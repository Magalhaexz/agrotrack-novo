import { useMemo, useState } from 'react';
import Input from '../components/ui/Input';
import Modal from '../components/ui/Modal';
import Button from '../components/ui/Button';
import { useAuth } from '../auth/useAuth';
import { useToast } from '../hooks/useToast';
import { getResumoLote } from '../domain/resumoLote';
import { calcLote } from '../utils/calculations';
import { gerarNovoId } from '../utils/id';
import { createOperationalRecord, updateOperationalRecord } from '../services/operationalPersistence';
import LoteCard from '../components/lotes/LoteCard';
import LoteDetailsPanel from '../components/lotes/LoteDetailsPanel';
import LotesFilters from '../components/lotes/LotesFilters';
import LotesPageHeader from '../components/lotes/LotesPageHeader';
import RetiradaAnimaisModal from '../components/lotes/RetiradaAnimaisModal';
import FechamentoLoteModal from '../components/lotes/FechamentoLoteModal';
import '../styles/rebanho.css';

function toNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function daysFrom(dateValue) {
  if (!dateValue) return 0;
  const ms = Date.now() - new Date(dateValue).getTime();
  return Math.max(0, Math.floor(ms / 86400000));
}

function calculateGmd30(pesagens = []) {
  const sorted = [...pesagens].sort((a, b) => new Date(a.data) - new Date(b.data));
  if (sorted.length < 2) return 0;
  const last = sorted[sorted.length - 1];
  const targetDate = new Date(last.data);
  targetDate.setDate(targetDate.getDate() - 30);

  let start = sorted[0];
  for (let i = sorted.length - 1; i >= 0; i -= 1) {
    if (new Date(sorted[i].data) <= targetDate) {
      start = sorted[i];
      break;
    }
  }

  const gain = toNumber(last.peso_medio) - toNumber(start.peso_medio);
  const days = Math.max(1, Math.round((new Date(last.data) - new Date(start.data)) / 86400000));
  return gain / days;
}

function normalizeStatus(lote) {
  const status = String(lote?.status || 'ativo').toLowerCase();
  return status;
}

const todayIso = new Date().toISOString().slice(0, 10);
const EMPTY_LIST = [];

