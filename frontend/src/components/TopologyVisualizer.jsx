import React, { useRef, useEffect, useState } from 'react';
import { Play, Pause } from 'lucide-react';

const drawCircleNode = (ctx, x, y, label, color, type, ip) => {
  ctx.beginPath();
  ctx.arc(x, y, 18, 0, Math.PI * 2);
  ctx.fillStyle = '#0f172a';
  ctx.fill();
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 11px Inter, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, x, y);

  ctx.font = '9px Inter, sans-serif';
  ctx.fillStyle = '#94a3b8';
  ctx.fillText(type, x, y + 26);
  ctx.font = '9px monospace';
  ctx.fillStyle = '#64748b';
  ctx.fillText(ip, x, y + 36);
};

const drawRouterBox = (ctx, x, y, qType, currentOcc, maxOcc) => {
  const boxW = 84;
  const boxH = 48;
  ctx.fillStyle = '#131f37';
  ctx.fillRect(x - boxW / 2, y - boxH / 2, boxW, boxH);
  ctx.strokeStyle = '#06b6d4';
  ctx.lineWidth = 2;
  ctx.strokeRect(x - boxW / 2, y - boxH / 2, boxW, boxH);

  const fillRatio = Math.min(1.0, currentOcc / Math.max(1, maxOcc));
  ctx.fillStyle =
    fillRatio > 0.75
      ? 'rgba(239, 68, 68, 0.45)'
      : fillRatio > 0.4
      ? 'rgba(245, 158, 11, 0.45)'
      : 'rgba(16, 185, 129, 0.45)';
  ctx.fillRect(x - boxW / 2 + 2, y - boxH / 2 + 2, (boxW - 4) * fillRatio, boxH - 4);

  ctx.fillStyle = '#f8fafc';
  ctx.font = 'bold 10px monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('ROUTER', x, y - 8);

  ctx.fillStyle = '#38bdf8';
  ctx.font = '9.5px monospace';
  ctx.fillText(qType, x, y + 8);

  ctx.font = '9px Inter, sans-serif';
  ctx.fillStyle = '#94a3b8';
  ctx.fillText('Bottleneck Queue', x, y + 36);

  ctx.font = '8.5px monospace';
  ctx.fillStyle = fillRatio > 0.75 ? '#f87171' : '#38bdf8';
  ctx.fillText(`${currentOcc} / ${maxOcc} pkts`, x, y + 46);
};

