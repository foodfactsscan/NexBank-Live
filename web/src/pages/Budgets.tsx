import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Card } from '@/components/primitives/Card';
import { Button } from '@/components/primitives/Button';
import { Input } from '@/components/primitives/Input';
import { Modal } from '@/components/primitives/Modal';
import { Skeleton } from '@/components/primitives/Skeleton';
import { EmptyState } from '@/components/primitives/EmptyState';
import { BudgetGauge } from '@/components/charts/BudgetGauge';
import { api, ApiError } from '@/lib/api';
import { qk } from '@/lib/queryClient';
import { toast } from '@/store/ui';
import { PiggyIcon, PlusIcon } from '@/icons/Icon';

const CATEGORIES = [
  'Food & Dining', 'Groceries', 'Transport', 'Entertainment', 'Shopping',
  'Bills & Utilities', 'Rent & EMI', 'Healthcare', 'Education', 'Travel', 'Other',
];

interface Row { category: string; monthlyLimit: number; alertThreshold: number; spent: number; ratio: number; breached: boolean; warning: boolean }

export function Budgets() {
  const qc = useQueryClient();
  const [creating, setCreating] = useState(false);

  const list = useQuery({
    queryKey: qk.budgets,
    queryFn: () => api.get<{ budgets: Row[] }>('/budgets'),
  });

  return (
    <div className="stack-5">
      <div className="row-sb">
        <div>
          <h2 className="h2">Budgets</h2>
          <p className="muted" style={{ marginTop: 4 }}>Cap your spending per category. We’ll warn you at 80%.</p>
        </div>
        <Button iconLeft={<PlusIcon size={16} />} onClick={() => setCreating(true)}>New budget</Button>
      </div>

      {list.isLoading ? (
        <Card><div className="stack-3">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} height={48} />)}</div></Card>
      ) : !list.data?.budgets?.length ? (
        <Card>
          <EmptyState icon={<PiggyIcon />} title="No budgets yet"
            description="Set monthly limits per category and we'll keep an eye on them."
            action={<Button onClick={() => setCreating(true)} iconLeft={<PlusIcon size={16} />}>Create your first budget</Button>}
          />
        </Card>
      ) : (
        <Card>
          <div className="stack-4">
            {list.data.budgets.map(b => (
              <div key={b.category} style={{ padding: 14, background: 'var(--bg-2)', borderRadius: 12, border: '1px solid var(--line)' }}>
                <BudgetGauge category={b.category} spent={b.spent} limit={b.monthlyLimit} />
                <div style={{ marginTop: 8, display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                  <Button size="sm" variant="ghost" onClick={() => removeBudget(b.category, qc)}>Remove</Button>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      <CreateBudgetModal open={creating} onClose={() => setCreating(false)} />
    </div>
  );
}

function CreateBudgetModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const qc = useQueryClient();
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [limit, setLimit] = useState('');
  const m = useMutation({
    mutationFn: () => api.put(`/budgets/${encodeURIComponent(category)}`, { monthlyLimit: parseFloat(limit) }),
    onSuccess: () => {
      toast.success('Budget saved');
      qc.invalidateQueries({ queryKey: qk.budgets });
      onClose(); setLimit('');
    },
    onError: (err: any) => toast.error('Save failed', err?.message || ''),
  });
  return (
    <Modal open={open} onClose={onClose} title="New monthly budget">
      <form onSubmit={(e) => { e.preventDefault(); m.mutate(); }} className="stack-4">
        <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <span style={{ fontSize: 13, color: 'var(--text-2)', fontWeight: 500 }}>Category</span>
          <select value={category} onChange={(e) => setCategory(e.target.value)} style={{
            background: 'var(--bg-3)', color: 'var(--text-1)', border: '1px solid var(--line)',
            borderRadius: 12, padding: '12px 14px', fontSize: 14, height: 48,
          }}>
            {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </label>
        <Input label="Monthly limit (₹)" inputMode="decimal" required value={limit}
          onChange={(e) => setLimit(e.target.value.replace(/[^\d.]/g, ''))} />
        <Button type="submit" loading={m.isPending} block>Save budget</Button>
      </form>
    </Modal>
  );
}

async function removeBudget(category: string, qc: any) {
  if (!confirm(`Remove the ${category} budget?`)) return;
  try {
    await api.del(`/budgets/${encodeURIComponent(category)}`);
    qc.invalidateQueries({ queryKey: qk.budgets });
  } catch (err) {
    toast.error('Could not remove', err instanceof ApiError ? err.message : '');
  }
}
