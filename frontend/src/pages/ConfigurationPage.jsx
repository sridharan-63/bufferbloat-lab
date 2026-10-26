import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Play, RotateCcw, Sparkles } from 'lucide-react';
import { useSimulation } from '../context/SimulationContext';

const PRESETS = {
  textbook_bloat: {
    name: 'Textbook BufferBloat',
    desc: 'Large 100-packet DropTail FIFO queue on 5 Mbps bottleneck under heavy TCP saturation.',
    queueType: 'DropTail',
    queueSize: 100,
    bottleneckBw: 5.0,
    bottleneckDelay: 35.0,
    nClients: 3,
    trafficLoad: 'high',
    simDuration: 15.0
  },
  codel_mitigation: {
    name: 'CoDel AQM Mitigation',
    desc: 'CoDel automatically detects standing packet delay > 5ms and proactively manages buffer sojourn.',
    queueType: 'CoDel',
    queueSize: 100,
    bottleneckBw: 5.0,
    bottleneckDelay: 35.0,
    nClients: 3,
    trafficLoad: 'high',
    simDuration: 15.0
  },
  fq_codel_fairness: {
    name: 'FQ-CoDel Fair Queueing',
    desc: 'Combines per-flow Deficit Round Robin isolation with CoDel, keeping ping probe latency near wire baseline.',
    queueType: 'FqCoDel',
    queueSize: 100,
    bottleneckBw: 5.0,
    bottleneckDelay: 35.0,
    nClients: 3,
    trafficLoad: 'high',
    simDuration: 15.0
  },
  red_aqm: {
    name: 'RED (Random Early Detection)',
    desc: 'Classic AQM dropping packets probabilistically based on average queue length (minTh=20p, maxTh=80p).',
    queueType: 'RED',
    queueSize: 100,
    bottleneckBw: 5.0,
    bottleneckDelay: 35.0,
    nClients: 3,
    trafficLoad: 'high',
    simDuration: 15.0
  },
  small_buffer: {
    name: 'Small FIFO Buffer (15p)',
    desc: 'Small buffer avoids latency bloat but causes higher drop rates and TCP throughput collapse.',
    queueType: 'DropTail',
    queueSize: 15,
    bottleneckBw: 5.0,
    bottleneckDelay: 35.0,
    nClients: 3,
    trafficLoad: 'high',
    simDuration: 15.0
  }
};

