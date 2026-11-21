import { motion, useReducedMotion } from 'framer-motion';
import { type ReactNode } from 'react';

/**
 * A quick, subtle fade when switching pages (~150ms). The new page appears
 * immediately — no waiting for the old one to animate out — and people who
 * prefer reduced motion get no animation at all.
 */
export function PageTransition({ children, routeKey }: { children: ReactNode; routeKey: string }) {
  const reduce = useReducedMotion();
  if (reduce) return <>{children}</>;
  return (
    <motion.div
      key={routeKey}
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.15, ease: 'easeOut' }}
    >
      {children}
    </motion.div>
  );
}
