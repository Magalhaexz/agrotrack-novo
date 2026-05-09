import { useMemo, useState } from 'react';
import { Plus } from 'lucide-react';
import AnimalForm from '../components/AnimalForm';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import { TIPOS_SAIDA_ANIMAL } from '../utils/constantes';
import { formatarData, formatarNumero } from '../utils/formatters';
import { gerarNovoId } from '../utils/id';
import { useAuth } from '../auth/useAuth';
import { createOperationalRecord, deleteOperationalRecord, updateOperationalRecord } from '../services/operationalPersistence';

export default function AnimaisPage({ db, setDb, onConfirmAction }) {
  const { hasPermission, session } = useAuth();
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
    if (animalEditando) {
      const persisted = await updateOperationalRecord('animais', animalEditando.id, dados, session);
      setDb((prev) => ({ ...prev, animais: (prev.animais || []).map((animal) => (animal.id === animalEditando.id ? { ...animal, ...(persisted.data || dados) } : animal)) }));
    } else {
      const persisted = await createOperationalRecord('animais', dados, session);
      setDb((prev) => ({ ...prev, animais: [...(prev.animais || []), persisted.data || { id: gerarNovoId(prev.animais || []), ...dados }] }));
    }
    setAbrirForm(false);
    setAnimalEditando(null);
  }

  const listaAtiva = abaAtiva === 'grupos' ? grupos : individuais;

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
      {abaAtiva !== 'movimentacoes' && listaAtiva.length > 0 && (<div className="table-responsive"><table className="data-table"><thead><tr><th>Identificação/Lote</th><th>Fazenda/Lote</th><th>Quantidade</th><th>Peso inicial</th><th>Peso atual</th><th>Status</th><th>Ações</th></tr></thead><tbody>{listaAtiva.map((animal) => <tr key={animal.id}><td>{animal.identificacao} / {animal.loteNome}</td><td>{lotesMap.get(Number(animal.lote_id))?.fazenda || '-'} / {animal.loteNome}</td><td>{animal.qtd}</td><td>{formatarNumero(animal.p_ini)} kg</td><td>{formatarNumero(animal.p_at)} kg</td><td>{animal.status}</td><td><div className="row-actions"><button className="action-btn" onClick={() => editarAnimal(animal)}>Editar</button><button className="action-btn action-btn-danger" onClick={() => excluirAnimal(animal.id)}>Excluir</button></div></td></tr>)}</tbody></table></div>)}
      {abaAtiva === 'grupos' && grupos.length === 0 && <div className="animais-empty-state"><strong>Nenhum grupo cadastrado.</strong><Button size="sm" variant="primary" onClick={() => abrirNovoPorModo('grupo')}>Cadastrar grupo</Button></div>}
      {abaAtiva === 'individuais' && individuais.length === 0 && <div className="animais-empty-state"><strong>Nenhum animal individual cadastrado.</strong></div>}
      {abaAtiva === 'movimentacoes' && (historicoSaidas.length ? <div className="table-responsive"><table className="data-table"><thead><tr><th>Data</th><th>Tipo</th><th>Lote</th><th>Quantidade</th><th>Observação</th></tr></thead><tbody>{historicoSaidas.map((m) => <tr key={m.id}><td>{formatarData(m.data)}</td><td>{normalizarSaida(m.tipo)}</td><td>{m.loteNome}</td><td>{m.qtd}</td><td>{m.observacao || '-'}</td></tr>)}</tbody></table></div> : <div className="animais-empty-state"><strong>Nenhuma movimentação registrada.</strong></div>)}
    </Card>

    {mostrarCadastro && <Card title="O que você quer cadastrar?"><div className="animais-mode-actions"><Button variant="primary" onClick={() => abrirNovoPorModo('grupo')}>Grupo de animais</Button><p>Use para cadastrar várias cabeças juntas em um lote.</p></div><div className="animais-mode-actions"><Button variant="primary" onClick={() => abrirNovoPorModo('individual')}>Animal individual</Button><p>Use para acompanhar um animal específico.</p></div></Card>}

    {abrirForm && <AnimalForm initialData={animalEditando} lotes={lotes} onSave={salvarAnimal} onCancel={() => { setAbrirForm(false); setAnimalEditando(null); }} />}
  </div>;
}

function normalizarSaida(tipo) { return TIPOS_SAIDA_ANIMAL[tipo] || tipo || '-'; }
