import { useEffect, useId, useState } from 'react';
import { Sparkles } from 'lucide-react';
import { useFormat } from '@/lib/format';
import { useI18n } from '@/lib/i18n';
import { cn, focusRing } from '@/lib/utils';
import type { RetentionPoint, VideoDetail } from '@/lib/types';

// Text inside a viewBox scales with the container. Desktop renders this at roughly 1:1, but
// a phone card is half the width, which would halve the labels with it — so the caller that
// has less room asks for a smaller coordinate space instead of smaller type.
const H = 250;
const TOP = 14;
const STRIP = 8;
const BOTTOM = 40;
const LEFT = 40;
const PLOT = H - TOP - BOTTOM;
const STRIP_Y = TOP + PLOT + 8;

const INTRO_S = 30;
const SPIKE = 0.02;

/**
 * The whole point of a retention curve is finding the second people left, so the curve is
 * readable by pointer and by keyboard rather than being a picture with a caption.
 */
export function RetentionChart({
  retention,
  durationS,
  width = 720,
  compare,
  focus,
  onCursor,
  onAsk,
}: {
  retention: NonNullable<VideoDetail['retention']>;
  durationS: number | null;
  width?: number;
  /** Another video's curve laid underneath, matched by share of length rather than by clock. */
  compare?: { title: string; points: RetentionPoint[] } | null;
  /** A position someone arrived here to look at, as a share of the video's length. */
  focus?: number | null;
  /** Where the pointer is, so a panel beside the chart can echo the same moment. */
  onCursor?: (ratio: number | null) => void;
  /** Finding the second people left is only half the job; this is where the other half starts. */
  onAsk?: (question: string) => void;
}) {
  const W = width;
  const { t } = useI18n();
  const f = useFormat();
  const titleId = useId();
  const [cursor, setCursor] = useState<number | null>(null);

  const points = retention.points;
  const x = (ratio: number) => LEFT + ratio * (W - LEFT);
  const y = (watch: number) => TOP + PLOT * (1 - Math.min(Math.max(watch, 0), 1));
  const mark = (ratio: number) => (durationS ? f.clock(ratio * durationS) : `${Math.round(ratio * 100)}%`);

  const line = points
    .map((p, i) => `${i ? 'L' : 'M'}${x(p.ratio).toFixed(1)} ${y(p.watchRatio).toFixed(1)}`)
    .join(' ');

  // a citation should land on the exact second it named
  useEffect(() => {
    if (focus == null) return;
    setCursor(
      points.reduce(
        (best, point, index) =>
          Math.abs(point.ratio - focus) < Math.abs(points[best]!.ratio - focus) ? index : best,
        0,
      ),
    );
  }, [focus, points]);

  const active = cursor == null ? null : points[cursor];

  useEffect(() => {
    onCursor?.(active ? active.ratio : null);
  }, [active, onCursor]);
  const intro = durationS && durationS > INTRO_S ? INTRO_S / durationS : null;
  const ranked = points.some((p) => p.relative != null);

  // the two videos differ in length, so both curves are read across share of length
  const other = compare?.points.length ? compare.points : null;
  const otherLine = other
    ? other.map((p, i) => `${i ? 'L' : 'M'}${x(p.ratio).toFixed(1)} ${y(p.watchRatio).toFixed(1)}`).join(' ')
    : null;
  const otherAt = (ratio: number) =>
    other?.reduce((best, point) =>
      Math.abs(point.ratio - ratio) < Math.abs(best.ratio - ratio) ? point : best,
    ).watchRatio ?? null;

  // people scrubbing back is the one thing a falling curve cannot show, so the rises are
  // called out rather than left to be read off a line that mostly goes down
  const spikes = points
    .map((point, i) => ({ point, rise: i === 0 ? 0 : point.watchRatio - points[i - 1]!.watchRatio }))
    .filter((entry) => entry.rise > SPIKE)
    .sort((a, b) => b.rise - a.rise)
    .slice(0, 3);

  const seek = (clientX: number, box: DOMRect) => {
    const ratio = (clientX - box.left) / box.width;
    // the plot starts after the axis gutter, so the pointer has to be mapped past it
    const along = (ratio * W - LEFT) / (W - LEFT);
    const index = Math.round(along * (points.length - 1));
    setCursor(Math.min(Math.max(index, 0), points.length - 1));
  };

  return (
    <div className="p-5">
      <span id={titleId} className="sr-only">
        {t('section.retention')}
      </span>

      {(ranked || other) && (
        <div className="text-muted-foreground mb-2 flex flex-wrap items-center justify-end gap-4 text-xs">
          {other && <Key line className="border-muted-foreground">{compare!.title}</Key>}
          {ranked && <Key className="bg-success">{t('video.aboveTypical')}</Key>}
          {ranked && <Key className="bg-destructive">{t('video.belowTypical')}</Key>}
        </div>
      )}

      <div className="relative">
        {active && (
          <Readout
            active={active}
            at={mark(active.ratio)}
            left={(x(active.ratio) / W) * 100}
            compared={other ? otherAt(active.ratio) : null}
          />
        )}

        <svg
          viewBox={`0 0 ${W} ${H}`}
          role="img"
          aria-labelledby={titleId}
          tabIndex={0}
          className={cn(focusRing, 'block h-auto w-full touch-pan-y rounded-md')}
          onPointerLeave={() => setCursor(null)}
          onPointerDown={(event) => seek(event.clientX, event.currentTarget.getBoundingClientRect())}
          onPointerMove={(event) => {
            if (event.pointerType === 'mouse' || event.buttons > 0) {
              seek(event.clientX, event.currentTarget.getBoundingClientRect());
            }
          }}
          onKeyDown={(event) => {
            if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
            event.preventDefault();
            setCursor((current) => {
              const next = (current ?? 0) + (event.key === 'ArrowRight' ? 1 : -1);
              return Math.min(Math.max(next, 0), points.length - 1);
            });
          }}
        >
          {intro && (
            <g>
              <rect
                x={LEFT}
                y={TOP}
                width={x(intro) - LEFT}
                height={PLOT}
                className="fill-muted-foreground opacity-10"
              />
              <text x={LEFT + 6} y={TOP + 16} className="fill-muted-foreground font-mono text-[12px]">
                {t('video.intro')}
              </text>
            </g>
          )}

          {[0, 0.5, 1].map((level) => (
            <g key={level}>
              <line x1={LEFT} x2={W} y1={y(level)} y2={y(level)} className="stroke-border" />
              <text x={0} y={y(level) + 4} className="fill-muted-foreground font-mono text-[12px]">
                {level * 100}%
              </text>
            </g>
          ))}

          <path d={`${line} L${W} ${TOP + PLOT} L${LEFT} ${TOP + PLOT} Z`} className="fill-chart opacity-18" />

          {/* unfilled and underneath: this video stays the subject */}
          {otherLine && (
            <path
              d={otherLine}
              className="stroke-muted-foreground fill-none opacity-70"
              strokeWidth={2}
              strokeDasharray="6 5"
              strokeLinejoin="round"
            />
          )}

          <path d={line} className="stroke-chart fill-none" strokeWidth={3} strokeLinejoin="round" />

          {spikes.map(({ point }) => (
            <path
              key={point.ratio}
              d={`M${x(point.ratio)} ${y(point.watchRatio) - 10} l5 7 l-10 0 z`}
              className="fill-success"
            />
          ))}

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
                y={H - 6}
                textAnchor="middle"
                className="fill-destructive font-mono text-[12px]"
              >
                {mark(drop.ratio)}
              </text>
            </g>
          ))}

          {/* the curve says how many stayed; the strip says whether that is any good, which is
              the only thing a first-time number can be judged against */}
          {points.slice(0, -1).map((point, index) =>
            point.relative == null ? null : (
              <rect
                key={point.ratio}
                x={x(point.ratio)}
                y={STRIP_Y}
                width={x(points[index + 1]!.ratio) - x(point.ratio)}
                height={STRIP}
                opacity={0.25 + Math.min(Math.abs(point.relative - 0.5) * 1.5, 0.55)}
                className={point.relative >= 0.5 ? 'fill-success' : 'fill-destructive'}
              />
            ),
          )}

          {active && (
            <g className="pointer-events-none">
              <line
                x1={x(active.ratio)}
                x2={x(active.ratio)}
                y1={TOP}
                y2={TOP + PLOT}
                className="stroke-foreground"
                strokeWidth={1}
              />
              <circle
                cx={x(active.ratio)}
                cy={y(active.watchRatio)}
                r={5}
                className="fill-chart stroke-card"
                strokeWidth={2}
              />
            </g>
          )}
        </svg>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-1 text-sm text-muted-foreground">
        {retention.steepestDropOffs.map((drop) => {
          const at = mark(drop.ratio);
          const said = (
            <>
              {t('video.dropAt')} <b className="tabular text-destructive font-medium">{at}</b>
              {' — '}
              {t('video.dropSize', { n: f.dec(drop.drop * 100, 1) })}
            </>
          );

          return onAsk ? (
            <button
              key={drop.ratio}
              onClick={() => onAsk(t('ask.aboutDrop', { at }))}
              aria-label={t('video.askDrop', { at })}
              className={cn(
                focusRing,
                'hover:text-foreground inline-flex min-h-11 items-center gap-2 rounded-md px-1 underline-offset-4 hover:underline',
              )}
            >
              <span>{said}</span>
              <Sparkles className="size-4 shrink-0" />
            </button>
          ) : (
            <span key={drop.ratio} className="inline-flex min-h-11 items-center">
              <span>{said}</span>
            </span>
          );
        })}
        {spikes.map(({ point }) => (
          <span key={point.ratio} className="inline-flex min-h-11 items-center">
            <span>
              {t('video.spikeAt')} <b className="tabular text-success font-medium">{mark(point.ratio)}</b>
            </span>
          </span>
        ))}
      </div>
    </div>
  );
}