export default function ConfigurationPage() {
  const { runSimulation, addToast } = useSimulation();
  const navigate = useNavigate();

  const [activePreset, setActivePreset] = useState('textbook_bloat');
  const [form, setForm] = useState({
    queueType: 'DropTail',
    queueSize: 100,
    bottleneckBw: 5.0,
    bottleneckDelay: 35.0,
    nClients: 3,
    trafficLoad: 'high',
    simDuration: 15.0,
    expName: ''
  });

  const handlePresetSelect = (key) => {
    setActivePreset(key);
    const p = PRESETS[key];
    if (!p) return;
    setForm(prev => ({
      ...prev,
      queueType: p.queueType,
      queueSize: p.queueSize,
      bottleneckBw: p.bottleneckBw,
      bottleneckDelay: p.bottleneckDelay,
      nClients: p.nClients,
      trafficLoad: p.trafficLoad,
      simDuration: p.simDuration
    }));
    addToast(`Applied preset: ${p.name}`, 'info');
  };

  const handleReset = () => {
    handlePresetSelect('textbook_bloat');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    navigate('/run');
    await runSimulation(form);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Presets Card */}
      <div className="bg-navy-800 border border-navy-700/70 rounded-2xl p-6 shadow-card">
        <div className="flex items-center gap-2 mb-3">
          <Sparkles className="w-4 h-4 text-brand-cyan" />
          <h3 className="text-sm font-semibold text-slate-100">Reproducible Experiment Presets</h3>
        </div>
        <p className="text-xs text-slate-400 mb-4">
          Select standard network research configurations to reproduce textbook bufferbloat or test AQM optimization.
        </p>

        <div className="flex flex-wrap gap-2.5">
          {Object.entries(PRESETS).map(([key, p]) => (
            <button
              key={key}
              type="button"
              onClick={() => handlePresetSelect(key)}
              className={`px-3.5 py-1.5 rounded-full text-xs font-medium border transition-all ${
                activePreset === key
                  ? 'bg-brand-cyan/15 border-brand-cyan text-brand-cyan shadow-sm font-semibold'
                  : 'bg-navy-900 border-navy-700 text-slate-400 hover:text-slate-200 hover:border-navy-600'
              }`}
            >
              {p.name}
            </button>
          ))}
        </div>
      </div>

      {/* Main Configuration Form */}
      <form onSubmit={handleSubmit} className="bg-navy-800 border border-navy-700/70 rounded-2xl p-6 shadow-card space-y-6">
        <div className="flex items-center justify-between pb-4 border-b border-navy-700/60">
          <div>
            <h3 className="text-sm font-semibold text-slate-100">Network Simulation Parameters</h3>
            <p className="text-xs text-slate-400 mt-0.5">Parameters are passed directly to the NS-3 C++ simulation binary.</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleReset}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded bg-navy-900 border border-navy-700 hover:border-navy-600 text-xs text-slate-300 font-medium transition"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset</span>
            </button>
            <button
              type="submit"
              className="inline-flex items-center gap-1.5 bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-500 hover:to-cyan-400 text-white text-xs font-medium px-4 py-1.5 rounded shadow-sm hover:shadow-glow transition"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              <span>Apply & Run Simulation</span>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Column 1 */}
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Queue Discipline (QueueDisc)
              </label>
              <select
                value={form.queueType}
                onChange={(e) => setForm({ ...form, queueType: e.target.value })}
                className="w-full bg-navy-900 border border-navy-700 rounded-lg px-3 py-2 text-xs font-mono text-slate-200 focus:outline-none focus:border-brand-teal"
              >
                <option value="DropTail">DropTail (FifoQueueDisc) - Traditional FIFO</option>
                <option value="CoDel">CoDel (CoDelQueueDisc) - Controlled Delay AQM</option>
                <option value="FqCoDel">FQ-CoDel (FqCoDelQueueDisc) - Fair Queueing + CoDel</option>
                <option value="RED">RED (RedQueueDisc) - Random Early Detection</option>
                <option value="PIE">PIE (PieQueueDisc) - Proportional Integral controller</option>
              </select>
              <span className="text-[11px] text-slate-500 mt-1 block">Active queue management algorithm installed at the bottleneck router.</span>
            </div>

            <div>
              <div className="flex justify-between text-xs font-medium text-slate-300 mb-1.5">
                <span>Queue Capacity Limit</span>
                <span className="font-mono text-brand-cyan">{form.queueSize} pkts</span>
              </div>
              <div className="flex items-center gap-3">
                <input
                  type="range"
                  min="5"
                  max="500"
                  step="5"
                  value={form.queueSize}
                  onChange={(e) => setForm({ ...form, queueSize: Number(e.target.value) })}
                  className="flex-1 accent-brand-cyan bg-navy-900 h-1.5 rounded-lg cursor-pointer"
                />
                <input
                  type="number"
                  min="5"
                  max="1000"
                  value={form.queueSize}
                  onChange={(e) => setForm({ ...form, queueSize: Number(e.target.value) })}
                  className="w-20 bg-navy-900 border border-navy-700 rounded px-2 py-1 text-xs font-mono text-slate-200"
                />
              </div>
              <span className="text-[11px] text-slate-500 mt-1 block">Number of packets the router buffer will store before dropping packets.</span>
            </div>

            <div>
              <div className="flex justify-between text-xs font-medium text-slate-300 mb-1.5">
                <span>Bottleneck Bandwidth</span>
                <span className="font-mono text-brand-cyan">{form.bottleneckBw} Mbps</span>
              </div>
              <div className="flex items-center gap-3">
                <input
                  type="range"
                  min="1"
                  max="50"
                  step="0.5"
                  value={form.bottleneckBw}
                  onChange={(e) => setForm({ ...form, bottleneckBw: Number(e.target.value) })}
                  className="flex-1 accent-brand-cyan bg-navy-900 h-1.5 rounded-lg cursor-pointer"
                />
                <input
                  type="number"
                  step="0.5"
                  min="0.5"
                  max="100"
                  value={form.bottleneckBw}
                  onChange={(e) => setForm({ ...form, bottleneckBw: Number(e.target.value) })}
                  className="w-20 bg-navy-900 border border-navy-700 rounded px-2 py-1 text-xs font-mono text-slate-200"
                />
              </div>
              <span className="text-[11px] text-slate-500 mt-1 block">Transmission data rate on the Point-to-Point bottleneck channel.</span>
            </div>

            <div>
              <div className="flex justify-between text-xs font-medium text-slate-300 mb-1.5">
                <span>Bottleneck Delay</span>
                <span className="font-mono text-brand-cyan">{form.bottleneckDelay} ms</span>
              </div>
              <div className="flex items-center gap-3">
                <input
                  type="range"
                  min="5"
                  max="150"
                  step="5"
                  value={form.bottleneckDelay}
                  onChange={(e) => setForm({ ...form, bottleneckDelay: Number(e.target.value) })}
                  className="flex-1 accent-brand-cyan bg-navy-900 h-1.5 rounded-lg cursor-pointer"
                />
                <input
                  type="number"
                  min="1"
                  max="250"
                  value={form.bottleneckDelay}
                  onChange={(e) => setForm({ ...form, bottleneckDelay: Number(e.target.value) })}
                  className="w-20 bg-navy-900 border border-navy-700 rounded px-2 py-1 text-xs font-mono text-slate-200"
                />
              </div>
              <span className="text-[11px] text-slate-500 mt-1 block">One-way propagation delay of the bottleneck channel (base RTT = 2 * delay).</span>
            </div>
          </div>

          {/* Column 2 */}
          <div className="space-y-4">
            <div>
              <div className="flex justify-between text-xs font-medium text-slate-300 mb-1.5">
                <span>Number of Client Nodes</span>
                <span className="font-mono text-brand-cyan">{form.nClients} Clients</span>
              </div>
              <div className="flex items-center gap-3">
                <input
                  type="range"
                  min="1"
                  max="10"
                  step="1"
                  value={form.nClients}
                  onChange={(e) => setForm({ ...form, nClients: Number(e.target.value) })}
                  className="flex-1 accent-brand-cyan bg-navy-900 h-1.5 rounded-lg cursor-pointer"
                />
                <input
                  type="number"
                  min="1"
                  max="15"
                  value={form.nClients}
                  onChange={(e) => setForm({ ...form, nClients: Number(e.target.value) })}
                  className="w-20 bg-navy-900 border border-navy-700 rounded px-2 py-1 text-xs font-mono text-slate-200"
                />
              </div>
              <span className="text-[11px] text-slate-500 mt-1 block">Each client runs independent concurrent bulk TCP Cubic streams.</span>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Traffic Intensity
              </label>
              <select
                value={form.trafficLoad}
                onChange={(e) => setForm({ ...form, trafficLoad: e.target.value })}
                className="w-full bg-navy-900 border border-navy-700 rounded-lg px-3 py-2 text-xs font-mono text-slate-200 focus:outline-none focus:border-brand-teal"
              >
                <option value="high">High Load (All Clients Saturated TCP)</option>
                <option value="medium">Medium Load (2 Concurrent Flows)</option>
                <option value="low">Low Load (Single Sparing Flow)</option>
              </select>
              <span className="text-[11px] text-slate-500 mt-1 block">Traffic stress factor creating buffer backlog.</span>
            </div>

            <div>
              <div className="flex justify-between text-xs font-medium text-slate-300 mb-1.5">
                <span>Simulation Duration</span>
                <span className="font-mono text-brand-cyan">{form.simDuration} s</span>
              </div>
              <div className="flex items-center gap-3">
                <input
                  type="range"
                  min="5"
                  max="30"
                  step="1"
                  value={form.simDuration}
                  onChange={(e) => setForm({ ...form, simDuration: Number(e.target.value) })}
                  className="flex-1 accent-brand-cyan bg-navy-900 h-1.5 rounded-lg cursor-pointer"
                />
                <input
                  type="number"
                  min="3"
                  max="60"
                  value={form.simDuration}
                  onChange={(e) => setForm({ ...form, simDuration: Number(e.target.value) })}
                  className="w-20 bg-navy-900 border border-navy-700 rounded px-2 py-1 text-xs font-mono text-slate-200"
                />
              </div>
              <span className="text-[11px] text-slate-500 mt-1 block">Simulated discrete-event duration in NS-3 seconds.</span>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Experiment Run Identifier
              </label>
              <input
                type="text"
                placeholder="e.g. exp_droptail_test (leave blank for timestamp)"
                value={form.expName}
                onChange={(e) => setForm({ ...form, expName: e.target.value })}
                className="w-full bg-navy-900 border border-navy-700 rounded-lg px-3 py-2 text-xs font-mono text-slate-200 focus:outline-none focus:border-brand-teal"
              />
              <span className="text-[11px] text-slate-500 mt-1 block">Directory name in results/ for reproducibility.</span>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}