export default function LotesPage({ db, setDb, onRegistrarSaidaAnimal, session }) {
  const { hasPermission } = useAuth();
  const { showToast } = useToast();
  const [filters, setFilters] = useState({ status: 'todos', fazenda: 'todas', periodo: 'todos', busca: '' });
  const [selectedLoteId, setSelectedLoteId] = useState(null);
  const [activeTab, setActiveTab] = useState('visao_geral');
  const [openRetirada, setOpenRetirada] = useState(false);
  const [openFechamento, setOpenFechamento] = useState(false);
  const [openPesagem, setOpenPesagem] = useState(false);
  const [openNovoLote, setOpenNovoLote] = useState(false);
  const lotes = Array.isArray(db?.lotes) ? db.lotes : EMPTY_LIST;
  const fazendas = Array.isArray(db?.fazendas) ? db.fazendas : EMPTY_LIST;
  const pesagens = Array.isArray(db?.pesagens) ? db.pesagens : EMPTY_LIST;
  const animais = Array.isArray(db?.animais) ? db.animais : EMPTY_LIST;
  const sanitarios = Array.isArray(db?.sanitario) ? db.sanitario : EMPTY_LIST;
  const movAnimais = Array.isArray(db?.movimentacoes_animais) ? db.movimentacoes_animais : EMPTY_LIST;
  const movFinanceiros = Array.isArray(db?.movimentacoes_financeiras) ? db.movimentacoes_financeiras : EMPTY_LIST;

  const lotesEnriquecidos = useMemo(() => lotes.map((lote) => {
    const lotePesagens = pesagens.filter((item) => Number(item.lote_id) === Number(lote.id));
    const latestPesagem = [...lotePesagens].sort((a, b) => new Date(b.data) - new Date(a.data))[0];
    const resumo = getResumoLote(db, lote.id);
    const indicators = calcLote(db, lote.id);
    const pesoAtual = toNumber(lote.p_at || latestPesagem?.peso_medio || indicators.pesoAtualMedio);
    const heads = toNumber(lote.qtd || resumo.totalAnimais || indicators.totalAnimais);
    const progressoPeso = indicators.pesoInicialMedio > 0
      ? ((indicators.pesoAtualMedio - indicators.pesoInicialMedio) / Math.max(1, toNumber(lote.peso_alvo || indicators.pesoInicialMedio) - indicators.pesoInicialMedio)) * 100
      : 0;
    const fazendaNome = fazendas.find((f) => Number(f.id) === Number(lote.faz_id))?.nome || '—';
    return {
      ...lote,
      status: normalizeStatus(lote),
      pesoAtual,
      heads,
      resumo,
      progressoPeso,
      ultimaPesagem: latestPesagem?.data || null,
      gmd30: calculateGmd30(lotePesagens),
      fazendaNome,
      bloqueado: ['encerrado', 'vendido'].includes(normalizeStatus(lote)),
    };
  }), [db, lotes, pesagens, fazendas]);

  const lotesFiltrados = useMemo(() => lotesEnriquecidos.filter((lote) => {
    if (filters.status !== 'todos' && lote.status !== filters.status) return false;
    if (filters.fazenda !== 'todas' && Number(lote.faz_id) !== Number(filters.fazenda)) return false;
    if (filters.periodo === '30d' && daysFrom(lote.entrada) > 30) return false;
    if (filters.periodo === '90d' && daysFrom(lote.entrada) > 90) return false;
    if (String(filters.busca || '').trim()) {
      const termo = String(filters.busca).trim().toLowerCase();
      const alvo = `${lote?.nome || ''} ${lote?.fazendaNome || ''}`.toLowerCase();
      if (!alvo.includes(termo)) return false;
    }
    return true;
  }), [filters, lotesEnriquecidos]);

  const selectedLote = useMemo(
    () => lotesEnriquecidos.find((lote) => Number(lote.id) === Number(selectedLoteId)) || null,
    [lotesEnriquecidos, selectedLoteId]
  );

  function updateFilter(field, value) {
    setFilters((prev) => ({ ...prev, [field]: value }));
  }

  function ensurePermission(permission) {
    if (hasPermission(permission)) return true;
    showToast({ type: 'error', message: 'Você não tem permissão para executar esta ação.' });
    return false;
  }

  function handleRetirada(payload) {
    if (!ensurePermission('animais:movimentar')) return;
    if (!selectedLote) return;
    if (selectedLote.bloqueado) {
      showToast({ type: 'warning', message: 'Lote encerrado ou vendido não aceita novas retiradas.' });
      return;
    }

    try {
      onRegistrarSaidaAnimal(payload);
      setOpenRetirada(false);
      showToast({ type: 'success', message: 'Retirada registrada com sucesso.' });
    } catch (error) {
      showToast({ type: 'error', message: error?.message || 'Falha ao registrar retirada.' });
    }
  }

  async function handleFechamento({ data, status, motivo }) {
    if (!ensurePermission('lotes:editar')) return;
    if (!selectedLote) return;

    const loteId = selectedLote.id;
    const patch = {
      status,
      data_encerramento: data,
      data_venda: status === 'vendido' ? data : null,
      motivo_encerramento: motivo,
    };

    setDb((prev) => ({
      ...prev,
      lotes: (prev.lotes || []).map((l) => (Number(l.id) === Number(loteId) ? { ...l, ...patch } : l)),
    }));

    const persisted = await updateOperationalRecord('lotes', loteId, patch, session);
    if (!persisted?.persisted) {
      showToast({ type: 'warning', message: 'Lote encerrado localmente. Sincronização pendente.' });
    } else {
      showToast({ type: 'success', message: 'Lote encerrado com sucesso.' });
    }

    setOpenFechamento(false);
  }

  async function handleSalvarPesagem({ data, pesoMedio, observacao }) {
    if (!ensurePermission('pesagens:editar')) return;
    if (!selectedLote) return;
    if (selectedLote.bloqueado) {
      showToast({ type: 'warning', message: 'Lote encerrado ou vendido não aceita nova pesagem.' });
      return;
    }

    const novoRegistro = {
      id: gerarNovoId(pesagens),
      lote_id: selectedLote.id,
      data,
      peso_medio: Number(pesoMedio),
      observacao: observacao || '',
    };

    setDb((prev) => ({
      ...prev,
      pesagens: [...(prev.pesagens || []), novoRegistro],
      lotes: (prev.lotes || []).map((l) => (
        Number(l.id) === Number(selectedLote.id)
          ? { ...l, p_at: Number(pesoMedio), ultima_pesagem: data }
          : l
      )),
    }));

    const pesagemCloud = await createOperationalRecord('pesagens', { ...novoRegistro, id: undefined }, session);
    await updateOperationalRecord('lotes', selectedLote.id, { p_at: Number(pesoMedio), ultima_pesagem: data }, session);

    if (!pesagemCloud?.persisted) {
      showToast({ type: 'warning', message: 'Pesagem salva localmente. Sincronização pendente.' });
    } else {
      showToast({ type: 'success', message: 'Pesagem registrada com sucesso.' });
    }

    setOpenPesagem(false);
  }

  async function handleNovoLote(payload) {
    if (!ensurePermission('lotes:editar')) return;

    const novoLote = {
      id: gerarNovoId(lotes),
      status: 'ativo',
      sistema: payload.sistema || 'confinamento',
      tipo: payload.tipo || 'confinamento',
      tem_recria: false,
      dias_recria: 0,
      tem_engorda: true,
      dias_engorda: 120,
      gmd_meta: toNumber(payload.gmd_meta),
      investimento: toNumber(payload.investimento),
      preco_arroba: toNumber(payload.preco_arroba),
      rendimento_carcaca: toNumber(payload.rendimento_carcaca),
      ...payload,
    };

    setDb((prev) => ({ ...prev, lotes: [...(prev.lotes || []), novoLote] }));
    const persisted = await createOperationalRecord('lotes', { ...novoLote, id: undefined }, session);

    if (!persisted?.persisted) {
      showToast({ type: 'warning', message: 'Lote criado localmente. Sincronização pendente.' });
    } else {
      showToast({ type: 'success', message: 'Lote criado com sucesso.' });
    }

    setOpenNovoLote(false);
  }

  if (selectedLote) {
    const lotePesagens = pesagens.filter((item) => Number(item.lote_id) === Number(selectedLote.id));
    const loteAnimais = animais.filter((item) => Number(item.lote_id) === Number(selectedLote.id));
    const loteRetiradas = movAnimais.filter((item) => Number(item.lote_id) === Number(selectedLote.id) && ['venda', 'morte', 'descarte', 'transferencia_saida', 'abate', 'outro'].includes(String(item.tipo || '').toLowerCase()));
    const loteSanitario = sanitarios.filter((item) => Number(item.lote_id) === Number(selectedLote.id));
    const loteFinanceiro = movFinanceiros.filter((item) => Number(item.lote_id) === Number(selectedLote.id));
    const historico = [
      ...lotePesagens.map((item) => ({ ...item, key: `pesagem-${item.id}`, tipo: 'pesagem' })),
      ...movAnimais.filter((item) => Number(item.lote_id) === Number(selectedLote.id)).map((item) => ({ ...item, key: `mov-${item.id}` })),
    ].sort((a, b) => new Date(b.data) - new Date(a.data));

    const consumoNutricao = selectedLote.heads * (selectedLote.pesoAtual * (toNumber(selectedLote.supl_pv_pct) / 100));

    return (
      <>
        <LoteDetailsPanel
          lote={selectedLote}
          resumo={selectedLote.resumo}
          activeTab={activeTab}
          onChangeTab={setActiveTab}
          onBack={() => setSelectedLoteId(null)}
          canMove={hasPermission('animais:movimentar')}
          canEdit={hasPermission('lotes:editar')}
          canEditPesagem={hasPermission('pesagens:editar')}
          onNovaRetirada={() => setOpenRetirada(true)}
          onNovaPesagem={() => setOpenPesagem(true)}
          onEncerrar={() => setOpenFechamento(true)}
          animais={loteAnimais}
          pesagens={lotePesagens}
          retiradas={loteRetiradas}
          sanitarios={loteSanitario}
          financeiros={loteFinanceiro}
          historico={historico}
          consumoNutricao={consumoNutricao}
        />

        <RetiradaAnimaisModal
          open={openRetirada}
          lote={selectedLote}
          maxCabecas={selectedLote.heads}
          onClose={() => setOpenRetirada(false)}
          onSubmit={handleRetirada}
        />

        <FechamentoLoteModal
          open={openFechamento}
          lote={selectedLote}
          onClose={() => setOpenFechamento(false)}
          onSubmit={handleFechamento}
        />

        <PesagemModal
          open={openPesagem}
          lote={selectedLote}
          onClose={() => setOpenPesagem(false)}
          onSubmit={handleSalvarPesagem}
        />
      </>
    );
  }

  return (
    <div className="rebanho-page">
      <LotesPageHeader
        canEdit={hasPermission('lotes:editar')}
        onNovoLote={() => setOpenNovoLote(true)}
      />

      <LotesFilters
        filters={filters}
        fazendas={fazendas}
        onChange={updateFilter}
      />

      <div className="lote-cards-grid">
        {lotesFiltrados.length === 0 ? (
          <div className="empty-state">
            <strong>Nenhum lote encontrado.</strong>
            <span>Ajuste os filtros ou cadastre um novo lote para continuar.</span>
          </div>
        ) : lotesFiltrados.map((lote) => (
          <LoteCard
            key={lote.id}
            lote={lote}
            canMove={hasPermission('animais:movimentar')}
            canEdit={hasPermission('lotes:editar')}
            onOpen={() => {
              setActiveTab('visao_geral');
              setSelectedLoteId(lote.id);
            }}
            onRetirada={() => {
              setActiveTab('retiradas');
              setSelectedLoteId(lote.id);
              setOpenRetirada(true);
            }}
            onEncerrar={() => {
              setSelectedLoteId(lote.id);
              setOpenFechamento(true);
            }}
          />
        ))}
      </div>

      <NovoLoteModal
        open={openNovoLote}
        fazendas={fazendas}
        onClose={() => setOpenNovoLote(false)}
        onSubmit={handleNovoLote}
      />
    </div>
  );
}

