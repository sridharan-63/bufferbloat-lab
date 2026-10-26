import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useSimulation } from '../context/SimulationContext';
import { 
  GitBranch, 
  Check, 
  X, 
  AlertTriangle, 
  ShieldCheck, 
  Zap, 
  Cpu, 
  Layers, 
  ArrowRight,
  TrendingDown,
  Sparkles
} from 'lucide-react';

const ALGORITHMS = [
  {
    id: 'DropTail',
    name: 'DropTail (FIFO Queue)',
    subtitle: 'Classic Unmanaged Buffer',
    rfc: 'Traditional / Non-AQM',
    verdict: 'Severe Bloat',
    grade: 'Grade D / F',
    gradeColor: 'text-rose-400 bg-rose-500/10 border-rose-500/30',
    overview: 'A simple First-In-First-Out queue. When packets arrive faster than the bottleneck departure rate, they occupy buffer slots unconditionally until full (tail drop).',
    mechanics: [
      'Drops packets ONLY when buffer hits 100% capacity (100 packets).',
      'No awareness of packet sojourn delay or traffic flow identity.',
      'Allows TCP senders to fill the buffer, creating hundreds of milliseconds of artificial latency.',
      'Causes global TCP synchronization and packet lock-out.'
    ],
    cons: ['Standing queues persist indefinitely', 'Destroys gaming, VoIP, and video calls', 'High bloat ratio (2.5x to 5.0x+ baseline)']
  },
  {
    id: 'RED',
    name: 'Random Early Detection (RED)',
    subtitle: 'Queue-Length Based AQM',
    rfc: 'RFC 2309 / RFC 7567',
    verdict: 'Moderate Bloat Reduction',
    grade: 'Grade B / C',
    gradeColor: 'text-amber-400 bg-amber-500/10 border-amber-500/30',
    overview: 'Monitors the average queue size using an Exponentially Weighted Moving Average (EWMA) and drops packets probabilistically before the buffer overflows.',
    mechanics: [
      'Calculates moving average queue length avg_q.',
      'If avg_q < minTh, no drops.',
      'If minTh <= avg_q < maxTh, drops with probability proportional to queue growth.',
      'Signals TCP senders via early loss or ECN to back off congestion windows early.'
    ],
    cons: ['Extremely sensitive to parameter tuning (minTh, maxTh, w_q)', 'Tied to buffer length rather than time/delay', 'Cannot isolate heavy flows from thin flows']
  },
  {
    id: 'CoDel',
    name: 'Controlled Delay (CoDel)',
    subtitle: 'Delay-Based AQM (RFC 8289)',
    rfc: 'RFC 8289',
    verdict: 'Strong Bloat Elimination',
    grade: 'Grade A',
    gradeColor: 'text-blue-400 bg-blue-500/10 border-blue-500/30',
    overview: 'Revolutionary AQM that measures time instead of packets. Distinguishes between "good queues" (absorbing transient bursts) and "bad queues" (standing persistent buffers).',
    mechanics: [
      'Tracks packet sojourn time: difference between dequeue and enqueue time.',
      'If minimum sojourn delay remains above Target (5 ms) for an Interval (100 ms), enters drop state.',
      'Drops packet at square-root interval: interval / sqrt(count).',
      'Requires zero tuning across varied link bandwidths (1 Mbps to 10 Gbps).'
    ],
    cons: ['Single-queue architecture means low-rate packets still share queue behind a heavy TCP burst']
  },
  {
    id: 'FqCoDel',
    name: 'Fair Queueing CoDel (FQ-CoDel)',
    subtitle: 'Hybrid Flow-Isolation AQM (RFC 8290)',
    rfc: 'RFC 8290 (IETF Recommended)',
    verdict: 'Optimal - Zero Bloat',
    grade: 'Grade A+',
    gradeColor: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30',
    overview: 'The gold standard in network queue management. Combines 1024-bucket Jenkins hash flow separation, Deficit Round Robin (DRR), and per-flow CoDel.',
    mechanics: [
      'Hashes 5-tuple (src/dst IP & port, protocol) into separate stochastic subqueues.',
      'Deficit Round Robin scheduling prioritizes sparse flows (DNS, ping, gaming, VoIP).',
      'Applies CoDel independently to each active subqueue.',
      'Completely protects interactive traffic even while full-throttle multi-gigabit downloads occur.'
    ],
    cons: ['Slightly higher CPU overhead than DropTail (negligible on modern network processors)']
  }
];

