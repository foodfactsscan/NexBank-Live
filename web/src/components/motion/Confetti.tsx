import { useEffect, useRef } from 'react';
import { useUI } from '@/store/ui';

// Lightweight canvas confetti — 80 particles, gravity-only physics, gone in
// ~2 s. Kept dependency-free so we don't add 30 kB just for "yay". Listens to
// the shared `confettiTrigger` so any feature can fire it.

const COLORS = ['#6366F1', '#06B6D4', '#10B981', '#F59E0B', '#EC4899', '#8B5CF6'];

interface P { x: number; y: number; vx: number; vy: number; size: number; rot: number; vr: number; color: string; }

export function ConfettiHost() {
  const ref = useRef<HTMLCanvasElement | null>(null);
  const trigger = useUI(s => s.confettiTrigger);

  useEffect(() => {
    if (!trigger) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const canvas = ref.current; if (!canvas) return;
    const ctx = canvas.getContext('2d'); if (!ctx) return;
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    const particles: P[] = Array.from({ length: 100 }, () => ({
      x: window.innerWidth / 2, y: window.innerHeight * 0.4,
      vx: (Math.random() - 0.5) * 12,
      vy: -Math.random() * 12 - 6,
      size: Math.random() * 6 + 4,
      rot: Math.random() * Math.PI * 2,
      vr: (Math.random() - 0.5) * 0.3,
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
    }));
    let raf = 0;
    const start = performance.now();
    const step = (t: number) => {
      const elapsed = t - start;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      particles.forEach(p => {
        p.vy += 0.4;
        p.x += p.vx; p.y += p.vy; p.rot += p.vr;
        ctx.save();
        ctx.translate(p.x, p.y); ctx.rotate(p.rot);
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.4);
        ctx.restore();
      });
      if (elapsed < 2200) raf = requestAnimationFrame(step);
      else ctx.clearRect(0, 0, canvas.width, canvas.height);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [trigger]);

  return (
    <canvas
      ref={ref}
      aria-hidden
      style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 401 }}
    />
  );
}
