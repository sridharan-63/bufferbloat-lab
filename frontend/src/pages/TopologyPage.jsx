import React from 'react';
import { useSimulation } from '../context/SimulationContext';
import TopologyVisualizer from '../components/TopologyVisualizer';

export default function TopologyPage() {
  const { activeSummary } = useSimulation();

  const nClients = activeSummary ? parseInt(activeSummary.num_clients, 10) : 3;
  const queueType = activeSummary ? activeSummary.queue_type : 'DropTail';
  const queueCap = activeSummary ? parseInt(activeSummary.queue_capacity_packets, 10) : 100;
  const currOcc = activeSummary ? Math.round(parseFloat(activeSummary.avg_queue_occupancy_pkts) || 48) : 48;
  const botBw = activeSummary ? parseFloat(activeSummary.bottleneck_bw_mbps) : 5.0;
  const botDelay = activeSummary ? parseFloat(activeSummary.bottleneck_delay_ms) : 35.0;
  const accBw = activeSummary ? parseFloat(activeSummary.access_bw_mbps) : 100.0;
  const accDelay = activeSummary ? parseFloat(activeSummary.access_delay_ms) : 2.0;

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      <TopologyVisualizer
        nClients={nClients}
        queueType={queueType}
        queueCapacity={queueCap}
        currentOccupancy={currOcc}
        bottleneckBw={botBw}
        bottleneckDelay={botDelay}
        accessBw={accBw}
        accessDelay={accDelay}
      />

      {/* Topology Architecture Card */}
      <div className="bg-navy-800 border border-navy-700/70 rounded-2xl p-6 shadow-card">
        <h3 className="text-sm font-semibold text-slate-100 mb-3">
          Topological Model in NS-3
        </h3>
        <p className="text-xs text-slate-300 leading-relaxed max-w-4xl mb-4">
          The simulated network utilizes an asymmetric <strong>Dumbbell Topology</strong>. Client nodes (C0, C1, ... Cn) connect to an intermediate Router via high-capacity gigabit/fast-ethernet access links (100 Mbps, 2 ms delay). The Router acts as an aggregation and forwarding node connecting to the destination Server via a single bandwidth-constrained Bottleneck Link (5.0 Mbps, 35 ms propagation delay).
        </p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs font-mono">
          <div className="bg-navy-900/60 p-3.5 rounded-xl border border-navy-700/50">
            <span className="text-brand-cyan font-bold block mb-1">Queue Location</span>
            <span className="text-slate-400">Attached to Router PointToPoint NetDevice facing the Server. Controlled via TrafficControlHelper.</span>
          </div>
          <div className="bg-navy-900/60 p-3.5 rounded-xl border border-navy-700/50">
            <span className="text-brand-emerald font-bold block mb-1">Propagation Delay</span>
            <span className="text-slate-400">Round-trip base wire latency = 2 × (2ms access + 35ms bottleneck) = 74.0 ms baseline.</span>
          </div>
          <div className="bg-navy-900/60 p-3.5 rounded-xl border border-navy-700/50">
            <span className="text-brand-amber font-bold block mb-1">Queueing Inflation</span>
            <span className="text-slate-400">Every 100 packets in buffer add: (100 × 1024 × 8) / 5,000,000 = ~164 ms queue latency.</span>
          </div>
        </div>
      </div>
    </div>
  );
}
