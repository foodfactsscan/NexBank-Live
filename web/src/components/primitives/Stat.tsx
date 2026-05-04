import { ReactNode } from 'react';
import { Card } from './Card';

interface Props {
  label: string;
  value: ReactNode;
  trend?: number;     // signed % e.g. +5 / -3
  hint?: string;
  icon?: ReactNode;
}

export function Stat({ label, value, trend, hint, icon }: Props) {
  const trendColor = trend == null ? 'var(--text-3)' : trend >= 0 ? 'var(--success)' : 'var(--danger)';
  return (
    <Card>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ fontSize: 13, color: 'var(--text-2)', fontWeight: 500 }}>{label}</div>
        {icon}
      </div>
      <div style={{ fontSize: 28, fontWeight: 800, marginTop: 8, letterSpacing: '-0.02em' }}>{value}</div>
      <div style={{ marginTop: 8, fontSize: 12, color: trendColor, display: 'flex', gap: 6, alignItems: 'center' }}>
        {trend != null && <span style={{ fontWeight: 700 }}>{trend >= 0 ? '↑' : '↓'} {Math.abs(trend).toFixed(1)}%</span>}
        {hint && <span style={{ color: 'var(--text-3)' }}>{hint}</span>}
      </div>
    </Card>
  );
}
