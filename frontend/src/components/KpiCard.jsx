import React from 'react';

export default function KpiCard({ title, value, unit, subtext, icon: Icon, color = 'text-brand-cyan' }) {
  return (
    <div className="bg-navy-800 border border-navy-700/70 hover:border-brand-teal/40 rounded-xl p-5 transition-all duration-200 hover:-translate-y-0.5 shadow-card group">
      <div className="flex items-center justify-between mb-3">
        <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">{title}</span>
        {Icon && (
          <div className="w-7 h-7 rounded bg-navy-900/60 flex items-center justify-center text-slate-400 group-hover:text-brand-cyan transition-colors">
            <Icon className="w-4 h-4" />
          </div>
        )}
      </div>

      <div className="flex items-baseline gap-1.5 mb-1.5">
        <span className={`text-2xl font-bold font-mono tracking-tight text-slate-100 ${color}`}>
          {value !== undefined && value !== null ? value : '--'}
        </span>
        {unit && <span className="text-xs font-medium text-slate-400">{unit}</span>}
      </div>

      {subtext && <div className="text-[11px] text-slate-400 font-mono truncate">{subtext}</div>}
    </div>
  );
}
