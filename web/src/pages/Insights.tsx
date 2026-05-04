import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/store/auth';
import { api } from '@/lib/api';
import { qk } from '@/lib/queryClient';
import { Card } from '@/components/primitives/Card';
import { Skeleton } from '@/components/primitives/Skeleton';
import { Stat } from '@/components/primitives/Stat';
import { TrendLine } from '@/components/charts/TrendLine';
import { CategoryDonut } from '@/components/charts/CategoryDonut';
import { formatINR } from '@/lib/format';
import { ChartIcon, TrendUpIcon, TrendDownIcon, PercentIcon } from '@/icons/Icon';

export function Insights() {
  const accounts = useAuth(s => s.accounts);
  const primary = accounts[0];
  const summary = useQuery({
    queryKey: qk.summary(primary?._id || ''),
    enabled: !!primary,
    queryFn: () => api.get<{ summary: any }>(`/accounts/${primary!._id}/summary`),
  });
  const monthly = summary.data?.summary?.monthlyData || [];
  const categories = summary.data?.summary?.categoryBreakdown || {};
  const income = summary.data?.summary?.monthlyIncome || 0;
  const expense = summary.data?.summary?.monthlyExpense || 0;
  const savingsRate = income > 0 ? ((income - expense) / income) * 100 : 0;

  return (
    <div className="stack-5">
      <div className="grid-3">
        <Stat label="Income (this month)"  value={summary.isLoading ? <Skeleton width="60%" height={28} /> : formatINR(income)}  icon={<TrendUpIcon size={18} />} />
        <Stat label="Expense (this month)" value={summary.isLoading ? <Skeleton width="60%" height={28} /> : formatINR(expense)} icon={<TrendDownIcon size={18} />} />
        <Stat label="Savings rate"         value={summary.isLoading ? <Skeleton width="60%" height={28} /> : `${savingsRate.toFixed(1)}%`} icon={<PercentIcon size={18} />} />
      </div>

      <Card>
        <h3 className="h3" style={{ marginBottom: 12 }}>Cashflow — last 6 months</h3>
        {summary.isLoading ? <Skeleton height={300} /> : <TrendLine data={monthly} height={320} />}
      </Card>

      <Card>
        <h3 className="h3" style={{ marginBottom: 12 }}>Where your money went</h3>
        {summary.isLoading ? <Skeleton height={300} /> : <CategoryDonut data={categories} height={320} />}
      </Card>

      <Card>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', color: 'var(--text-2)' }}>
          <ChartIcon size={20} /> <span>Set monthly limits in Budgets to get alerts before you overspend.</span>
        </div>
      </Card>
    </div>
  );
}