/**
 * Pinned to the top of the plot rather than to the point, so it never covers the stretch of
 * curve being read and never jumps under the pointer as the line falls.
 */
function Readout({
  active,
  at,
  left,
  compared,
}: {
  active: RetentionPoint;
  at: string;
  left: number;
  compared: number | null;
}) {
  const { t } = useI18n();
  const f = useFormat();

  return (
    <div
      role="status"
      aria-live="polite"
      style={{ left: `${left}%` }}
      className={cn(
        'bg-popover pointer-events-none absolute top-0 z-10 rounded-lg border px-3 py-2 shadow-md',
        left < 12 ? 'translate-x-0' : left > 88 ? '-translate-x-full' : '-translate-x-1/2',
      )}
    >
      <div className="tabular text-sm font-medium whitespace-nowrap">
        {at} · {t('video.stillWatching', { n: f.pct(active.watchRatio * 100, 0) })}
      </div>
      {compared != null && (
        <div className="tabular text-muted-foreground mt-1 text-xs whitespace-nowrap">
          {t('video.comparedHere', { n: f.pct(compared * 100, 0) })}
        </div>
      )}
      {active.relative != null && (
        <div className="text-muted-foreground mt-1 text-xs whitespace-nowrap">
          {t('video.typicalRank', { n: Math.round(active.relative * 100) })}
        </div>
      )}
    </div>
  );
}

function Key({ className, line, children }: { className: string; line?: boolean; children: string }) {
  return (
    <span className="flex min-w-0 items-center gap-2">
      <span className={cn('shrink-0', line ? 'w-6 border-t border-dashed' : 'size-2 rounded-full opacity-70', className)} />
      <span className="truncate">{children}</span>
    </span>
  );
}
