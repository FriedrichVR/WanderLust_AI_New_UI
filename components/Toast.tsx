
import React, { useEffect } from 'react';
import { X, CheckCircle2, AlertCircle, Info } from 'lucide-react';

export type ToastType = 'success' | 'error' | 'info';

interface Props {
  message: string;
  type: ToastType;
  onClose: () => void;
  duration?: number;
}

const Toast: React.FC<Props> = ({ message, type, onClose, duration = 4000 }) => {
  useEffect(() => {
    const timer = setTimeout(onClose, duration);
    return () => clearTimeout(timer);
  }, [duration, onClose]);

  const styles = {
    success: 'bg-emerald-500 border-emerald-600',
    error: 'bg-red-500 border-red-600',
    info: 'bg-blue-500 border-blue-600'
  };

  const icons = {
    success: <CheckCircle2 size={20} className="shrink-0" />,
    error: <AlertCircle size={20} className="shrink-0" />,
    info: <Info size={20} className="shrink-0" />
  };

  return (
    <div className={`fixed top-6 right-6 z-[2000] flex items-start gap-3 px-5 py-4 rounded-xl shadow-2xl text-white border ${styles[type]} animate-slide-up max-w-sm backdrop-blur-md bg-opacity-95`}>
      <div className="mt-0.5">{icons[type]}</div>
      <div className="flex-1">
        <p className="text-sm font-medium leading-relaxed">{message}</p>
      </div>
      <button onClick={onClose} className="opacity-70 hover:opacity-100 transition-opacity mt-0.5">
        <X size={16} />
      </button>
    </div>
  );
};

export default Toast;
