import { useCallback, useEffect, useState } from 'react';

const subscribers = new Set();
let toastStore = [];

function broadcast() {
  subscribers.forEach((subscriber) => subscriber(toastStore));
}

function addToastToStore(toast) {
  toastStore = [...toastStore, toast];
  broadcast();
}

function removeToastFromStore(id) {
  toastStore = toastStore.filter((toast) => toast.id !== id);
  broadcast();
}

export function useToast() {
  const [toasts, setToasts] = useState(() => toastStore);

  useEffect(() => {
    subscribers.add(setToasts);
    setToasts(toastStore);

    return () => {
      subscribers.delete(setToasts);
    };
  }, []);

  const removeToast = useCallback((id) => {
    removeToastFromStore(id);
  }, []);

  const showToast = useCallback(({ type = 'info', message = '' }) => {
    const id = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    addToastToStore({ id, type, message });

    setTimeout(() => {
      removeToastFromStore(id);
    }, 4000);
  }, []);

  return {
    toasts,
    showToast,
    removeToast,
  };
}
