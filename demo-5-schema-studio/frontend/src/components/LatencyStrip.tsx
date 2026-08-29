import { useMemo } from 'react';

export interface Sample {
  compileMs: number;
  totalMs: number;
  ok: boolean;
}

function quantile(sorted: number[], q: number): number {
  if (sorted.length === 0) return 0;
  const pos = (sorted.length - 1) * q;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  const a = sorted[lo] ?? 0;
  const b = sorted[hi] ?? a;
  return a + (b - a) * (pos - lo);
}

/**
 * The headline metric of this demo: how long `reflect.Package.compile` takes.
 * Every keystroke-debounced edit adds a bar.
 */
export function LatencyStrip({ samples }: { samples: Sample[] }) {
  const stats = useMemo(() => {
    const values = samples.map((s) => s.compileMs).sort((a, b) => a - b);
    return {
      last: samples.length ? samples[samples.length - 1]!.compileMs : 0,
      p50: quantile(values, 0.5),
      p95: quantile(values, 0.95),
      max: Math.max(1, ...values),
      count: samples.length,
    };
  }, [samples]);

  const shown = samples.slice(-48);
  const barWidth = 100 / 48;
  const scaleMax = Math.max(stats.max, 5);

  return (
    <div className="latency-strip">
      <div className="latency-head">
        <span className="latency-title">reflect.Package.compile</span>
        <span className="latency-stat">
          last <b>{stats.last.toFixed(1)}</b>ms
        </span>
        <span className="latency-stat">
          p50 <b>{stats.p50.toFixed(1)}</b>ms
        </span>
        <span className="latency-stat">
          p95 <b>{stats.p95.toFixed(1)}</b>ms
        </span>
        <span className="latency-stat dim">{stats.count} compiles</span>
      </div>
      <svg className="latency-chart" viewBox="0 0 100 26" preserveAspectRatio="none" role="img" aria-label="compile latency history">
        <line x1="0" y1="25.5" x2="100" y2="25.5" stroke="#232a35" strokeWidth="0.4" />
        {shown.map((s, i) => {
          const h = Math.max(0.8, (s.compileMs / scaleMax) * 23);
          return (
            <rect
              key={i}
              x={i * barWidth + 0.35}
              y={25 - h}
              width={barWidth - 0.7}
              height={h}
              rx={0.4}
              fill={s.ok ? 'var(--ok)' : 'var(--err)'}
              opacity={0.45 + (0.55 * (i + 1)) / shown.length}
            />
          );
        })}
      </svg>
      <div className="latency-foot">
        <span>0</span>
        <span>{scaleMax.toFixed(0)}ms full scale</span>
      </div>
    </div>
  );
}
