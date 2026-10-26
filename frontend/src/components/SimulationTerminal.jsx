import React, { useRef, useEffect } from 'react';
import { Trash2 } from 'lucide-react';

export default function SimulationTerminal({ logs, onClear }) {
  const endRef = useRef(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  const getLineClass = (type) => {
    switch (type) {
      case 'error': return 'text-brand-rose';
      case 'success': return 'text-brand-emerald font-semibold';
      case 'warning': return 'text-brand-amber';
      case 'highlight': return 'text-brand-cyan font-semibold';
      default: return 'text-sky-400';
    }
  };

  return (
    <div className="bg-navy-800 border border-navy-700/70 rounded-2xl p-6 shadow-card flex flex-col h-[400px]">
      <div className="flex items-center justify-between mb-3 shrink-0">
        <h3 className="text-sm font-semibold text-slate-100 font-sans">
          Simulation Engine Terminal Console
        </h3>
        {onClear && (
          <button
            onClick={onClear}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-navy-900 border border-navy-700 hover:border-navy-600 text-xs text-slate-400 hover:text-slate-200 transition"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Clear</span>
          </button>
        )}
      </div>

      <div className="flex-1 bg-navy-950 rounded-xl p-4 font-mono text-xs overflow-y-auto border border-navy-900 leading-relaxed select-text">
        {logs.map((log, idx) => (
          <div key={idx} className={`mb-1 ${getLineClass(log.type)}`}>
            <span className="text-slate-600 mr-2">[{log.time}]</span>
            {log.text}
          </div>
        ))}
        <div ref={endRef} />
      </div>
    </div>
  );
}