export default function QueueManagementPage() {
  const navigate = useNavigate();
  const { experiments, runSimulation, isSimRunning } = useSimulation();

  const handleQuickRun = (algoId) => {
    runSimulation({
      queueType: algoId,
      queueSize: 100,
      bottleneckBw: 5.0,
      bottleneckDelay: 35.0,
      nClients: 3,
      tcpProtocol: 'Cubic',
      simDuration: 15.0
    });
    navigate('/run');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2.5">
          <GitBranch className="w-6 h-6 text-brand-cyan" />
          Queue Management Algorithms
        </h1>
        <p className="text-sm text-slate-400 mt-1">
          Comparative deep dive into FIFO BufferBloat mechanics and modern Active Queue Management (AQM) solutions in NS-3.
        </p>
      </div>

      {/* Overview Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {ALGORITHMS.map((algo) => {
          // Check if user has an experiment for this algorithm in the database
          const matchingExp = experiments.find(e => 
            e.id.toLowerCase().includes(algo.id.toLowerCase())
          );

          return (
            <div 
              key={algo.id}
              className="bg-navy-800/90 border border-slate-700/60 rounded-xl p-5 shadow-xl flex flex-col justify-between hover:border-slate-600 transition-all"
            >
              <div className="space-y-3">
                <div className="flex items-start justify-between">
                  <div>
                    <h2 className="text-lg font-bold text-white flex items-center gap-2">
                      {algo.name}
                    </h2>
                    <span className="text-xs text-slate-400 font-mono">{algo.rfc}</span>
                  </div>
                  <span className={`text-xs font-semibold px-2.5 py-1 rounded-full border ${algo.gradeColor}`}>
                    {algo.grade}
                  </span>
                </div>

                <p className="text-xs text-slate-300 leading-relaxed">
                  {algo.overview}
                </p>

                {/* Mechanics List */}
                <div className="bg-navy-900/60 border border-slate-800 rounded-lg p-3 space-y-1.5">
                  <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                    Core Mechanics:
                  </span>
                  <ul className="space-y-1 text-xs text-slate-300">
                    {algo.mechanics.map((m, idx) => (
                      <li key={idx} className="flex items-start gap-1.5">
                        <span className="text-brand-cyan mt-0.5">•</span>
                        <span>{m}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              {/* Bottom Action / Matching Experiment Footer */}
              <div className="mt-4 pt-3 border-t border-slate-700/60 flex items-center justify-between text-xs">
                {matchingExp ? (
                  <div className="flex items-center gap-2 text-slate-400">
                    <Check className="w-4 h-4 text-emerald-400" />
                    <span>Tested: <strong className="text-slate-200">{matchingExp.id}</strong></span>
                  </div>
                ) : (
                  <span className="text-slate-500">Not tested yet in this session</span>
                )}

                <button
                  onClick={() => handleQuickRun(algo.id)}
                  disabled={isSimRunning}
                  className="px-3 py-1.5 rounded-lg bg-navy-900 hover:bg-brand-blue/30 border border-slate-700 hover:border-brand-blue text-xs font-medium text-slate-200 hover:text-white flex items-center gap-1.5 transition-colors disabled:opacity-50"
                >
                  <span>Simulate {algo.id}</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Systematic Feature Comparison Matrix */}
      <div className="bg-navy-800/90 border border-slate-700/60 rounded-xl p-5 shadow-xl">
        <h2 className="text-base font-semibold text-white flex items-center gap-2 mb-4">
          <Sparkles className="w-4 h-4 text-brand-cyan" />
          Technical Queue-Discipline Comparison Matrix
        </h2>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-700/80 text-slate-400 bg-navy-900/50">
                <th className="py-3 px-4 font-semibold">Queue Discipline</th>
                <th className="py-3 px-4 font-semibold">Evaluation Metric</th>
                <th className="py-3 px-4 font-semibold">Tuning Required</th>
                <th className="py-3 px-4 font-semibold">Multi-Flow Fairness</th>
                <th className="py-3 px-4 font-semibold">Ping / VoIP Protection</th>
                <th className="py-3 px-4 font-semibold">Typical Loaded RTT</th>
                <th className="py-3 px-4 font-semibold">Recommended Deployment</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800 text-slate-300">
              <tr className="hover:bg-navy-900/40">
                <td className="py-3 px-4 font-bold text-rose-400">DropTail</td>
                <td className="py-3 px-4">Buffer Capacity Limit (Packets)</td>
                <td className="py-3 px-4 text-emerald-400">None (Static size)</td>
                <td className="py-3 px-4 text-rose-400">None (Monopolized by heavy flow)</td>
                <td className="py-3 px-4 text-rose-400">Severe Lag (150 - 300+ ms)</td>
                <td className="py-3 px-4 font-mono text-rose-400">140 - 250 ms</td>
                <td className="py-3 px-4 text-slate-400">Legacy systems (Avoid)</td>
              </tr>
              <tr className="hover:bg-navy-900/40">
                <td className="py-3 px-4 font-bold text-amber-400">RED</td>
                <td className="py-3 px-4">EWMA Queue Depth (avg_q)</td>
                <td className="py-3 px-4 text-rose-400">High (minTh, maxTh, w_q)</td>
                <td className="py-3 px-4 text-amber-400">Partial (Probabilistic)</td>
                <td className="py-3 px-4 text-amber-400">Moderate Improvement</td>
                <td className="py-3 px-4 font-mono text-amber-400">90 - 120 ms</td>
                <td className="py-3 px-4 text-slate-400">Enterprise Routers (ECN)</td>
              </tr>
              <tr className="hover:bg-navy-900/40">
                <td className="py-3 px-4 font-bold text-blue-400">CoDel</td>
                <td className="py-3 px-4">Packet Sojourn Time (5ms target)</td>
                <td className="py-3 px-4 text-emerald-400">Zero (Automatic)</td>
                <td className="py-3 px-4 text-slate-400">Single Queue FIFO</td>
                <td className="py-3 px-4 text-blue-400">Good (~80-95 ms)</td>
                <td className="py-3 px-4 font-mono text-blue-400">80 - 95 ms</td>
                <td className="py-3 px-4 text-slate-400">Core Transit Routers</td>
              </tr>
              <tr className="hover:bg-navy-900/40 bg-emerald-500/5">
                <td className="py-3 px-4 font-bold text-emerald-400">FQ-CoDel</td>
                <td className="py-3 px-4">Per-Flow Sojourn + DRR Quantums</td>
                <td className="py-3 px-4 text-emerald-400">Zero (Self-managing)</td>
                <td className="py-3 px-4 text-emerald-400 font-bold">Complete (1024 Flow Buckets)</td>
                <td className="py-3 px-4 text-emerald-400 font-bold">Flawless (~75 ms baseline)</td>
                <td className="py-3 px-4 font-mono text-emerald-400 font-bold">75 - 79 ms</td>
                <td className="py-3 px-4 text-emerald-300 font-medium">Home Gateways, Wi-Fi, Cable (DOCSIS)</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
