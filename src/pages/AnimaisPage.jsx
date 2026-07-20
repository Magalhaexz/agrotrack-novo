import { useMemo, useState } from 'react';
import { Plus } from 'lucide-react';
import AnimalForm from '../components/AnimalForm';
import AnimalMovementModal from '../components/AnimalMovementModal';
import Badge from '../components/ui/Badge';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import EmptyState from '../components/EmptyState';
import { TIPOS_SAIDA_ANIMAL } from '../utils/constantes';
import { formatarData, formatarNumero, formatarMoeda } from '../utils/formatters';
import { gerarNovoId } from '../utils/id';
import { useAuth } from '../auth/useAuth';
import { useToast } from '../hooks/useToast';
import {
  createOperationalRecord,
  deleteOperationalRecord,
  updateOperationalRecord,
} from '../services/operationalPersistence';
import { canCreateAnimal, getSubscriptionLimitMessage } from '../services/subscriptions';
import { isAnimalIndividualAtivo, registrarSaidaAnimalIndividual } from '../services/movimentacoes';

const MOVEMENT_LABELS = {
  criacao: 'Criação',
  venda: 'Venda',
  morte: 'Saída por morte',
  descarte: 'Saída por descarte',
  transferencia_saida: 'Saída por transferência',
  perda: 'Saída por perda',
  outro: 'Saída por outro motivo',
};

function normalizeIdKey(value) {
  if (value === undefined || value === null) return null;
  const text = String(value).trim();
  return text ? text : null;
}

function idsMatch(left, right) {
  const leftKey = normalizeIdKey(left);
  const rightKey = normalizeIdKey(right);
  return Boolean(leftKey && rightKey && leftKey === rightKey);
}

function isIndividualAnimalRecord(animal) {
  const tipoRegistro = String(animal?.tipo_registro || '').toLowerCase();
  if (tipoRegistro === 'individual') return true;
  return Number(animal?.qtd || 0) === 1 && Boolean(animal?.identificacao);
}

function isAnimalActive(animal) {
  return isAnimalIndividualAtivo(animal);
}

function getIndividualMovementRows(individuais, movimentacoes, lotesMap) {
  const movementRows = [];

  individuais.forEach((animal) => {
    const creationDate = animal?.data_referencia || animal?.data_entrada || animal?.created_at || null;
    movementRows.push({
      id: `criacao-${animal.id}`,
      animalId: animal.id,
      animalNome: animal.identificacao,
      loteNome: animal.loteNome,
      data: creationDate,
      tipo: 'criacao',
      motivo: 'Cadastro inicial',
      valor_total: null,
      obs: animal.observacao || '',
    });
  });

  movimentacoes.forEach((movimento) => {
    const metadata = movimento?.metadata || {};
    const animalId = metadata?.animal_id ?? metadata?.animal_local_id ?? null;
    const individualAnimal = individuais.find((animal) => (
      idsMatch(animal.id, animalId)
      || idsMatch(animal?.metadata?.local_id, animalId)
      || idsMatch(animal.identificacao, metadata?.animal_identificacao)
    ));

    if (!individualAnimal) return;

    movementRows.push({
      id: `mov-${movimento.id}`,
      animalId: individualAnimal.id,
      animalNome: individualAnimal.identificacao,
      loteNome: lotesMap.get(Number(movimento.lote_id))?.nome || individualAnimal.loteNome || '-',
      data: movimento.data,
      tipo: String(movimento.tipo || 'outro').toLowerCase(),
      motivo: metadata?.motivo || '',
      valor_total: movimento.valor_total ?? null,
      obs: movimento.obs || '',
    });
  });

  return movementRows.sort((a, b) => new Date(b.data || 0) - new Date(a.data || 0));
}

function getMovementLabel(tipo) {
  return MOVEMENT_LABELS[tipo] || TIPOS_SAIDA_ANIMAL[tipo] || tipo || '-';
}

