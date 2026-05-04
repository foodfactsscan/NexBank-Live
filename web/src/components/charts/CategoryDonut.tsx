import { Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import { formatINR } from '@/lib/format';

const PALETTE = ['#6366F1', '#06B6D4', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#22D3EE', '#F97316'];

interface Props {
  data: Record<string, number>;
  height?: number;
}

export function CategoryDonut({ data, height = 240 }: Props) {
  const entries = Object.entries(data || {}).filter(([, v]) => v > 0);
  if (!entries.length) {
    return (
      <div style={{ height, display: 'grid', placeItems: 'center', color: 'var(--text-3)', fontSize: 14 }}>
        No spending in this period yet.
      </div>
    );
  }
  const series = entries.map(([name, value], i) => ({ name, value, fill: PALETTE[i % PALETTE.length] }));
  return (
    <div style={{ width: '100%', height }}>
      <ResponsiveContainer>
        <PieChart>
          <Pie data={series} dataKey="value" nameKey="name" innerRadius="55%" outerRadius="80%" paddingAngle={2}>
            {series.map((s, i) => <Cell key={i} fill={s.fill} />)}
          </Pie>
          <Tooltip
            contentStyle={{ background: '#11172A', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, color: '#F8FAFC' }}
            formatter={(v: number, n: string) => [formatINR(v), n]}
          />
          <Legend wrapperStyle={{ fontSize: 12, color: '#94A3B8' }} />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
