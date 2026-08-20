import { useEffect, useState } from 'react';

export type Async<T> = { data: T | null; error: Error | null; loading: boolean };

export function useAsync<T>(load: () => Promise<T>, deps: unknown[] = []): Async<T> {
  const [state, setState] = useState<Async<T>>({ data: null, error: null, loading: true });

  useEffect(() => {
    let live = true;
    setState((prev) => ({ ...prev, loading: true }));
    load().then(
      (data) => live && setState({ data, error: null, loading: false }),
      (error: Error) => live && setState({ data: null, error, loading: false }),
    );
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return state;
}

export function useHash(): string {
  const [hash, setHash] = useState(() => location.hash || '#/');

  useEffect(() => {
    const update = () => setHash(location.hash || '#/');
    window.addEventListener('hashchange', update);
    return () => window.removeEventListener('hashchange', update);
  }, []);

  return hash;
}
