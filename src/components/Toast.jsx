<<<<<<< HEAD
import React from 'react';

// Mapeamento de estilos para os tipos de toast
const toastStylesMap = {
  success: { bg: 'var(--color-success-bg)', border: 'var(--color-success)', color: 'var(--color-success-text)' },
  error: { bg: 'var(--color-danger-bg)', border: 'var(--color-danger)', color: 'var(--color-danger-text)' },
  warning: { bg: 'var(--color-warning-bg)', border: 'var(--color-warning)', color: 'var(--color-warning-text)' },
  info: { bg: 'var(--color-info-bg)', border: 'var(--color-info)', color: 'var(--color-info-text)' },
};

export default function Toast({ toast, onClose }) {
  // Usa o estilo correspondente ao tipo, ou info como fallback
  const style = toastStylesMap[toast.type] || toastStylesMap.info;

  return (
    <div
      className={`ui-toast ui-toast-${toast.type || 'info'}`} // Adiciona classes para estilização via CSS
      role="status" // Indica que o elemento é uma atualização de status
      aria-live="polite" // Anuncia mudanças de forma não intrusiva
      style={{
        background: style.bg,
        border: `1px solid ${style.border}`,
        color: style.color, // Usa a cor de texto definida no mapa
      }}
    >
      <span className="ui-toast-message">{toast.message}</span>
      <button
        type="button"
        onClick={() => onClose(toast.id)}
        className="ui-toast-close-btn" // Classe para o botão de fechar
        aria-label="Fechar notificação" // Descrição para leitores de tela
=======
const toastStyles = {
  success: { bg: 'var(--color-success-bg)', border: 'var(--color-success)' },
  error: { bg: 'var(--color-danger-bg)', border: 'var(--color-danger)' },
  warning: { bg: 'var(--color-warning-bg)', border: 'var(--color-warning)' },
  info: { bg: 'var(--color-info-bg)', border: 'var(--color-info)' },
};

export default function Toast({ toast, onClose }) {
  const style = toastStyles[toast.type] || toastStyles.info;

  return (
    <div
      style={{
        background: style.bg,
        border: `1px solid ${style.border}`,
        color: 'var(--color-text)',
        borderRadius: 10,
        padding: '10px 12px',
        minWidth: 260,
        boxShadow: 'var(--shadow-md)',
        display: 'flex',
        justifyContent: 'space-between',
        gap: 12,
      }}
    >
      <span style={{ fontSize: 14 }}>{toast.message}</span>
      <button
        type="button"
        onClick={() => onClose(toast.id)}
        style={{
          border: 'none',
          background: 'transparent',
          color: 'var(--color-text)',
          cursor: 'pointer',
          fontWeight: 700,
        }}
>>>>>>> f7f6d2991c81e0a38b5e190db55c7ad82834360d
      >
        ✕
      </button>
    </div>
  );
<<<<<<< HEAD
}
=======
}
>>>>>>> f7f6d2991c81e0a38b5e190db55c7ad82834360d
