import { useRef } from 'react';
import { Download, MessageCircle, Copy } from 'lucide-react';
import Button from '../ui/Button';
import { exportarRelatorio } from '../../utils/exportarPDF';
import { copiarTexto, abrirWhatsApp, compartilharResumo } from '../../utils/compartilhar';
import { useToast } from '../../hooks/useToast';
import { isWriteAllowed, notifyBlockedWrite } from '../../services/writeGuard';

const MENSAGEM_EXPORTACAO_BLOQUEADA = 'Escolha um plano para exportar relatórios do HERDON.';

/**
 * Exportar/compartilhar um relatório é tratado como ação premium: reaproveita
 * o mesmo gate comercial do paywall de escrita (`writeGuard`) — "conta tem
 * plano ativo?" — em vez de duplicar essa checagem. Visualizar o relatório
 * continua sempre livre; só baixar/copiar/compartilhar exige plano (Sprint 4,
 * Parte 7). Sem plano, mostra a mensagem específica de exportação e
 * redireciona para Planos e Assinatura (mesmo fluxo do paywall de escrita).
 */
function garantirExportacaoPermitida() {
  if (isWriteAllowed()) return true;
  notifyBlockedWrite({ feature: 'relatorio.exportar', message: MENSAGEM_EXPORTACAO_BLOQUEADA });
  return false;
}

/**
 * Barra de ações comum a todos os relatórios: baixar/imprimir em PDF, copiar o
 * resumo em texto e compartilhar no WhatsApp. `containerRef` aponta para o
 * elemento cujo conteúdo será impresso; `getTexto` gera o resumo em texto.
 */
export default function AcoesRelatorio({ containerRef, getTexto, titulo, fazendaNome, nomeArquivo = 'relatorio' }) {
  const { showToast } = useToast();
  const internalRef = useRef(null);
  const ref = containerRef || internalRef;

  async function handleCopiar() {
    if (!garantirExportacaoPermitida()) return;
    const texto = getTexto?.();
    if (!texto) return;
    const ok = await copiarTexto(texto);
    showToast({ type: ok ? 'success' : 'error', message: ok ? 'Resumo copiado.' : 'Não foi possível copiar o resumo.' });
  }

  async function handleWhatsApp() {
    if (!garantirExportacaoPermitida()) return;
    const texto = getTexto?.();
    if (!texto) return;
    const compartilhou = await compartilharResumo(texto, titulo);
    if (!compartilhou) {
      abrirWhatsApp(texto);
    }
  }

  function handlePdf() {
    if (!garantirExportacaoPermitida()) return;
    if (!ref.current) return;
    exportarRelatorio(ref.current, nomeArquivo, { titulo, fazenda: fazendaNome });
  }

  return (
    <div className="action-row no-print" style={{ gap: 8, flexWrap: 'wrap' }}>
      <Button variant="outline" size="sm" icon={<Download size={16} />} onClick={handlePdf}>
        Baixar PDF
      </Button>
      <Button variant="outline" size="sm" icon={<Copy size={16} />} onClick={handleCopiar}>
        Copiar resumo
      </Button>
      <Button variant="outline" size="sm" icon={<MessageCircle size={16} />} onClick={handleWhatsApp}>
        Enviar resumo por WhatsApp
      </Button>
    </div>
  );
}
