import { useMemo, useState } from 'react';
import Input from '../components/ui/Input';
import Modal from '../components/ui/Modal';
import Button from '../components/ui/Button';
import LoteForm from '../components/LoteForm';
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

function calculateDailyPlannedConsumption(lote, heads, pesoAtual) {
  const consumoTipo = String(lote?.consumo_tipo || '').toLowerCase();
  const consumoInformado = toNumber(lote?.consumo_por_cabeca_dia);

  if (consumoTipo === 'kg_cab_dia' && consumoInformado > 0 && heads > 0) {
    return heads * consumoInformado;
  }

  if (toNumber(lote?.consumo_total_estimado) > 0 && toNumber(lote?.dias_estimados) > 0) {
    return toNumber(lote.consumo_total_estimado) / toNumber(lote.dias_estimados);
  }

  const percentualPv = consumoTipo === 'percentual_pv'
    ? consumoInformado
    : toNumber(lote?.supl_pv_pct);
  return heads * (pesoAtual * (percentualPv / 100));
}

function normalizeStatus(lote) {
  const status = String(lote?.status || 'ativo').toLowerCase();
  return status;
}

const todayIso = new Date().toISOString().slice(0, 10);
const EMPTY_LIST = [];
const LABEL_OR_DASH = '—';

function resolvePastagemNome(pastagensMap, lote) {
  const byId = lote?.pastagem_id ? pastagensMap.get(Number(lote.pastagem_id)) : null;
  return byId?.nome || lote?.pastagem_nome || lote?.pastagemAtualNome || LABEL_OR_DASH;
}

