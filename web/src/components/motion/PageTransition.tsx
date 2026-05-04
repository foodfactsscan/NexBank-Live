import { motion } from 'framer-motion';
import { ReactNode } from 'react';

interface Props { children: ReactNode }

export function PageTransition({ children }: Props) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -4 }}
      transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
      style={{ minHeight: '100%' }}
    >
      {children}
    </motion.div>
  );
}
