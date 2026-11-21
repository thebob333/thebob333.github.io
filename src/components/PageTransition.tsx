import { type ReactNode } from 'react';

/**
 * A quick, subtle fade-up when switching pages (CSS, ~150ms). The new page
 * appears immediately; reduced-motion users get no animation (global CSS rule).
 */
export function PageTransition({ children, routeKey }: { children: ReactNode; routeKey: string }) {
  return (
    <div key={routeKey} style={{ animation: 'rise-in 0.18s cubic-bezier(0.22, 1, 0.36, 1) backwards' }}>
      {children}
    </div>
  );
}
