import React from 'react';
import {
  Clock,
  ArrowUpRight,
  ShieldAlert,
  Layers,
  Hourglass,
  Gauge
} from 'lucide-react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid
} from 'recharts';
import { useSimulation } from '../context/SimulationContext';
import KpiCard from '../components/KpiCard';
import VerdictBanner from '../components/VerdictBanner';
import ChartPanel from '../components/ChartPanel';
import { LoadingState, EmptyState } from '../components/FeedbackStates';

export default function OverviewPage() {
  const { activeSummary, traces, isLoading } = useSimulation();

  if (isLoading) {
    return <LoadingState message="Loading experiment metrics and traces..." />;
  }

  if (!activeSummary) {
    return (
      <EmptyState
        title="No Experiment Data Loaded"
        message="Please launch a simulation or select a previous run from the top dropdown."
      />
    );
  }

  const baseRtt = parseFloat(activeSummary.baseline_rtt_ms) || 74.3;
  const loadedRtt = parseFloat(activeSummary.avg_loaded_rtt_ms) || baseRtt;
  const peakRtt = parseFloat(activeSummary.peak_rtt_ms) || loadedRtt;
  const avgTp = parseFloat(activeSummary.avg_throughput_mbps) || 0;
  const botBw = parseFloat(activeSummary.bottleneck_bw_mbps) || 5.0;
  const util = parseFloat(activeSummary.bottleneck_utilization_percent) || ((avgTp / botBw) * 100);
  const lossPct = parseFloat(activeSummary.packet_loss_percent) || 0;
  const droppedPkts = activeSummary.packets_dropped || '0';
  const qOcc = parseFloat(activeSummary.avg_queue_occupancy_pkts) || 0;
  const qCap = parseInt(activeSummary.queue_capacity_packets, 10) || 100;
  const maxQOcc = activeSummary.max_queue_occupancy_pkts || qCap;
  const qDelay = parseFloat(activeSummary.avg_queueing_delay_ms) || 0;
  const maxQDelay = parseFloat(activeSummary.max_queueing_delay_ms) || 0;
  const isBloat = activeSummary.bufferbloat_detected === 'YES';

  // Format Recharts data (downsampled for performance if large)
  const rttChartData = (traces.rtt || []).filter((_, idx) => idx % 2 === 0).map(r => ({
    time: Number(Number(r.time_sec).toFixed(2)),
    rtt: Number(Number(r.rtt_ms).toFixed(1))
  }));

  const queueChartData = (traces.queue || []).filter((_, idx) => idx % 2 === 0).map(q => ({
    time: Number(Number(q.time_sec).toFixed(2)),
    packets: Number(q.packets_in_queue),
    delay: Number(Number(q.queue_delay_ms).toFixed(1))
  }));

  return (
    <div className="space-y-7 animate-in fade-in duration-200">
      {/* BufferBloat Verdict Banner */}
      <VerdictBanner summary={activeSummary} />

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        <KpiCard
          title="Average RTT"
          value={loadedRtt.toFixed(1)}
          unit="ms"
          subtext={`Peak: ${peakRtt.toFixed(1)} ms | Base: ${baseRtt.toFixed(1)} ms`}
          icon={Clock}
          color={isBloat ? 'text-brand-rose' : 'text-brand-cyan'}
        />

        <KpiCard
          title="Throughput"
          value={avgTp.toFixed(2)}
          unit="Mbps"
          subtext={`Link Capacity: ${botBw.toFixed(1)} Mbps`}
          icon={ArrowUpRight}
          color="text-brand-emerald"
        />

        <KpiCard
          title="Packet Loss"
          value={lossPct.toFixed(2)}
          unit="%"
          subtext={`${droppedPkts} bottleneck drops`}
          icon={ShieldAlert}
          color={lossPct > 2 ? 'text-brand-amber' : 'text-slate-100'}
        />

        <KpiCard
          title="Queue Occupancy"
          value={qOcc.toFixed(1)}
          unit={`/ ${qCap} pkts`}
          subtext={`Peak: ${maxQOcc} pkts (${Math.round((maxQOcc / qCap) * 100)}%)`}
          icon={Layers}
          color={qOcc > qCap * 0.5 ? 'text-brand-amber' : 'text-brand-cyan'}
        />

        <KpiCard
          title="Queueing Delay"
          value={qDelay.toFixed(1)}
          unit="ms"
          subtext={`Max Sojourn: ${maxQDelay.toFixed(1)} ms`}
          icon={Hourglass}
          color={qDelay > 40 ? 'text-brand-rose' : 'text-brand-cyan'}
        />

        <KpiCard
          title="Utilization"
          value={Math.min(100, util).toFixed(1)}
          unit="%"
          subtext={`Active flows: ${activeSummary.num_clients || 3} senders`}
          icon={Gauge}
          color="text-brand-cyan"
        />
      </div>

      {/* Overview Charts (Recharts) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ChartPanel title="Round-Trip Time (RTT) vs Simulation Time" badge="Interactive Probe (ms)">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={rttChartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" opacity={0.6} />
              <XAxis dataKey="time" stroke="#64748b" tick={{ fontSize: 11 }} />
              <YAxis stroke="#64748b" tick={{ fontSize: 11 }} />
              <Tooltip
                contentStyle={{ backgroundColor: '#0f172a', borderColor: '#1e293b', borderRadius: '8px', fontSize: '12px' }}
                itemStyle={{ color: '#00f0ff' }}
                labelFormatter={(t) => `Time: ${t}s`}
                formatter={(val) => [`${val} ms`, 'RTT']}
              />
              <Line
                type="monotone"
                dataKey="rtt"
                stroke="#00f0ff"
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4, stroke: '#00f0ff', strokeWidth: 2 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </ChartPanel>

        <ChartPanel title="Bottleneck Queue Occupancy vs Time" badge="Packets in Buffer">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={queueChartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="queueGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.35} />
                  <stop offset="95%" stopColor="#f59e0b" stopOpacity={0.0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" opacity={0.6} />
              <XAxis dataKey="time" stroke="#64748b" tick={{ fontSize: 11 }} />
              <YAxis stroke="#64748b" tick={{ fontSize: 11 }} />
              <Tooltip
                contentStyle={{ backgroundColor: '#0f172a', borderColor: '#1e293b', borderRadius: '8px', fontSize: '12px' }}
                itemStyle={{ color: '#f59e0b' }}
                labelFormatter={(t) => `Time: ${t}s`}
                formatter={(val) => [`${val} packets`, 'Queue']}
              />
              <Area
                type="monotone"
                dataKey="packets"
                stroke="#f59e0b"
                strokeWidth={2}
                fillOpacity={1}
                fill="url(#queueGrad)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </ChartPanel>
      </div>
    </div>
  );
}
