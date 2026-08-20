const KEY = 'gc.theme';

export type Theme = 'light' | 'dark';

export const currentTheme = (): Theme =>
  document.documentElement.classList.contains('dark') ? 'dark' : 'light';

export function setTheme(next: Theme) {
  document.documentElement.classList.toggle('dark', next === 'dark');
  localStorage.setItem(KEY, next);
}
