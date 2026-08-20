import { useMemo } from 'react';
import { useI18n, type Locale, type Translate } from './i18n';

export const DASH = '—';

function build(locale: Locale, t: Translate) {
  const number = new Intl.NumberFormat(locale);
  const relative = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });
  const short = new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short' });
  const long = new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'long', year: 'numeric' });

  const dec = (value: number | null | undefined, digits = 1) =>
    value == null
      ? DASH
      : new Intl.NumberFormat(locale, {
          minimumFractionDigits: digits,
          maximumFractionDigits: digits,
        }).format(value);

  const span = (ms: number) => {
    const minutes = Math.round(ms / 60_000);
    if (Math.abs(minutes) < 60) return relative.format(minutes, 'minute');
    const hours = Math.round(minutes / 60);
    if (Math.abs(hours) < 48) return relative.format(hours, 'hour');
    return relative.format(Math.round(hours / 24), 'day');
  };

  const clock = (seconds: number | null | undefined) => {
    if (seconds == null) return DASH;
    const total = Math.round(seconds);
    return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
  };

  const named = (prefix: string, key: string) => {
    const label = t(`${prefix}.${key}`);
    return label === `${prefix}.${key}` ? key : label;
  };

  return {
    int: (value: number | null | undefined) => (value == null ? DASH : number.format(value)),
    dec,
    pct: (value: number | null | undefined, digits = 1) =>
      value == null ? DASH : `${dec(value, digits)}%`,
    clock,
    shortDate: (value: string | null | undefined) => (value ? short.format(new Date(value)) : DASH),
    longDate: (value: string | null | undefined) => (value ? long.format(new Date(value)) : DASH),
    since: (value: string) => span(new Date(value).getTime() - Date.now()),
    metric: (key: string) => named('metric', key),
    lever: (key: string) => named('lever', key),
    checkpoint: (kind: string) => {
      const value = kind.replace(/^t/, '');
      return /^\d+$/.test(value) ? `${value}h` : value;
    },
    metricValue: (key: string, value: number | null | undefined) => {
      if (value == null) return DASH;
      if (key === 'avgViewDurationS') return clock(value);
      if (key.endsWith('Pct')) return `${dec(value, 1)}%`;
      return number.format(value);
    },
  };
}

export function useFormat() {
  const { locale, t } = useI18n();
  return useMemo(() => build(locale, t), [locale, t]);
}
