import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSimulation } from '../context/SimulationContext';
import SimulationTerminal from '../components/SimulationTerminal';
import { 
  Play, 
  RotateCcw, 
  CheckCircle2, 
  AlertCircle, 
  Clock, 
  Zap, 
  Cpu, 
  BarChart3, 
  Activity, 
  SlidersHorizontal,
  ChevronRight,
  ShieldCheck
} from 'lucide-react';

const PRESETS = [
  {
    id: 'droptail_bloat',
    title: 'Severe BufferBloat (DropTail)',
    desc: 'Deep 100-packet unmanaged FIFO buffer. Demonstrates classic latency inflation up to 250+ ms under TCP Cubic load.',
    color: 'from-rose-500/20 to-orange-500/10 border-rose-500/30 text-rose-400',
    params: {
      queueType: 'DropTail',
      queueSize: 100,
      bottleneckBw: 5.0,
      bottleneckDelay: 35.0,
      nClients: 3,
      tcpProtocol: 'Cubic',
      simDuration: 15.0
    }
  },
  {
    id: 'fqcodel_remedy',
    title: 'Modern AQM Solution (FQ-CoDel)',
    desc: 'Fair Queueing + Controlled Delay. Isolates delay-sensitive UDP pings from bulk TCP flows, keeping loaded RTT near baseline (~75 ms).',
    color: 'from-emerald-500/20 to-cyan-500/10 border-emerald-500/30 text-emerald-400',
    params: {
      queueType: 'FqCoDel',
      queueSize: 100,
      bottleneckBw: 5.0,
      bottleneckDelay: 35.0,
      nClients: 3,
      tcpProtocol: 'Cubic',
      simDuration: 15.0
    }
  },
  {
    id: 'codel_aqm',
    title: 'CoDel (Active Queue Management)',
    desc: 'Single-queue CoDel with 5 ms sojourn target. Controls persistent queueing delay while maintaining full bottleneck utilization.',
    color: 'from-blue-500/20 to-indigo-500/10 border-blue-500/30 text-blue-400',
    params: {
      queueType: 'CoDel',
      queueSize: 100,
      bottleneckBw: 5.0,
      bottleneckDelay: 35.0,
      nClients: 3,
      tcpProtocol: 'Cubic',
      simDuration: 15.0
    }
  },
  {
    id: 'red_aqm',
    title: 'RED (Random Early Detection)',
    desc: 'EWMA probabilistic early drop to signal TCP sources before the physical queue fills up.',
    color: 'from-amber-500/20 to-yellow-500/10 border-amber-500/30 text-amber-400',
    params: {
      queueType: 'RED',
      queueSize: 100,
      bottleneckBw: 5.0,
      bottleneckDelay: 35.0,
      nClients: 3,
      tcpProtocol: 'Cubic',
      simDuration: 15.0
    }
  }
];