function prepareAnimalForForm(animal, lotesMap) {
  const lote = lotesMap.get(Number(animal?.lote_id)) || null;
  const metadata = animal?.metadata || {};
  const fazendaId = animal?.fazenda_id ?? metadata?.fazenda_id ?? lote?.faz_id ?? lote?.fazenda_id ?? '';

  return {
    ...animal,
    fazenda_id: fazendaId || '',
    lote_id: animal?.lote_id ?? '',
    data_referencia: animal?.data_referencia || animal?.data_entrada || metadata?.data_referencia || '',
    data_nascimento: animal?.data_nascimento || metadata?.data_nascimento || '',
    identificacao: animal?.identificacao || animal?.nome || metadata?.identificacao || '',
    categoria: animal?.categoria || animal?.categoria_animal || metadata?.categoria || '',
    raca: animal?.raca || animal?.gen || metadata?.raca || '',
    sexo: animal?.sexo || metadata?.sexo || 'macho',
    origem: animal?.origem || metadata?.origem || '',
    observacao: animal?.observacao || animal?.obs || metadata?.observacao || '',
    qtd: animal?.qtd ?? '',
    p_ini: animal?.p_ini ?? '',
    p_at: animal?.p_at ?? '',
    dias: animal?.dias ?? '',
    consumo: animal?.consumo ?? '',
    rendimento_carcaca: animal?.rendimento_carcaca ?? '',
    preco_arroba: animal?.preco_arroba ?? '',
    status: animal?.status || 'ativo',
  };
}

function resolveAnimalFazendaNome(animal, fazendasMap, lotesMap) {
  const lote = lotesMap.get(Number(animal?.lote_id)) || null;
  const metadata = animal?.metadata || {};
  const fazendaId = animal?.fazenda_id ?? metadata?.fazenda_id ?? lote?.faz_id ?? lote?.fazenda_id ?? null;
  return fazendasMap.get(Number(fazendaId))?.nome || lote?.fazendaNome || '-';
}

