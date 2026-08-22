import { cn } from '@/lib/utils';

export type Stat = { value: string | number; label: string; alert?: boolean; lead?: boolean };

// static class names so Tailwind keeps them; the grid has to match the item count or a
// trailing cell renders as an empty coloured block
const COLUMNS: Record<number, string> = {
  3: 'grid-cols-3',
  4: 'grid-cols-2 lg:grid-cols-4',
  5: 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-5',
};

export function StatGrid({ stats }: { stats: Stat[] }) {
  return (
    <div
      className={cn(
        'bg-border grid gap-px overflow-hidden rounded-xl border',
        COLUMNS[stats.length] ?? 'grid-cols-2',
      )}
    >
      {stats.map((stat, i) => (
        <div
          key={stat.label}
          className={cn(
            'bg-card px-5 py-4',
            i === stats.length - 1 && stats.length % 2 === 1 && 'col-span-2 sm:col-span-1',
          )}
        >
          <div className="text-muted-foreground text-xs">{stat.label}</div>
          <div
            className={cn(
              // proportional figures: tabular-nums is for columns that align, and equal-width
              // digits make a large standalone number read loose
              'mt-1 text-2xl leading-tight font-normal tracking-tight',
              stat.lead && 'font-medium',
              stat.alert && 'text-warning',
            )}
          >
            {stat.value}
          </div>
        </div>
      ))}
    </div>
  );
}
