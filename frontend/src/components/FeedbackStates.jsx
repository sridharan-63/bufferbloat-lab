import React from 'react';
import { Loader2, AlertCircle, Inbox } from 'lucide-react';

export function LoadingState({ message = 'Loading simulation data...' }) {
  return (
    <div className="flex flex-col items-center justify-center p-12 text-slate-400">
      <Loader2 className="w-8 h-8 animate-spin text-brand-cyan mb-3" />
      <p className="text-xs font-mono">{message}</p>
    </div>
  );
}

export function EmptyState({ title = 'No Data Available', message = 'Run an experiment or select one from the history.' }) {
  return (
    <div className="flex flex-col items-center justify-center p-12 text-center text-slate-400">
      <div className="w-12 h-12 rounded-full bg-navy-900 border border-navy-700 flex items-center justify-center mb-3 text-slate-500">
        <Inbox className="w-6 h-6" />
      </div>
      <h4 className="text-sm font-semibold text-slate-200 mb-1">{title}</h4>
      <p className="text-xs text-slate-400 max-w-sm">{message}</p>
    </div>
  );
}

export function ErrorState({ title = 'Error Loading Experiment', message = 'An unexpected error occurred while fetching trace data.' }) {
  return (
    <div className="flex flex-col items-center justify-center p-12 text-center text-brand-rose">
      <div className="w-12 h-12 rounded-full bg-rose-950/40 border border-rose-500/30 flex items-center justify-center mb-3">
        <AlertCircle className="w-6 h-6" />
      </div>
      <h4 className="text-sm font-semibold text-slate-200 mb-1">{title}</h4>
      <p className="text-xs text-slate-400 max-w-sm">{message}</p>
    </div>
  );
}
