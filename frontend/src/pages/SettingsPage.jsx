import React, { useState } from 'react';
import { useSimulation } from '../context/SimulationContext';
import { 
  Server, 
  Cpu, 
  FolderTree, 
  Activity, 
  RefreshCw, 
  CheckCircle2, 
  AlertCircle, 
  Sliders
} from 'lucide-react';

export default function SettingsPage() {
  const { controllerStatus, activeExpId, refreshExperiments, addToast, addLog } = useSimulation();
  const [pingResult, setPingResult] = useState(null);
  const [isPinging, setIsPinging] = useState(false);

  const handlePingDaemon = async () => {
    setIsPinging(true);
    const start = performance.now();
    try {
      const res = await fetch('/api/status');
      const elapsed = (performance.now() - start).toFixed(1);
      if (res.ok) {
        const data = await res.json();
        setPingResult({ success: true, latency: elapsed, data });
        addToast(`Controller Daemon responded in ${elapsed} ms`, 'success');
      } else {
        setPingResult({ success: false, latency: elapsed, error: `HTTP ${res.status}` });
        addToast(`Controller returned HTTP ${res.status}`, 'error');
      }
    } catch (err) {
      const elapsed = (performance.now() - start).toFixed(1);
      setPingResult({ success: false, latency: elapsed, error: err.message });
      addToast(`Ping failed: ${err.message}`, 'error');
    } finally {
      setIsPinging(false);
    }
  };

  const handleRefreshCache = async () => {
    const list = await refreshExperiments();
    addToast(`Refreshed ${list?.length || 0} experiment runs`, 'info');
    addLog(`Cache refresh: discovered ${list?.length || 0} experiment directories.`);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Top Header Card */}
      <div className="bg-navy-800 border border-navy-700/70 rounded-2xl p-6 shadow-card">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-brand-blue to-brand-cyan flex items-center justify-center text-white shadow-glow">
              <Server className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-100">
                System Infrastructure & Daemon Settings
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Low-level POSIX TCP socket daemon, NS-3.46 discrete engine, and environment diagnostics.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handlePingDaemon}
              disabled={isPinging}
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-navy-900 border border-navy-700 hover:border-brand-cyan/40 text-xs font-medium text-slate-200 transition shadow-sm"
            >
              <Activity className={`w-3.5 h-3.5 text-brand-cyan ${isPinging ? 'animate-spin' : ''}`} />
              <span>{isPinging ? 'Pinging...' : 'Ping Daemon (8088)'}</span>
            </button>

            <button
              onClick={handleRefreshCache}
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-500 hover:to-cyan-400 text-white text-xs font-medium shadow-sm transition"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Refresh Runs</span>
            </button>
          </div>
        </div>

        {pingResult && (
          <div className={`mt-4 p-3 rounded-xl border text-xs font-mono flex items-center justify-between ${
            pingResult.success 
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300' 
              : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
          }`}>
            <div className="flex items-center gap-2">
              {pingResult.success ? <CheckCircle2 className="w-4 h-4 text-brand-emerald" /> : <AlertCircle className="w-4 h-4 text-brand-rose" />}
              <span>
                {pingResult.success ? `Controller Daemon is HEALTHY. RTT: ${pingResult.latency} ms` : `Daemon Unreachable: ${pingResult.error} (${pingResult.latency} ms)`}
              </span>
            </div>
            <span className="text-[11px] opacity-75">
              {pingResult.success ? `Engine NS-3 v${pingResult.data?.ns3_version || '3.46'}` : 'Check C daemon process'}
            </span>
          </div>
        )}
      </div>

      {/* Grid: Daemon Architecture + System Paths */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Daemon Architecture Card */}
        <div className="bg-navy-800 border border-navy-700/70 rounded-2xl p-6 shadow-card space-y-4">
          <div className="flex items-center gap-2.5 pb-3 border-b border-navy-700/60">
            <Cpu className="w-4 h-4 text-brand-cyan" />
            <h3 className="text-sm font-semibold text-slate-100">Native C Socket Controller</h3>
          </div>

          <div className="space-y-3 text-xs">
            <div className="flex items-center justify-between p-2.5 rounded-lg bg-navy-900/60 border border-navy-700/40">
              <span className="text-slate-400">Server Architecture</span>
              <span className="font-mono text-slate-200">POSIX C99 (socket, bind, listen, fork)</span>
            </div>

            <div className="flex items-center justify-between p-2.5 rounded-lg bg-navy-900/60 border border-navy-700/40">
              <span className="text-slate-400">Listening Port</span>
              <span className="font-mono text-brand-cyan">TCP 127.0.0.1:8088</span>
            </div>

            <div className="flex items-center justify-between p-2.5 rounded-lg bg-navy-900/60 border border-navy-700/40">
              <span className="text-slate-400">Daemon Status</span>
              <span className="inline-flex items-center gap-1.5 font-mono">
                <span className={`w-2 h-2 rounded-full ${controllerStatus.online ? 'bg-brand-emerald' : 'bg-brand-rose'}`} />
                <span className={controllerStatus.online ? 'text-brand-emerald' : 'text-brand-rose'}>
                  {controllerStatus.online ? (controllerStatus.isRunning ? 'Executing Simulation' : 'Ready / Idle') : 'Offline (Start ./controller/server)'}
                </span>
              </span>
            </div>

            <div className="flex items-center justify-between p-2.5 rounded-lg bg-navy-900/60 border border-navy-700/40">
              <span className="text-slate-400">Process Concurrency Guard</span>
              <span className="font-mono text-slate-200">Single-Execution Mutex (HTTP 409 on overlap)</span>
            </div>

            <div className="flex items-center justify-between p-2.5 rounded-lg bg-navy-900/60 border border-navy-700/40">
              <span className="text-slate-400">Supported Queue Disciplines</span>
              <span className="font-mono text-brand-teal">DropTail, CoDel, RED, FqCoDel, PIE</span>
            </div>
          </div>
        </div>

        {/* System Paths Card */}
        <div className="bg-navy-800 border border-navy-700/70 rounded-2xl p-6 shadow-card space-y-4">
          <div className="flex items-center gap-2.5 pb-3 border-b border-navy-700/60">
            <FolderTree className="w-4 h-4 text-brand-teal" />
            <h3 className="text-sm font-semibold text-slate-100">Filesystem & Target Binaries</h3>
          </div>

          <div className="space-y-3 text-xs">
            <div className="p-2.5 rounded-lg bg-navy-900/60 border border-navy-700/40">
              <span className="text-slate-400 block mb-1">NS-3 Simulation Binary:</span>
              <span className="font-mono text-brand-cyan text-[11px] break-all">simulation/bufferbloat (ELF 64-bit C++20)</span>
            </div>

            <div className="p-2.5 rounded-lg bg-navy-900/60 border border-navy-700/40">
              <span className="text-slate-400 block mb-1">Results Archive Directory:</span>
              <span className="font-mono text-slate-200 text-[11px] break-all">results/ (summary.csv, rtt_trace.csv, queue_trace.csv, etc.)</span>
            </div>

            <div className="p-2.5 rounded-lg bg-navy-900/60 border border-navy-700/40">
              <span className="text-slate-400 block mb-1">Current Active Experiment ID:</span>
              <span className="font-mono text-brand-amber text-[11px] break-all">{activeExpId || 'None loaded'}</span>
            </div>

            <div className="p-2.5 rounded-lg bg-navy-900/60 border border-navy-700/40">
              <span className="text-slate-400 block mb-1">Live Process Log:</span>
              <span className="font-mono text-slate-300 text-[11px] break-all">results/sim.log (STDOUT & STDERR redirection)</span>
            </div>
          </div>
        </div>
      </div>

      {/* Algorithmic Reference & Standards Matrix */}
      <div className="bg-navy-800 border border-navy-700/70 rounded-2xl p-6 shadow-card space-y-4">
        <div className="flex items-center gap-2.5 pb-3 border-b border-navy-700/60">
          <Sliders className="w-4 h-4 text-brand-indigo" />
          <h3 className="text-sm font-semibold text-slate-100">AQM Standard Parameters & Specifications</h3>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-mono">
            <thead>
              <tr className="border-b border-navy-700/60 text-slate-400">
                <th className="pb-3 font-semibold">Algorithm</th>
                <th className="pb-3 font-semibold">IETF RFC</th>
                <th className="pb-3 font-semibold">Target / Control Metric</th>
                <th className="pb-3 font-semibold">Interval / Window</th>
                <th className="pb-3 font-semibold">Bloat Grade</th>
                <th className="pb-3 font-semibold">NS-3 Class</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-navy-700/40 text-slate-200">
              <tr>
                <td className="py-3 font-bold text-rose-400">DropTail</td>
                <td className="py-3 text-slate-400">Traditional</td>
                <td className="py-3">Physical Buffer Fullness (100 pkts)</td>
                <td className="py-3 text-slate-400">None</td>
                <td className="py-3"><span className="px-2 py-0.5 rounded bg-rose-500/15 text-rose-300 border border-rose-500/30">Grade D / F</span></td>
                <td className="py-3 text-slate-400">DropTailQueue</td>
              </tr>
              <tr>
                <td className="py-3 font-bold text-amber-400">RED</td>
                <td className="py-3 text-slate-400">RFC 2309</td>
                <td className="py-3">minTh=20p, maxTh=80p, w_q=0.002</td>
                <td className="py-3 text-slate-400">EWMA Queue Size</td>
                <td className="py-3"><span className="px-2 py-0.5 rounded bg-amber-500/15 text-amber-300 border border-amber-500/30">Grade B / C</span></td>
                <td className="py-3 text-slate-400">RedQueueDisc</td>
              </tr>
              <tr>
                <td className="py-3 font-bold text-blue-400">CoDel</td>
                <td className="py-3 text-slate-400">RFC 8289</td>
                <td className="py-3">Target Sojourn Delay = 5.0 ms</td>
                <td className="py-3">Interval = 100.0 ms</td>
                <td className="py-3"><span className="px-2 py-0.5 rounded bg-blue-500/15 text-blue-300 border border-blue-500/30">Grade A</span></td>
                <td className="py-3 text-slate-400">CoDelQueueDisc</td>
              </tr>
              <tr>
                <td className="py-3 font-bold text-emerald-400">FQ-CoDel</td>
                <td className="py-3 text-slate-400">RFC 8290</td>
                <td className="py-3">1024 Flow Buckets + CoDel (5ms)</td>
                <td className="py-3">DRR Quantum = 1514 B</td>
                <td className="py-3"><span className="px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">Grade A+</span></td>
                <td className="py-3 text-slate-400">FqCoDelQueueDisc</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
