import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Card } from '@/components/primitives/Card';
import { Button } from '@/components/primitives/Button';
import { Input } from '@/components/primitives/Input';
import { Modal } from '@/components/primitives/Modal';
import { EmptyState } from '@/components/primitives/EmptyState';
import { Skeleton } from '@/components/primitives/Skeleton';
import { SavingsRing } from '@/components/charts/SavingsRing';
import { useAuth } from '@/store/auth';
import { api, ApiError, newIdempotencyKey } from '@/lib/api';
import { toast, useUI } from '@/store/ui';
import { qk } from '@/lib/queryClient';
import { formatINR, fmtDate } from '@/lib/format';
import { TargetIcon, PlusIcon } from '@/icons/Icon';

interface Goal {
  _id: string; name: string; icon: string;
  targetAmount: number; currentAmount: number;
  deadline: string | null; status: string; accountId: string;
}

export function Goals() {
  const accounts = useAuth(s => s.accounts);
  const primary = accounts[0];
  const qc = useQueryClient();
  const fireConfetti = useUI(s => s.fireConfetti);
  const [creating, setCreating] = useState(false);
  const [contributing, setContributing] = useState<Goal | null>(null);

  const list = useQuery({
    queryKey: qk.goals,
    queryFn: () => api.get<{ goals: Goal[] }>('/goals'),
  });

  return (
    <div className="stack-5">
      <div className="row-sb">
        <div>
          <h2 className="h2">Savings goals</h2>
          <p className="muted" style={{ marginTop: 4 }}>Set what you’re saving for. Move money in or out anytime.</p>
        </div>
        <Button iconLeft={<PlusIcon size={16} />} onClick={() => setCreating(true)}>New goal</Button>
      </div>

      {list.isLoading ? (
        <div className="grid-2">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} height={160} />)}</div>
      ) : !list.data?.goals?.length ? (
        <Card>
          <EmptyState
            icon={<TargetIcon size={28} />}
            title="No goals yet"
            description="Save for a trip, an emergency fund, or anything you want."
            action={<Button onClick={() => setCreating(true)} iconLeft={<PlusIcon size={16} />}>Create your first goal</Button>}
          />
        </Card>
      ) : (
        <div className="grid-2">
          {list.data.goals.map(g => (
            <Card key={g._id}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                <SavingsRing current={g.currentAmount} target={g.targetAmount} size={92} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: 16, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{g.name}</div>
                  <div style={{ marginTop: 4, fontSize: 13, color: 'var(--text-2)' }}>
                    {formatINR(g.currentAmount)} <span style={{ color: 'var(--text-3)' }}>/ {formatINR(g.targetAmount)}</span>
                  </div>
                  {g.deadline && <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 2 }}>Due {fmtDate(g.deadline)}</div>}
                  <div style={{ marginTop: 12, display: 'flex', gap: 6 }}>
                    <Button size="sm" onClick={() => setContributing(g)}>Add</Button>
                    <Button size="sm" variant="secondary" onClick={() => withdraw(g, qc)}>Withdraw</Button>
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      <CreateGoalModal
        open={creating}
        onClose={() => setCreating(false)}
        accountId={primary?._id}
        onCreated={() => { qc.invalidateQueries({ queryKey: qk.goals }); fireConfetti(); }}
      />
      <ContributeModal
        goal={contributing}
        onClose={() => setContributing(null)}
        onDone={(completed) => {
          qc.invalidateQueries({ queryKey: qk.goals });
          qc.invalidateQueries({ queryKey: qk.accounts });
          if (completed) fireConfetti();
        }}
      />
    </div>
  );
}

function CreateGoalModal({ open, onClose, accountId, onCreated }: { open: boolean; onClose: () => void; accountId?: string; onCreated: () => void }) {
  const [name, setName] = useState('');
  const [target, setTarget] = useState('');
  const [deadline, setDeadline] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!accountId) return;
    setBusy(true);
    try {
      await api.post('/goals', { name, targetAmount: parseFloat(target), accountId, deadline: deadline || undefined });
      toast.success('Goal created');
      onCreated(); onClose();
      setName(''); setTarget(''); setDeadline('');
    } catch (err) {
      toast.error('Could not create goal', err instanceof ApiError ? err.message : '');
    } finally { setBusy(false); }
  }
  return (
    <Modal open={open} onClose={onClose} title="New savings goal">
      <form onSubmit={submit} className="stack-4">
        <Input label="Goal name" required value={name} onChange={(e) => setName(e.target.value)} placeholder="Emergency fund" />
        <Input label="Target amount (₹)" inputMode="decimal" required value={target}
          onChange={(e) => setTarget(e.target.value.replace(/[^\d.]/g, ''))} />
        <Input label="Deadline (optional)" type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} />
        <Button type="submit" loading={busy} block>Create goal</Button>
      </form>
    </Modal>
  );
}

function ContributeModal({ goal, onClose, onDone }: { goal: Goal | null; onClose: () => void; onDone: (completed: boolean) => void }) {
  const [amount, setAmount] = useState('');
  const m = useMutation({
    mutationFn: async () => {
      if (!goal) throw new Error('No goal');
      return api.post<{ goal: Goal }>(`/goals/${goal._id}/contribute`,
        { amount: parseFloat(amount) },
        { idempotencyKey: newIdempotencyKey() });
    },
    onSuccess: (res) => {
      toast.success('Saved');
      onDone(res.goal?.status === 'completed');
      onClose();
      setAmount('');
    },
    onError: (err: any) => toast.error('Failed', err?.message || ''),
  });
  return (
    <Modal open={!!goal} onClose={onClose} title={goal ? `Add to ${goal.name}` : ''}>
      <form onSubmit={(e) => { e.preventDefault(); m.mutate(); }} className="stack-4">
        <Input label="Amount (₹)" inputMode="decimal" required value={amount}
          onChange={(e) => setAmount(e.target.value.replace(/[^\d.]/g, ''))} />
        <Button type="submit" loading={m.isPending} block>Add to goal</Button>
      </form>
    </Modal>
  );
}

async function withdraw(g: Goal, qc: any) {
  const raw = window.prompt(`Withdraw how much from ${g.name}? Available ${formatINR(g.currentAmount)}`);
  if (!raw) return;
  const amount = parseFloat(raw);
  if (!Number.isFinite(amount) || amount <= 0) return;
  try {
    await api.post(`/goals/${g._id}/withdraw`, { amount });
    toast.success('Withdrawn');
    qc.invalidateQueries({ queryKey: qk.goals });
    qc.invalidateQueries({ queryKey: qk.accounts });
  } catch (err) {
    toast.error('Withdrawal failed', err instanceof ApiError ? err.message : '');
  }
}
