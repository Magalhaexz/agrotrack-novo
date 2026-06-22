/**
 * Copia texto para a área de transferência. Usa a Clipboard API quando disponível
 * e cai para um textarea temporário em navegadores/contextos sem suporte.
 */
export async function copiarTexto(texto) {
  if (navigator?.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(texto);
      return true;
    } catch {
      // segue para o fallback
    }
  }

  try {
    const textarea = document.createElement('textarea');
    textarea.value = texto;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    const sucesso = document.execCommand('copy');
    document.body.removeChild(textarea);
    return sucesso;
  } catch {
    return false;
  }
}

/**
 * Abre o WhatsApp Web/App com o texto já preenchido via link wa.me.
 * Não anexa PDF — comportamento intencionalmente simples e estável entre navegadores.
 */
export function abrirWhatsApp(texto) {
  const url = `https://wa.me/?text=${encodeURIComponent(texto)}`;
  window.open(url, '_blank', 'noopener,noreferrer');
}

/**
 * Tenta compartilhar via Web Share API nativa (mobile). Retorna false quando a API
 * não está disponível ou o usuário cancela, para o chamador decidir o fallback.
 */
export async function compartilharResumo(texto, titulo = 'Resumo HERDON') {
  if (navigator?.share) {
    try {
      await navigator.share({ title: titulo, text: texto });
      return true;
    } catch {
      return false;
    }
  }
  return false;
}
