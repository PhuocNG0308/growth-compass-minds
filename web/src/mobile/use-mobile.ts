import { useEffect, useState } from 'react';

// The same test the `desktop` CSS variant uses, so JS and styles can never disagree about
// which build the person is looking at. A phone in landscape is wider than 768px and still
// a phone, which is why the pointer matters as much as the width.
const DESKTOP = '(min-width: 768px) and (hover: hover) and (pointer: fine)';

export function useIsMobile(): boolean {
  const [mobile, setMobile] = useState(() => !matchMedia(DESKTOP).matches);

  useEffect(() => {
    const query = matchMedia(DESKTOP);
    const update = () => setMobile(!query.matches);
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, []);

  return mobile;
}
