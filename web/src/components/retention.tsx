import { useFormat } from '@/lib/format';
import { useI18n } from '@/lib/i18n';
import type { VideoDetail } from '@/lib/types';

// Text inside a viewBox scales with the container. Desktop renders this at roughly 1:1, but
// a phone card is half the width, which would halve the labels with it — so the caller that
// has less room asks for a smaller coordinate space instead of smaller type.
const H = 220;
const TOP = 14;
const BOTTOM = 30;
const LEFT = 40;
const PLOT = H - TOP - BOTTOM;

export function RetentionChart({
  retention,
  durationS,
  width = 720,
}: {
  retention: NonNullable<VideoDetail['retention']>;
  durationS: number | null;
  width?: number;
}) {
  const W = width;
  const { t } = useI18n();
  const f = useFormat();

  const x = (ratio: number) => LEFT + ratio * (W - LEFT);
  const y = (watch: number) => TOP + PLOT * (1 - Math.min(Math.max(watch, 0), 1));
  const mark = (ratio: number) => (durationS ? f.clock(ratio * durationS) : `${Math.round(ratio * 100)}%`);

  const line = retention.points
    .map((p, i) => `${i ? 'L' : 'M'}${x(p.ratio).toFixed(1)} ${y(p.watchRatio).toFixed(1)}`)
    .join(' ');

  return (
    <div className="p-5">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={t('section.retention')} className="block h-auto w-full">
        {[0, 0.5, 1].map((level) => (
          <g key={level}>
            <line x1={LEFT} x2={W} y1={y(level)} y2={y(level)} className="stroke-border" />
            <text x={0} y={y(level) + 4} className="fill-muted-foreground font-mono text-[12px]">
              {level * 100}%
            </text>
          </g>
        ))}

        <path d={`${line} L${W} ${TOP + PLOT} L${LEFT} ${TOP + PLOT} Z`} className="fill-chart opacity-18" />
        <path d={line} className="stroke-chart fill-none" strokeWidth={3} strokeLinejoin="round" />

        {retention.steepestDropOffs.map((drop) => (
          <g key={drop.ratio}>
            <line
              x1={x(drop.ratio)}
              x2={x(drop.ratio)}
              y1={TOP}
              y2={TOP + PLOT}
              className="stroke-destructive"
              strokeWidth={1.5}
              strokeDasharray="4 4"
            />
            <text
              x={x(drop.ratio)}
              y={H - 10}
              textAnchor="middle"
              className="fill-destructive font-mono text-[12px]"
            >
              {mark(drop.ratio)}
            </text>
          </g>
        ))}
      </svg>

      <div className="mt-4 flex flex-wrap gap-x-6 gap-y-2">
        {retention.steepestDropOffs.map((drop) => (
          <span key={drop.ratio} className="text-sm text-muted-foreground">
            {t('video.dropAt')}{' '}
            <b className="tabular text-destructive font-medium">{mark(drop.ratio)}</b>
            {' — '}
            {t('video.dropSize', { n: f.dec(drop.drop * 100, 1) })}
          </span>
        ))}
      </div>
    </div>
  );
}
