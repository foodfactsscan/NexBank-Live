import { formatINR } from '@/lib/format';

interface Props {
  spent: number;
  limit: number;
  category: string;
}

export function BudgetGauge({ spent, limit, category }: Props) {
  const ratio = limit > 0 ? Math.min(spent / limit, 1.5) : 0;
  const pct = Math.min(ratio * 100, 100);
  const color = ratio >= 1 ? 'var(--danger)' : ratio >= 0.8 ? 'var(--warning)' : 'var(--accent)';
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <span style={{ fontWeight: 600 }}>{category}</span>
        <span style={{ color: 'var(--text-2)', fontSize: 13 }}>
          {formatINR(spent)} <span style={{ color: 'var(--text-3)' }}>/ {formatINR(limit)}</span>
        </span>
      </div>
      <div style={{ height: 8, background: 'var(--bg-2)', borderRadius: 999, overflow: 'hidden' }}>
        <div style={{
          height: '100%', width: `${pct}%`, background: color,
          transition: 'width 600ms cubic-bezier(0.16,1,0.3,1)',
        }} />
      </div>
    </div>
  );
}
