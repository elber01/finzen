'use client';

import { motion } from 'framer-motion';
import type { ReactNode } from 'react';

/**
 * Transición suave entre vistas del shell. Usar con `key={view}` en el padre
 * para que el remount dispare la animación de entrada.
 */
export function ViewTransition({ children }: { children: ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, ease: [0.25, 0.1, 0.25, 1] }}
    >
      {children}
    </motion.div>
  );
}
