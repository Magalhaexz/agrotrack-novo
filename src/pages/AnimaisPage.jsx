import { useMemo, useState } from 'react';
import { Plus } from 'lucide-react';
import AnimalForm from '../components/AnimalForm';
import AnimalMovementModal from '../components/AnimalMovementModal';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import { TIPOS_SAIDA_ANIMAL } from '../utils/constantes';
import { formatarData, formatarNumero, formatarMoeda } from '../utils/formatters';
import { gerarNovoId } from '../utils/id';
import { useAuth } from '../auth/useAuth';
import { useToast } from '../hooks/useToast';
import {
  createOperationalRecord,
  deleteOperationalRecord,
  persistCollectionMutation,
  updateOperationalRecord,
} from '../services/operationalPersistence';

const INDIVIDUAL_INACTIVE_STATUSES = new Set(['vendido', 'morte', 'descarte', 'transferencia', 'perda', 'inativo']);
const MOVEMENT_LABELS = {
  criacao: 'Criação',
  venda: 'Venda',
  morte: 'Saída por morte',
  descarte: 'Saída por descarte',
  transferencia: 'Saída por transferência',
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
  const status = String(animal?.status || 'ativo').toLowerCase();
  return !INDIVIDUAL_INACTIVE_STATUSES.has(status);
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

function getMovementStatusPatch(reason) {
  const normalized = String(reason || '').toLowerCase();
  if (normalized === 'venda') return 'vendido';
  if (INDIVIDUAL_INACTIVE_STATUSES.has(normalized)) return normalized;
  return 'inativo';
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

export default function AnimaisPage({ db, setDb, onConfirmAction }) {
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
  const movimentacoesFinanceiras = useMemo(() => (Array.isArray(db?.movimentacoes_financeiras) ? db.movimentacoes_financeiras : []), [db]);
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
    await deleteOperationalRecord('animais', id, session);
    setDb((prev) => ({ ...prev, animais: (prev.animais || []).filter((animal) => animal.id !== id) }));
  }

  async function salvarAnimal(dados) {
    if (animalEditando) {
      const persisted = await updateOperationalRecord('animais', animalEditando.id, dados, session);
      const mergedAnimal = {
        ...animalEditando,
        ...dados,
        ...(persisted.data || {}),
        id: persisted.data?.id ?? animalEditando.id,
      };
      setDb((prev) => ({
        ...prev,
        animais: (prev.animais || []).map((animal) => (
          animal.id === animalEditando.id ? mergedAnimal : animal
        )),
      }));
      if (persisted.persisted) {
        showToast({ type: 'success', message: 'Animal atualizado com sucesso.' });
      } else if (persisted.data) {
        showToast({ type: 'warning', message: 'Animal atualizado localmente. Sincronização pendente.' });
      } else {
        showToast({ type: 'error', message: persisted.error || 'Não foi possível atualizar o animal.' });
      }
    } else {
      const persisted = await createOperationalRecord('animais', dados, session);
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
      if (persisted.persisted) {
        showToast({ type: 'success', message: 'Animal cadastrado com sucesso.' });
      } else if (persisted.data) {
        showToast({ type: 'warning', message: 'Animal cadastrado localmente. Sincronização pendente.' });
      } else {
        showToast({ type: 'error', message: persisted.error || 'Não foi possível cadastrar o animal.' });
      }
    }
    setAbrirForm(false);
    setAnimalEditando(null);
  }

  async function registrarOperacaoIndividual(payload) {
    const operation = animalOperacao;
    if (!operation?.animal) return;

    const animal = operation.animal;
    const mode = operation.mode;
    const status = getMovementStatusPatch(payload.motivo);
    const animalKey = normalizeIdKey(animal.id);
    const localAnimalId = normalizeIdKey(animal?.metadata?.local_id ?? animal.id);
    const movementId = gerarNovoId(movimentacoes);
    const financeId = gerarNovoId(movimentacoesFinanceiras);
    const movementType = mode === 'sale' ? 'venda' : payload.motivo;
    const loteId = Number(animal.lote_id) || null;
    const saleValue = mode === 'sale' ? Number(payload.valor || 0) : 0;

    const movementPayload = {
      id: movementId,
      lote_id: loteId,
      tipo: movementType,
      qtd: 1,
      peso_medio: payload.peso ?? (Number(animal.p_at || animal.p_ini || 0) || 0),
      valor_total: saleValue,
      custo_por_cabeca: saleValue > 0 ? saleValue : 0,
      data: payload.data,
      comprador_fornecedor: mode === 'sale' ? 'Venda individual' : '',
      obs: payload.observacao || '',
      metadata: {
        animal_id: animalKey,
        animal_local_id: localAnimalId,
        animal_identificacao: animal.identificacao,
        movement_scope: 'individual',
        motivo: movementType,
      },
    };

    const financePayload = mode === 'sale' && saleValue > 0
      ? {
          id: financeId,
          tipo: 'receita',
          categoria: 'Venda Animal',
          lote_id: loteId,
          valor: saleValue,
          data: payload.data,
          descricao: `Venda do animal ${animal.identificacao}`,
          origem_tipo: 'movimentacao_animal',
          origem_id: movementId,
          observacao: payload.observacao || null,
        }
      : null;

    const animalPatch = {
      status,
      p_at: payload.peso ?? animal.p_at,
      data_saida: payload.data,
      data_venda: mode === 'sale' ? payload.data : (animal.data_venda || null),
      observacao: [animal.observacao, payload.observacao].filter(Boolean).join(' • '),
      metadata: {
        ...(animal.metadata || {}),
        local_id: localAnimalId,
        ultimo_movimento_individual: movementType,
        ultima_data_movimento_individual: payload.data,
      },
    };

    setDb((prev) => ({
      ...prev,
      animais: (prev.animais || []).map((item) => (
        idsMatch(item.id, animal.id) ? { ...item, ...animalPatch } : item
      )),
      movimentacoes_animais: [
        ...(prev.movimentacoes_animais || []),
        movementPayload,
      ],
      movimentacoes_financeiras: financePayload
        ? [...(prev.movimentacoes_financeiras || []), financePayload]
        : (prev.movimentacoes_financeiras || []),
    }));

    const mutations = [
      updateOperationalRecord('animais', animal.id, animalPatch, session),
      createOperationalRecord('movimentacoes_animais', { ...movementPayload, id: undefined }, session),
    ];
    if (financePayload) {
      mutations.push(createOperationalRecord('movimentacoes_financeiras', { ...financePayload, id: undefined }, session));
    }

    const persisted = await persistCollectionMutation(mutations);
    const successMessage = mode === 'sale' ? 'Venda registrada com sucesso.' : 'Saída registrada com sucesso.';
    const errorMessage = mode === 'sale' ? 'Não foi possível registrar a venda.' : 'Não foi possível registrar a saída.';

    if (persisted.results.some((item) => item?.persisted)) {
      showToast({
        type: persisted.persisted ? 'success' : 'warning',
        message: persisted.persisted ? successMessage : `${successMessage} Alguns registros ficaram apenas no modo local.`,
      });
    } else {
      showToast({ type: 'error', message: errorMessage });
    }

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
                      <span className={`status-badge ${animal.ativo ? 'status-badge--ativo' : 'status-badge--inativo'}`}>
                        {animal.status}
                      </span>
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
          <div className="animais-empty-state empty-state">
            <strong>Nenhum grupo cadastrado.</strong>
            <Button size="sm" onClick={() => abrirNovoPorModo('grupo')}>Cadastrar grupo</Button>
          </div>
        ) : null}

        {abaAtiva === 'individuais' && individuais.length === 0 ? (
          <div className="animais-empty-state empty-state">
            <strong>Nenhum animal individual cadastrado.</strong>
          </div>
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
            <div className="animais-empty-state empty-state">
              <strong>Nenhuma movimentação registrada.</strong>
            </div>
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
