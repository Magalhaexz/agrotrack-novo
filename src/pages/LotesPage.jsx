import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Input from '../components/ui/Input';
import Modal from '../components/ui/Modal';
import Button from '../components/ui/Button';
import EmptyState from '../components/EmptyState';
import LoteForm from '../components/LoteForm';
import { useAuth } from '../auth/useAuth';
import { useToast } from '../hooks/useToast';
import { getResumoLote } from '../domain/resumoLote';
import { isModoConsolidado } from '../domain/escopoFazenda';
import { calcularSaudeLote } from '../domain/saudeLote';
import { gerarResumoRelatorioLote } from '../domain/relatorioLote';
import { gerarResumoLoteTexto } from '../domain/whatsappResumo';
import { calcLote } from '../utils/calculations';
import { gerarNovoId } from '../utils/id';
import { createOperationalRecord, deleteOperationalRecord, updateOperationalRecord } from '../services/operationalPersistence';
import LoteCard from '../components/lotes/LoteCard';
import LoteDetailsPanel from '../components/lotes/LoteDetailsPanel';
import LotesFilters from '../components/lotes/LotesFilters';
import LotesPageHeader from '../components/lotes/LotesPageHeader';
import RetiradaAnimaisModal from '../components/lotes/RetiradaAnimaisModal';
import FechamentoLoteModal from '../components/lotes/FechamentoLoteModal';
import MoverPastoModal from '../components/lotes/MoverPastoModal';
import AjusteLotacaoModal from '../components/lotes/AjusteLotacaoModal';
import RelatorioLotePreview from '../components/relatorios/RelatorioLotePreview';
import AcoesRelatorio from '../components/relatorios/AcoesRelatorio';
import { moverLoteParaPasto, listarHistoricoPastos } from '../services/movimentacaoPastos';
import { buildGrupoAnimaisAutoPatch, buildPesagemInicialPatch, buildAjusteLotacaoPatch, loteEstaBloqueado } from './lotesLogic';
import { useUrlState } from '../navigation/useUrlState.js';
import {
  addDaysToDate,
  calculateDailyConsumptionKg,
  daysBetween,
  toDateKey,
  toNumber,
} from '../domain/calcHelpers.js';
import '../styles/rebanho.css';

function daysFrom(dateValue) {
  const key = toDateKey(dateValue);
  if (!key) return 0;
  return Math.max(0, daysBetween(key, new Date().toISOString().slice(0, 10)));
}

function calculateGmd30(pesagens = []) {
  const sorted = [...pesagens]
    .map((item) => ({ ...item, data: toDateKey(item?.data) }))
    .filter((item) => item.data)
    .sort((a, b) => a.data.localeCompare(b.data));
  if (sorted.length < 2) return 0;
  const last = sorted[sorted.length - 1];
  const targetDate = addDaysToDate(last.data, -30);

  let start = sorted[0];
  for (let i = sorted.length - 1; i >= 0; i -= 1) {
    if (sorted[i].data <= targetDate) {
      start = sorted[i];
      break;
    }
  }

  const gain = toNumber(last.peso_medio) - toNumber(start.peso_medio);
  const days = Math.max(1, daysBetween(start.data, last.data));
  return gain / days;
}

function getActiveFarmId(fazendaSelecionada) {
  const direct = fazendaSelecionada?.id ?? fazendaSelecionada?.fazenda_id ?? fazendaSelecionada?.fazendaSelecionadaId ?? null;
  const value = Number(direct);
  return Number.isFinite(value) && value > 0 ? value : null;
}

function filterLotesByActiveFarm(lotes = [], activeFarmId = null, consolidado = false) {
  const lista = Array.isArray(lotes) ? lotes : [];
  // Sprint 28: visão "Todas as fazendas" mostra todos os lotes (o db já vem
  // completo do App); sem fazenda ativa e fora do modo consolidado, mantém o
  // comportamento antigo de não vazar lote nenhum.
  if (consolidado) return lista;
  if (!activeFarmId) return [];
  return lista.filter((lote) => Number(lote?.faz_id) === Number(activeFarmId));
}

function buildLoteConsumptionHistoryRows(consumos = [], loteId = null) {
  const targetId = Number(loteId);
  return (Array.isArray(consumos) ? consumos : [])
    .filter((item) => Number(item?.lote_id) === targetId)
    .map((item) => ({
      ...item,
      key: `consumo-${item.id}`,
      tipo: 'consumo',
      quantidade: toNumber(item?.qtd_total ?? item?.quantidade_total ?? item?.quantidade),
      peso_medio: toNumber(item?.peso_medio_usado),
      obs: item?.obs || '',
    }));
}

