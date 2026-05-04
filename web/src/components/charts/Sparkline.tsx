import { Area, AreaChart, ResponsiveContainer } from 'recharts';

interface Props {
  data: number[];
  color?: string;
  height?: number;
}

export function Sparkline({ data, color = 'var(--accent-2)', height = 40 }: Props) {
  if (!data || data.length < 2) return <div style={{ height }} />;
  const series = data.map((v, i) => ({ i, v }));
  const id = `sl-${Math.random().toString(36).slice(2, 8)}`;
  return (
    <div style={{ width: '100%', height }}>
      <ResponsiveContainer>
        <AreaChart data={series} margin={{ top: 2, right: 2, left: 2, bottom: 2 }}>
          <defs>
            <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.45} />
              <stop offset="100%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <Area type="monotone" dataKey="v" stroke={color} strokeWidth={2} fill={`url(#${id})`} dot={false} isAnimationActive />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
