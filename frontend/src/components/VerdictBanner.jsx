import React from 'react';
import { AlertTriangle, CheckCircle2 } from 'lucide-react';

export default function VerdictBanner({ summary }) {
  if (!summary) return null;

  const baseRtt = parseFloat(summary.baseline_rtt_ms) || 74.3;
  const loadedRtt = parseFloat(summary.avg_loaded_rtt_ms) || baseRtt;
  const deltaRtt = Math.max(0, loadedRtt - baseRtt);
  const rttRatio = baseRtt > 0 ? (loadedRtt / baseRtt) : 1.0;
  const isBloat = summary.bufferbloat_detected === 'YES';
  const grade = summary.bufferbloat_grade || (isBloat ? 'D' : 'A+');
  const qType = summary.queue_type || 'DropTail';

  const getGradeStyle = (g) => {
    if (g.startsWith('A')) {
      return 'border-brand-emerald text-brand-emerald shadow-glow-emerald';
    }
    if (g === 'B') {
      return 'border-brand-cyan text-brand-cyan shadow-glow';
    }
    if (g === 'C') {
      return 'border-brand-amber text-brand-amber';
    }
    return 'border-brand-rose text-brand-rose shadow-glow-rose';
  };

  return (
    <div
      className={`rounded-2xl p-6 mb-7 relative overflow-hidden border transition-all ${
        isBloat
          ? 'bg-gradient-to-r from-navy-900 via-navy-850 to-rose-950/20 border-rose-500/30'
          : 'bg-gradient-to-r from-navy-900 via-navy-850 to-emerald-950/20 border-emerald-500/30'
      }`}
    >
      {/* Accent Indicator Bar */}
      <div
        className={`absolute top-0 left-0 w-1.5 h-full ${
          isBloat ? 'bg-brand-rose' : 'bg-brand-emerald'
        }`}
      />

      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6 pl-2">
        <div className="flex items-center gap-5">
          {/* Grade Badge */}
          <div
            className={`w-16 h-16 rounded-xl border-2 flex flex-col items-center justify-center font-mono font-extrabold bg-navy-950/70 shrink-0 ${getGradeStyle(
              grade
            )}`}
          >
            <span className="text-2xl leading-none">{grade}</span>
            <span className="text-[9px] uppercase tracking-wider font-semibold opacity-75 mt-0.5">
              Grade
            </span>
          </div>

          <div>
            <div className="flex items-center gap-2 mb-1.5">
              {isBloat ? (
                <AlertTriangle className="w-5 h-5 text-brand-rose shrink-0" />
              ) : (
                <CheckCircle2 className="w-5 h-5 text-brand-emerald shrink-0" />
              )}
              <h3 className="text-base font-bold text-slate-100">
                {isBloat
                  ? 'BufferBloat Detected Under Saturated Load'
                  : 'BufferBloat Mitigated - Controlled Standing Delay'}
              </h3>
            </div>
            <p className="text-xs text-slate-300 max-w-2xl leading-relaxed">
              {isBloat
                ? `Packets accumulate in the unmanaged router buffer, increasing RTT by ${rttRatio.toFixed(
                    2
                  )}x (+${deltaRtt.toFixed(
                    1
                  )} ms over baseline). Active Queue Management (CoDel / FQ-CoDel) is recommended.`
                : `The ${qType} queue discipline successfully prevents standing buffer accumulation. Loaded RTT remained within ${deltaRtt.toFixed(
                    1
                  )} ms of wire baseline while sustaining optimal throughput.`}
            </p>
          </div>
        </div>

        {/* Breakdown Stats */}
        <div className="flex items-center gap-4 bg-navy-950/60 p-3.5 rounded-xl border border-navy-700/50 self-start lg:self-auto shrink-0 font-mono text-center">
          <div className="px-2">
            <div className="text-[10px] text-slate-400 uppercase font-sans font-semibold">Baseline RTT</div>
            <div className="text-sm font-bold text-slate-200">{baseRtt.toFixed(1)} ms</div>
          </div>
          <div className="w-px h-8 bg-navy-700/60" />
          <div className="px-2">
            <div className="text-[10px] text-slate-400 uppercase font-sans font-semibold">Loaded RTT</div>
            <div className={`text-sm font-bold ${isBloat ? 'text-brand-rose' : 'text-slate-100'}`}>
              {loadedRtt.toFixed(1)} ms
            </div>
          </div>
          <div className="w-px h-8 bg-navy-700/60" />
          <div className="px-2">
            <div className="text-[10px] text-slate-400 uppercase font-sans font-semibold">Bloat Latency</div>
            <div className={`text-sm font-bold ${isBloat ? 'text-brand-rose' : 'text-brand-emerald'}`}>
              +{deltaRtt.toFixed(1)} ms
            </div>
          </div>
          <div className="w-px h-8 bg-navy-700/60" />
          <div className="px-2">
            <div className="text-[10px] text-slate-400 uppercase font-sans font-semibold">Discipline</div>
            <div className="text-sm font-bold text-brand-cyan">{qType}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
