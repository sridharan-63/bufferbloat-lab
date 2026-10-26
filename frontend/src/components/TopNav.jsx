import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Play, RefreshCw } from 'lucide-react';
import { useSimulation } from '../context/SimulationContext';

export default function TopNav({ title = 'System Overview' }) {
  const { experiments, activeExpId, loadExperiment, refreshExperiments } = useSimulation();
  const navigate = useNavigate();

  return (
    <header className="h-16 sticky top-0 z-40 bg-navy-900/85 backdrop-blur-md border-b border-navy-700/60 px-8 flex items-center justify-between">
      <div className="flex items-center gap-4">
        <h2 className="text-base font-semibold text-slate-100 flex items-center gap-2">
          {title}
        </h2>
        {activeExpId && (
          <span className="text-[11px] font-mono px-2.5 py-0.5 rounded-full bg-brand-teal/15 text-brand-cyan border border-brand-teal/30">
            Loaded: {activeExpId}
          </span>
        )}
      </div>

      <div className="flex items-center gap-3">
        {/* Experiment Selector */}
        <select
          value={activeExpId || ''}
          onChange={(e) => loadExperiment(e.target.value)}
          className="bg-navy-800 border border-navy-700 text-slate-200 text-xs font-mono rounded px-3 py-1.5 focus:outline-none focus:border-brand-teal transition"
        >
          {experiments.length === 0 ? (
            <option value="">No experiments recorded</option>
          ) : (
            experiments.map((exp) => (
              <option key={exp.id} value={exp.id}>
                {exp.id} ({exp.queue_type})
              </option>
            ))
          )}
        </select>

        {/* Refresh button */}
        <button
          onClick={refreshExperiments}
          title="Refresh experiment runs"
          className="p-1.5 rounded text-slate-400 hover:text-slate-100 hover:bg-navy-800 transition"
        >
          <RefreshCw className="w-4 h-4" />
        </button>

        {/* Quick Run CTA */}
        <button
          onClick={() => navigate('/run')}
          className="inline-flex items-center gap-1.5 bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-500 hover:to-cyan-400 text-white text-xs font-medium px-3.5 py-1.5 rounded shadow-sm hover:shadow-glow transition-all"
        >
          <Play className="w-3.5 h-3.5 fill-current" />
          <span>Quick Run</span>
        </button>
      </div>
    </header>
  );
}
