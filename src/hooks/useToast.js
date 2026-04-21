import { useCallback, useState } from 'react';

/**
 * Hook personalizado para gerenciar e exibir notificações "toast".
 * Permite adicionar toasts que são automaticamente removidos após um tempo.
 *
 * @returns {{
 *   toasts: Array<{id: string, type: 'info'|'success'|'error'|'warning', message: string}>,
 *   showToast: ({ type?: 'info'|'success'|'error'|'warning', message: string }) => void,
 *   removeToast: (id: string) => void
 * }} Um objeto contendo a lista de toasts, uma função para adicionar toasts e uma função para remover toasts.
 */
export function useToast() {
  const [toasts, setToasts] = useState([]);

  /**
   * Remove um toast específico da lista.
   * Memorizado com useCallback para evitar recriação desnecessária.
   * @param {string} id - O ID do toast a ser removido.
   */
  const removeToast = useCallback((id) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  }, []); // Dependência vazia, pois setToasts é estável e a lógica não depende de props/state do escopo.

  /**
   * Adiciona um novo toast à lista e agenda sua remoção automática.
   * Memorizado com useCallback para evitar recriação desnecessária.
   * @param {object} options - Opções do toast.
   * @param {'info'|'success'|'error'|'warning'} [options.type='info'] - O tipo do toast (afeta o estilo).
   * @param {string} [options.message=''] - A mensagem a ser exibida no toast.
   */
  const showToast = useCallback(
    ({ type = 'info', message = '' }) => {
      const id = `${Date.now()}-${Math.random().toString(16).slice(2)}`; // Gera um ID único
      setToasts((prev) => [...prev, { id, type, message }]);

      // Agenda a remoção automática do toast após 4 segundos
      setTimeout(() => {
        removeToast(id);
      }, 4000);
    },
    [removeToast] // Depende de removeToast, que é uma função memorizada.
  );

  return {
    toasts,
    showToast,
    removeToast,
  };
}