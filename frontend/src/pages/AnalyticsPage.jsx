import React, { useState, useMemo } from 'react';
import { useSimulation } from '../context/SimulationContext';
import ChartPanel from '../components/ChartPanel';
import { LoadingState, EmptyState } from '../components/FeedbackStates';
import { 
  ResponsiveContainer, 
  LineChart, 
  Line, 
  AreaChart, 
  Area, 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ReferenceLine 
} from 'recharts';

import { 
  Activity, 
  Zap, 
  Download,
  Filter
} from 'lucide-react';

// Downsample helper to maintain ultra-smooth 60fps rendering with large trace datasets
function optimizeData(data, downsample, maxPoints = 150) {
  if (!data || data.length <= maxPoints || !downsample) return data || [];
  const step = Math.ceil(data.length / maxPoints);
  return data.filter((_, idx) => idx % step === 0);
}

export default function AnalyticsPage() {
  const { activeExpId, activeSummary, traces, isLoading } = useSimulation();
  const [downsample, setDownsample] = useState(true);

  const rttData = useMemo(() => optimizeData(traces.rtt, downsample), [traces.rtt, downsample]);
  const queueData = useMemo(() => optimizeData(traces.queue, downsample), [traces.queue, downsample]);
  const throughputData = useMemo(() => optimizeData(traces.throughput, downsample), [traces.throughput, downsample]);
  const dropData = useMemo(() => optimizeData(traces.drops, downsample, 50), [traces.drops, downsample]);

  // Derive queueing delay: RTT(t) - Baseline RTT
  const baselineRTT = parseFloat(activeSummary?.baseline_rtt_ms) || 74.0;
  const queueingDelayData = useMemo(() => {
    if (!traces.rtt) return [];
    const optimized = optimizeData(traces.rtt, downsample);
    return optimized.map(item => ({
      time: item.time,
      queueDelay: Math.max(0, +(item.rtt_ms - baselineRTT).toFixed(2)),
      rtt_ms: item.rtt_ms
    }));
  }, [traces.rtt, baselineRTT, downsample]);

  if (isLoading) {
    return <LoadingState message="Fetching and processing NS-3 trace metrics..." />;
  }

  if (!activeSummary && (!traces.rtt || traces.rtt.length === 0)) {
    return (
      <EmptyState 
        title="No Experiment Data Loaded" 
        message="Run a simulation or select a recorded experiment from the top bar to inspect time-series analytics." 
      />
    );
  }

  const isBloat = activeSummary?.bufferbloat_detected === 'YES';

  return (
    <div className="space-y-6">
      {/* Header with Experiment Meta & Downsampling Toggle */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2.5">
            <Activity className="w-6 h-6 text-brand-cyan" />
            Performance Analytics: <span className="font-mono text-brand-blue">{activeExpId}</span>
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Real-time discrete-event telemetry: RTT inflation, queue occupancy, queueing delay, drops, and throughput.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setDownsample(!downsample)}
            className={`px-3 py-1.5 rounded-lg border text-xs font-medium flex items-center gap-1.5 transition-colors ${
              downsample 
                ? 'bg-navy-800 border-brand-cyan/40 text-brand-cyan' 
                : 'bg-navy-900 border-slate-700 text-slate-400 hover:text-white'
            }`}
            title="Toggle chart downsampling for high-density trace files"
          >
            <Filter className="w-3.5 h-3.5" />
            <span>Downsampling: {downsample ? 'On (Fast)' : 'Off (All Points)'}</span>
          </button>

          <a
            href={`/api/data?exp=${activeExpId}&file=summary.csv`}
            download={`${activeExpId}_summary.csv`}
            className="px-3 py-1.5 rounded-lg bg-navy-800 border border-slate-700 hover:border-slate-600 text-xs font-medium text-slate-300 hover:text-white flex items-center gap-1.5 transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export CSV</span>
          </a>
        </div>
      </div>

      {/* KPI Highlight Strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
        <div className="p-3.5 bg-navy-800/80 border border-slate-700/60 rounded-xl">
          <span className="text-xs text-slate-400">Queue Discipline</span>
          <div className="text-lg font-bold font-mono text-brand-cyan mt-1">
            {activeSummary?.queue_type || 'Unknown'}
          </div>
        </div>
        <div className="p-3.5 bg-navy-800/80 border border-slate-700/60 rounded-xl">
          <span className="text-xs text-slate-400">Baseline RTT</span>
          <div className="text-lg font-bold font-mono text-emerald-400 mt-1">
            {activeSummary?.baseline_rtt_ms || '0'} <span className="text-xs font-normal text-slate-400">ms</span>
          </div>
        </div>
        <div className="p-3.5 bg-navy-800/80 border border-slate-700/60 rounded-xl">
          <span className="text-xs text-slate-400">Loaded Mean RTT</span>
          <div className={`text-lg font-bold font-mono mt-1 ${isBloat ? 'text-rose-400' : 'text-emerald-400'}`}>
            {activeSummary?.loaded_mean_rtt_ms || '0'} <span className="text-xs font-normal text-slate-400">ms</span>
          </div>
        </div>
        <div className="p-3.5 bg-navy-800/80 border border-slate-700/60 rounded-xl">
          <span className="text-xs text-slate-400">Bloat Ratio</span>
          <div className={`text-lg font-bold font-mono mt-1 ${isBloat ? 'text-rose-400' : 'text-emerald-400'}`}>
            {activeSummary?.bloat_ratio || '1.0'}x
          </div>
        </div>
        <div className="p-3.5 bg-navy-800/80 border border-slate-700/60 rounded-xl">
          <span className="text-xs text-slate-400">Bottleneck Throughput</span>
          <div className="text-lg font-bold font-mono text-cyan-400 mt-1">
            {activeSummary?.mean_throughput_mbps || '0'} <span className="text-xs font-normal text-slate-400">Mbps</span>
          </div>
        </div>
        <div className="p-3.5 bg-navy-800/80 border border-slate-700/60 rounded-xl">
          <span className="text-xs text-slate-400">Packet Drops</span>
          <div className={`text-lg font-bold font-mono mt-1 ${parseFloat(activeSummary?.total_drops) > 0 ? 'text-amber-400' : 'text-slate-300'}`}>
            {activeSummary?.total_drops || '0'} <span className="text-xs font-normal text-slate-400">pkts</span>
          </div>
        </div>
      </div>

      {/* Grid of Visualizations */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Chart 1: RTT Over Time */}
        <ChartPanel 
          title="Round-Trip Time (RTT) Under Congestion" 
          subtitle="Measures probe ping latency before and after concurrent TCP Cubic bulk transfer activation."
          badge={`${rttData.length} samples`}
        >
          {rttData.length === 0 ? (
            <div className="h-64 flex items-center justify-center text-xs text-slate-500">No RTT trace samples recorded</div>
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={rttData} margin={{ top: 10, right: 20, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="time" stroke="#64748b" fontSize={11} tickFormatter={(v) => `${v}s`} />
                <YAxis stroke="#64748b" fontSize={11} domain={['auto', 'auto']} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '8px', fontSize: '12px' }}
                  labelFormatter={(v) => `Time: ${v}s`}
                  formatter={(val) => [`${val} ms`, 'RTT']}
                />
                <ReferenceLine 
                  y={baselineRTT} 
                  stroke="#10b981" 
                  strokeDasharray="4 4" 
                  label={{ value: `Baseline: ${baselineRTT}ms`, fill: '#10b981', fontSize: 10, position: 'insideTopLeft' }} 
                />
                <Line 
                  type="monotone" 
                  dataKey="rtt_ms" 
                  stroke="#38bdf8" 
                  strokeWidth={2} 
                  dot={false}
                  activeDot={{ r: 4, fill: '#38bdf8' }}
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </ChartPanel>

        {/* Chart 2: Queue Occupancy Over Time */}
        <ChartPanel 
          title="Bottleneck Router Queue Occupancy" 
          subtitle="Monitors the instant packet depth residing inside the router's queue discipline buffer."
          badge="Router Buffer"
        >
          {queueData.length === 0 ? (
            <div className="h-64 flex items-center justify-center text-xs text-slate-500">No queue trace samples recorded</div>
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <AreaChart data={queueData} margin={{ top: 10, right: 20, left: -10, bottom: 0 }}>
                <defs>
                  <linearGradient id="queueColor" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={isBloat ? '#f43f5e' : '#10b981'} stopOpacity={0.4}/>
                    <stop offset="95%" stopColor={isBloat ? '#f43f5e' : '#10b981'} stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="time" stroke="#64748b" fontSize={11} tickFormatter={(v) => `${v}s`} />
                <YAxis stroke="#64748b" fontSize={11} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '8px', fontSize: '12px' }}
                  labelFormatter={(v) => `Time: ${v}s`}
                  formatter={(val) => [`${val} pkts`, 'Occupancy']}
                />
                <ReferenceLine 
                  y={100} 
                  stroke="#e11d48" 
                  strokeDasharray="3 3" 
                  label={{ value: 'Buffer Limit (100 pkts)', fill: '#e11d48', fontSize: 10, position: 'insideTopRight' }} 
                />
                <Area 
                  type="stepAfter" 
                  dataKey="queue_pkts" 
                  stroke={isBloat ? '#f43f5e' : '#10b981'} 
                  fillOpacity={1} 
                  fill="url(#queueColor)" 
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </ChartPanel>

        {/* Chart 3: Queueing Delay (Sojourn) Over Time */}
        <ChartPanel 
          title="Calculated Queueing Delay" 
          subtitle="Net delay penalty induced exclusively by standing queue accumulation (RTT - RTT_baseline)."
          badge="Delay Penalty"
        >
          {queueingDelayData.length === 0 ? (
            <div className="h-64 flex items-center justify-center text-xs text-slate-500">No queueing delay data</div>
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <AreaChart data={queueingDelayData} margin={{ top: 10, right: 20, left: -10, bottom: 0 }}>
                <defs>
                  <linearGradient id="delayColor" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.4}/>
                    <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="time" stroke="#64748b" fontSize={11} tickFormatter={(v) => `${v}s`} />
                <YAxis stroke="#64748b" fontSize={11} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '8px', fontSize: '12px' }}
                  labelFormatter={(v) => `Time: ${v}s`}
                  formatter={(val) => [`+${val} ms`, 'Queueing Delay']}
                />
                <ReferenceLine 
                  y={5} 
                  stroke="#38bdf8" 
                  strokeDasharray="2 2" 
                  label={{ value: 'CoDel Target (5ms)', fill: '#38bdf8', fontSize: 10, position: 'insideBottomRight' }} 
                />
                <Area 
                  type="monotone" 
                  dataKey="queueDelay" 
                  stroke="#8b5cf6" 
                  fillOpacity={1} 
                  fill="url(#delayColor)" 
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </ChartPanel>

        {/* Chart 4: Bottleneck Throughput Over Time */}
        <ChartPanel 
          title="Bottleneck Link Throughput" 
          subtitle="Actual throughput delivered across the 5 Mbps bottleneck link to the receiving server sink."
          badge="Capacity Utilization"
        >
          {throughputData.length === 0 ? (
            <div className="h-64 flex items-center justify-center text-xs text-slate-500">No throughput trace recorded</div>
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <AreaChart data={throughputData} margin={{ top: 10, right: 20, left: -10, bottom: 0 }}>
                <defs>
                  <linearGradient id="tputColor" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.4}/>
                    <stop offset="95%" stopColor="#06b6d4" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="time" stroke="#64748b" fontSize={11} tickFormatter={(v) => `${v}s`} />
                <YAxis stroke="#64748b" fontSize={11} domain={[0, 6]} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '8px', fontSize: '12px' }}
                  labelFormatter={(v) => `Time: ${v}s`}
                  formatter={(val) => [`${val} Mbps`, 'Throughput']}
                />
                <ReferenceLine 
                  y={5.0} 
                  stroke="#f59e0b" 
                  strokeDasharray="3 3" 
                  label={{ value: 'Bottleneck Cap (5.0 Mbps)', fill: '#f59e0b', fontSize: 10, position: 'insideTopLeft' }} 
                />
                <Area 
                  type="monotone" 
                  dataKey="throughput_mbps" 
                  stroke="#06b6d4" 
                  fillOpacity={1} 
                  fill="url(#tputColor)" 
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </ChartPanel>

      </div>

      {/* Bottom Row: Packet Drop Distribution & BufferBloat Mechanics Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Drops Timeline */}
        <div className="lg:col-span-6">
          <ChartPanel 
            title="Packet Drop / Early Congestion Events" 
            subtitle="AQM deliberate early drops (CoDel/RED) vs DropTail tail-drop buffer overflow events."
            badge={`${traces.drops.length} total drops`}
          >
            {dropData.length === 0 ? (
              <div className="h-48 flex items-center justify-center text-xs text-slate-500">
                No packet drops detected in this run (buffer remained within capacity or flows under-subscribed).
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={dropData} margin={{ top: 10, right: 20, left: -10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                  <XAxis dataKey="time" stroke="#64748b" fontSize={11} tickFormatter={(v) => `${v}s`} />
                  <YAxis stroke="#64748b" fontSize={11} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '8px', fontSize: '12px' }}
                    labelFormatter={(v) => `Time: ${v}s`}
                    formatter={(val) => [`${val} pkts`, 'Dropped']}
                  />
                  <Bar dataKey="drops" fill="#f43f5e" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </ChartPanel>
        </div>

        {/* Telemetry Interpretation Box */}
        <div className="lg:col-span-6 bg-navy-800/80 border border-slate-700/60 rounded-xl p-5 shadow-lg space-y-3">
          <h3 className="text-base font-semibold text-white flex items-center gap-2">
            <Zap className="w-4 h-4 text-brand-cyan" />
            NS-3 Simulation Interpretation
          </h3>
          <p className="text-xs text-slate-300 leading-relaxed">
            In this run with <strong className="text-brand-cyan">{activeSummary?.queue_type}</strong>, 
            baseline unloaded RTT was measured at <strong className="text-emerald-400">{activeSummary?.baseline_rtt_ms} ms</strong> (physical propagation delay across 2 ms access links and 35 ms bottleneck link).
          </p>
          <div className="bg-navy-900/80 rounded-lg p-3 border border-slate-800 text-xs space-y-1.5 font-mono">
            <div className="flex justify-between">
              <span className="text-slate-400">Peak RTT Latency:</span>
              <span className="text-white font-bold">{activeSummary?.peak_rtt_ms || '0'} ms</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Peak Standing Queue:</span>
              <span className="text-white font-bold">{activeSummary?.peak_queue_pkts || '0'} packets</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Bottleneck Utilization:</span>
              <span className="text-white font-bold">
                {activeSummary?.mean_throughput_mbps ? `${((parseFloat(activeSummary.mean_throughput_mbps) / 5.0) * 100).toFixed(1)}%` : '0%'}
              </span>
            </div>
          </div>
          <p className="text-xs text-slate-400 leading-relaxed">
            {isBloat ? (
              <span className="text-rose-400 font-medium">
                Warning: BufferBloat detected. Deep FIFO queue allowed unconstrained standing packets, inflating interactive latency by {activeSummary?.bloat_ratio}x.
              </span>
            ) : (
              <span className="text-emerald-400 font-medium">
                Clean Performance: The AQM queue effectively curtailed persistent standing queues while preserving maximum bottleneck throughput.
              </span>
            )}
          </p>
        </div>

      </div>
    </div>
  );
}