export default function RunPage() {
  const navigate = useNavigate();
  const { 
    isSimRunning, 
    simProgress, 
    simElapsed, 
    simLogs, 
    runSimulation, 
    activeExpId,
    activeSummary,
    controllerStatus 
  } = useSimulation();

  const [selectedPreset, setSelectedPreset] = useState(PRESETS[0]);
  const [customParams, setCustomParams] = useState(PRESETS[0].params);

  const handleSelectPreset = (p) => {
    setSelectedPreset(p);
    setCustomParams(p.params);
  };

  const handleStart = () => {
    runSimulation(customParams);
  };

  // Compute active simulation phase
  const getPhase = (prog) => {
    if (!isSimRunning && prog === 0) return { step: 0, text: 'Idle & Ready' };
    if (prog < 20) return { step: 1, text: 'Phase 1: Initializing NS-3 Nodes, Channels & Point-to-Point Links' };
    if (prog < 45) return { step: 2, text: 'Phase 2: Baseline UDP Probing (50ms interval measurement)' };
    if (prog < 75) return { step: 3, text: 'Phase 3: Triggering TCP Cubic Congestion Flows over Bottleneck' };
    if (prog < 95) return { step: 4, text: 'Phase 4: AQM Queue Disciplinary Processing & Packet Dropping' };
    return { step: 5, text: 'Phase 5: Finalizing Discrete Events & Generating CSV Traces' };
  };

  const currentPhase = getPhase(simProgress);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2.5">
            <Zap className="w-6 h-6 text-brand-cyan" />
            Run NS-3 Simulation
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Execute native C++ NS-3 discrete-event simulations to reproduce, measure, and optimize BufferBloat in real-time.
          </p>
        </div>

        {/* Server Status Pill */}
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-slate-700/60 bg-navy-800/80 text-xs">
          <span className={`w-2.5 h-2.5 rounded-full ${controllerStatus.online ? 'bg-emerald-400 animate-pulse' : 'bg-rose-500'}`} />
          <span className="text-slate-300 font-mono">
            POSIX C Daemon: {controllerStatus.online ? 'Online (Port 8088)' : 'Offline'}
          </span>
          <span className="text-slate-500">|</span>
          <span className="text-brand-cyan font-mono font-medium">NS-3 v{controllerStatus.version}</span>
        </div>
      </div>

      {/* Grid: Execution Config & Status */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Preset Selector & Execution Triggers */}
        <div className="lg:col-span-5 space-y-4">
          <div className="bg-navy-800/90 border border-slate-700/60 rounded-xl p-5 shadow-xl backdrop-blur-sm">
            <h2 className="text-base font-semibold text-white flex items-center gap-2 mb-3">
              <SlidersHorizontal className="w-4 h-4 text-brand-blue" />
              Experiment Preset Selection
            </h2>
            <div className="space-y-2.5">
              {PRESETS.map((p) => {
                const isSelected = selectedPreset.id === p.id;
                return (
                  <button
                    key={p.id}
                    onClick={() => handleSelectPreset(p)}
                    disabled={isSimRunning}
                    className={`w-full text-left p-3.5 rounded-lg border transition-all ${
                      isSelected 
                        ? `bg-gradient-to-r ${p.color} shadow-lg ring-1 ring-brand-blue/50` 
                        : 'bg-navy-900/50 border-slate-800 hover:border-slate-700 text-slate-300 hover:bg-navy-900/80'
                    } ${isSimRunning ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-sm text-white flex items-center gap-2">
                        {p.title}
                      </span>
                      {isSelected && <span className="text-xs px-2 py-0.5 rounded bg-brand-blue/30 text-brand-cyan border border-brand-cyan/30">Active</span>}
                    </div>
                    <p className="text-xs text-slate-400 mt-1 line-clamp-2 leading-relaxed">
                      {p.desc}
                    </p>
                    <div className="flex items-center gap-3 mt-2 text-[11px] font-mono text-slate-400">
                      <span>Queue: <strong className="text-slate-200">{p.params.queueType}</strong></span>
                      <span>Buffer: <strong className="text-slate-200">{p.params.queueSize} pkts</strong></span>
                      <span>Flows: <strong className="text-slate-200">{p.params.nClients} TCP</strong></span>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Launch / Running Buttons */}
            <div className="mt-5 pt-4 border-t border-slate-700/60 flex flex-col gap-2.5">
              <button
                onClick={handleStart}
                disabled={isSimRunning || !controllerStatus.online}
                className={`w-full py-3 px-4 rounded-lg font-semibold flex items-center justify-center gap-2 shadow-lg transition-all ${
                  isSimRunning
                    ? 'bg-amber-600/30 text-amber-300 border border-amber-500/50 cursor-wait animate-pulse'
                    : !controllerStatus.online
                    ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
                    : 'bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 text-white shadow-blue-500/20 hover:shadow-cyan-500/30 active:scale-[0.99]'
                }`}
              >
                {isSimRunning ? (
                  <>
                    <Activity className="w-5 h-5 animate-spin" />
                    <span>Executing Simulation in NS-3 Engine...</span>
                  </>
                ) : (
                  <>
                    <Play className="w-5 h-5 fill-current" />
                    <span>Launch NS-3 Simulation</span>
                  </>
                )}
              </button>

              <div className="flex items-center justify-between text-xs text-slate-400 px-1">
                <span>Estimated duration: ~6-8s wall clock</span>
                <button
                  onClick={() => navigate('/config')}
                  className="text-brand-cyan hover:underline flex items-center gap-1"
                >
                  Custom parameters <ChevronRight className="w-3 h-3" />
                </button>
              </div>
            </div>
          </div>

          {/* NS-3 Kernel Architecture Info Box */}
          <div className="bg-navy-900/60 border border-slate-800 rounded-xl p-4 text-xs text-slate-400 space-y-2">
            <div className="flex items-center gap-2 text-slate-300 font-medium">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              Genuine Native Execution Pipeline
            </div>
            <p>
              When launched, the POSIX C daemon forks and invokes the compiled C++ executable <code className="text-brand-cyan font-mono bg-navy-950 px-1 py-0.5 rounded">./simulation/bufferbloat</code> with parameter flags.
            </p>
            <p>
              Real packet drops, RTT probes, and queue occupancies are collected directly via NS-3 trace callbacks and written to CSV.
            </p>
          </div>
        </div>

        {/* Right Column: Execution Progress, Status & Terminal */}
        <div className="lg:col-span-7 space-y-4">
          {/* Real-time Progress Card */}
          <div className="bg-navy-800/90 border border-slate-700/60 rounded-xl p-5 shadow-xl backdrop-blur-sm space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={`p-2.5 rounded-lg border ${
                  isSimRunning 
                    ? 'bg-amber-500/20 border-amber-500/40 text-amber-400 animate-spin' 
                    : simProgress === 100 
                    ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-400' 
                    : 'bg-navy-900 border-slate-700 text-slate-400'
                }`}>
                  {isSimRunning ? (
                    <Activity className="w-5 h-5" />
                  ) : simProgress === 100 ? (
                    <CheckCircle2 className="w-5 h-5" />
                  ) : (
                    <Cpu className="w-5 h-5" />
                  )}
                </div>
                <div>
                  <h3 className="text-base font-semibold text-white">
                    {isSimRunning ? 'Simulation Running...' : simProgress === 100 ? 'Simulation Complete' : 'Engine Ready'}
                  </h3>
                  <p className="text-xs text-slate-400">
                    {isSimRunning ? currentPhase.text : 'Select an experiment and click Launch to start.'}
                  </p>
                </div>
              </div>

              {/* Elapsed Timer */}
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-navy-900 border border-slate-700/70 font-mono text-sm text-brand-cyan">
                <Clock className="w-4 h-4 text-slate-400" />
                <span>{simElapsed.toFixed(1)}s</span>
              </div>
            </div>

            {/* Progress Bar */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-400 font-medium">Execution Progress</span>
                <span className="font-mono text-slate-200 font-semibold">{Math.round(simProgress)}%</span>
              </div>
              <div className="h-3 w-full bg-navy-950 rounded-full overflow-hidden p-0.5 border border-slate-800">
                <div 
                  className={`h-full rounded-full transition-all duration-300 ${
                    isSimRunning
                      ? 'bg-gradient-to-r from-blue-500 via-cyan-400 to-emerald-400 animate-pulse'
                      : simProgress === 100
                      ? 'bg-emerald-500'
                      : 'bg-slate-700'
                  }`}
                  style={{ width: `${simProgress}%` }}
                />
              </div>
            </div>

            {/* Step Indicators */}
            <div className="grid grid-cols-5 gap-2 pt-1 text-[11px]">
              {[
                { n: 1, label: 'Init' },
                { n: 2, label: 'Baseline' },
                { n: 3, label: 'Cubic Load' },
                { n: 4, label: 'AQM/Drops' },
                { n: 5, label: 'Trace Export' }
              ].map(step => {
                const isPassed = simProgress >= step.n * 20 || simProgress === 100;
                const isCurrent = isSimRunning && currentPhase.step === step.n;
                return (
                  <div 
                    key={step.n}
                    className={`flex flex-col items-center p-1.5 rounded border transition-colors text-center ${
                      isCurrent
                        ? 'bg-brand-blue/20 border-brand-cyan text-brand-cyan font-bold ring-1 ring-brand-cyan/40'
                        : isPassed
                        ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                        : 'bg-navy-950 border-slate-800 text-slate-500'
                    }`}
                  >
                    <span>Step {step.n}</span>
                    <span className="truncate max-w-full text-[10px]">{step.label}</span>
                  </div>
                );
              })}
            </div>

            {/* Post Run Action Bar */}
            {simProgress === 100 && !isSimRunning && (
              <div className="pt-3 border-t border-slate-700/60 flex items-center justify-between gap-3">
                <div className="text-xs text-slate-300">
                  <span className="text-emerald-400 font-semibold">Ready to analyze:</span>{' '}
                  <span className="font-mono text-slate-200">{activeExpId}</span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => navigate('/analytics')}
                    className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-brand-blue hover:bg-blue-600 text-white flex items-center gap-1.5 transition-colors"
                  >
                    <BarChart3 className="w-3.5 h-3.5" />
                    Open Analytics
                  </button>
                  <button
                    onClick={() => navigate('/results')}
                    className="px-3 py-1.5 text-xs font-medium rounded-lg bg-navy-900 border border-slate-700 text-slate-300 hover:text-white transition-colors"
                  >
                    View Raw Traces
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Integrated Simulation Terminal */}
          <SimulationTerminal logs={simLogs} isRunning={isSimRunning} />
        </div>
      </div>
    </div>
  );
}
