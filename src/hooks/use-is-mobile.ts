'use client';

import { useEffect, useState } from 'react';

// [responsive] Breakpoint CSS-driven: sin parpadeo de hidratación porque matchMedia
// solo se evalúa en el cliente tras el montaje.
export function useIsMobile(maxWidth = 640): boolean {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${maxWidth}px)`);
    const update = () => setIsMobile(mq.matches);
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, [maxWidth]);

  return isMobile;
}