export default function LotesPage({ db, setDb, onRegistrarSaidaAnimal, session }) {
  const { hasPermission } = useAuth();
  const { showToast } = useToast();
  const [filters, setFilters] = useState({ status: 'todos', fazenda: 'todas', periodo: 'todos', busca: '' });
  const [selectedLoteId, setSelectedLoteId] = useState(null);
  const [activeTab, setActiveTab] = useState('visao_geral');
  const [openRetirada, setOpenRetirada] = useState(false);
  const [retiradaModo, setRetiradaModo] = useState('sale_partial');
  const [openFechamento, setOpenFechamento] = useState(false);
  const [openPesagem, setOpenPesagem] = useState(false);
  const [openNovoLote, setOpenNovoLote] = useState(false);
  const [loteEmEdicao, setLoteEmEdicao] = useState(null);
  const lotes = Array.isArray(db?.lotes) ? db.lotes : EMPTY_LIST;
  const fazendas = Array.isArray(db?.fazendas) ? db.fazendas : EMPTY_LIST;
  const pastagens = Array.isArray(db?.pastagens) ? db.pastagens : EMPTY_LIST;
  const pesagens = Array.isArray(db?.pesagens) ? db.pesagens : EMPTY_LIST;
  const animais = Array.isArray(db?.animais) ? db.animais : EMPTY_LIST;
  const sanitarios = Array.isArray(db?.sanitario) ? db.sanitario : EMPTY_LIST;
  const movAnimais = Array.isArray(db?.movimentacoes_animais) ? db.movimentacoes_animais : EMPTY_LIST;
  const movFinanceiros = Array.isArray(db?.movimentacoes_financeiras) ? db.movimentacoes_financeiras : EMPTY_LIST;
  const pastagensMap = useMemo(() => new Map(pastagens.map((item) => [Number(item.id), item])), [pastagens]);

  const lotesEnriquecidos = useMemo(() => lotes.map((lote) => {
    const lotePesagens = pesagens.filter((item) => Number(item.lote_id) === Number(lote.id));
    const latestPesagem = [...lotePesagens].sort((a, b) => new Date(b.data) - new Date(a.data))[0];
    const resumo = getResumoLote(db, lote.id);
    const indicators = calcLote(db, lote.id);
    const pesoInicialPlanejado = toNumber(lote.p_ini || indicators.pesoInicialMedio);
    const pesoAtual = toNumber(lote.p_at || latestPesagem?.peso_medio || indicators.pesoAtualMedio || lote.p_ini);
    const heads = toNumber(lote.qtd || resumo.totalAnimais || indicators.totalAnimais);
    const progressoPeso = pesoInicialPlanejado > 0
      ? ((pesoAtual - pesoInicialPlanejado) / Math.max(1, toNumber(lote.peso_alvo || pesoInicialPlanejado) - pesoInicialPlanejado)) * 100
      : 0;
    const fazendaNome = fazendas.find((f) => Number(f.id) === Number(lote.faz_id))?.nome || '—';
    const pastagemNome = resolvePastagemNome(pastagensMap, lote);
    const categoriaAnimal = String(lote.categoria_animal || lote.categoria || '').trim() || LABEL_OR_DASH;
    const raca = String(lote.raca || lote.raca_animal || lote.gen || '').trim() || LABEL_OR_DASH;
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
      pastagemNome,
      categoriaAnimal,
      raca,
      bloqueado: ['encerrado', 'vendido'].includes(normalizeStatus(lote)),
    };
  }), [db, lotes, pesagens, fazendas, pastagensMap]);

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

  function abrirRetirada(modo) {
    setRetiradaModo(modo);
    setOpenRetirada(true);
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
      setRetiradaModo('sale_partial');
      const mensagens = {
        sale_partial: 'Venda parcial registrada com sucesso.',
        death_loss: 'Morte/perda registrada com sucesso.',
        exit: 'Saída do lote registrada com sucesso.',
      };
      showToast({ type: 'success', message: mensagens[retiradaModo] || 'Retirada registrada com sucesso.' });
    } catch (error) {
      showToast({ type: 'error', message: error?.message || 'Falha ao registrar movimentação do lote.' });
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
      showToast({ type: 'warning', message: 'Lote encerrado com sucesso.' });
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
      showToast({ type: 'warning', message: 'Pesagem salva com sucesso.' });
    } else {
      showToast({ type: 'success', message: 'Pesagem registrada com sucesso.' });
    }

    setOpenPesagem(false);
  }

  async function handleNovoLote(payload) {
    if (!ensurePermission('lotes:editar')) return;

    const patch = {
      ...payload,
      pastagem_id: payload.pastagem_id ?? null,
      categoria_animal: payload.categoria_animal || '',
      raca: payload.raca || '',
      sistema: payload.sistema || 'confinamento',
      tipo: payload.tipo || 'confinamento',
      tem_recria: false,
      dias_recria: 0,
      tem_engorda: true,
      dias_engorda: toNumber(payload.dias_estimados || payload.dias_engorda),
      gmd_meta: toNumber(payload.gmd_meta),
      investimento: toNumber(payload.investimento),
      preco_arroba: toNumber(payload.preco_arroba),
      rendimento_carcaca: toNumber(payload.rendimento_carcaca),
      qtd: toNumber(payload.qtd),
      p_ini: toNumber(payload.p_ini),
      p_at: toNumber(payload.p_at || payload.p_ini),
      peso_alvo: toNumber(payload.peso_alvo),
      dias_estimados: toNumber(payload.dias_estimados),
      consumo_tipo: payload.consumo_tipo || 'percentual_pv',
      consumo_por_cabeca_dia: toNumber(payload.consumo_por_cabeca_dia),
      consumo_total_estimado: toNumber(payload.consumo_total_estimado),
      custo_total_estimado: toNumber(payload.custo_total_estimado),
      preco_kg: toNumber(payload.preco_kg || payload.supl_rkg),
      supl_nome: payload.supl_nome || '',
      supl_rkg: toNumber(payload.supl_rkg || payload.preco_kg),
      supl_pv_pct: toNumber(payload.supl_pv_pct),
      supl_meta_dias: toNumber(payload.supl_meta_dias || payload.dias_estimados),
    };

    if (loteEmEdicao) {
      const loteId = loteEmEdicao.id;
      setDb((prev) => ({
        ...prev,
        lotes: (prev.lotes || []).map((l) => (Number(l.id) === Number(loteId) ? { ...l, ...patch } : l)),
      }));

      const persisted = await updateOperationalRecord('lotes', loteId, patch, session);
      if (!persisted?.persisted) {
        showToast({ type: 'warning', message: 'Lote atualizado com sucesso.' });
      } else {
        showToast({ type: 'success', message: 'Lote atualizado com sucesso.' });
      }

      setOpenNovoLote(false);
      setLoteEmEdicao(null);
      return;
    }

    const novoLote = {
      id: gerarNovoId(lotes),
      ...patch,
      status: 'ativo',
    };

    setDb((prev) => ({ ...prev, lotes: [...(prev.lotes || []), novoLote] }));
    const persisted = await createOperationalRecord('lotes', { ...novoLote, id: undefined }, session);

    if (!persisted?.persisted) {
      showToast({ type: 'warning', message: 'Lote criado com sucesso.' });
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

    const consumoNutricao = calculateDailyPlannedConsumption(selectedLote, selectedLote.heads, selectedLote.pesoAtual);

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
      onEdit={() => {
        setLoteEmEdicao(selectedLote);
        setOpenNovoLote(true);
      }}
      onRegistrarVendaParcial={() => abrirRetirada('sale_partial')}
      onRegistrarMorte={() => abrirRetirada('death_loss')}
      onRegistrarSaida={() => abrirRetirada('exit')}
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
          key={`${selectedLote?.id ?? 'lote'}-${retiradaModo}`}
          open={openRetirada}
          lote={selectedLote}
          maxCabecas={selectedLote.heads}
          modo={retiradaModo}
          onClose={() => {
            setOpenRetirada(false);
            setRetiradaModo('sale_partial');
          }}
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
        onNovoLote={() => {
          setLoteEmEdicao(null);
          setOpenNovoLote(true);
        }}
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
            onEdit={() => {
              setLoteEmEdicao(lote);
              setOpenNovoLote(true);
            }}
            onRegistrarVendaParcial={() => {
              setActiveTab('retiradas');
              setSelectedLoteId(lote.id);
              abrirRetirada('sale_partial');
            }}
            onRegistrarMorte={() => {
              setActiveTab('retiradas');
              setSelectedLoteId(lote.id);
              abrirRetirada('death_loss');
            }}
            onRegistrarSaida={() => {
              setActiveTab('retiradas');
              setSelectedLoteId(lote.id);
              abrirRetirada('exit');
            }}
            onEncerrar={() => {
              setSelectedLoteId(lote.id);
              setOpenFechamento(true);
            }}
          />
        ))}
      </div>

      {openNovoLote ? (
        <LoteForm
          key={loteEmEdicao?.id ?? 'novo-lote'}
          initialData={loteEmEdicao}
          fazendas={fazendas}
          pastagens={pastagens}
          onCancel={() => {
            setOpenNovoLote(false);
            setLoteEmEdicao(null);
          }}
          onSave={handleNovoLote}
        />
      ) : null}
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
