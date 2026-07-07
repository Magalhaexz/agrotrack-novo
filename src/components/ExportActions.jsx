import { Download, Printer } from 'lucide-react';
import Button from './ui/Button';
import { isWriteAllowed, notifyBlockedWrite } from '../services/writeGuard';

const MENSAGEM_EXPORTACAO_BLOQUEADA = 'Escolha um plano para exportar relatórios do HERDON.';

/**
 * Botões de exportação reutilizáveis (CSV + impressão/PDF) — Sprint 19.
 * Mesmo gate comercial de `AcoesRelatorio.jsx` (exportar é ação premium,
 * ver writeGuard): sem plano ativo, mostra a mensagem e não executa a ação.
 * Diferente de `AcoesRelatorio`, não depende de um `containerRef` com HTML
 * já renderizado — quem usa este componente decide como gerar o CSV/print
 * (normalmente via `src/utils/exportacaoArquivos.js`).
 */
export default function ExportActions({ onExportCsv, onPrint, disabled = false, label = '' }) {
  function executarSePermitido(acao) {
    if (disabled || !acao) return;
    if (!isWriteAllowed()) {
      notifyBlockedWrite({ feature: 'relatorio.exportar', message: MENSAGEM_EXPORTACAO_BLOQUEADA });
      return;
    }
    acao();
  }

  return (
    <div className="action-row export-actions no-print" style={{ gap: 8, flexWrap: 'wrap' }}>
      {label ? <span className="export-actions-label">{label}</span> : null}
      <Button
        variant="outline"
        size="sm"
        icon={<Download size={14} />}
        disabled={disabled || !onExportCsv}
        title={disabled ? 'Não há dados para exportar.' : undefined}
        onClick={() => executarSePermitido(onExportCsv)}
      >
        Exportar CSV
      </Button>
      <Button
        variant="outline"
        size="sm"
        icon={<Printer size={14} />}
        disabled={disabled || !onPrint}
        title={disabled ? 'Não há dados para exportar.' : undefined}
        onClick={() => executarSePermitido(onPrint)}
      >
        Imprimir / PDF
      </Button>
    </div>
  );
}
