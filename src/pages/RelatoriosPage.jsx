import { useMemo } from 'react';
import { BarChart3, Beef, FileBarChart, Scale, Tractor } from 'lucide-react';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import PageHeader from '../components/PageHeader';
import { construirChecklistPrimeirosPassos } from '../domain/guiaCriador';

const RELATORIOS = [
  {
    id: 'relatorioLote',
    icon: Beef,
    titulo: 'Relatório do Lote',
    descricao: 'Veja peso, desempenho, custos e resultado de um lote.',
  },
  {
    id: 'relatorioPesagens',
    icon: Scale,
    titulo: 'Relatório de Pesagens',
    descricao: 'Acompanhe a evolução de peso e o GMD entre pesagens.',
  },
  {
    id: 'relatorioFinanceiro',
    icon: BarChart3,
    titulo: 'Relatório Financeiro',
    descricao: 'Veja o que entrou, o que saiu e o saldo do período.',
  },
  {
    id: 'relatorioPastagens',
    icon: Tractor,
    titulo: 'Relatório de Pastos',
    descricao: 'Veja quais pastos estão ocupados e quais estão vazios.',
  },
  {
    id: 'relatorioResumoGeral',
    icon: FileBarChart,
    titulo: 'Resumo Geral da Fazenda',
    descricao: 'Um resumo rápido para enviar ao dono, sócio ou gerente.',
  },
];

export default function RelatoriosPage({ db, onNavigate }) {
  const checklist = useMemo(() => construirChecklistPrimeirosPassos(db), [db]);
  const relatoriosProntos = checklist.itens.find((item) => item.id === 'relatorios')?.concluido;

  return (
    <div className="page reports-page">
      <PageHeader
        title="Relatórios"
        subtitle="Gere resumos para salvar em PDF ou compartilhar pelo WhatsApp."
      />

      {!relatoriosProntos ? (
        <Card>
          <p style={{ margin: 0 }}>
            Os relatórios aparecem melhor depois que você tiver lotes, pesagens e financeiro registrados.
          </p>
        </Card>
      ) : null}

      <div className="report-kpi-grid">
        {RELATORIOS.map((item) => {
          const Icone = item.icon;
          return (
            <Card key={item.id} title={item.titulo}>
              <div className="summary-panel" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <Icone size={24} aria-hidden="true" />
                <p style={{ margin: 0 }}>{item.descricao}</p>
                <Button size="sm" onClick={() => onNavigate?.(item.id)}>
                  Abrir relatório
                </Button>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
