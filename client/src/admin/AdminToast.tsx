import { useState, useCallback, useRef, useEffect } from 'react';

export interface ToastState {
  type: 'success' | 'error';
  msg: string;
}

export function useAdminToast() {
  const [toast, setToast] = useState<ToastState | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = useCallback((type: 'success' | 'error', msg: string) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setToast({ type, msg });
    if (type === 'success') {
      timerRef.current = setTimeout(() => setToast(null), 5000);
    }
  }, []);

  const dismissToast = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setToast(null);
  }, []);

  useEffect(() => {
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, []);

  return { toast, showToast, dismissToast };
}

export function AdminToast({ toast, onDismiss }: { toast: ToastState | null; onDismiss: () => void }) {
  if (!toast) return null;

  return (
    <div className={`admin-toast ${toast.type}`}>
      <span className="admin-toast-msg">{toast.msg}</span>
      {toast.type === 'error' && (
        <button className="admin-toast-close" onClick={onDismiss} aria-label="Cerrar">
          ×
        </button>
      )}
    </div>
  );
}
