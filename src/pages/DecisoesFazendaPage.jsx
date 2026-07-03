import { useMemo } from 'react';
import {
  Beef,
  CheckCircle2,
  ClipboardCheck,
  ListChecks,
  Package,
  Receipt,
  Syringe,
  TrendingUp,
} from 'lucide-react';
import Badge from '../components/ui/Badge';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import PageHeader from '../components/PageHeader';
import EmptyState from '../components/EmptyState';
import SaudeLoteCard from '../components/lotes/SaudeLoteCard';
import {
  agruparAlertasPorTipo,
  construirInsightsFazenda,
  listarAtencaoImediata,
} from '../domain/insightsFazenda';
import { listarSaudeLotes } from '../domain/saudeLote';
import '../styles/decisoes.css';
import '../styles/rebanho.css';

const LIMITE_LOTES_RANKING = 6;

// Rótulo/ícone/página de destino por categoria — puramente apresentação.
// A lista de tipos válidos e o agrupamento em si vêm do motor (insightsFazenda.js).
const CATEGORIAS = [
  {
    tipo: 'gmd',
    titulo: 'Lotes abaixo da meta',
    subtitulo: 'Ganho de peso abaixo do esperado.',
    icone: Beef,
    pagina: 'resultados',
    botaoLabel: 'Ver resultados',
    vazio: 'Nenhum lote abaixo da meta de GMD no momento.',
  },
  {
    tipo: 'estoque',
    titulo: 'Estoque crítico',
    subtitulo: 'Produtos zerados, abaixo do mínimo ou perto de acabar.',
    icone: Package,
    pagina: 'estoque',
    botaoLabel: 'Ver estoque',
    vazio: 'Estoque sob controle — nada em risco agora.',
  },
  {
    tipo: 'sanidade',
    titulo: 'Sanidade próxima',
    subtitulo: 'Manejos vencidos ou próximos do prazo.',
    icone: Syringe,
    pagina: 'sanitario',
    botaoLabel: 'Ver sanidade',
    vazio: 'Nenhum manejo sanitário vencendo agora.',
  },
  {
    tipo: 'tarefa',
    titulo: 'Tarefas atrasadas',
    subtitulo: 'Pendências fora do prazo.',
    icone: ClipboardCheck,
    pagina: 'tarefas',
    botaoLabel: 'Ver tarefas',
    vazio: 'Nenhuma tarefa atrasada.',
  },
  {
    tipo: 'custo',
    titulo: 'Financeiro e custos',
    subtitulo: 'Onde a fazenda pode estar perdendo dinheiro.',
    icone: Receipt,
    pagina: 'financeiro',
    botaoLabel: 'Ver financeiro',
    vazio: 'Custos dentro do esperado nos últimos 30 dias.',
  },
  {
    tipo: 'peso_alvo',
    titulo: 'Oportunidades',
    subtitulo: 'Lotes prontos ou próximos da decisão de venda.',
    icone: TrendingUp,
    pagina: 'resultados',
    botaoLabel: 'Ver resultados',
    vazio: 'Nenhum lote perto do peso alvo ainda.',
    oportunidade: true,
  },
];

const SEVERIDADE_LABEL = {
  critico: 'Crítico',
  alto: 'Alto',
  medio: 'Médio',
  baixo: 'Baixo',
};

const SEVERIDADE_BADGE = {
  critico: 'danger',
  alto: 'warning',
  medio: 'info',
  baixo: 'neutral',
};

const IMPACTO_POR_SEVERIDADE = {
  critico: 'Alto risco imediato — pode gerar prejuízo ou perda de desempenho se não for resolvido agora.',
  alto: 'Impacto relevante — vale resolver nos próximos dias.',
  medio: 'Impacto moderado — acompanhe de perto.',
  baixo: 'Impacto baixo — fique de olho, sem urgência.',
};

const IMPACTO_OPORTUNIDADE = 'Pode representar ganho se a venda for avaliada agora.';

const COLECOES_BASE = ['lotes', 'estoque', 'pesagens', 'custos', 'movimentacoes_financeiras'];

function obterImpacto(alerta, oportunidade) {
  if (oportunidade) return IMPACTO_OPORTUNIDADE;
  return IMPACTO_POR_SEVERIDADE[alerta?.severidade] || IMPACTO_POR_SEVERIDADE.medio;
}

function DecisaoItem({ alerta, oportunidade = false }) {
  const badgeVariant = oportunidade ? 'success' : (SEVERIDADE_BADGE[alerta.severidade] || 'neutral');
  const badgeLabel = oportunidade ? 'Oportunidade' : (SEVERIDADE_LABEL[alerta.severidade] || alerta.severidade);

  return (
    <li className={`decisoes-item decisoes-item--${oportunidade ? 'oportunidade' : (alerta.severidade || 'medio')}`}>
      <div className="decisoes-item__cabecalho">
        <Badge variant={badgeVariant}>{badgeLabel}</Badge>
        <strong className="decisoes-item__titulo">{alerta.titulo}</strong>
      </div>
      <p className="decisoes-item__linha"><em>Motivo:</em> {alerta.descricao}</p>
      <p className="decisoes-item__linha"><em>Impacto:</em> {obterImpacto(alerta, oportunidade)}</p>
      <p className="decisoes-item__linha"><em>Ação sugerida:</em> {alerta.acaoSugerida}</p>
    </li>
  );
}

