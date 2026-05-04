import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { formatCompactINR } from '@/lib/format';

export interface TrendPoint { month: string; credit: number; debit: number }

interface Props {
  data: TrendPoint[];
  height?: number;
}

export function TrendLine({ data, height = 240 }: Props) {
  return (
    <div style={{ width: '100%', height }}>
      <ResponsiveContainer>
        <AreaChart data={data} margin={{ top: 16, right: 8, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="cr" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%"  stopColor="#10B981" stopOpacity={0.45} />
              <stop offset="95%" stopColor="#10B981" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="db" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%"  stopColor="#EF4444" stopOpacity={0.45} />
              <stop offset="95%" stopColor="#EF4444" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
          <XAxis dataKey="month" tick={{ fill: '#94A3B8', fontSize: 12 }} axisLine={false} tickLine={false} />
          <YAxis tickFormatter={(v) => formatCompactINR(v)} tick={{ fill: '#94A3B8', fontSize: 11 }} axisLine={false} tickLine={false} width={48} />
          <Tooltip
            contentStyle={{ background: '#11172A', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, color: '#F8FAFC' }}
            formatter={(v: number) => formatCompactINR(v)}
            cursor={{ stroke: 'rgba(255,255,255,0.1)' }}
          />
          <Area type="monotone" dataKey="credit" stroke="#10B981" strokeWidth={2} fill="url(#cr)" />
          <Area type="monotone" dataKey="debit"  stroke="#EF4444" strokeWidth={2} fill="url(#db)" />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
