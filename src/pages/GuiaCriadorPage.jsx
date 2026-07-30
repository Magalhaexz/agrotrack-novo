import { useMemo } from 'react';
import { CheckCircle2, Circle } from 'lucide-react';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import PageHeader from '../components/PageHeader';
import { construirChecklistPrimeirosPassos } from '../domain/guiaCriador';

const SECOES = [
  {
    titulo: 'Fazenda',
    texto: 'Cadastre sua fazenda primeiro. É a partir dela que pastos, lotes e relatórios são organizados.',
    rota: 'fazendas',
    acao: 'Ir para Fazendas',
  },
  {
    titulo: 'Pastos',
    texto: 'Cadastre os pastos da fazenda para acompanhar onde cada lote está e receber alertas de lotação.',
    rota: 'pastagens',
    acao: 'Ir para Pastos',
  },
  {
    titulo: 'Lotes',
    texto: 'Cada lote representa um grupo de animais acompanhado em conjunto — peso, custo e resultado.',
    rota: 'lotes',
    acao: 'Ir para Lotes',
  },
  {
    titulo: 'Pesagens',
    texto: 'Registre pesagens para acompanhar ganho de peso, desempenho e resultado.',
    rota: 'pesagens',
    acao: 'Ir para Pesagens',
  },
  {
    titulo: 'Financeiro',
    texto: 'Lance custos e receitas para entender o resultado dos lotes.',
    rota: 'financeiro',
    acao: 'Ir para Financeiro',
  },
  {
    titulo: 'Importação',
    texto: 'Use o modelo oficial do HERDON para trazer fazendas, pastos, lotes, animais e pesagens de uma só vez.',
    rota: 'importacao',
    acao: 'Ir para Importação',
  },
  {
    titulo: 'Modo offline',
    texto: 'Quando estiver sem internet, alguns registros ficam salvos neste aparelho e serão enviados quando a conexão voltar.',
    rota: 'sincronizacao',
    acao: 'Ir para Sincronização',
  },
  {
    titulo: 'Relatórios',
    texto: 'Gere resumos para salvar em PDF ou compartilhar pelo WhatsApp.',
    rota: 'relatorios',
    acao: 'Ir para Relatórios',
  },
];

export default function GuiaCriadorPage({ db, onNavigate }) {
  const checklist = useMemo(() => construirChecklistPrimeirosPassos(db), [db]);

  return (
    <div className="page reports-page">
      <PageHeader
        title="Guia do Criador"
        subtitle="O HERDON foi criado para ajudar você a acompanhar seus lotes, pastos, pesagens, custos e resultados em um só lugar."
      />

      <Card
        title="Primeiros passos"
        subtitle={`${checklist.totalConcluido} de ${checklist.totalItens} concluídos`}
      >
        <div className="summary-list">
          {checklist.itens.map((item) => (
            <div className="summary-row" key={item.id}>
              <span className="summary-row__label" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                {item.concluido ? (
                  <CheckCircle2 size={18} style={{ color: 'var(--color-success)' }} aria-hidden="true" />
                ) : (
                  <Circle size={18} style={{ color: 'var(--color-text-muted)' }} aria-hidden="true" />
                )}
                {item.concluido ? item.concluidoTexto : item.texto}
              </span>
              {!item.concluido ? (
                <Button size="sm" variant="outline" onClick={() => onNavigate?.(item.rota)}>
                  Resolver
                </Button>
              ) : null}
            </div>
          ))}
        </div>
      </Card>

      <div className="report-kpi-grid">
        {SECOES.map((secao) => (
          <Card key={secao.titulo} title={secao.titulo}>
            <div className="summary-panel" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <p style={{ margin: 0 }}>{secao.texto}</p>
              <div>
                <Button size="sm" onClick={() => onNavigate?.(secao.rota)}>{secao.acao}</Button>
              </div>
            </div>
          </Card>
        ))}
      </div>

      <Card title="Precisa de ajuda?">
        <div className="summary-panel" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <p style={{ margin: 0 }}>
            Se algo não funcionar como esperado ou se você tiver uma sugestão, envie um e-mail contando o que você
            estava tentando fazer e o que aconteceu. Um print da tela ajuda bastante.
          </p>
          <div>
            <Button size="sm" onClick={() => onNavigate?.('suporte')}>Enviar feedback</Button>
          </div>
        </div>
      </Card>
    </div>
  );
}
