import { useMemo, useState } from 'react';
import { Plus } from 'lucide-react';
import AnimalForm from '../components/AnimalForm';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import Table from '../components/ui/Table';
import { TIPOS_SAIDA_ANIMAL } from '../utils/constantes';
import { formatarData, formatarNumero } from '../utils/formatters';
import { gerarNovoId } from '../utils/id';
import { useAuth } from '../auth/useAuth';
import { useToast } from '../hooks/useToast';
import { createOperationalRecord, deleteOperationalRecord, updateOperationalRecord } from '../services/operationalPersistence';

export default function AnimaisPage({ db, setDb, onConfirmAction }) {
  const { hasPermission, session } = useAuth();
  const { showToast } = useToast();
  const [abrirForm, setAbrirForm] = useState(false);
  const [animalEditando, setAnimalEditando] = useState(null);
  const [abaAtiva, setAbaAtiva] = useState('grupos');
  const [mostrarCadastro, setMostrarCadastro] = useState(false);

  const lotes = useMemo(() => (Array.isArray(db?.lotes) ? db.lotes : []), [db]);
  const animais = useMemo(() => (Array.isArray(db?.animais) ? db.animais : []), [db]);
  const movimentacoes = useMemo(() => (Array.isArray(db?.movimentacoes_animais) ? db.movimentacoes_animais : []), [db]);
  const lotesMap = useMemo(() => new Map(lotes.map((lote) => [Number(lote.id), lote])), [lotes]);

  const dadosTabela = useMemo(() => animais.map((animal) => ({ ...animal, loteNome: lotesMap.get(Number(animal.lote_id))?.nome || '-', tipoRegistro: animal.tipo_registro || (Number(animal.qtd || 0) === 1 && animal.identificacao ? 'individual' : 'grupo'), identificacao: animal.identificacao || 'Animal', status: animal.status || 'ativo' })), [animais, lotesMap]);
  const grupos = useMemo(() => dadosTabela.filter((item) => item.tipoRegistro !== 'individual'), [dadosTabela]);
  const individuais = useMemo(() => dadosTabela.filter((item) => item.tipoRegistro === 'individual'), [dadosTabela]);

  const historicoSaidas = useMemo(() => movimentacoes.filter((m) => Object.keys(TIPOS_SAIDA_ANIMAL).includes(m.tipo)).map((m) => ({ ...m, loteNome: lotesMap.get(Number(m.lote_id))?.nome || '-' })).sort((a, b) => new Date(b.data) - new Date(a.data)), [movimentacoes, lotesMap]);

  const resumo = useMemo(() => ({ totalCabecas: animais.reduce((acc, item) => acc + Number(item.qtd || 0), 0), grupos: grupos.length, individuais: individuais.length, lotesCobertos: new Set(animais.map((animal) => Number(animal.lote_id)).filter(Boolean)).size }), [animais, grupos.length, individuais.length]);

  function abrirNovo() { if (!hasPermission('animais:editar')) return; setMostrarCadastro(true); }
  function abrirNovoPorModo(modo) { setMostrarCadastro(false); setAnimalEditando({ tipo_registro: modo }); setAbrirForm(true); }
  function editarAnimal(animal) { if (!hasPermission('animais:editar')) return; setAnimalEditando(animal); setAbrirForm(true); }

  async function excluirAnimal(id) {
    if (!hasPermission('animais:excluir')) return;
    const confirmado = typeof onConfirmAction === 'function' ? await onConfirmAction({ title: 'Excluir registro de animais', message: 'Deseja excluir este registro de animais?', tone: 'danger' }) : window.confirm('Deseja excluir este registro de animais?');
    if (!confirmado) return;
    await deleteOperationalRecord('animais', id, session);
    setDb((prev) => ({ ...prev, animais: (prev.animais || []).filter((animal) => animal.id !== id) }));
  }

  async function salvarAnimal(dados) {
    if (animalEditando?.id) {
      const persisted = await updateOperationalRecord('animais', animalEditando.id, dados, session);
      setDb((prev) => ({ ...prev, animais: (prev.animais || []).map((animal) => (animal.id === animalEditando.id ? { ...animal, ...(persisted.data || dados) } : animal)) }));
      if (persisted.syncStatus === 'cloud_success') showToast({ type: 'success', message: 'Animal atualizado na nuvem.' });
      else showToast({ type: 'warning', message: 'Alteração salva localmente. Sincronização pendente.' });
    } else {
      const localId = gerarNovoId(animais);
      const dadosComId = { ...dados, id: localId, metadata: { ...(dados.metadata || {}), local_id: localId } };
      const persisted = await createOperationalRecord('animais', dadosComId, session);
      const incoming = persisted.data || dadosComId;
      setDb((prev) => ({ ...prev, animais: [...(prev.animais || []), incoming] }));
      if (persisted.syncStatus === 'cloud_success') showToast({ type: 'success', message: 'Animal salvo na nuvem.' });
      else showToast({ type: 'warning', message: 'Animal salvo localmente. Sincronização pendente.' });
    }
    setAbrirForm(false);
    setAnimalEditando(null);
  }

  const listaAtiva = abaAtiva === 'grupos' ? grupos : individuais;

  const colunasAnimais = [
    { key: 'identificacao', label: 'Identificação/Lote', render: (animal) => `${animal.identificacao} / ${animal.loteNome}` },
    { key: 'fazenda', label: 'Fazenda/Lote', render: (animal) => `${lotesMap.get(Number(animal.lote_id))?.fazenda || '-'} / ${animal.loteNome}` },
    { key: 'qtd', label: 'Quantidade' },
    { key: 'p_ini', label: 'Peso inicial', render: (animal) => `${formatarNumero(animal.p_ini)} kg` },
    { key: 'p_at', label: 'Peso atual', render: (animal) => `${formatarNumero(animal.p_at)} kg` },
    { key: 'status', label: 'Status' },
    {
      key: 'acoes',
      label: 'Ações',
      render: (animal) => (
        <div className="row-actions">
          <button className="action-btn" onClick={() => editarAnimal(animal)}>Editar</button>
          <button className="action-btn action-btn-danger" onClick={() => excluirAnimal(animal.id)}>Excluir</button>
        </div>
      ),
    },
  ];

  const colunasMovimentacoes = [
    { key: 'data', label: 'Data', render: (m) => formatarData(m.data) },
    { key: 'tipo', label: 'Tipo', render: (m) => normalizarSaida(m.tipo) },
    { key: 'loteNome', label: 'Lote' },
    { key: 'qtd', label: 'Quantidade' },
    { key: 'observacao', label: 'Observação', render: (m) => m.observacao || '-' },
  ];

  return <div className="page animais-page">
    <section className="animais-hero"><div><h1>Animais</h1><p>Cadastro organizado para grupos, individuais e movimentações.</p></div><div className="page-actions"><Button size="sm" variant="primary" icon={<Plus size={16} />} onClick={abrirNovo}>Novo cadastro</Button></div></section>

    <div className="dashboard-grid dashboard-grid--kpi-main">
    <Card title="Total de cabeças"><div className="animais-kpi-value">{resumo.totalCabecas}</div></Card>
      <Card title="Grupos de animais"><div className="animais-kpi-value">{resumo.grupos}</div></Card>
      <Card title="Animais individuais"><div className="animais-kpi-value">{resumo.individuais}</div></Card>
      <Card title="Lotes vinculados"><div className="animais-kpi-value">{resumo.lotesCobertos}</div></Card>
    </div>

    <Card title="Cadastros" subtitle="Visualização simplificada.">
      <div className="segmented-control" role="tablist" aria-label="Abas de animais">
        <button type="button" className={`segment ${abaAtiva === 'grupos' ? 'active' : ''}`} onClick={() => setAbaAtiva('grupos')}>Grupos</button>
        <button type="button" className={`segment ${abaAtiva === 'individuais' ? 'active' : ''}`} onClick={() => setAbaAtiva('individuais')}>Individuais</button>
        <button type="button" className={`segment ${abaAtiva === 'movimentacoes' ? 'active' : ''}`} onClick={() => setAbaAtiva('movimentacoes')}>Movimentações</button>
      </div>
      {abaAtiva !== 'movimentacoes' && listaAtiva.length > 0 && (
        <Table columns={colunasAnimais} rows={listaAtiva} mobileTitleKey="identificacao" mobileSubtitleKey="loteNome" />
      )}
      {abaAtiva === 'grupos' && grupos.length === 0 && <div className="animais-empty-state"><strong>Nenhum grupo cadastrado.</strong><Button size="sm" variant="primary" onClick={() => abrirNovoPorModo('grupo')}>Cadastrar grupo</Button></div>}
      {abaAtiva === 'individuais' && individuais.length === 0 && <div className="animais-empty-state"><strong>Nenhum animal individual cadastrado.</strong></div>}
      {abaAtiva === 'movimentacoes' && (historicoSaidas.length ? (
        <Table columns={colunasMovimentacoes} rows={historicoSaidas} mobileTitleKey="loteNome" mobileSubtitleKey={(m) => formatarData(m.data)} />
      ) : <div className="animais-empty-state"><strong>Nenhuma movimentação registrada.</strong></div>)}
    </Card>

    {mostrarCadastro && <Card title="O que você quer cadastrar?"><div className="animais-mode-actions"><Button variant="primary" onClick={() => abrirNovoPorModo('grupo')}>Grupo de animais</Button><p>Use para cadastrar várias cabeças juntas em um lote.</p></div><div className="animais-mode-actions"><Button variant="primary" onClick={() => abrirNovoPorModo('individual')}>Animal individual</Button><p>Use para acompanhar um animal específico.</p></div></Card>}

    {abrirForm && <AnimalForm initialData={animalEditando} lotes={lotes} onSave={salvarAnimal} onCancel={() => { setAbrirForm(false); setAnimalEditando(null); }} />}
  </div>;
}

function normalizarSaida(tipo) { return TIPOS_SAIDA_ANIMAL[tipo] || tipo || '-'; }
