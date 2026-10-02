import React, { createContext, useContext, useState, useCallback, useRef } from 'react';
import { CheckCircle2, AlertCircle, Info } from 'lucide-react';

export type ToastType = 'success' | 'error' | 'info';

interface ToastContextValue {
  showToast: (message: string, type?: ToastType) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toast, setToast] = useState<{ message: string; type: ToastType } | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = useCallback((message: string, type: ToastType = 'success') => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }
    setToast({ message, type });
    timerRef.current = setTimeout(() => {
      setToast(null);
    }, 3000);
  }, []);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      {toast && (
        <div className="fixed top-5 right-6 z-[2000] bg-white border border-sky-200 shadow-lg rounded-xl px-4 py-3 flex items-center gap-2.5 text-sm font-semibold text-sky-700 animate-in fade-in slide-in-from-top-2 duration-200 pointer-events-none select-none">
          {toast.type === 'error' ? (
            <AlertCircle size={17} className="text-rose-600 shrink-0" />
          ) : toast.type === 'info' ? (
            <Info size={17} className="text-sky-600 shrink-0" />
          ) : (
            <CheckCircle2 size={17} className="text-sky-600 shrink-0" />
          )}
          <span>{toast.message}</span>
        </div>
      )}
    </ToastContext.Provider>
  );
};

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
};
