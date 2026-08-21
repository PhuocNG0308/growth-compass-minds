import { useState } from 'react';
import { Moon, Sun } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { LOCALES, useI18n } from '@/lib/i18n';
import { currentTheme, setTheme } from '@/lib/theme';
import { cn, focusRing } from '@/lib/utils';

export function LocaleToggle({ className }: { className?: string }) {
  const { locale, setLocale } = useI18n();

  return (
    <div className={cn('flex items-center rounded-lg border p-1', className)}>
      {LOCALES.map(([code, label]) => (
        <button
          key={code}
          onClick={() => setLocale(code)}
          aria-pressed={code === locale}
          className={cn(
            focusRing,
            'rounded-md px-2 py-1 text-xs font-semibold transition-colors @md:px-3',
            code === locale
              ? 'bg-primary text-primary-foreground'
              : 'text-muted-foreground hover:text-foreground',
          )}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

export function ThemeToggle() {
  const { t } = useI18n();
  const [theme, applyTheme] = useState(currentTheme);

  return (
    <Button
      variant="outline"
      size="icon"
      aria-label={t('shell.theme')}
      title={t('shell.theme')}
      onClick={() => {
        const next = theme === 'dark' ? 'light' : 'dark';
        setTheme(next);
        applyTheme(next);
      }}
    >
      {theme === 'dark' ? <Sun /> : <Moon />}
    </Button>
  );
}
