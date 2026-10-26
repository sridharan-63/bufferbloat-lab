import React from 'react';

export default function ChartPanel({ title, badge, children, action }) {
  return (
    <div className="bg-navy-800 border border-navy-700/70 rounded-2xl p-6 shadow-card flex flex-col h-[360px]">
      <div className="flex items-center justify-between mb-4 shrink-0">
        <h3 className="text-sm font-semibold text-slate-100 flex items-center gap-2">
          {title}
        </h3>
        <div className="flex items-center gap-2">
          {badge && (
            <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-navy-900 border border-navy-700 text-slate-400">
              {badge}
            </span>
          )}
          {action}
        </div>
      </div>
      <div className="flex-1 w-full min-h-0">
        {children}
      </div>
    </div>
  );
}
