import { useMemo, useState } from 'react';
import { AlertCircle, Beef, CheckCircle2, CheckSquare, DollarSign, FileSearch, ListChecks, Package, Syringe } from 'lucide-react';
import Card from '../components/ui/Card';
import EmptyState from '../components/EmptyState';
import PageHeader from '../components/PageHeader';
import ExportActions from '../components/ExportActions';
import { useAuth } from '../auth/useAuth';
import { useToast } from '../hooks/useToast';
import { formatarData } from '../utils/formatters';
import { gerarAlertasUnificados } from '../domain/alertasUnificados';
import {
  normalizarAlertaCentral,
  filtrarAlertasCentral,
  ordenarAlertasCentral,
  resumirCentralAlertas,
  PRAZO,
} from '../domain/centralAlertas';
import { aplicarTratativasAosAlertas, resumirTratativas, STATUS_TRATATIVA } from '../domain/tratativasAlertas';
import { listarTratativasAlertas, salvarTratativaAlerta } from '../services/tratativasAlertas';
import { formatarDataExportacao, montarNomeArquivo } from '../domain/exportacaoRelatorios';
import { isModoConsolidado, construirMapaFazendas } from '../domain/escopoFazenda';
import { baixarCsv, abrirRelatorioParaImpressao } from '../utils/exportacaoArquivos';
import '../styles/alertas.css';

import { hojeLocalISO } from '../domain/dataCivil.js';
const ORIGEM_LABEL = {
  financeiro: 'Financeiro',
  estoque: 'Estoque',
  rebanho: 'Rebanho',
  sanidade: 'Sanidade',
  tarefas: 'Tarefas',
  decisao: 'Decisão',
  geral: 'Geral',
};

const ORIGEM_ICONE = {
  financeiro: DollarSign,
  estoque: Package,
  rebanho: Beef,
  sanidade: Syringe,
  tarefas: CheckSquare,
  decisao: ListChecks,
  geral: AlertCircle,
};

const PRIORIDADE_LABEL = {
  critico: 'Crítico',
  atencao: 'Atenção',
  decisao: 'Decisão',
  informativo: 'Informativo',
};

const PRIORIDADE_BADGE = {
  critico: 'badge-r',
  atencao: 'badge-a',
  decisao: 'badge-info',
  informativo: 'badge-n',
};

const PRAZO_LABEL = {
  [PRAZO.VENCIDO]: 'Vencido',
  [PRAZO.HOJE]: 'Vence hoje',
  [PRAZO.PROXIMOS_7_DIAS]: 'Próximos 7 dias',
  [PRAZO.PROXIMOS_30_DIAS]: 'Próximos 30 dias',
  [PRAZO.SEM_PRAZO]: 'Sem prazo definido',
};

const PRAZO_BADGE = {
  [PRAZO.VENCIDO]: 'badge-r',
  [PRAZO.HOJE]: 'badge-a',
  [PRAZO.PROXIMOS_7_DIAS]: 'badge-info',
  [PRAZO.PROXIMOS_30_DIAS]: 'badge-n',
  [PRAZO.SEM_PRAZO]: 'badge-n',
};

const FILTROS_VAZIO = {
  origem: '',
  prioridade: '',
  prazoCategoria: '',
  loteNome: '',
  busca: '',
  somenteCriticos: false,
};

// Sprint 16 — filtro de tratativa, separado dos filtros acima (que vêm de
// `centralAlertas.js` e não sabem nada sobre tratativa). "ativos" é o padrão:
// mesma coisa que a Central sempre mostrou, menos o que já foi tratado.
const FILTRO_TRATATIVA_OPCOES = [
  { valor: 'ativos', label: 'Ativos' },
  { valor: 'em_analise', label: 'Em análise' },
  { valor: 'adiados', label: 'Adiados' },
  { valor: 'historico', label: 'Histórico (resolvidos/ignorados)' },
];

const STATUS_TRATATIVA_LABEL = {
  [STATUS_TRATATIVA.EM_ANALISE]: 'Em análise',
  [STATUS_TRATATIVA.RESOLVIDO]: 'Resolvido',
  [STATUS_TRATATIVA.ADIADO]: 'Adiado',
  [STATUS_TRATATIVA.IGNORADO]: 'Ignorado',
};

