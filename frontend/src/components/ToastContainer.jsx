import React from 'react';
import { useSimulation } from '../context/SimulationContext';
import { CheckCircle2, AlertCircle, Info } from 'lucide-react';

export default function ToastContainer() {
  const { toasts } = useSimulation();

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-2.5 max-w-sm pointer-events-none">
      {toasts.map((t) => {
        const isSuccess = t.type === 'success';
        const isError = t.type === 'error';

        return (
          <div
            key={t.id}
            className={`pointer-events-auto flex items-center gap-3 p-3.5 rounded-xl shadow-2xl border text-xs font-medium backdrop-blur-md transition-all animate-in slide-in-from-right ${
              isSuccess
                ? 'bg-navy-900/95 border-emerald-500/40 text-slate-100 border-l-4 border-l-brand-emerald'
                : isError
                ? 'bg-navy-900/95 border-rose-500/40 text-slate-100 border-l-4 border-l-brand-rose'
                : 'bg-navy-900/95 border-cyan-500/40 text-slate-100 border-l-4 border-l-brand-cyan'
            }`}
          >
            {isSuccess && <CheckCircle2 className="w-4 h-4 text-brand-emerald shrink-0" />}
            {isError && <AlertCircle className="w-4 h-4 text-brand-rose shrink-0" />}
            {!isSuccess && !isError && <Info className="w-4 h-4 text-brand-cyan shrink-0" />}
            <span>{t.message}</span>
          </div>
        );
      })}
    </div>
  );
}