export default function DecisoesFazendaPage({ db = {}, onNavigate = null }) {
  const insights = useMemo(() => construirInsightsFazenda(db), [db]);
  const grupos = useMemo(() => agruparAlertasPorTipo(insights.alertas), [insights.alertas]);
  const atencaoImediata = useMemo(() => listarAtencaoImediata(insights.alertas), [insights.alertas]);
  const saudeLotes = useMemo(() => listarSaudeLotes(db).slice(0, LIMITE_LOTES_RANKING), [db]);

  const temDadosBase = useMemo(
    () => COLECOES_BASE.some((chave) => Array.isArray(db?.[chave]) && db[chave].length > 0),
    [db]
  );

  function handleNavigate(pagina) {
    if (typeof onNavigate === 'function' && pagina) {
      onNavigate(pagina);
    }
  }

  if (!temDadosBase) {
    return (
      <div className="page decisoes-page">
        <PageHeader
          title="Decisões da Fazenda"
          subtitle="Prioridades, riscos e oportunidades identificados a partir dos seus dados."
        />
        <EmptyState
          icon={ListChecks}
          title="Ainda não há dados suficientes para gerar decisões."
          subtitle="Cadastre lotes, pesagens, estoque e custos para o HERDON começar a apontar prioridades."
          action={onNavigate ? (
            <Button variant="primary" onClick={() => handleNavigate('lotes')}>
              Cadastrar lotes
            </Button>
          ) : null}
        />
      </div>
    );
  }

  return (
    <div className="page decisoes-page">
      <PageHeader title="Decisões da Fazenda" subtitle={insights.saudeLabel} />

      <Card title="Atenção imediata" subtitle="O que precisa ser resolvido primeiro." className="decisoes-card decisoes-card--destaque">
        {atencaoImediata.length === 0 ? (
          <div className="decisoes-vazio">
            <CheckCircle2 size={18} aria-hidden="true" />
            <span>Nenhum ponto crítico no momento. A operação está sob controle.</span>
          </div>
        ) : (
          <ul className="decisoes-lista">
            {atencaoImediata.map((alerta) => (
              <li key={alerta.id} className={`decisoes-item decisoes-item--${alerta.severidade}`}>
                <div className="decisoes-item__cabecalho">
                  <Badge variant={SEVERIDADE_BADGE[alerta.severidade]}>{SEVERIDADE_LABEL[alerta.severidade]}</Badge>
                  <strong className="decisoes-item__titulo">{alerta.titulo}</strong>
                </div>
                <p className="decisoes-item__linha"><em>Motivo:</em> {alerta.descricao}</p>
                <p className="decisoes-item__linha"><em>Impacto:</em> {obterImpacto(alerta, false)}</p>
                <p className="decisoes-item__linha"><em>Ação sugerida:</em> {alerta.acaoSugerida}</p>
                <Button variant="outline" size="sm" onClick={() => handleNavigate(alerta.pagina)}>
                  Abrir tela relacionada
                </Button>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card
        title="Saúde dos lotes"
        subtitle="Do que precisa de mais atenção ao que está indo melhor."
        className="decisoes-card"
        action={(
          <Button variant="ghost" size="sm" onClick={() => handleNavigate('lotes')}>
            Ver lotes
          </Button>
        )}
      >
        {saudeLotes.length === 0 ? (
          <div className="decisoes-vazio">
            <CheckCircle2 size={16} aria-hidden="true" />
            <span>Nenhum lote ativo para avaliar ainda.</span>
          </div>
        ) : (
          <div className="decisoes-saude-lotes">
            {saudeLotes.map((item) => (
              <SaudeLoteCard key={item.loteId} saude={item} compact titulo={item.nome || `Lote ${item.loteId}`} />
            ))}
          </div>
        )}
      </Card>

      <div className="decisoes-grid">
        {CATEGORIAS.map((categoria) => {
          const Icone = categoria.icone;
          const alertasCategoria = grupos[categoria.tipo] || [];

          return (
            <Card
              key={categoria.tipo}
              title={categoria.titulo}
              subtitle={categoria.subtitulo}
              className={`decisoes-card ${categoria.oportunidade ? 'decisoes-card--oportunidade' : ''}`}
              action={(
                <Button
                  variant="ghost"
                  size="sm"
                  icon={<Icone size={14} aria-hidden="true" />}
                  onClick={() => handleNavigate(categoria.pagina)}
                >
                  {categoria.botaoLabel}
                </Button>
              )}
            >
              {alertasCategoria.length === 0 ? (
                <div className="decisoes-vazio">
                  <CheckCircle2 size={16} aria-hidden="true" />
                  <span>{categoria.vazio}</span>
                </div>
              ) : (
                <ul className="decisoes-lista">
                  {alertasCategoria.map((alerta) => (
                    <DecisaoItem key={alerta.id} alerta={alerta} oportunidade={categoria.oportunidade} />
                  ))}
                </ul>
              )}
            </Card>
          );
        })}
      </div>
    </div>
  );
}