const MENSAGEM_SEM_PERMISSAO = 'Você não tem permissão para executar esta ação.';

export default function AlertasPage({
  db = {},
  setDb = null,
  session = null,
  fazendaSelecionada = null,
  onNavigate = null,
  onConfirmAction = null,
}) {
  const { hasPermission } = useAuth();
  const { showToast } = useToast();
  const [filtros, setFiltros] = useState(FILTROS_VAZIO);
  const [filtroTratativa, setFiltroTratativa] = useState('ativos');
  const [adiandoAlertaId, setAdiandoAlertaId] = useState(null);
  const [dataAdiamento, setDataAdiamento] = useState('');

  const pastagensFazendaAtiva = useMemo(() => {
    const pastagens = Array.isArray(db.pastagens) ? db.pastagens : [];
    if (!fazendaSelecionada?.id) return pastagens;
    return pastagens.filter((item) => Number(item?.faz_id) === Number(fazendaSelecionada.id));
  }, [db.pastagens, fazendaSelecionada]);

  // Mesma fonte que o Dashboard usa para a "Central de Alertas Internos" —
  // não recalcula nada, só reaproveita `gerarAlertasUnificados` (Sprint 5/9/10).
  const alertasBrutos = useMemo(
    () => gerarAlertasUnificados({ ...db, pastagens: pastagensFazendaAtiva }),
    [db, pastagensFazendaAtiva]
  );

  const lotes = useMemo(() => (Array.isArray(db.lotes) ? db.lotes : []), [db.lotes]);
  // Sprint Visual 8: só identifica a fazenda de cada alerta para exibição
  // (via lote → fazenda) — não altera o motor de alertas nem a filtragem
  // por pastagem já existente acima.
  const consolidado = isModoConsolidado(fazendaSelecionada);
  const fazendasMap = useMemo(() => construirMapaFazendas(db), [db]);
  const lotesMap = useMemo(() => new Map(lotes.map((lote) => [Number(lote.id), lote])), [lotes]);

  const alertasNormalizados = useMemo(
    () => alertasBrutos.map((alerta) => {
      const normalizado = normalizarAlertaCentral(alerta, { lotes });
      const lote = normalizado.loteId != null ? lotesMap.get(Number(normalizado.loteId)) : null;
      return {
        ...normalizado,
        fazendaNome: lote ? (fazendasMap.get(Number(lote.faz_id)) || 'Sem fazenda') : null,
      };
    }),
    [alertasBrutos, lotes, lotesMap, fazendasMap]
  );

  // Sprint 16 — camada de tratativa (em_analise/resolvido/adiado/ignorado)
  // por cima dos alertas já normalizados. Nunca substitui a regra de origem:
  // só anota `statusTratativa`/`visivel`, nunca remove um alerta da lista.
  const tratativas = useMemo(() => listarTratativasAlertas(db), [db]);
  const alertasComTratativa = useMemo(
    () => aplicarTratativasAosAlertas(alertasNormalizados, tratativas, new Date()),
    [alertasNormalizados, tratativas]
  );

  const alertasAtivos = useMemo(() => alertasComTratativa.filter((a) => a.visivel), [alertasComTratativa]);
  const resumo = useMemo(() => resumirCentralAlertas(alertasAtivos), [alertasAtivos]);
  const resumoTratativas = useMemo(() => resumirTratativas(alertasComTratativa), [alertasComTratativa]);

  // Só oferece no filtro os lotes que a heurística de texto conseguiu
  // vincular a algum alerta agora — evita opções que sempre dão zero resultado.
  const lotesComAlerta = useMemo(() => {
    const mapa = new Map();
    alertasNormalizados.forEach((alerta) => {
      if (alerta.loteId != null && !mapa.has(alerta.loteId)) {
        mapa.set(alerta.loteId, alerta.loteNome);
      }
    });
    return Array.from(mapa.entries()).map(([id, nome]) => ({ id, nome }));
  }, [alertasNormalizados]);

  const origensDisponiveis = useMemo(
    () => Array.from(new Set(alertasNormalizados.map((a) => a.origem))),
    [alertasNormalizados]
  );

  // Filtro de tratativa aplicado depois de origem/prioridade/prazo/lote/busca
  // (que vêm de `centralAlertas.js` e ignoram tratativa) — "ativos" é o
  // padrão: resolvido/ignorado somem daqui, mas continuam existindo/consultáveis.
  const alertasPorTratativa = useMemo(() => {
    if (filtroTratativa === 'em_analise') return alertasComTratativa.filter((a) => a.statusTratativa === STATUS_TRATATIVA.EM_ANALISE);
    if (filtroTratativa === 'adiados') return alertasComTratativa.filter((a) => a.statusTratativa === STATUS_TRATATIVA.ADIADO && !a.visivel);
    if (filtroTratativa === 'historico') {
      return alertasComTratativa.filter((a) => a.statusTratativa === STATUS_TRATATIVA.RESOLVIDO || a.statusTratativa === STATUS_TRATATIVA.IGNORADO);
    }
    return alertasComTratativa.filter((a) => a.visivel);
  }, [alertasComTratativa, filtroTratativa]);

  const alertasFiltrados = useMemo(
    () => ordenarAlertasCentral(filtrarAlertasCentral(alertasPorTratativa, filtros)),
    [alertasPorTratativa, filtros]
  );

  function atualizarFiltro(campo, valor) {
    setFiltros((prev) => ({ ...prev, [campo]: valor }));
  }

  function limparFiltros() {
    setFiltros(FILTROS_VAZIO);
  }

  /** Persiste a tratativa e mescla o resultado em `db.alertas_tratativas` local. */
  async function registrarTratativa(alerta, status, extra = {}) {
    if (!hasPermission('tarefas:editar')) {
      showToast({ type: 'error', message: MENSAGEM_SEM_PERMISSAO });
      return;
    }
    const resultado = await salvarTratativaAlerta(db, session, {
      alertaId: alerta.id,
      alertaTipo: alerta?.alertaOriginal?.tipo || alerta.origem,
      origem: alerta.origem,
      status,
      ownerUserId: session?.user?.id || null,
      ...extra,
    });
    if (!resultado.persisted) {
      showToast({ type: 'warning', message: resultado.error || 'Não foi possível salvar agora. Tente novamente.' });
      return;
    }
    setDb?.((prev) => {
      const atuais = Array.isArray(prev?.alertas_tratativas) ? prev.alertas_tratativas : [];
      if (resultado.isUpdate) {
        return {
          ...prev,
          alertas_tratativas: atuais.map((t) => (String(t.alerta_id) === String(alerta.id) ? { ...t, ...resultado.data } : t)),
        };
      }
      return { ...prev, alertas_tratativas: [...atuais, resultado.data] };
    });
  }

  async function marcarEmAnalise(alerta) {
    await registrarTratativa(alerta, STATUS_TRATATIVA.EM_ANALISE);
    showToast({ type: 'success', message: 'Alerta marcado como em análise.' });
  }

  async function resolverAlerta(alerta) {
    const confirmado = typeof onConfirmAction === 'function'
      ? await onConfirmAction({ title: 'Resolver alerta', message: 'Marcar este alerta como resolvido? Ele sai da lista de ativos, mas continua no histórico.', tone: 'default' })
      : window.confirm('Marcar este alerta como resolvido?');
    if (!confirmado) return;
    await registrarTratativa(alerta, STATUS_TRATATIVA.RESOLVIDO);
    showToast({ type: 'success', message: 'Alerta resolvido.' });
  }

  async function ignorarAlerta(alerta) {
    const confirmado = typeof onConfirmAction === 'function'
      ? await onConfirmAction({ title: 'Ignorar alerta', message: 'Ignorar este alerta? Ele sai da lista de ativos, mas continua no histórico.', tone: 'default' })
      : window.confirm('Ignorar este alerta?');
    if (!confirmado) return;
    await registrarTratativa(alerta, STATUS_TRATATIVA.IGNORADO);
    showToast({ type: 'success', message: 'Alerta ignorado.' });
  }

  function iniciarAdiamento(alertaId) {
    setAdiandoAlertaId(alertaId);
    setDataAdiamento('');
  }

  function cancelarAdiamento() {
    setAdiandoAlertaId(null);
    setDataAdiamento('');
  }

  async function confirmarAdiamento(alerta) {
    if (!dataAdiamento) {
      showToast({ type: 'warning', message: 'Informe até quando adiar.' });
      return;
    }
    await registrarTratativa(alerta, STATUS_TRATATIVA.ADIADO, { adiadoAte: dataAdiamento });
    showToast({ type: 'success', message: `Alerta adiado até ${formatarData(dataAdiamento)}.` });
    cancelarAdiamento();
  }

  const filtrosAtivos = Object.entries(filtros).some(([chave, valor]) => (
    chave === 'somenteCriticos' ? Boolean(valor) : Boolean(valor)
  ));

  // Exportação (Sprint 19) — sempre a partir de `alertasFiltrados`, a mesma
  // lista já renderizada abaixo: nunca duplica a lógica de filtro/tratativa,
  // e nunca exporta um alerta que o usuário não está vendo na tela.
  const colunasExportacaoAlertas = [
    { key: 'titulo', label: 'Título' },
    { key: 'origem', label: 'Origem', accessor: (a) => ORIGEM_LABEL[a.origem] || a.origem },
    { key: 'prioridade', label: 'Prioridade', accessor: (a) => PRIORIDADE_LABEL[a.prioridade] || a.prioridade },
    { key: 'prazo', label: 'Prazo', accessor: (a) => PRAZO_LABEL[a.prazoCategoria] || '' },
    { key: 'dataReferencia', label: 'Data de referência', accessor: (a) => formatarDataExportacao(a.dataReferencia) },
    { key: 'loteNome', label: 'Lote' },
    {
      key: 'statusTratativa',
      label: 'Status',
      accessor: (a) => STATUS_TRATATIVA_LABEL[a.statusTratativa] || 'Ativo (sem tratativa)',
    },
    { key: 'acaoRecomendada', label: 'Ação recomendada' },
  ];

  function exportarAlertasCsv() {
    baixarCsv({
      colunas: colunasExportacaoAlertas,
      linhas: alertasFiltrados,
      nomeArquivo: montarNomeArquivo({ prefixo: 'central-de-alertas-filtrados' }),
    });
  }

  function imprimirAlertas() {
    abrirRelatorioParaImpressao({
      titulo: 'Central de Alertas — filtrados',
      subtitulo: filtrosAtivos || filtroTratativa !== 'ativos'
        ? 'Lista com os filtros atualmente aplicados na tela — não é a lista completa de alertas.'
        : 'Alertas ativos (sem filtro adicional aplicado).',
      colunas: colunasExportacaoAlertas,
      linhas: alertasFiltrados,
      metadados: { 'Total exportado': alertasFiltrados.length },
    });
  }

  return (
    <div className="page page--alertas">
      <PageHeader
        title="Central de Alertas"
        subtitle={`${consolidado ? 'Todas as fazendas' : (fazendaSelecionada?.nome || 'Todas as fazendas')} · Priorize ocorrências, prazos e ações críticas da operação.`}
      />

      <div className="summary-cards-grid alertas-summary-grid">
        <Card title="Total de alertas" className="alertas-summary-card">
          <strong>{resumo.total}</strong>
        </Card>
        <Card title="Críticos" className="alertas-summary-card alertas-summary-card--critico">
          <strong>{resumo.criticos}</strong>
        </Card>
        <Card title="Vencidos" className="alertas-summary-card alertas-summary-card--critico">
          <strong>{resumo.vencidos}</strong>
        </Card>
        <Card title="Vencendo hoje" className="alertas-summary-card alertas-summary-card--atencao">
          <strong>{resumo.vencendoHoje}</strong>
        </Card>
        <Card title="Próximos 7 dias" className="alertas-summary-card">
          <strong>{resumo.proximos7Dias}</strong>
        </Card>
        <Card title="Em análise" className="alertas-summary-card">
          <strong>{resumoTratativas.emAnalise}</strong>
        </Card>
        <Card title="Adiados" className="alertas-summary-card">
          <strong>{resumoTratativas.adiados}</strong>
        </Card>
      </div>

      <Card title="Filtros" className="alertas-filtros-card">
        <div className="alertas-filtros-grid">
          <label className="ui-input-wrap">
            <span className="ui-input-label">Status</span>
            <select className="ui-input" value={filtroTratativa} onChange={(e) => setFiltroTratativa(e.target.value)}>
              {FILTRO_TRATATIVA_OPCOES.map((opcao) => (
                <option key={opcao.valor} value={opcao.valor}>{opcao.label}</option>
              ))}
            </select>
          </label>

          <label className="ui-input-wrap">
            <span className="ui-input-label">Origem</span>
            <select className="ui-input" value={filtros.origem} onChange={(e) => atualizarFiltro('origem', e.target.value)}>
              <option value="">Todas</option>
              {origensDisponiveis.map((origem) => (
                <option key={origem} value={origem}>{ORIGEM_LABEL[origem] || origem}</option>
              ))}
            </select>
          </label>

          <label className="ui-input-wrap">
            <span className="ui-input-label">Prioridade</span>
            <select className="ui-input" value={filtros.prioridade} onChange={(e) => atualizarFiltro('prioridade', e.target.value)}>
              <option value="">Todas</option>
              {Object.entries(PRIORIDADE_LABEL).map(([valor, label]) => (
                <option key={valor} value={valor}>{label}</option>
              ))}
            </select>
          </label>

          <label className="ui-input-wrap">
            <span className="ui-input-label">Prazo</span>
            <select className="ui-input" value={filtros.prazoCategoria} onChange={(e) => atualizarFiltro('prazoCategoria', e.target.value)}>
              <option value="">Todos</option>
              {Object.entries(PRAZO_LABEL).map(([valor, label]) => (
                <option key={valor} value={valor}>{label}</option>
              ))}
            </select>
          </label>

          <label className="ui-input-wrap">
            <span className="ui-input-label">Lote</span>
            <select
              className="ui-input"
              value={filtros.loteNome}
              onChange={(e) => atualizarFiltro('loteNome', e.target.value)}
              disabled={lotesComAlerta.length === 0}
            >
              <option value="">{lotesComAlerta.length === 0 ? 'Nenhum lote identificado' : 'Todos'}</option>
              {lotesComAlerta.map((lote) => (
                <option key={lote.id} value={lote.nome}>{lote.nome}</option>
              ))}
            </select>
          </label>

          <label className="ui-input-wrap alertas-busca-wrap">
            <span className="ui-input-label">Busca</span>
            <div className="alertas-busca-input">
              <FileSearch size={14} aria-hidden="true" />
              <input
                className="ui-input"
                type="text"
                placeholder="Buscar por título ou descrição"
                value={filtros.busca}
                onChange={(e) => atualizarFiltro('busca', e.target.value)}
              />
            </div>
          </label>
        </div>

        <div className="alertas-filtros-acoes">
          <button
            type="button"
            className={`chip-toggle ${filtros.somenteCriticos ? 'chip-toggle--active' : ''}`}
            onClick={() => atualizarFiltro('somenteCriticos', !filtros.somenteCriticos)}
          >
            Somente críticos
          </button>
          {filtrosAtivos ? (
            <button type="button" className="chip-toggle" onClick={limparFiltros}>Limpar filtros</button>
          ) : null}
        </div>
      </Card>

      <ExportActions
        label="Alertas filtrados:"
        disabled={alertasFiltrados.length === 0}
        onExportCsv={exportarAlertasCsv}
        onPrint={imprimirAlertas}
      />

      <div className="alertas-lista">
        {alertasNormalizados.length === 0 ? (
          <EmptyState
            title="Nenhum alerta crítico no momento."
            subtitle="A operação está em dia — continue acompanhando pelo Dashboard."
            icon={CheckCircle2}
            tone="success"
          />
        ) : alertasFiltrados.length === 0 ? (
          <EmptyState
            title="Nenhum alerta encontrado com os filtros selecionados."
            subtitle="Ajuste ou limpe os filtros para ver outras ocorrências."
            action={<button type="button" className="chip-toggle" onClick={limparFiltros}>Limpar filtros</button>}
          />
        ) : (
          alertasFiltrados.map((alerta) => {
            const OrigemIcon = ORIGEM_ICONE[alerta.origem] || AlertCircle;
            return (
              <article key={alerta.id} className={`alertas-card alertas-card--${alerta.prioridade}`}>
                <div className="alertas-card-topo">
                  <span className={`badge ${PRIORIDADE_BADGE[alerta.prioridade] || 'badge-n'}`}>
                    {PRIORIDADE_LABEL[alerta.prioridade] || alerta.prioridade}
                  </span>
                  <span className="alertas-card-origem">
                    <OrigemIcon size={13} aria-hidden="true" />
                    {ORIGEM_LABEL[alerta.origem] || alerta.origem}
                  </span>
                  <span className={`badge ${PRAZO_BADGE[alerta.prazoCategoria] || 'badge-n'}`}>
                    {PRAZO_LABEL[alerta.prazoCategoria]}
                    {alerta.dataReferencia ? ` · ${formatarData(alerta.dataReferencia)}` : ''}
                  </span>
                  {alerta.statusTratativa ? (
                    <span className="badge badge-info">
                      {STATUS_TRATATIVA_LABEL[alerta.statusTratativa]}
                      {alerta.statusTratativa === STATUS_TRATATIVA.ADIADO && alerta.tratativa?.adiado_ate
                        ? ` até ${formatarData(alerta.tratativa.adiado_ate)}`
                        : ''}
                    </span>
                  ) : null}
                </div>

                <h3 className="alertas-card-titulo">{alerta.titulo}</h3>
                {alerta.descricao ? <p className="alertas-card-descricao">{alerta.descricao}</p> : null}
                {alerta.loteNome ? (
                  <p className="alertas-card-lote">
                    Lote: <strong>{alerta.loteNome}</strong>
                    {consolidado && alerta.fazendaNome ? <> · Fazenda: <strong>{alerta.fazendaNome}</strong></> : null}
                  </p>
                ) : null}

                <div className="alertas-card-acao">
                  <span className="alertas-card-acao-label">Ação recomendada</span>
                  <p>{alerta.acaoRecomendada}</p>
                </div>

                <div className="alertas-card-tratativa-acoes">
                  {alerta.statusTratativa !== STATUS_TRATATIVA.EM_ANALISE ? (
                    <button type="button" className="alertas-card-abrir" onClick={() => marcarEmAnalise(alerta)}>Em análise</button>
                  ) : null}
                  {alerta.statusTratativa !== STATUS_TRATATIVA.RESOLVIDO ? (
                    <button type="button" className="alertas-card-abrir" onClick={() => resolverAlerta(alerta)}>Resolver</button>
                  ) : null}
                  {alerta.statusTratativa !== STATUS_TRATATIVA.IGNORADO ? (
                    <button type="button" className="alertas-card-abrir" onClick={() => ignorarAlerta(alerta)}>Ignorar</button>
                  ) : null}
                  {adiandoAlertaId === alerta.id ? (
                    <span className="alertas-card-adiar-inline">
                      <input
                        type="date"
                        className="ui-input"
                        value={dataAdiamento}
                        min={hojeLocalISO()}
                        onChange={(e) => setDataAdiamento(e.target.value)}
                      />
                      <button type="button" className="alertas-card-abrir" onClick={() => confirmarAdiamento(alerta)}>Confirmar</button>
                      <button type="button" className="alertas-card-abrir" onClick={cancelarAdiamento}>Cancelar</button>
                    </span>
                  ) : (
                    <button type="button" className="alertas-card-abrir" onClick={() => iniciarAdiamento(alerta.id)}>Adiar</button>
                  )}
                </div>

                {alerta.pageId ? (
                  <div className="alertas-card-rodape">
                    <button type="button" className="alertas-card-abrir" onClick={() => onNavigate?.(alerta.pageId)}>
                      Abrir {ORIGEM_LABEL[alerta.origem] || 'detalhes'}
                    </button>
                  </div>
                ) : null}
              </article>
            );
          })
        )}
      </div>
    </div>
  );
}
