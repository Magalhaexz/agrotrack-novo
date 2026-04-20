import { useCallback, useState } from 'react';

export function useToast() {
  const [toasts, setToasts] = useState([]);

  const removeToast = useCallback((id) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  }, []);

  const showToast = useCallback(
    ({ type = 'info', message = '' }) => {
      const id = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
      setToasts((prev) => [...prev, { id, type, message }]);

      setTimeout(() => {
        removeToast(id);
      }, 4000);
    },
    [removeToast]
  );

  return {
    toasts,
    showToast,
    removeToast,
  };
}
