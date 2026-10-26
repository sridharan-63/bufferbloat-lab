import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSimulation } from '../context/SimulationContext';
import { parseSummaryCSV } from '../utils/csvParser';
import { LoadingState, EmptyState } from '../components/FeedbackStates';
import { 
  FileText, 
  Download, 
  Search, 
  RefreshCw,
  FolderArchive,
  BarChart2
} from 'lucide-react';

export default function ResultsPage() {
  const navigate = useNavigate();
  const { experiments, loadExperiment, activeExpId, addToast } = useSimulation();
  const [searchTerm, setSearchTerm] = useState('');
  const [summaries, setSummaries] = useState({});
  const [loading, setLoading] = useState(false);

  const fetchAllSummaries = async () => {
    if (!experiments || experiments.length === 0) return;
    setLoading(true);
    const sumMap = {};

    for (const exp of experiments) {
      try {
        const res = await fetch(`/api/data?exp=${exp.id}&file=summary.csv`);
        if (res.ok) {
          sumMap[exp.id] = parseSummaryCSV(await res.text());
        }
      } catch {
        // ignore
      }
    }

    setSummaries(sumMap);
    setLoading(false);
  };

  useEffect(() => {
    fetchAllSummaries();
  }, [experiments]);

  const filteredExperiments = experiments.filter(e => {
    const s = summaries[e.id];
    const term = searchTerm.toLowerCase();
    return (
      e.id.toLowerCase().includes(term) ||
      (s?.queue_type && s.queue_type.toLowerCase().includes(term))
    );
  });

  const handleSelectAndInspect = async (expId) => {
    await loadExperiment(expId);
    addToast(`Loaded ${expId} into active dashboard`, 'info');
    navigate('/analytics');
  };

  const handleExportMarkdownReport = () => {
    if (experiments.length === 0) return;

    let md = `# BufferBloat Detection and Queue Management Optimization Report\n\n`;
    md += `**Generated:** ${new Date().toLocaleString()}\n`;
    md += `**Simulator Engine:** NS-3 Discrete-Event Simulator (ns-3.46)\n`;
    md += `**Topology:** Dumbbell Topology (3 Clients, 100 Mbps Access Links, 5 Mbps / 35 ms Bottleneck, Server Sink)\n\n`;
    md += `## Experimental Results Summary Table\n\n`;
    md += `| Experiment ID | Queue Discipline | Buffer Size | Baseline RTT | Loaded Mean RTT | Bloat Ratio | Drops | Grade | BufferBloat? |\n`;
    md += `| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |\n`;

    experiments.forEach(e => {
      const s = summaries[e.id] || {};
      md += `| \`${e.id}\` | ${s.queue_type || 'N/A'} | ${s.queue_size_pkts || 100} pkts | ${s.baseline_rtt_ms || '0'} ms | ${s.loaded_mean_rtt_ms || '0'} ms | ${s.bloat_ratio || '1.0'}x | ${s.total_drops || 0} | **${s.grade || 'N/A'}** | ${s.bufferbloat_detected === 'YES' ? '⚠️ YES' : '✅ NO'} |\n`;
    });

    md += `\n## Engineering Analysis and Key Findings\n\n`;
    md += `1. **DropTail (FIFO) Latency Inflation:** Unmanaged 100-packet router buffers cause latency to jump from ~74 ms to >140–250 ms, resulting in poor user experience for gaming and video calls.\n`;
    md += `2. **Controlled Delay (CoDel):** Maintains near-zero persistent queue delay by monitoring packet sojourn times and dropping with square-root intervals when sojourn > 5 ms.\n`;
    md += `3. **Fair Queueing CoDel (FQ-CoDel):** Provides total flow isolation via Jenkins 5-tuple hash and Deficit Round Robin, keeping thin probe packets at baseline latency (~75 ms) without sacrificing TCP throughput.\n\n`;
    md += `---\n*BufferBloat Research & Development Lab*\n`;

    const blob = new Blob([md], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `BufferBloat_NS3_Report_${Date.now()}.md`;
    a.click();
    URL.revokeObjectURL(url);
    addToast('Executive Markdown report downloaded', 'success');
  };

  const handleExportJsonBundle = () => {
    const dataStr = JSON.stringify({
      generatedAt: new Date().toISOString(),
      experiments,
      summaries
    }, null, 2);

    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ns3_simulation_results_${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    addToast('Complete JSON dataset bundle exported', 'success');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2.5">
            <FileText className="w-6 h-6 text-brand-cyan" />
            Results and Reports
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Browse, inspect, and export verified NS-3 experimental data, CSV metric traces, and executive summaries.
          </p>
        </div>

        {/* Global Export Controls */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={fetchAllSummaries}
            className="px-3 py-1.5 rounded-lg bg-navy-800 border border-slate-700 text-xs text-slate-300 hover:text-white flex items-center gap-1.5 transition-colors"
            title="Refresh results directory"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>

          <button
            onClick={handleExportMarkdownReport}
            disabled={experiments.length === 0}
            className="px-3.5 py-1.5 rounded-lg bg-navy-800 border border-brand-cyan/40 hover:bg-brand-blue/20 text-xs font-semibold text-brand-cyan flex items-center gap-1.5 transition-colors disabled:opacity-50"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export Markdown Report</span>
          </button>

          <button
            onClick={handleExportJsonBundle}
            disabled={experiments.length === 0}
            className="px-3.5 py-1.5 rounded-lg bg-navy-800 border border-slate-700 hover:border-slate-600 text-xs font-medium text-slate-300 hover:text-white flex items-center gap-1.5 transition-colors disabled:opacity-50"
          >
            <FolderArchive className="w-3.5 h-3.5" />
            <span>Export JSON Bundle</span>
          </button>
        </div>
      </div>

      {/* Search Bar */}
      <div className="relative">
        <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Filter results by experiment ID or queue algorithm..."
          className="w-full bg-navy-800/80 border border-slate-700/80 rounded-xl pl-10 pr-4 py-2.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-brand-blue"
        />
      </div>

      {loading && Object.keys(summaries).length === 0 ? (
        <LoadingState message="Scanning results directory and compiling reports..." />
      ) : filteredExperiments.length === 0 ? (
        <EmptyState 
          title="No Matching Experiments Found" 
          message="No experiment matches your search criteria, or no simulations have been run yet." 
        />
      ) : (
        <div className="bg-navy-800/90 border border-slate-700/60 rounded-xl shadow-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-700/80 text-slate-400 bg-navy-900/60">
                  <th className="py-3 px-4 font-semibold">Experiment</th>
                  <th className="py-3 px-4 font-semibold">Queue Discipline</th>
                  <th className="py-3 px-4 font-semibold">Loaded RTT</th>
                  <th className="py-3 px-4 font-semibold">Bloat Ratio</th>
                  <th className="py-3 px-4 font-semibold">Throughput</th>
                  <th className="py-3 px-4 font-semibold">Drops</th>
                  <th className="py-3 px-4 font-semibold">Grade</th>
                  <th className="py-3 px-4 font-semibold">Raw CSV Artifacts</th>
                  <th className="py-3 px-4 font-semibold text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800 text-slate-300">
                {filteredExperiments.map(exp => {
                  const s = summaries[exp.id];
                  const isActive = activeExpId === exp.id;
                  const isBloat = s?.bufferbloat_detected === 'YES';

                  return (
                    <tr 
                      key={exp.id} 
                      className={`hover:bg-navy-900/50 transition-colors ${isActive ? 'bg-brand-blue/10' : ''}`}
                    >
                      <td className="py-3.5 px-4 font-mono font-medium text-white">
                        <div className="flex items-center gap-1.5">
                          {isActive && <span className="w-1.5 h-1.5 rounded-full bg-brand-cyan" />}
                          <span>{exp.id}</span>
                        </div>
                      </td>

                      <td className="py-3.5 px-4">
                        <span className="font-semibold text-brand-cyan font-mono">
                          {s?.queue_type || 'Processing...'}
                        </span>
                        <div className="text-[11px] text-slate-400">
                          {s?.queue_size_pkts ? `${s.queue_size_pkts} pkts buffer` : ''}
                        </div>
                      </td>

                      <td className="py-3.5 px-4 font-mono">
                        <span className={`font-bold ${isBloat ? 'text-rose-400' : 'text-emerald-400'}`}>
                          {s?.loaded_mean_rtt_ms ? `${s.loaded_mean_rtt_ms} ms` : '-'}
                        </span>
                        <div className="text-[10px] text-slate-400">
                          Base: {s?.baseline_rtt_ms || '-'} ms
                        </div>
                      </td>

                      <td className="py-3.5 px-4 font-mono font-bold">
                        {s?.bloat_ratio ? `${s.bloat_ratio}x` : '-'}
                      </td>

                      <td className="py-3.5 px-4 font-mono text-cyan-400">
                        {s?.mean_throughput_mbps ? `${s.mean_throughput_mbps} Mbps` : '-'}
                      </td>

                      <td className="py-3.5 px-4 font-mono">
                        {s?.total_drops ? `${s.total_drops} pkts` : '0 pkts'}
                      </td>

                      <td className="py-3.5 px-4">
                        <span className={`px-2 py-0.5 rounded border text-[11px] font-mono font-semibold ${
                          s?.grade?.startsWith('A') 
                            ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40' 
                            : 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                        }`}>
                          {s?.grade || 'N/A'}
                        </span>
                      </td>

                      {/* Download Links for 5 CSV files */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-1.5 text-[11px]">
                          <a 
                            href={`/api/data?exp=${exp.id}&file=summary.csv`} 
                            download 
                            title="Download summary.csv"
                            className="p-1 rounded bg-navy-900 border border-slate-700 hover:border-brand-cyan hover:text-brand-cyan text-slate-400"
                          >
                            sum
                          </a>
                          <a 
                            href={`/api/data?exp=${exp.id}&file=rtt_trace.csv`} 
                            download 
                            title="Download rtt_trace.csv"
                            className="p-1 rounded bg-navy-900 border border-slate-700 hover:border-brand-cyan hover:text-brand-cyan text-slate-400"
                          >
                            rtt
                          </a>
                          <a 
                            href={`/api/data?exp=${exp.id}&file=queue_trace.csv`} 
                            download 
                            title="Download queue_trace.csv"
                            className="p-1 rounded bg-navy-900 border border-slate-700 hover:border-brand-cyan hover:text-brand-cyan text-slate-400"
                          >
                            queue
                          </a>
                          <a 
                            href={`/api/data?exp=${exp.id}&file=throughput_trace.csv`} 
                            download 
                            title="Download throughput_trace.csv"
                            className="p-1 rounded bg-navy-900 border border-slate-700 hover:border-brand-cyan hover:text-brand-cyan text-slate-400"
                          >
                            tput
                          </a>
                          <a 
                            href={`/api/data?exp=${exp.id}&file=drop_trace.csv`} 
                            download 
                            title="Download drop_trace.csv"
                            className="p-1 rounded bg-navy-900 border border-slate-700 hover:border-brand-cyan hover:text-brand-cyan text-slate-400"
                          >
                            drop
                          </a>
                        </div>
                      </td>

                      {/* Action Button */}
                      <td className="py-3.5 px-4 text-right">
                        <button
                          onClick={() => handleSelectAndInspect(exp.id)}
                          className="px-2.5 py-1 rounded bg-navy-900 hover:bg-brand-blue/30 border border-slate-700 hover:border-brand-blue text-slate-300 hover:text-white inline-flex items-center gap-1 transition-colors"
                        >
                          <BarChart2 className="w-3.5 h-3.5" />
                          <span>Inspect</span>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