export default function AnimaisPage({ db, setDb, onConfirmAction, subscription = null }) {
  const { hasPermission, session } = useAuth();
  const { showToast } = useToast();
  const [abrirForm, setAbrirForm] = useState(false);
  const [animalEditando, setAnimalEditando] = useState(null);
  const [abaAtiva, setAbaAtiva] = useState('grupos');
  const [mostrarCadastro, setMostrarCadastro] = useState(false);
  const [animalOperacao, setAnimalOperacao] = useState(null);

  const lotes = useMemo(() => (Array.isArray(db?.lotes) ? db.lotes : []), [db]);
  const fazendas = useMemo(() => (Array.isArray(db?.fazendas) ? db.fazendas : []), [db]);
  const animais = useMemo(() => (Array.isArray(db?.animais) ? db.animais : []), [db]);
  const movimentacoes = useMemo(() => (Array.isArray(db?.movimentacoes_animais) ? db.movimentacoes_animais : []), [db]);
  const lotesMap = useMemo(() => new Map(lotes.map((lote) => [Number(lote.id), lote])), [lotes]);
  const fazendasMap = useMemo(() => new Map(fazendas.map((item) => [Number(item.id), item])), [fazendas]);

  const dadosTabela = useMemo(
    () => animais.map((animal) => ({
      ...animal,
      loteNome: lotesMap.get(Number(animal.lote_id))?.nome || '-',
      fazendaNome: resolveAnimalFazendaNome(animal, fazendasMap, lotesMap),
      tipoRegistro: isIndividualAnimalRecord(animal) ? 'individual' : 'grupo',
      identificacao: animal.identificacao || animal?.metadata?.animal_identificacao || 'Animal',
      status: animal.status || 'ativo',
      ativo: isAnimalActive(animal),
    })),
    [animais, lotesMap, fazendasMap]
  );

  const grupos = useMemo(() => dadosTabela.filter((item) => item.tipoRegistro !== 'individual'), [dadosTabela]);
  const individuais = useMemo(() => dadosTabela.filter((item) => item.tipoRegistro === 'individual'), [dadosTabela]);

  const historicoSaidas = useMemo(
    () => getIndividualMovementRows(individuais, movimentacoes, lotesMap),
    [individuais, movimentacoes, lotesMap]
  );

  const resumo = useMemo(
    () => ({
      totalCabecas: animais.reduce((acc, item) => acc + Number(item.qtd || 0), 0),
      grupos: grupos.length,
      individuais: individuais.length,
      individuaisAtivos: individuais.filter((animal) => animal.ativo).length,
      lotesCobertos: new Set(animais.map((animal) => Number(animal.lote_id)).filter(Boolean)).size,
    }),
    [animais, grupos.length, individuais]
  );

  function abrirNovo() {
    if (!hasPermission('animais:editar')) return;
    setMostrarCadastro(true);
  }

  function abrirNovoPorModo(modo) {
    setMostrarCadastro(false);
    setAnimalEditando({ tipo_registro: modo, fazenda_id: String(fazendas[0]?.id || ''), qtd: modo === 'individual' ? '1' : '' });
    setAbrirForm(true);
  }

  function editarAnimal(animal) {
    if (!hasPermission('animais:editar')) return;
    setAnimalEditando(prepareAnimalForForm(animal, lotesMap));
    setAbrirForm(true);
  }

  function abrirOperacao(animal, mode) {
    if (!hasPermission('animais:movimentar')) {
      showToast({ type: 'error', message: 'Você não tem permissão para executar esta ação.' });
      return;
    }
    if (!animal?.ativo) {
      showToast({ type: 'warning', message: 'Este animal já está inativo e não pode receber nova operação.' });
      return;
    }
    setAnimalOperacao({ animal, mode });
  }

  async function excluirAnimal(id) {
    if (!hasPermission('animais:excluir')) return;
    const confirmado = typeof onConfirmAction === 'function'
      ? await onConfirmAction({
          title: 'Excluir registro de animais',
          message: 'Deseja excluir este registro de animais?',
          tone: 'danger',
        })
      : window.confirm('Deseja excluir este registro de animais?');
    if (!confirmado) return;
    const persistedDelete = await deleteOperationalRecord('animais', id, session);
    if (!persistedDelete.persisted) {
      showToast({ type: 'warning', message: persistedDelete.error || 'Não foi possível confirmar a exclusão agora.' });
      return;
    }
    setDb((prev) => ({ ...prev, animais: (prev.animais || []).filter((animal) => animal.id !== id) }));
    showToast({ type: 'success', message: 'Animal excluído com sucesso.' });
  }

  async function salvarAnimal(dados) {
    const currentQuantity = animalEditando?.id ? Number(animalEditando.qtd || 0) || 0 : 0;
    const nextQuantity = Number(dados?.qtd ?? animalEditando?.qtd ?? 1) || 1;
    const evaluation = canCreateAnimal(subscription, Math.max(resumo.totalCabecas - currentQuantity, 0), nextQuantity);
    if (!evaluation.allowed) {
      showToast({
        type: 'warning',
        message: getSubscriptionLimitMessage('animals', evaluation) || 'Regularize sua assinatura para continuar usando o HERDON.',
      });
      return;
    }

    if (animalEditando?.id) {
      const persisted = await updateOperationalRecord('animais', animalEditando.id, dados, session);
      const mergedAnimal = {
        ...animalEditando,
        ...dados,
        ...(persisted.data || {}),
        id: persisted.data?.id ?? animalEditando.id,
      };
      if (persisted.persisted) {
        setDb((prev) => ({
          ...prev,
          animais: (prev.animais || []).map((animal) => (
            animal.id === animalEditando.id ? mergedAnimal : animal
          )),
        }));
        showToast({ type: 'success', message: 'Animal atualizado com sucesso.' });
      } else {
        showToast({ type: 'error', message: persisted.error || 'Não foi possível atualizar o animal.' });
        return;
      }
    } else {
      const persisted = await createOperationalRecord('animais', dados, session);
      if (persisted.persisted) {
        setDb((prev) => ({
          ...prev,
          animais: [
            ...(prev.animais || []),
            {
              ...dados,
              ...(persisted.data || {}),
              id: persisted.data?.id ?? gerarNovoId(prev.animais || []),
            },
          ],
        }));
        showToast({ type: 'success', message: 'Animal cadastrado com sucesso.' });
      } else {
        showToast({ type: 'error', message: persisted.error || 'Não foi possível cadastrar o animal.' });
        return;
      }
    }
    setAbrirForm(false);
    setAnimalEditando(null);
  }

  function registrarOperacaoIndividual(payload) {
    const operation = animalOperacao;
    if (!operation?.animal) return;

    const animal = operation.animal;
    const mode = operation.mode;
    const tipo = mode === 'sale' ? 'venda' : String(payload.motivo || '').trim();
    const userContext = { id: session?.user?.id || null, email: session?.user?.email || '' };
    const persistContext = {
      session,
      persist: true,
      onWarning: (message) => showToast({ type: 'warning', message }),
    };

    try {
      setDb((prev) => registrarSaidaAnimalIndividual(prev, {
        animalId: animal.id,
        tipo,
        data: payload.data,
        valor: payload.valor,
        peso: payload.peso,
        observacao: payload.observacao,
      }, userContext, persistContext));
    } catch (error) {
      showToast({ type: 'error', message: error?.message || 'Não foi possível registrar a operação.' });
      return;
    }

    showToast({
      type: 'success',
      message: mode === 'sale' ? 'Venda registrada com sucesso.' : 'Saída registrada com sucesso.',
    });
    setAnimalOperacao(null);
  }

  const listaAtiva = abaAtiva === 'grupos' ? grupos : individuais;

  return (
    <div className="page animais-page">
      <section className="animais-hero page-header">
        <div>
          <h1>Animais</h1>
          <p>Gerencie grupos, individuais e movimentações com visão clara da operação.</p>
        </div>
        <div className="page-actions">
          <Button size="sm" icon={<Plus size={16} />} onClick={abrirNovo}>Novo cadastro</Button>
        </div>
      </section>

      <div className="dashboard-grid dashboard-grid--kpi-main animais-kpi-grid">
        <Card className="kpi-card" title="Total de cabeças"><div className="animais-kpi-value">{resumo.totalCabecas}</div></Card>
        <Card className="kpi-card" title="Grupos de animais"><div className="animais-kpi-value">{resumo.grupos}</div></Card>
        <Card className="kpi-card" title="Animais individuais"><div className="animais-kpi-value">{resumo.individuais}</div></Card>
        <Card className="kpi-card" title="Individuais ativos"><div className="animais-kpi-value">{resumo.individuaisAtivos}</div></Card>
      </div>

      <Card className="section-card" title="Cadastros" subtitle="Navegue entre grupos, individuais e movimentações.">
        <div className="segmented-control tab-bar" role="tablist" aria-label="Abas de animais">
          <button type="button" className={`segment ${abaAtiva === 'grupos' ? 'active' : ''}`} onClick={() => setAbaAtiva('grupos')}>Grupos</button>
          <button type="button" className={`segment ${abaAtiva === 'individuais' ? 'active' : ''}`} onClick={() => setAbaAtiva('individuais')}>Individuais</button>
          <button type="button" className={`segment ${abaAtiva === 'movimentacoes' ? 'active' : ''}`} onClick={() => setAbaAtiva('movimentacoes')}>Movimentações</button>
        </div>

        {abaAtiva !== 'movimentacoes' && listaAtiva.length > 0 ? (
          <div className="responsive-table-wrap table-responsive">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Identificação/Lote</th>
                  <th>Fazenda/Lote</th>
                  <th className="is-number">Quantidade</th>
                  <th className="is-number">Peso inicial</th>
                  <th className="is-number">Peso atual</th>
                  <th>Status</th>
                  <th>Ações</th>
                </tr>
              </thead>
              <tbody>
                {listaAtiva.map((animal) => (
                  <tr key={animal.id}>
                    <td>{animal.identificacao} / {animal.loteNome}</td>
                    <td>{animal.fazendaNome} / {animal.loteNome}</td>
                    <td className="is-number">{animal.qtd}</td>
                    <td className="is-number">{formatarNumero(animal.p_ini)} kg</td>
                    <td className="is-number">{formatarNumero(animal.p_at)} kg</td>
                    <td>
                      <Badge variant={animal.ativo ? 'success' : 'neutral'}>{animal.status}</Badge>
                    </td>
                    <td>
                      <div className="row-actions action-row">
                        <button className="action-btn" onClick={() => editarAnimal(animal)}>Editar</button>
                        {animal.tipoRegistro === 'individual' ? (
                          <>
                            <button className="action-btn" onClick={() => abrirOperacao(animal, 'sale')} disabled={!animal.ativo}>Registrar venda</button>
                            <button className="action-btn" onClick={() => abrirOperacao(animal, 'death')} disabled={!animal.ativo}>Registrar morte</button>
                            <button className="action-btn" onClick={() => abrirOperacao(animal, 'exit')} disabled={!animal.ativo}>Registrar saída</button>
                          </>
                        ) : null}
                        <button className="action-btn action-btn-danger" onClick={() => excluirAnimal(animal.id)}>Excluir</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}

        {abaAtiva === 'grupos' && grupos.length === 0 ? (
          <EmptyState
            title="Você ainda não cadastrou nenhum grupo de animais."
            subtitle="Crie um grupo para acompanhar peso e quantidade em conjunto."
            action={<Button size="sm" onClick={() => abrirNovoPorModo('grupo')}>Cadastrar grupo</Button>}
          />
        ) : null}

        {abaAtiva === 'individuais' && individuais.length === 0 ? (
          <EmptyState
            title="Você ainda não cadastrou nenhum animal individual."
            subtitle="Cadastre um animal individual quando precisar acompanhar peso e histórico separadamente."
            action={<Button size="sm" onClick={() => abrirNovoPorModo('individual')}>Cadastrar animal</Button>}
          />
        ) : null}

        {abaAtiva === 'movimentacoes' ? (
          historicoSaidas.length ? (
            <div className="responsive-table-wrap table-responsive">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Data</th>
                    <th>Animal</th>
                    <th>Tipo</th>
                    <th>Lote</th>
                    <th>Motivo</th>
                    <th>Valor</th>
                    <th>Observação</th>
                  </tr>
                </thead>
                <tbody>
                  {historicoSaidas.map((mov) => (
                    <tr key={mov.id}>
                      <td>{formatarData(mov.data)}</td>
                      <td>{mov.animalNome}</td>
                      <td>{getMovementLabel(mov.tipo)}</td>
                      <td>{mov.loteNome}</td>
                      <td>{mov.motivo || '-'}</td>
                      <td>{mov.valor_total != null && Number(mov.valor_total) > 0 ? formatarMoeda(mov.valor_total) : '-'}</td>
                      <td>{mov.obs || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState
              title="Nenhuma movimentação registrada."
              subtitle="Vendas, mortes e transferências aparecem aqui automaticamente."
            />
          )
        ) : null}
      </Card>

      {mostrarCadastro ? (
        <Card className="section-card" title="O que você quer cadastrar?" subtitle="Escolha o modo ideal para o fluxo atual.">
          <div className="animais-mode-actions">
            <Button onClick={() => abrirNovoPorModo('grupo')}>Grupo de animais</Button>
            <p>Use para cadastrar várias cabeças juntas em um lote.</p>
          </div>
          <div className="animais-mode-actions">
            <Button onClick={() => abrirNovoPorModo('individual')}>Animal individual</Button>
            <p>Use para acompanhar um animal específico.</p>
          </div>
        </Card>
      ) : null}

      {abrirForm ? (
        <AnimalForm
          initialData={animalEditando}
          lotes={lotes}
          fazendas={fazendas}
          onSave={salvarAnimal}
          onCancel={() => {
            setAbrirForm(false);
            setAnimalEditando(null);
          }}
        />
      ) : null}

      {animalOperacao ? (
        <AnimalMovementModal
          key={`${animalOperacao.mode}-${normalizeIdKey(animalOperacao.animal?.id) || 'animal'}`}
          open
          mode={animalOperacao.mode}
          animal={animalOperacao.animal}
          onClose={() => setAnimalOperacao(null)}
          onSubmit={registrarOperacaoIndividual}
        />
      ) : null}
    </div>
  );
}