function buildLoteConsumptionAlert({ lote, consumoRows = [] } = {}) {
  const expectedDaily = calculateDailyPlannedConsumption(
    lote,
    toNumber(lote?.heads || lote?.qtd || 0),
    toNumber(lote?.pesoAtual || lote?.p_at || lote?.p_ini)
  );
  const totalRecorded = (Array.isArray(consumoRows) ? consumoRows : []).reduce((sum, item) => sum + toNumber(item?.quantidade), 0);
  const averageRecorded = consumoRows.length > 0 ? totalRecorded / consumoRows.length : 0;

  if (expectedDaily <= 0 || consumoRows.length === 0) {
    return {
      tone: 'neutral',
      message: 'Sem histórico de consumo registrado.',
      expectedDaily,
      actualDaily: averageRecorded,
    };
  }

  if (averageRecorded > expectedDaily) {
    return {
      tone: 'warning',
      message: 'Consumo acima do esperado para este lote.',
      expectedDaily,
      actualDaily: averageRecorded,
    };
  }

  if (averageRecorded <= expectedDaily * 0.8) {
    return {
      tone: 'danger',
      message: 'Consumo muito abaixo do esperado para este lote.',
      expectedDaily,
      actualDaily: averageRecorded,
    };
  }

  return {
    tone: 'success',
    message: 'Consumo dentro do esperado.',
    expectedDaily,
    actualDaily: averageRecorded,
  };
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

  return calculateDailyConsumptionKg({
    mode: consumoTipo,
    heads,
    pesoInicial: toNumber(lote?.p_ini || pesoAtual),
    pesoFinal: pesoAtual,
    percentualPv: consumoTipo === 'percentual_pv' ? consumoInformado : toNumber(lote?.supl_pv_pct),
    kgPorCabeca: consumoInformado,
  });
}

