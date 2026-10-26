import React, { useState, useEffect } from 'react';
import { useSimulation } from '../context/SimulationContext';
import { parseSummaryCSV } from '../utils/csvParser';
import ChartPanel from '../components/ChartPanel';
import { LoadingState, EmptyState } from '../components/FeedbackStates';
import { 
  ResponsiveContainer, 
  BarChart, 
  Bar, 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ReferenceLine 
} from 'recharts';
import { 
  GitCompare, 
  CheckSquare, 
  Square, 
  Layers, 
  CheckCircle2, 
  AlertTriangle 
} from 'lucide-react';

export default function ComparisonPage() {
  const { experiments } = useSimulation();
  const [selectedIds, setSelectedIds] = useState([]);
  const [experimentSummaries, setExperimentSummaries] = useState({});
  const [loading, setLoading] = useState(false);

  // Load summaries for all experiments
  useEffect(() => {
    async function loadAllSummaries() {
      if (!experiments || experiments.length === 0) return;
      setLoading(true);
      const summaries = {};

      for (const exp of experiments) {
        try {
          const res = await fetch(`/api/data?exp=${exp.id}&file=summary.csv`);
          if (res.ok) {
            const text = await res.text();
            summaries[exp.id] = parseSummaryCSV(text);
          }
        } catch {
          // ignore error for single exp
        }
      }

      setExperimentSummaries(summaries);
      // Default: select up to first 4 experiments
      setSelectedIds(experiments.slice(0, 4).map(e => e.id));
      setLoading(false);
    }

    loadAllSummaries();
  }, [experiments]);

  const toggleSelect = (id) => {
    setSelectedIds(prev => 
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const selectAll = () => {
    setSelectedIds(experiments.map(e => e.id));
  };

  const selectNone = () => {
    setSelectedIds([]);
  };

  // Compile comparison data for selected experiments
  const selectedData = selectedIds
    .map(id => {
      const s = experimentSummaries[id];
      if (!s) return null;
      return {
        id,
        name: s.queue_type ? `${s.queue_type} (${s.queue_size_pkts || 100}pkts)` : id,
        queue_type: s.queue_type || 'Unknown',
        buffer_size: parseInt(s.queue_size_pkts) || 100,
        baseline_rtt: parseFloat(s.baseline_rtt_ms) || 0,
        loaded_rtt: parseFloat(s.loaded_mean_rtt_ms) || 0,
        peak_rtt: parseFloat(s.peak_rtt_ms) || 0,
        bloat_ratio: parseFloat(s.bloat_ratio) || 1.0,
        throughput: parseFloat(s.mean_throughput_mbps) || 0,
        drops: parseInt(s.total_drops) || 0,
        bloat_detected: s.bufferbloat_detected === 'YES',
        grade: s.grade || 'N/A'
      };
    })
    .filter(Boolean);

  // Buffer size vs RTT data (sorted by buffer size)
  const bufferVsRttData = [...selectedData]
    .sort((a, b) => a.buffer_size - b.buffer_size)
    .map(d => ({
      name: `${d.queue_type} (${d.buffer_size}p)`,
      buffer_size: d.buffer_size,
      loaded_rtt: d.loaded_rtt,
      baseline_rtt: d.baseline_rtt,
      queue_type: d.queue_type
    }));

  if (loading) {
    return <LoadingState message="Aggregating experimental results across recorded NS-3 runs..." />;
  }

  if (experiments.length === 0) {
    return (
      <EmptyState 
        title="No Experiments Recorded" 
        message="Run simulations in the Run page to collect experimental results for comparison." 
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2.5">
            <GitCompare className="w-6 h-6 text-brand-cyan" />
            Experiment Comparison
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Side-by-side analytical evaluation of DropTail vs AQM (CoDel, RED, FQ-CoDel) using verified NS-3 simulation data.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={selectAll}
            className="px-3 py-1.5 rounded-lg bg-navy-800 border border-slate-700 text-xs text-slate-300 hover:text-white transition-colors"
          >
            Select All
          </button>
          <button
            onClick={selectNone}
            className="px-3 py-1.5 rounded-lg bg-navy-800 border border-slate-700 text-xs text-slate-300 hover:text-white transition-colors"
          >
            Clear Selection
          </button>
        </div>
      </div>

      {/* Multi-Select Experiment Chips */}
      <div className="bg-navy-800/90 border border-slate-700/60 rounded-xl p-4 shadow-xl">
        <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-2.5">
          Select Experiments to Compare ({selectedIds.length} selected):
        </span>
        <div className="flex flex-wrap gap-2">
          {experiments.map(exp => {
            const isSelected = selectedIds.includes(exp.id);
            const summary = experimentSummaries[exp.id];
            return (
              <button
                key={exp.id}
                onClick={() => toggleSelect(exp.id)}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-xs font-mono transition-all ${
                  isSelected 
                    ? 'bg-brand-blue/20 border-brand-cyan text-brand-cyan shadow-sm' 
                    : 'bg-navy-900 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-200'
                }`}
              >
                {isSelected ? <CheckSquare className="w-3.5 h-3.5" /> : <Square className="w-3.5 h-3.5" />}
                <span className="font-semibold">{summary?.queue_type || exp.id}</span>
                <span className="text-[10px] text-slate-400">({summary?.loaded_mean_rtt_ms || '0'} ms)</span>
              </button>
            );
          })}
        </div>
      </div>

      {selectedData.length === 0 ? (
        <div className="p-8 text-center text-slate-400 bg-navy-800/50 border border-slate-800 rounded-xl">
          Please select at least one experiment above to view comparative analysis.
        </div>
      ) : (
        <>
          {/* Side-by-Side Comparison Table */}
          <div className="bg-navy-800/90 border border-slate-700/60 rounded-xl shadow-xl overflow-hidden">
            <div className="p-4 border-b border-slate-700/80">
              <h2 className="text-base font-semibold text-white flex items-center gap-2">
                <Layers className="w-4 h-4 text-brand-cyan" />
                Comparative Metrics Matrix
              </h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-700/80 text-slate-400 bg-navy-900/60">
                    <th className="py-3 px-4 font-semibold">Metric</th>
                    {selectedData.map(d => (
                      <th key={d.id} className="py-3 px-4 font-semibold font-mono text-white">
                        {d.queue_type} <span className="text-[11px] text-slate-400 font-normal">({d.id})</span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800 text-slate-300">
                  <tr className="hover:bg-navy-900/40">
                    <td className="py-3 px-4 font-medium text-slate-400">Buffer Size (pkts)</td>
                    {selectedData.map(d => (
                      <td key={d.id} className="py-3 px-4 font-mono">{d.buffer_size} pkts</td>
                    ))}
                  </tr>
                  <tr className="hover:bg-navy-900/40">
                    <td className="py-3 px-4 font-medium text-slate-400">Baseline RTT (ms)</td>
                    {selectedData.map(d => (
                      <td key={d.id} className="py-3 px-4 font-mono text-emerald-400">{d.baseline_rtt.toFixed(2)} ms</td>
                    ))}
                  </tr>
                  <tr className="hover:bg-navy-900/40">
                    <td className="py-3 px-4 font-medium text-slate-400">Loaded Mean RTT (ms)</td>
                    {selectedData.map(d => (
                      <td key={d.id} className={`py-3 px-4 font-mono font-bold ${d.bloat_detected ? 'text-rose-400' : 'text-emerald-400'}`}>
                        {d.loaded_rtt.toFixed(2)} ms
                      </td>
                    ))}
                  </tr>
                  <tr className="hover:bg-navy-900/40">
                    <td className="py-3 px-4 font-medium text-slate-400">Peak RTT (ms)</td>
                    {selectedData.map(d => (
                      <td key={d.id} className="py-3 px-4 font-mono">{d.peak_rtt.toFixed(2)} ms</td>
                    ))}
                  </tr>
                  <tr className="hover:bg-navy-900/40">
                    <td className="py-3 px-4 font-medium text-slate-400">Bloat Ratio (Loaded / Base)</td>
                    {selectedData.map(d => (
                      <td key={d.id} className={`py-3 px-4 font-mono font-bold ${d.bloat_detected ? 'text-rose-400' : 'text-emerald-400'}`}>
                        {d.bloat_ratio.toFixed(2)}x
                      </td>
                    ))}
                  </tr>
                  <tr className="hover:bg-navy-900/40">
                    <td className="py-3 px-4 font-medium text-slate-400">Bottleneck Throughput</td>
                    {selectedData.map(d => (
                      <td key={d.id} className="py-3 px-4 font-mono text-cyan-400">{d.throughput.toFixed(2)} Mbps</td>
                    ))}
                  </tr>
                  <tr className="hover:bg-navy-900/40">
                    <td className="py-3 px-4 font-medium text-slate-400">Total Packet Drops</td>
                    {selectedData.map(d => (
                      <td key={d.id} className="py-3 px-4 font-mono">{d.drops} pkts</td>
                    ))}
                  </tr>
                  <tr className="hover:bg-navy-900/40 bg-navy-900/30">
                    <td className="py-3 px-4 font-medium text-slate-400">BufferBloat Verdict</td>
                    {selectedData.map(d => (
                      <td key={d.id} className="py-3 px-4">
                        {d.bloat_detected ? (
                          <span className="inline-flex items-center gap-1 text-rose-400 font-semibold">
                            <AlertTriangle className="w-3.5 h-3.5" /> YES (Severe Bloat)
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-emerald-400 font-semibold">
                            <CheckCircle2 className="w-3.5 h-3.5" /> NO (Optimized)
                          </span>
                        )}
                      </td>
                    ))}
                  </tr>
                  <tr className="hover:bg-navy-900/40 bg-navy-900/50">
                    <td className="py-3 px-4 font-medium text-slate-400">BufferBloat Grade</td>
                    {selectedData.map(d => (
                      <td key={d.id} className="py-3 px-4 font-bold font-mono">
                        <span className={`px-2 py-0.5 rounded border text-xs ${
                          d.grade.startsWith('A') 
                            ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40' 
                            : 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                        }`}>
                          {d.grade}
                        </span>
                      </td>
                    ))}
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Recharts Comparison Visualizations */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            
            {/* Chart 1: Queue-Management Algorithm RTT Comparison */}
            <ChartPanel 
              title="Queue-Management Algorithm Latency Comparison" 
              subtitle="Loaded Mean RTT vs Baseline Propagation Delay across algorithms."
              badge="Loaded vs Baseline"
            >
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={selectedData} margin={{ top: 10, right: 20, left: -10, bottom: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                  <XAxis dataKey="name" stroke="#64748b" fontSize={11} angle={-15} textAnchor="end" />
                  <YAxis stroke="#64748b" fontSize={11} label={{ value: 'RTT (ms)', angle: -90, position: 'insideLeft', fill: '#64748b', fontSize: 10 }} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '8px', fontSize: '12px' }}
                    formatter={(val, name) => [`${val} ms`, name === 'loaded_rtt' ? 'Loaded RTT' : 'Baseline RTT']}
                  />
                  <Legend verticalAlign="top" wrapperStyle={{ paddingBottom: '10px', fontSize: '12px' }} />
                  <Bar dataKey="baseline_rtt" name="Baseline RTT" fill="#10b981" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="loaded_rtt" name="Loaded RTT" fill="#38bdf8" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </ChartPanel>

            {/* Chart 2: Bloat Ratio Comparison */}
            <ChartPanel 
              title="BufferBloat Latency Inflation Multiplier" 
              subtitle="Ratio of loaded latency to baseline delay (1.0x = ideal, >1.3x = BufferBloat)."
              badge="Bloat Ratio"
            >
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={selectedData} margin={{ top: 10, right: 20, left: -10, bottom: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                  <XAxis dataKey="name" stroke="#64748b" fontSize={11} angle={-15} textAnchor="end" />
                  <YAxis stroke="#64748b" fontSize={11} domain={[0.8, 'auto']} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '8px', fontSize: '12px' }}
                    formatter={(val) => [`${val}x`, 'Bloat Ratio']}
                  />
                  <ReferenceLine y={1.2} stroke="#f59e0b" strokeDasharray="3 3" label={{ value: 'Bloat Threshold (1.2x)', fill: '#f59e0b', fontSize: 10, position: 'insideTopLeft' }} />
                  <Bar dataKey="bloat_ratio" name="Bloat Ratio" fill="#f43f5e" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </ChartPanel>

            {/* Chart 3: Buffer Size vs Loaded RTT */}
            <ChartPanel 
              title="Buffer Size versus Loaded RTT Curve" 
              subtitle="Demonstrates how oversized FIFO buffers linearly inflate latency under TCP Cubic."
              badge="Buffer vs Delay"
            >
              <ResponsiveContainer width="100%" height={260}>
                <LineChart data={bufferVsRttData} margin={{ top: 10, right: 20, left: -10, bottom: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                  <XAxis dataKey="name" stroke="#64748b" fontSize={11} angle={-15} textAnchor="end" />
                  <YAxis stroke="#64748b" fontSize={11} label={{ value: 'RTT (ms)', angle: -90, position: 'insideLeft', fill: '#64748b', fontSize: 10 }} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '8px', fontSize: '12px' }}
                    formatter={(val) => [`${val} ms`, 'Loaded RTT']}
                  />
                  <Line type="monotone" dataKey="loaded_rtt" name="Loaded RTT" stroke="#ec4899" strokeWidth={2} dot={{ r: 4, fill: '#ec4899' }} />
                </LineChart>
              </ResponsiveContainer>
            </ChartPanel>

            {/* Chart 4: Bottleneck Throughput vs Packet Drops */}
            <ChartPanel 
              title="Throughput vs Packet Drop Efficiency" 
              subtitle="Shows how AQM algorithms maintain 100% throughput with minimal timely drops."
              badge="Efficiency Trade-Off"
            >
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={selectedData} margin={{ top: 10, right: 20, left: -10, bottom: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                  <XAxis dataKey="name" stroke="#64748b" fontSize={11} angle={-15} textAnchor="end" />
                  <YAxis stroke="#64748b" fontSize={11} domain={[0, 6]} label={{ value: 'Throughput (Mbps)', angle: -90, position: 'insideLeft', fill: '#64748b', fontSize: 10 }} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '8px', fontSize: '12px' }}
                    formatter={(val) => [`${val} Mbps`, 'Throughput']}
                  />
                  <ReferenceLine y={5.0} stroke="#f59e0b" strokeDasharray="3 3" label={{ value: 'Bottleneck Cap (5 Mbps)', fill: '#f59e0b', fontSize: 10, position: 'insideTopLeft' }} />
                  <Bar dataKey="throughput" name="Bottleneck Throughput" fill="#06b6d4" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </ChartPanel>

          </div>
        </>
      )}
    </div>
  );
}