function PesagemModal({ open, lote, onClose, onSubmit }) {
  const [data, setData] = useState(todayIso);
  const [pesoMedio, setPesoMedio] = useState('');
  const [observacao, setObservacao] = useState('');
  const [error, setError] = useState('');

  function handleSave() {
    setError('');
    if (!data) return setError('Informe a data da pesagem.');
    if (!Number(pesoMedio)) return setError('Informe o peso médio.');
    onSubmit({ data, pesoMedio, observacao });
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Nova pesagem"
      subtitle={`Lote ${lote?.nome || ''}`}
      footer={(
        <>
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleSave}>Salvar pesagem</Button>
        </>
      )}
    >
      <div className="form-grid">
        <Input type="date" label="Data" value={data} onChange={(e) => setData(e.target.value)} />
        <Input type="number" label="Peso médio (kg)" value={pesoMedio} onChange={(e) => setPesoMedio(e.target.value)} />
        <Input as="textarea" label="Observação" value={observacao} onChange={(e) => setObservacao(e.target.value)} />
      </div>
      {error ? <p className="err">{error}</p> : null}
    </Modal>
  );
}

function NovoLoteModal({ open, onClose, onSubmit, fazendas }) {
  const [form, setForm] = useState({
    nome: '',
    faz_id: '',
    entrada: todayIso,
    saida: '',
    qtd: '',
    p_at: '',
    gmd_meta: '',
    investimento: '',
    preco_arroba: '',
    rendimento_carcaca: '52',
  });
  const [error, setError] = useState('');

  function updateField(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  function handleSave() {
    setError('');
    if (!form.nome.trim()) return setError('Informe o nome do lote.');
    if (!Number(form.faz_id)) return setError('Selecione a fazenda.');
    if (!form.entrada) return setError('Informe a data de entrada.');

    onSubmit({
      ...form,
      nome: form.nome.trim(),
      faz_id: Number(form.faz_id),
      qtd: Number(form.qtd || 0),
      p_at: Number(form.p_at || 0),
    });
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Novo lote"
      subtitle="Cadastro rápido para operação"
      footer={(
        <>
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleSave}>Criar lote</Button>
        </>
      )}
    >
      <div className="form-grid two">
        <Input className="full" label="Nome" value={form.nome} onChange={(e) => updateField('nome', e.target.value)} />
        <Input as="select" label="Fazenda" value={form.faz_id} onChange={(e) => updateField('faz_id', e.target.value)}>
          <option value="">Selecione</option>
          {fazendas.map((fazenda) => <option key={fazenda.id} value={String(fazenda.id)}>{fazenda.nome}</option>)}
        </Input>
        <Input type="date" label="Entrada" value={form.entrada} onChange={(e) => updateField('entrada', e.target.value)} />
        <Input type="date" label="Saída prevista" value={form.saida} onChange={(e) => updateField('saida', e.target.value)} />
        <Input type="number" label="Cabeças" value={form.qtd} onChange={(e) => updateField('qtd', e.target.value)} />
        <Input type="number" label="Peso médio inicial (kg)" value={form.p_at} onChange={(e) => updateField('p_at', e.target.value)} />
        <Input type="number" label="Meta GMD (kg/dia)" value={form.gmd_meta} onChange={(e) => updateField('gmd_meta', e.target.value)} />
        <Input type="number" label="Investimento (R$)" value={form.investimento} onChange={(e) => updateField('investimento', e.target.value)} />
        <Input type="number" label="Preço da arroba (R$)" value={form.preco_arroba} onChange={(e) => updateField('preco_arroba', e.target.value)} />
        <Input type="number" label="Rendimento de carcaça (%)" value={form.rendimento_carcaca} onChange={(e) => updateField('rendimento_carcaca', e.target.value)} />
      </div>
      {error ? <p className="err">{error}</p> : null}
    </Modal>
  );
}