function buildLoteSavePatch(payload = {}, loteEmEdicao = null, activeFarmId = null) {
  return {
    ...payload,
    faz_id: loteEmEdicao?.faz_id ? Number(loteEmEdicao.faz_id) : activeFarmId,
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
}

function canCreateLoteInCurrentFarm(activeFarmId, loteEmEdicao = null) {
  return Boolean(activeFarmId) || Boolean(loteEmEdicao);
}

function normalizeStatus(lote) {
  const status = String(lote?.status || 'ativo').toLowerCase();
  return status;
}

const todayIso = new Date().toISOString().slice(0, 10);
const EMPTY_LIST = [];
const LABEL_OR_DASH = '—';

function resolvePastagemNome(pastagensMap, lote) {
  const byId = lote?.pastagem_id ? pastagensMap.get(String(lote.pastagem_id)) : null;
  return byId?.nome || lote?.pastagem_nome || lote?.pastagemAtualNome || LABEL_OR_DASH;
}

export default function LotesPage({ db, setDb, onRegistrarSaidaAnimal, session, fazendaSelecionada = null, navigationIntent = null }) {
  const abrirNovoLotePorIntent = navigationIntent?.page === 'lotes' && navigationIntent?.action === 'novo';
  const { hasPermission } = useAuth();
  const { showToast } = useToast();
  const [filters, setFilters] = useState({ status: 'todos', fazenda: 'todas', periodo: 'todos', busca: '' });
  // Seção 9/10 do sprint de fechamento: lote selecionado e aba ativa vivem na
  // URL (query string), não só em useState local — sem isso, entrar no
  // detalhe de um lote nunca empilhava histórico, e o botão voltar do
  // navegador pulava a listagem inteira (causa raiz diagnosticada no
  // fechamento anterior). Selecionar um lote empilha (permite sair com
  // voltar); trocar de aba dentro do mesmo lote só substitui a URL atual.
  const [loteNavState, updateLoteNavState] = useUrlState(
    { loteId: 'number', tab: 'string' },
    { loteId: null, tab: 'visao_geral' },
    ['loteId']
  );
  const selectedLoteId = loteNavState.loteId;
  const activeTab = loteNavState.tab;
  const setSelectedLoteId = useCallback((id) => updateLoteNavState({ loteId: id }), [updateLoteNavState]);
  const setActiveTab = useCallback((tab) => updateLoteNavState({ tab }), [updateLoteNavState]);
  const [openRetirada, setOpenRetirada] = useState(false);
  const [retiradaModo, setRetiradaModo] = useState('sale_partial');
  const [openFechamento, setOpenFechamento] = useState(false);
  const [openPesagem, setOpenPesagem] = useState(false);
  const [openNovoLote, setOpenNovoLote] = useState(abrirNovoLotePorIntent);
  const [loteEmEdicao, setLoteEmEdicao] = useState(null);
  const [openMoverPasto, setOpenMoverPasto] = useState(false);
  const [openAjusteLotacao, setOpenAjusteLotacao] = useState(false);
  const [openRelatorio, setOpenRelatorio] = useState(false);
  const relatorioContainerRef = useRef(null);
  const [historicoPastos, setHistoricoPastos] = useState(EMPTY_LIST);
  const [loadingHistoricoPastos, setLoadingHistoricoPastos] = useState(false);
  const lotes = Array.isArray(db?.lotes) ? db.lotes : EMPTY_LIST;
  const fazendas = Array.isArray(db?.fazendas) ? db.fazendas : EMPTY_LIST;
  const pastagens = Array.isArray(db?.pastagens) ? db.pastagens : EMPTY_LIST;
  const estoque = Array.isArray(db?.estoque) ? db.estoque : EMPTY_LIST;
  const pesagens = Array.isArray(db?.pesagens) ? db.pesagens : EMPTY_LIST;
  const animais = Array.isArray(db?.animais) ? db.animais : EMPTY_LIST;
  const sanitarios = Array.isArray(db?.sanitario) ? db.sanitario : EMPTY_LIST;
  const movAnimais = Array.isArray(db?.movimentacoes_animais) ? db.movimentacoes_animais : EMPTY_LIST;
  const movFinanceiros = Array.isArray(db?.movimentacoes_financeiras) ? db.movimentacoes_financeiras : EMPTY_LIST;
  const consumoHistorico = Array.isArray(db?.consumo_suplementacao) ? db.consumo_suplementacao : EMPTY_LIST;
  const activeFarmId = useMemo(() => getActiveFarmId(fazendaSelecionada), [fazendaSelecionada]);
  const fazendaAtiva = useMemo(() => fazendas.find((fazenda) => Number(fazenda.id) === Number(activeFarmId)) || null, [fazendas, activeFarmId]);
  const pastagensMap = useMemo(() => new Map(pastagens.map((item) => [String(item.id), item])), [pastagens]);

  useEffect(() => {
    if (!selectedLoteId) return undefined;
    let cancelado = false;

    async function carregarHistoricoPastos() {
      setLoadingHistoricoPastos(true);
      const resultado = await listarHistoricoPastos(selectedLoteId);
      if (cancelado) return;
      if (!resultado.success) {
        showToast({ type: 'warning', message: resultado.error || 'Não foi possível carregar o histórico de pasto.' });
      }
      setHistoricoPastos(resultado.data);
      setLoadingHistoricoPastos(false);
    }

    carregarHistoricoPastos();
    return () => {
      cancelado = true;
    };
  }, [selectedLoteId, showToast]);

  const lotesEnriquecidos = useMemo(() => lotes.map((lote) => {
    const lotePesagens = pesagens.filter((item) => Number(item.lote_id) === Number(lote.id));
    const latestPesagem = [...lotePesagens]
      .map((item) => ({ ...item, data: toDateKey(item?.data) }))
      .filter((item) => item.data)
      .sort((a, b) => b.data.localeCompare(a.data))[0];
    const resumo = getResumoLote(db, lote.id);
    const indicators = calcLote(db, lote.id);
    const saude = calcularSaudeLote(db, lote.id);
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
      saude,
      progressoPeso,
      ultimaPesagem: latestPesagem?.data || null,
      gmd30: calculateGmd30(lotePesagens),
      gmdMeta: toNumber(lote.gmd_meta),
      qtdPesagens: lotePesagens.length,
      fazendaNome,
      pastagemNome,
      categoriaAnimal,
      raca,
      bloqueado: loteEstaBloqueado(lote),
    };
  }), [db, lotes, pesagens, fazendas, pastagensMap]);

  const consolidado = useMemo(() => isModoConsolidado(fazendaSelecionada), [fazendaSelecionada]);
  const lotesDaFazendaAtiva = useMemo(() => filterLotesByActiveFarm(lotesEnriquecidos, activeFarmId, consolidado), [lotesEnriquecidos, activeFarmId, consolidado]);

  const lotesFiltrados = useMemo(() => lotesDaFazendaAtiva.filter((lote) => {
    if (filters.status !== 'todos' && lote.status !== filters.status) return false;
    if (filters.periodo === '30d' && daysFrom(lote.entrada) > 30) return false;
    if (filters.periodo === '90d' && daysFrom(lote.entrada) > 90) return false;
    if (String(filters.busca || '').trim()) {
      const termo = String(filters.busca).trim().toLowerCase();
      const alvo = `${lote?.nome || ''} ${lote?.fazendaNome || ''}`.toLowerCase();
      if (!alvo.includes(termo)) return false;
    }
    return true;
  }), [filters, lotesDaFazendaAtiva]);

  const selectedLote = useMemo(
    () => lotesEnriquecidos.find((lote) => Number(lote.id) === Number(selectedLoteId)) || null,
    [lotesEnriquecidos, selectedLoteId]
  );

  const selectedLoteConsumos = useMemo(() => buildLoteConsumptionHistoryRows(consumoHistorico, selectedLote?.id), [consumoHistorico, selectedLote?.id]);
  const consumoAlerta = useMemo(() => buildLoteConsumptionAlert({ lote: selectedLote, consumoRows: selectedLoteConsumos }), [selectedLote, selectedLoteConsumos]);

  // Relatório do lote (Sprint 4): só recalcula quando o modal está aberto,
  // reaproveitando getResumoLote/calcularSaudeLote via gerarResumoRelatorioLote.
  const relatorioLote = useMemo(
    () => (openRelatorio && selectedLote?.id ? gerarResumoRelatorioLote(db, selectedLote.id) : null),
    [openRelatorio, db, selectedLote]
  );

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setFilters((prev) => ({ ...prev, fazenda: activeFarmId ? String(activeFarmId) : 'todas' }));
      if (selectedLote && activeFarmId && Number(selectedLote.faz_id) !== Number(activeFarmId)) {
        setSelectedLoteId(null);
        setActiveTab('visao_geral');
        setOpenRetirada(false);
        setOpenFechamento(false);
        setOpenPesagem(false);
        setOpenNovoLote(false);
        setLoteEmEdicao(null);
      }
    }, 0);

    return () => window.clearTimeout(timer);
  }, [activeFarmId, selectedLote, setSelectedLoteId, setActiveTab]);

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

  async function handleExcluirHistoricoConsumo(item) {
    if (!ensurePermission('estoque:editar')) return;
    if (!item?.id) {
      showToast({ type: 'warning', message: 'Não foi possível identificar o registro para exclusão.' });
      return;
    }

    const confirmado = window.confirm('Deseja excluir este consumo do histórico?');
    if (!confirmado) return;

    const consumoId = Number(item.id);
    const linkedFinanceiro = movFinanceiros.find(
      (mov) => String(mov?.origem_tipo || '') === 'consumo_suplementacao' && Number(mov?.origem_id) === consumoId
    );

    const consumoPersist = await deleteOperationalRecord('consumo_suplementacao', consumoId, session);
    const financePersist = linkedFinanceiro?.id
      ? await deleteOperationalRecord('movimentacoes_financeiras', linkedFinanceiro.id, session)
      : { persisted: true };

    if (!consumoPersist?.persisted || !financePersist?.persisted) {
      showToast({ type: 'warning', message: consumoPersist?.error || financePersist?.error || 'Não foi possível confirmar a exclusão agora.' });
      return;
    }

    setDb((prev) => ({
      ...prev,
      consumo_suplementacao: (prev.consumo_suplementacao || []).filter((registro) => Number(registro.id) !== consumoId),
      movimentacoes_financeiras: (prev.movimentacoes_financeiras || []).filter((mov) => {
        if (Number(mov?.id) === Number(linkedFinanceiro?.id)) return false;
        return !(
          String(mov?.origem_tipo || '') === 'consumo_suplementacao'
          && Number(mov?.origem_id) === consumoId
        );
      }),
    }));
    showToast({ type: 'success', message: 'Consumo excluído com sucesso.' });
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

    const persisted = await updateOperationalRecord('lotes', loteId, patch, session);
    if (!persisted?.persisted) {
      showToast({ type: 'warning', message: persisted?.error || 'Não foi possível confirmar a troca do lote agora.' });
      return;
    }

    setDb((prev) => ({
      ...prev,
      lotes: (prev.lotes || []).map((l) => (Number(l.id) === Number(loteId) ? { ...l, ...patch } : l)),
    }));
    // Bug 1.4 (resquício): esta mensagem ainda dizia "Lote trocado" — mesmo
    // texto enganoso já corrigido no rótulo do botão, mas não aqui.
    showToast({ type: 'success', message: 'Lote finalizado com sucesso.' });
    setOpenFechamento(false);
  }

  async function handleMoverPasto({ loteId, pastagemDestinoId, dataMovimentacao, quantidadeCabecas, motivo, observacoes }) {
    if (!ensurePermission('lotes:editar')) return;
    if (!selectedLote) return;
    if (selectedLote.bloqueado) {
      showToast({ type: 'warning', message: 'Lote encerrado ou vendido não aceita movimentação de pasto.' });
      return;
    }

    const resultado = await moverLoteParaPasto({
      loteId,
      pastagemDestinoId,
      dataMovimentacao,
      quantidadeCabecas,
      motivo,
      observacoes,
    });

    if (!resultado.success) {
      showToast({ type: 'warning', message: resultado.error || 'Não foi possível confirmar a movimentação agora.' });
      return;
    }

    setDb((prev) => ({
      ...prev,
      lotes: (prev.lotes || []).map((l) => (
        Number(l.id) === Number(loteId) ? { ...l, pastagem_id: pastagemDestinoId } : l
      )),
    }));
    setHistoricoPastos((prev) => [resultado.data, ...prev]);
    showToast({ type: 'success', message: 'Movimentação de pasto registrada com sucesso.' });
    setOpenMoverPasto(false);
  }

  const MENSAGENS_ERRO_AJUSTE = {
    LOTE_INVALIDO: 'Lote inválido.',
    QUANTIDADE_INVALIDA: 'Informe uma quantidade de cabeças válida (número inteiro, zero ou mais).',
    MOTIVO_VAZIO: 'Informe o motivo do ajuste.',
    SEM_ALTERACAO: 'A nova quantidade é igual à atual — nada para ajustar.',
  };

  // Ajuste de lotação: correção administrativa da contagem (não é venda,
  // morte ou transferência — sem efeito financeiro, sem alterar peso médio).
  async function handleAjusteLotacao({ loteId, novaQtd, motivo, data }) {
    if (!ensurePermission('lotes:editar')) return;
    if (!selectedLote) return;
    if (selectedLote.bloqueado) {
      showToast({ type: 'warning', message: 'Lote encerrado ou vendido não aceita ajuste de lotação.' });
      return;
    }

    const plano = buildAjusteLotacaoPatch({ lote: selectedLote, novaQtd, motivo, data });
    if (!plano.ok) {
      showToast({ type: 'warning', message: MENSAGENS_ERRO_AJUSTE[plano.erro] || 'Não foi possível ajustar agora.' });
      return;
    }

    const loteAtualizado = await updateOperationalRecord('lotes', loteId, plano.writes.loteUpdate, session);
    const movPersistida = await createOperationalRecord('movimentacoes_animais', plano.writes.movimentacao, session);

    if (!loteAtualizado?.persisted || !movPersistida?.persisted) {
      showToast({ type: 'warning', message: 'Não foi possível confirmar o ajuste agora.' });
      return;
    }

    const novaMovimentacao = movPersistida.data || { id: gerarNovoId(movAnimais), ...plano.writes.movimentacao };
    setDb((prev) => ({
      ...prev,
      lotes: (prev.lotes || []).map((l) => (
        Number(l.id) === Number(loteId) ? { ...l, qtd: plano.writes.loteUpdate.qtd } : l
      )),
      movimentacoes_animais: [...(Array.isArray(prev?.movimentacoes_animais) ? prev.movimentacoes_animais : []), novaMovimentacao],
    }));
    showToast({ type: 'success', message: 'Lotação ajustada com sucesso.' });
    setOpenAjusteLotacao(false);
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

    const pesagemCloud = await createOperationalRecord('pesagens', { ...novoRegistro, id: undefined }, session);
    const loteCloud = await updateOperationalRecord('lotes', selectedLote.id, { p_at: Number(pesoMedio), ultima_pesagem: data }, session);

    if (!pesagemCloud?.persisted || !loteCloud?.persisted) {
      showToast({ type: 'warning', message: 'Não foi possível confirmar a pesagem agora.' });
      return;
    }

    setDb((prev) => ({
      ...prev,
      pesagens: [...(prev.pesagens || []), novoRegistro],
      lotes: (prev.lotes || []).map((l) => (
        Number(l.id) === Number(selectedLote.id)
          ? { ...l, p_at: Number(pesoMedio), ultima_pesagem: data }
          : l
      )),
    }));
    showToast({ type: 'success', message: 'Pesagem registrada com sucesso.' });
    setOpenPesagem(false);
  }

  async function handleNovoLote(payload) {
    if (!ensurePermission('lotes:editar')) return;
    if (!canCreateLoteInCurrentFarm(activeFarmId, loteEmEdicao)) {
      showToast({ type: 'warning', message: 'Selecione uma fazenda ativa para cadastrar um lote.' });
      return;
    }

    const patch = buildLoteSavePatch(payload, loteEmEdicao, activeFarmId);

    if (loteEmEdicao) {
      const loteId = loteEmEdicao.id;
      const persisted = await updateOperationalRecord('lotes', loteId, patch, session);
      if (!persisted?.persisted) {
        showToast({ type: 'warning', message: persisted?.error || 'Não foi possível confirmar a alteração agora.' });
        return;
      }

      const loteAtualizado = { ...loteEmEdicao, ...patch };
      setDb((prev) => ({
        ...prev,
        lotes: (prev.lotes || []).map((l) => (Number(l.id) === Number(loteId) ? loteAtualizado : l)),
      }));

      // O grupo em `animais` criado automaticamente no cadastro (Sprint 35)
      // não acompanhava edições do lote — cabeças/peso ficavam desatualizados
      // ali, e é `animais` (não `lotes.qtd`) que alimenta Resultado, Decisão
      // de Venda e Manejo (Sprint 37.1).
      const grupoAuto = animais.find((animal) => (
        Number(animal.lote_id) === Number(loteId) && animal?.metadata?.criado_automaticamente === true
      ));
      if (grupoAuto) {
        const grupoPatch = buildGrupoAnimaisAutoPatch({ ...loteAtualizado, id: loteId });
        if (grupoPatch) {
          const grupoPersistido = await updateOperationalRecord('animais', grupoAuto.id, grupoPatch, session);
          if (grupoPersistido?.persisted) {
            setDb((prev) => ({
              ...prev,
              animais: (prev.animais || []).map((a) => (Number(a.id) === Number(grupoAuto.id) ? { ...a, ...grupoPatch } : a)),
            }));
          } else {
            // Sprint 15: antes falhava em silêncio — cabeças/peso do lote ficavam
            // desatualizados no grupo de animais sem nenhum aviso, e Resultado/
            // Decisão de Venda/Manejo (que leem `animais`, não `lotes`) passavam
            // a mostrar números defasados sem o usuário saber o motivo.
            showToast({ type: 'warning', message: 'Lote atualizado, mas não foi possível sincronizar cabeças/peso com o grupo de animais. Resultado e Decisão de Venda podem ficar desatualizados até uma nova tentativa.' });
          }
        }
      }

      showToast({ type: 'success', message: 'Lote atualizado com sucesso.' });
      setOpenNovoLote(false);
      setLoteEmEdicao(null);
      return;
    }

    const novoLote = {
      id: gerarNovoId(lotes),
      ...patch,
      faz_id: activeFarmId,
      status: 'ativo',
    };

    const persisted = await createOperationalRecord('lotes', { ...novoLote, id: undefined }, session);
    if (!persisted?.persisted) {
      showToast({ type: 'warning', message: persisted?.error || 'Não foi possível confirmar o cadastro agora.' });
      return;
    }

    const loteIdReal = persisted?.data?.id ?? novoLote.id;

    setDb((prev) => ({ ...prev, lotes: [...(prev.lotes || []), novoLote] }));

    // Sem isso, um lote com "Cabeças" preenchida mas sem grupo em `animais`
    // mostra "Dados insuficientes" em Resultado/Decisão de Venda/Manejo,
    // mesmo com pesagens e despesas reais — esses cálculos usam `animais`,
    // nunca `lotes.qtd`. Criamos o grupo automaticamente, sem pedir nada
    // novo ao produtor (Sprint 35).
    const grupoAutoPatch = buildGrupoAnimaisAutoPatch({ ...novoLote, id: loteIdReal });
    let grupoAutoFalhou = false;
    if (grupoAutoPatch) {
      const grupoPersistido = await createOperationalRecord('animais', grupoAutoPatch, session);
      if (grupoPersistido?.persisted) {
        const novoGrupo = grupoPersistido.data || { id: gerarNovoId(animais), ...grupoAutoPatch };
        setDb((prev) => ({ ...prev, animais: [...(prev.animais || []), novoGrupo] }));
      } else {
        // Sprint 15: sem isso, o lote aparecia "criado com sucesso" mas ficava
        // operacionalmente quebrado — Resultado/Decisão de Venda/Manejo leem
        // `animais`, não `lotes.qtd`, e mostrariam "dados insuficientes" sem
        // nenhuma pista do motivo (falha silenciosa apontada na Sprint 13).
        grupoAutoFalhou = true;
      }
    }

    // Bug 3.2: sem isso, o histórico de pesagens do lote começava vazio mesmo
    // quando o produtor já informou o peso de entrada no cadastro — "peso
    // atual" e GMD ficavam sem base até a primeira pesagem manual. Só roda na
    // CRIAÇÃO (nunca em edição/retroativamente); não cria nada sem p_ini > 0.
    const pesagemInicialPatch = buildPesagemInicialPatch({ ...novoLote, id: loteIdReal });
    let pesagemInicialFalhou = false;
    if (pesagemInicialPatch) {
      const pesagemPersistida = await createOperationalRecord('pesagens', pesagemInicialPatch, session);
      if (pesagemPersistida?.persisted) {
        const novaPesagem = pesagemPersistida.data || { id: gerarNovoId(pesagens), ...pesagemInicialPatch };
        setDb((prev) => ({
          ...prev,
          pesagens: [...(Array.isArray(prev?.pesagens) ? prev.pesagens : []), novaPesagem],
          lotes: (prev.lotes || []).map((l) => (
            Number(l.id) === Number(loteIdReal) ? { ...l, ultima_pesagem: pesagemInicialPatch.data } : l
          )),
        }));
      } else {
        pesagemInicialFalhou = true;
      }
    }

    if (grupoAutoFalhou) {
      showToast({ type: 'warning', message: 'Lote criado, mas não foi possível registrar o grupo de animais automaticamente. Resultado, Decisão de Venda e Manejo vão mostrar "dados insuficientes" até você cadastrar os animais deste lote manualmente.' });
    } else if (pesagemInicialFalhou) {
      showToast({ type: 'warning', message: 'Lote criado, mas não foi possível registrar a pesagem de entrada automaticamente. Registre a primeira pesagem manualmente.' });
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
    const loteConsumos = selectedLoteConsumos;
    const historico = [
      ...lotePesagens.map((item) => ({ ...item, key: `pesagem-${item.id}`, tipo: 'pesagem' })),
      ...movAnimais.filter((item) => Number(item.lote_id) === Number(selectedLote.id)).map((item) => ({ ...item, key: `mov-${item.id}` })),
      ...loteConsumos.map((item) => ({ ...item, key: `consumo-${item.id}`, tipo: 'consumo' })),
    ]
      .map((item) => ({ ...item, data: toDateKey(item?.data) }))
      .sort((a, b) => String(b.data || '').localeCompare(String(a.data || '')));

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
          onEditar={() => {
            setLoteEmEdicao(selectedLote);
            setOpenNovoLote(true);
          }}
          onAjusteLotacao={() => setOpenAjusteLotacao(true)}
          onVenda={() => abrirRetirada('sale_partial')}
          onMortePerda={() => abrirRetirada('death_loss')}
          onTransferenciaSaida={() => abrirRetirada('exit')}
          onNovaPesagem={() => setOpenPesagem(true)}
          onFinalizar={() => setOpenFechamento(true)}
          onTrocarPasto={() => setOpenMoverPasto(true)}
          onGerarRelatorio={() => setOpenRelatorio(true)}
          animais={loteAnimais}
          pesagens={lotePesagens}
          retiradas={loteRetiradas}
          sanitarios={loteSanitario}
          financeiros={loteFinanceiro}
          historico={historico}
          historicoPastos={historicoPastos}
          loadingHistoricoPastos={loadingHistoricoPastos}
          consumoNutricao={consumoNutricao}
          consumoAlerta={consumoAlerta}
          onDeleteHistoricoConsumo={handleExcluirHistoricoConsumo}
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
          onRedirecionar={(tipo) => {
            // Seção 3: "Trocar lote de pasto"/"Finalizar lote" no dropdown de
            // retirada nunca reduzem a quantidade — abrem o fluxo próprio.
            setOpenRetirada(false);
            setRetiradaModo('sale_partial');
            if (tipo === 'trocar_pasto') {
              setActiveTab('pastagem');
              setOpenMoverPasto(true);
            } else if (tipo === 'finalizar_lote') {
              setOpenFechamento(true);
            }
          }}
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

        <MoverPastoModal
          key={`${selectedLote?.id ?? 'lote'}-${openMoverPasto}`}
          open={openMoverPasto}
          lote={selectedLote}
          pastagens={pastagens}
          onClose={() => setOpenMoverPasto(false)}
          onSubmit={handleMoverPasto}
        />

        {openAjusteLotacao ? (
          <AjusteLotacaoModal
            open={openAjusteLotacao}
            lote={selectedLote}
            onClose={() => setOpenAjusteLotacao(false)}
            onSubmit={handleAjusteLotacao}
          />
        ) : null}

        <Modal
          open={openRelatorio}
          onClose={() => setOpenRelatorio(false)}
          title="Relatório do lote"
          subtitle={selectedLote?.nome}
          size="lg"
        >
          {relatorioLote ? (
            <>
              <AcoesRelatorio
                containerRef={relatorioContainerRef}
                getTexto={() => gerarResumoLoteTexto(relatorioLote)}
                titulo="Relatório do Lote"
                fazendaNome={relatorioLote.fazenda}
                nomeArquivo={`relatorio-lote-${relatorioLote.lote?.nome || selectedLote?.id}`}
              />
              <div ref={relatorioContainerRef}>
                <RelatorioLotePreview relatorio={relatorioLote} />
              </div>
            </>
          ) : null}
        </Modal>
      </>
    );
  }

  return (
    <div className="rebanho-page">
      <LotesPageHeader
        canEdit={hasPermission('lotes:editar')}
        onNovoLote={() => {
          if (!canCreateLoteInCurrentFarm(activeFarmId, null)) {
            showToast({ type: 'warning', message: 'Selecione uma fazenda ativa para cadastrar um lote.' });
            return;
          }
          setLoteEmEdicao(null);
          setOpenNovoLote(true);
        }}
      />

      <LotesFilters
        filters={filters}
        fazendaAtiva={fazendaAtiva}
        onChange={updateFilter}
      />

      <div className="lote-cards-grid">
        {lotesFiltrados.length === 0 ? (
          <EmptyState
            title={activeFarmId ? 'Você ainda não cadastrou nenhum lote.' : 'Selecione uma fazenda ativa.'}
            subtitle={
              activeFarmId
                ? 'Crie seu primeiro lote para acompanhar pesagens, GMD, custos e resultado financeiro.'
                : 'Os lotes são exibidos por fazenda ativa.'
            }
            action={
              activeFarmId ? (
                <Button
                  variant="primary"
                  onClick={() => {
                    if (!canCreateLoteInCurrentFarm(activeFarmId, null)) {
                      showToast({ type: 'warning', message: 'Selecione uma fazenda ativa para cadastrar um lote.' });
                      return;
                    }
                    setLoteEmEdicao(null);
                    setOpenNovoLote(true);
                  }}
                >
                  Criar lote
                </Button>
              ) : null
            }
          />
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
            onEditar={() => {
              setLoteEmEdicao(lote);
              setOpenNovoLote(true);
            }}
            onAjusteLotacao={() => {
              setSelectedLoteId(lote.id);
              setOpenAjusteLotacao(true);
            }}
            onVenda={() => {
              setActiveTab('retiradas');
              setSelectedLoteId(lote.id);
              abrirRetirada('sale_partial');
            }}
            onMortePerda={() => {
              setActiveTab('retiradas');
              setSelectedLoteId(lote.id);
              abrirRetirada('death_loss');
            }}
            onTransferenciaSaida={() => {
              setActiveTab('retiradas');
              setSelectedLoteId(lote.id);
              abrirRetirada('exit');
            }}
            onTrocarPasto={() => {
              setActiveTab('pastagem');
              setSelectedLoteId(lote.id);
              setOpenMoverPasto(true);
            }}
            onFinalizar={() => {
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
          estoque={estoque}
          fazendaAtiva={fazendaAtiva}
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


