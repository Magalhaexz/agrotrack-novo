import { useMemo, useState } from 'react';
import { AlertCircle, Beef, CheckCircle2, CheckSquare, DollarSign, FileSearch, ListChecks, Package, Syringe } from 'lucide-react';
import Card from '../components/ui/Card';
import EmptyState from '../components/EmptyState';
import PageHeader from '../components/PageHeader';
import { gerarAlertasUnificados } from '../domain/alertasUnificados';
import {
  normalizarAlertaCentral,
  filtrarAlertasCentral,
  ordenarAlertasCentral,
  resumirCentralAlertas,
  PRAZO,
} from '../domain/centralAlertas';
import '../styles/alertas.css';

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

export default function AlertasPage({ db = {}, fazendaSelecionada = null, onNavigate = null }) {
  const [filtros, setFiltros] = useState(FILTROS_VAZIO);

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

  const alertasNormalizados = useMemo(
    () => alertasBrutos.map((alerta) => normalizarAlertaCentral(alerta, { lotes })),
    [alertasBrutos, lotes]
  );

  const resumo = useMemo(() => resumirCentralAlertas(alertasNormalizados), [alertasNormalizados]);

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

  const alertasFiltrados = useMemo(
    () => ordenarAlertasCentral(filtrarAlertasCentral(alertasNormalizados, filtros)),
    [alertasNormalizados, filtros]
  );

  function atualizarFiltro(campo, valor) {
    setFiltros((prev) => ({ ...prev, [campo]: valor }));
  }

  function limparFiltros() {
    setFiltros(FILTROS_VAZIO);
  }

  const filtrosAtivos = Object.entries(filtros).some(([chave, valor]) => (
    chave === 'somenteCriticos' ? Boolean(valor) : Boolean(valor)
  ));

  return (
    <div className="page page--alertas">
      <PageHeader
        title="Central de Alertas"
        subtitle="Priorize ocorrências, prazos e ações críticas da operação."
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
      </div>

      <Card title="Filtros" className="alertas-filtros-card">
        <div className="alertas-filtros-grid">
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
                  </span>
                </div>

                <h3 className="alertas-card-titulo">{alerta.titulo}</h3>
                {alerta.descricao ? <p className="alertas-card-descricao">{alerta.descricao}</p> : null}
                {alerta.loteNome ? <p className="alertas-card-lote">Lote: {alerta.loteNome}</p> : null}

                <div className="alertas-card-acao">
                  <span className="alertas-card-acao-label">Ação recomendada</span>
                  <p>{alerta.acaoRecomendada}</p>
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
