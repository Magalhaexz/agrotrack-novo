import { useCallback, useEffect, useState } from 'react';

const subscribers = new Set();
let toastStore = [];

function broadcast() {
  subscribers.forEach((subscriber) => subscriber(toastStore));
}

function addToastToStore(toast) {
  toastStore = [...toastStore.filter((item) => item.id !== toast.id), toast];
  broadcast();
}

function removeToastFromStore(id) {
  toastStore = toastStore.filter((toast) => toast.id !== id);
  broadcast();
}

export function useToast() {
  const [toasts, setToasts] = useState(() => toastStore);

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    subscribers.add(setToasts);
    setToasts(toastStore);

    return () => {
      subscribers.delete(setToasts);
    };
  }, []);
  /* eslint-enable react-hooks/set-state-in-effect */

  const removeToast = useCallback((id) => {
    removeToastFromStore(id);
  }, []);

  const showToast = useCallback(({ type = 'info', message = '', id = null, durationMs = 4000, persist = false }) => {
    const resolvedId = id || `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const ttl = Number(durationMs);
    const shouldAutoClose = !persist && Number.isFinite(ttl) && ttl > 0;

    removeToastFromStore(resolvedId);
    addToastToStore({ id: resolvedId, type, message });

    if (shouldAutoClose) {
      setTimeout(() => {
        removeToastFromStore(resolvedId);
      }, ttl);
    }

    return resolvedId;
  }, []);

  return {
    toasts,
    showToast,
    removeToast,
    dismissToast: removeToast,
  };
}
