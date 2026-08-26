import { useCallback, useState } from 'react';

const KEY = 'gc.archived';

function load(): string[] {
  try {
    const stored: unknown = JSON.parse(localStorage.getItem(KEY) ?? '[]');
    return Array.isArray(stored) ? stored.filter((id) => typeof id === 'string') : [];
  } catch {
    return [];
  }
}

/**
 * Videos the creator has finished with. There is no server field for this and no reason to
 * add one — it is a per-person view preference, so it lives beside the theme.
 */
export function useArchive() {
  const [ids, setIds] = useState(load);

  const write = (next: string[]) => {
    localStorage.setItem(KEY, JSON.stringify(next));
    return next;
  };

  const toggle = useCallback((id: string) => {
    setIds((current) =>
      write(current.includes(id) ? current.filter((kept) => kept !== id) : [...current, id]),
    );
  }, []);

  const setMany = useCallback((targets: string[], hidden: boolean) => {
    setIds((current) =>
      write(
        hidden
          ? [...new Set([...current, ...targets])]
          : current.filter((id) => !targets.includes(id)),
      ),
    );
  }, []);

  const restore = useCallback((snapshot: string[]) => setIds(write([...snapshot])), []);

  return { ids, toggle, setMany, restore, has: (id: string) => ids.includes(id) };
}