export default function TopologyVisualizer({
  nClients = 3,
  queueType = 'DropTail',
  queueCapacity = 100,
  currentOccupancy = 48,
  bottleneckBw = 5.0,
  bottleneckDelay = 35.0,
  accessBw = 100.0,
  accessDelay = 2.0
}) {
  const canvasRef = useRef(null);
  const [isRunning, setIsRunning] = useState(true);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    let animationId;
    let packets = [];
    let lastSpawn = 0;

    const resize = () => {
      const rect = canvas.parentElement.getBoundingClientRect();
      canvas.width = rect.width;
      canvas.height = rect.height;
    };
    resize();
    window.addEventListener('resize', resize);

    const spawnPacket = () => {
      const clientId = Math.floor(Math.random() * nClients);
      const isProbe = Math.random() < 0.2; // 20% probe (cyan), 80% bulk (blue)
      packets.push({
        clientId,
        progress: 0,
        stage: 1, // 1: Client->Router, 2: In Queue, 3: Router->Server
        isProbe,
        isDropped: false,
        speed: 0.016 + Math.random() * 0.01
      });
    };

    const render = (timestamp) => {
      if (isRunning) {
        if (timestamp - lastSpawn > 120) {
          spawnPacket();
          lastSpawn = timestamp;
        }

        // Update packets
        for (let i = packets.length - 1; i >= 0; i--) {
          const p = packets[i];
          p.progress += p.speed;

          if (p.stage === 1 && p.progress >= 1.0) {
            p.stage = 2;
            p.progress = 0;
            if (queueType === 'DropTail' && currentOccupancy > 80 && Math.random() < 0.25) {
              p.isDropped = true;
            }
          } else if (p.stage === 2 && p.progress >= 0.6) {
            if (p.isDropped) {
              packets.splice(i, 1);
              continue;
            }
            p.stage = 3;
            p.progress = 0;
          } else if (p.stage === 3 && p.progress >= 1.0) {
            packets.splice(i, 1);
          }
        }
      }

      // Draw frame
      const w = canvas.width;
      const h = canvas.height;
      ctx.clearRect(0, 0, w, h);

      // Grid lines
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.025)';
      ctx.lineWidth = 1;
      const gridSize = 28;
      for (let x = 0; x < w; x += gridSize) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, h);
        ctx.stroke();
      }
      for (let y = 0; y < h; y += gridSize) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(w, y);
        ctx.stroke();
      }

      // Positions
      const clientX = 85;
      const routerX = w * 0.52;
      const routerY = h / 2;
      const serverX = w - 90;
      const serverY = h / 2;

      const clientSpacing = Math.min(55, (h - 80) / Math.max(1, nClients));
      const clientStartY = routerY - ((nClients - 1) * clientSpacing) / 2;

      // Draw Links
      // 1. Client -> Router
      ctx.strokeStyle = '#1e293b';
      ctx.lineWidth = 2.5;
      for (let i = 0; i < nClients; i++) {
        const cy = clientStartY + i * clientSpacing;
        ctx.beginPath();
        ctx.moveTo(clientX, cy);
        ctx.lineTo(routerX, routerY);
        ctx.stroke();

        if (i === 0) {
          ctx.fillStyle = '#64748b';
          ctx.font = '10px monospace';
          ctx.fillText(`${accessBw} Mbps (${accessDelay}ms)`, (clientX + routerX) / 2 - 40, (cy + routerY) / 2 - 10);
        }
      }

      // 2. Bottleneck Link
      ctx.strokeStyle = '#ef4444';
      ctx.lineWidth = 3.5;
      ctx.setLineDash([6, 4]);
      ctx.beginPath();
      ctx.moveTo(routerX, routerY);
      ctx.lineTo(serverX, serverY);
      ctx.stroke();
      ctx.setLineDash([]);

      ctx.fillStyle = '#f87171';
      ctx.font = '11px monospace';
      ctx.fillText(`BOTTLENECK: ${bottleneckBw} Mbps (${bottleneckDelay}ms)`, (routerX + serverX) / 2 - 80, routerY - 14);

      // Draw Packets
      for (const p of packets) {
        let px, py;
        const cy = clientStartY + p.clientId * clientSpacing;

        if (p.stage === 1) {
          px = clientX + (routerX - clientX) * p.progress;
          py = cy + (routerY - cy) * p.progress;
        } else if (p.stage === 2) {
          px = routerX - 25 + p.progress * 25;
          py = routerY + Math.sin(p.progress * Math.PI) * 12 * (p.clientId % 2 === 0 ? 1 : -1);
        } else if (p.stage === 3) {
          px = routerX + (serverX - routerX) * p.progress;
          py = routerY;
        }

        ctx.beginPath();
        ctx.arc(px, py, p.isProbe ? 5 : 4, 0, Math.PI * 2);

        if (p.isDropped) {
          ctx.fillStyle = '#ef4444';
        } else if (p.isProbe) {
          ctx.fillStyle = '#00f0ff';
        } else {
          ctx.fillStyle = '#38bdf8';
        }
        ctx.fill();
      }

      // Draw Client Nodes
      for (let i = 0; i < nClients; i++) {
        const cy = clientStartY + i * clientSpacing;
        drawCircleNode(ctx, clientX, cy, `C${i}`, '#0284c7', 'Client', `10.1.${i + 1}.1`);
      }

      // Draw Router Queue Node
      drawRouterBox(ctx, routerX, routerY, queueType, currentOccupancy, queueCapacity);

      // Draw Server Node
      drawCircleNode(ctx, serverX, serverY, 'S', '#10b981', 'Server', '10.2.0.2');

      animationId = requestAnimationFrame(render);
    };

    animationId = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(animationId);
      window.removeEventListener('resize', resize);
    };
  }, [isRunning, nClients, queueType, queueCapacity, currentOccupancy, bottleneckBw, bottleneckDelay, accessBw, accessDelay]);

  return (
    <div className="bg-navy-800 border border-navy-700/70 rounded-2xl p-6 shadow-card">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-sm font-semibold text-slate-100">Simulated Dumbbell Network Topology</h3>
          <p className="text-xs text-slate-400 mt-0.5">
            Real-time packet flow from {nClients} Clients through Router {queueType} Queue to Server Sink.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsRunning(!isRunning)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded bg-navy-900 border border-navy-700 hover:border-navy-600 text-xs text-slate-300 font-medium transition"
          >
            {isRunning ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
            <span>{isRunning ? 'Pause' : 'Resume'}</span>
          </button>
        </div>
      </div>

      <div className="w-full h-80 bg-navy-950 rounded-xl border border-navy-700/60 overflow-hidden relative">
        <canvas ref={canvasRef} className="w-full h-full block" />
      </div>

      {/* Inspector Details */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-5 pt-5 border-t border-navy-700/60">
        <div className="bg-navy-900/50 p-3 rounded-lg border border-navy-700/40">
          <div className="text-[10px] font-mono uppercase text-brand-teal font-semibold">Clients</div>
          <div className="text-xs font-semibold text-slate-200 mt-1">{nClients} Sender Nodes</div>
          <div className="text-[11px] text-slate-400 mt-0.5">Bulk TCP + 50ms Ping Probe</div>
        </div>

        <div className="bg-navy-900/50 p-3 rounded-lg border border-navy-700/40">
          <div className="text-[10px] font-mono uppercase text-brand-teal font-semibold">Access Links</div>
          <div className="text-xs font-semibold text-slate-200 mt-1">{accessBw} Mbps, {accessDelay} ms</div>
          <div className="text-[11px] text-slate-400 mt-0.5">High-speed client feeder links</div>
        </div>

        <div className="bg-navy-900/50 p-3 rounded-lg border border-navy-700/40">
          <div className="text-[10px] font-mono uppercase text-brand-teal font-semibold">Queue Discipline</div>
          <div className="text-xs font-semibold text-slate-200 mt-1">{queueType} ({queueCapacity} pkts)</div>
          <div className="w-full h-1.5 bg-navy-950 rounded-full mt-2 overflow-hidden">
            <div
              className={`h-full transition-all duration-300 ${
                currentOccupancy > queueCapacity * 0.75
                  ? 'bg-brand-rose'
                  : currentOccupancy > queueCapacity * 0.4
                  ? 'bg-brand-amber'
                  : 'bg-brand-emerald'
              }`}
              style={{ width: `${Math.min(100, (currentOccupancy / queueCapacity) * 100)}%` }}
            />
          </div>
        </div>

        <div className="bg-navy-900/50 p-3 rounded-lg border border-navy-700/40">
          <div className="text-[10px] font-mono uppercase text-brand-teal font-semibold">Bottleneck & Server</div>
          <div className="text-xs font-semibold text-slate-200 mt-1">{bottleneckBw} Mbps, {bottleneckDelay} ms</div>
          <div className="text-[11px] text-slate-400 mt-0.5">Server Sink: 10.2.0.2:8080</div>
        </div>
      </div>
    </div>
  );
}
