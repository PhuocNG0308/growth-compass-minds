import { useId, useState } from 'react';
import { Table2, LineChart as LineIcon } from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useI18n } from '@/lib/i18n';
import { DASH } from '@/lib/format';
import { cn, focusRing } from '@/lib/utils';

export type TrendPoint = { label: string; value: number | null };

// The plot box only — every label lives in HTML beside it. Text inside a scaled viewBox
// shrinks with the container, which on a phone left the axis ticks at about six pixels.
const W = 720;
const H = 180;

/**
 * One series, one hue. Two measures never share a plot here: the y-scales would be
 * arbitrary and the chart would invent a correlation the data does not have. Callers put a
 * metric switch above instead.
 */
export function Trend({
  points,
  caption,
  format,
  reference,
}: {
  points: TrendPoint[];
  caption: string;
  format: (value: number | null) => string;
  reference?: { value: number; label: string };
}) {
  const { t } = useI18n();
  const [asTable, setAsTable] = useState(false);
  const [cursor, setCursor] = useState<number | null>(null);
  const titleId = useId();

  const real = points.filter((point): point is TrendPoint & { value: number } => point.value != null);
  if (real.length < 2) return <p className="text-muted-foreground py-6 text-sm">{t('chart.thin')}</p>;

  const values = real.map((point) => point.value);
  if (reference) values.push(reference.value);
  const top = Math.max(...values);
  const bottom = Math.min(...values, 0);
  const span = top - bottom || 1;

  const x = (index: number) => (index / (points.length - 1)) * W;
  const y = (value: number) => H * (1 - (value - bottom) / span);
  const ratio = (value: number) => 1 - (value - bottom) / span;

  // a gap in the data is a gap in the line — joining across a null would draw a number
  // nobody measured
  const segments: string[] = [];
  let run: string[] = [];
  points.forEach((point, index) => {
    if (point.value == null) {
      if (run.length > 1) segments.push(run.join(' '));
      run = [];
      return;
    }
    run.push(`${run.length ? 'L' : 'M'}${x(index).toFixed(1)} ${y(point.value).toFixed(1)}`);
  });
  if (run.length > 1) segments.push(run.join(' '));

  const active = cursor != null ? points[cursor] : undefined;

  return (
    <figure className="m-0">
      <figcaption className="mb-3 flex items-center justify-between gap-4">
        <span id={titleId} className="text-muted-foreground text-sm">
          {caption}
        </span>
        <button
          onClick={() => setAsTable((on) => !on)}
          aria-pressed={asTable}
          className={cn(
            focusRing,
            'text-muted-foreground hover:text-foreground flex items-center gap-2 rounded-md px-2 py-1 text-xs font-medium',
          )}
        >
          {asTable ? <LineIcon className="size-3" /> : <Table2 className="size-3" />}
          {t(asTable ? 'chart.asChart' : 'chart.asTable')}
        </button>
      </figcaption>

      {asTable ? (
        <div className="max-h-72 overflow-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('chart.when')}</TableHead>
                <TableHead className="text-right">{caption}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {points.map((point) => (
                <TableRow key={point.label}>
                  <TableCell className="tabular">{point.label}</TableCell>
                  <TableCell className="tabular text-right">
                    {point.value == null ? DASH : format(point.value)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : (
        <div className="flex gap-3">
          {/* h-40 matches the plot exactly; without it the column stretches over the x-axis
              row too and the bottom tick drifts below its gridline */}
          <div className="text-muted-foreground tabular relative h-40 w-14 shrink-0 self-start text-xs">
            {[1, 0.5, 0].map((level) => (
              <span
                key={level}
                className="absolute right-0 -translate-y-1/2"
                style={{ top: `${(1 - level) * 100}%` }}
              >
                {format(bottom + span * level)}
              </span>
            ))}
          </div>

          <div className="min-w-0 flex-1">
            <div className="relative">
              <svg
                viewBox={`0 0 ${W} ${H}`}
                preserveAspectRatio="none"
                role="img"
                aria-labelledby={titleId}
                tabIndex={0}
                className={cn(focusRing, 'block h-40 w-full rounded-md')}
                onPointerLeave={() => setCursor(null)}
                onPointerMove={(event) => {
                  const box = event.currentTarget.getBoundingClientRect();
                  const index = Math.round(
                    ((event.clientX - box.left) / box.width) * (points.length - 1),
                  );
                  setCursor(Math.min(Math.max(index, 0), points.length - 1));
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
                {[0, 0.5, 1].map((level) => (
                  <line
                    key={level}
                    x1={0}
                    x2={W}
                    y1={H * level}
                    y2={H * level}
                    className="stroke-border"
                    vectorEffect="non-scaling-stroke"
                  />
                ))}

                {reference && (
                  <line
                    x1={0}
                    x2={W}
                    y1={y(reference.value)}
                    y2={y(reference.value)}
                    className="stroke-muted-foreground"
                    strokeDasharray="5 4"
                    vectorEffect="non-scaling-stroke"
                  />
                )}

                {segments.map((path) => (
                  <path
                    key={path}
                    d={`${path} L${x(points.length - 1)} ${H} L0 ${H} Z`}
                    className="fill-chart opacity-12"
                  />
                ))}
                {segments.map((path) => (
                  <path
                    key={`line-${path}`}
                    d={path}
                    className="stroke-chart fill-none"
                    strokeWidth={2}
                    strokeLinejoin="round"
                    strokeLinecap="round"
                    vectorEffect="non-scaling-stroke"
                  />
                ))}

                {active?.value != null && cursor != null && (
                  <line
                    x1={x(cursor)}
                    x2={x(cursor)}
                    y1={0}
                    y2={H}
                    className="stroke-muted-foreground opacity-40"
                    vectorEffect="non-scaling-stroke"
                  />
                )}
              </svg>

              {/* markers sit in HTML so they stay round under a non-uniform SVG scale, and a
                  short series shows every reading rather than one smooth line */}
              {points.length <= 12 &&
                points.map((point, index) =>
                  point.value == null ? null : (
                    <span
                      key={point.label}
                      className={cn(
                        'bg-chart pointer-events-none absolute size-2 -translate-x-1/2 -translate-y-1/2 rounded-full',
                        index === cursor && 'ring-card size-3 ring-2',
                      )}
                      style={{
                        left: `${(index / (points.length - 1)) * 100}%`,
                        top: `${ratio(point.value) * 100}%`,
                      }}
                    />
                  ),
                )}

              {active && cursor != null && (
                <div
                  role="status"
                  aria-live="polite"
                  className="bg-card pointer-events-none absolute top-0 -translate-x-1/2 rounded-lg border px-3 py-2 text-xs shadow-sm"
                  style={{ left: `${(cursor / (points.length - 1)) * 100}%` }}
                >
                  <div className="text-muted-foreground tabular">{active.label}</div>
                  <div className="tabular font-medium">
                    {active.value == null ? t('chart.missing') : format(active.value)}
                  </div>
                </div>
              )}
            </div>

            <div className="text-muted-foreground tabular mt-2 flex justify-between text-xs">
              <span>{points[0]?.label}</span>
              {reference && <span>{reference.label}</span>}
              <span>{points.at(-1)?.label}</span>
            </div>
          </div>
        </div>
      )}
    </figure>
  );
}
