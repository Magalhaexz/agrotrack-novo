import { useRef } from 'react';
import { Download, MessageCircle, Copy } from 'lucide-react';
import Button from '../ui/Button';
import { exportarRelatorio } from '../../utils/exportarPDF';
import { copiarTexto, abrirWhatsApp, compartilharResumo } from '../../utils/compartilhar';
import { useToast } from '../../hooks/useToast';

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
    const texto = getTexto?.();
    if (!texto) return;
    const ok = await copiarTexto(texto);
    showToast({ type: ok ? 'success' : 'error', message: ok ? 'Resumo copiado.' : 'Não foi possível copiar o resumo.' });
  }

  async function handleWhatsApp() {
    const texto = getTexto?.();
    if (!texto) return;
    const compartilhou = await compartilharResumo(texto, titulo);
    if (!compartilhou) {
      abrirWhatsApp(texto);
    }
  }

  function handlePdf() {
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
