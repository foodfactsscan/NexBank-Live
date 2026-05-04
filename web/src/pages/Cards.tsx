import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Card } from '@/components/primitives/Card';
import { Button } from '@/components/primitives/Button';
import { Skeleton } from '@/components/primitives/Skeleton';
import { EmptyState } from '@/components/primitives/EmptyState';
import { api, ApiError, newIdempotencyKey } from '@/lib/api';
import { qk } from '@/lib/queryClient';
import { useAuth } from '@/store/auth';
import { toast } from '@/store/ui';
import { CardIcon, SnowflakeIcon, PlusIcon } from '@/icons/Icon';
import { formatINR } from '@/lib/format';

interface CardRow {
  _id: string; cardNumber: string; cardHolderName: string; cardNetwork: string;
  expiryDate: string; status: string; cardType: string;
  dailyLimit: number; internationalUsage: boolean; contactlessEnabled: boolean;
  accountId: string;
}

export function Cards() {
  const accounts = useAuth(s => s.accounts);
  const primary = accounts[0];
  const qc = useQueryClient();

  const list = useQuery({
    queryKey: qk.cards,
    queryFn: () => api.get<{ cards: CardRow[] }>('/users/cards'),
  });

  async function issue() {
    if (!primary) return;
    try {
      await api.post('/cards/virtual', { accountId: primary._id }, { idempotencyKey: newIdempotencyKey() });
      toast.success('Virtual card issued');
      qc.invalidateQueries({ queryKey: qk.cards });
    } catch (err) {
      toast.error('Could not issue card', err instanceof ApiError ? err.message : '');
    }
  }

  async function freeze(c: CardRow) {
    try {
      await api.patch(`/cards/${c._id}/freeze`, { frozen: c.status !== 'blocked' });
      qc.invalidateQueries({ queryKey: qk.cards });
    } catch (err) {
      toast.error('Could not update card', err instanceof ApiError ? err.message : '');
    }
  }

  return (
    <div className="stack-5">
      <div className="row-sb">
        <div>
          <h2 className="h2">Cards</h2>
          <p className="muted" style={{ marginTop: 4 }}>Issue virtual cards, freeze instantly, change limits anytime.</p>
        </div>
        <Button onClick={issue} iconLeft={<PlusIcon size={16} />}>New virtual card</Button>
      </div>

      {list.isLoading ? (
        <div className="grid-2">{Array.from({ length: 2 }).map((_, i) => <Skeleton key={i} height={220} rounded={20} />)}</div>
      ) : !list.data?.cards?.length ? (
        <Card><EmptyState icon={<CardIcon />} title="No cards yet" description="Issue your first virtual debit card."
          action={<Button onClick={issue} iconLeft={<PlusIcon size={16} />}>Issue a virtual card</Button>}
        /></Card>
      ) : (
        <div className="grid-2">
          {list.data.cards.map(c => (
            <div key={c._id} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <CardArt card={c} />
              <Card style={{ padding: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontSize: 12, color: 'var(--text-3)' }}>Daily limit</div>
                    <div style={{ fontWeight: 700 }}>{formatINR(c.dailyLimit)}</div>
                  </div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <Button size="sm" variant={c.status === 'blocked' ? 'success' : 'secondary'} iconLeft={<SnowflakeIcon size={14} />} onClick={() => freeze(c)}>
                      {c.status === 'blocked' ? 'Unfreeze' : 'Freeze'}
                    </Button>
                  </div>
                </div>
              </Card>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function CardArt({ card }: { card: CardRow }) {
  const last4 = card.cardNumber.slice(-4);
  const frozen = card.status === 'blocked';
  return (
    <div style={{
      position: 'relative', height: 200, borderRadius: 'var(--r-xl)', padding: 22, color: '#fff',
      background: frozen
        ? 'linear-gradient(135deg, #475569 0%, #1E293B 100%)'
        : 'linear-gradient(135deg, #1E1B4B 0%, #312E81 40%, #06B6D4 110%)',
      boxShadow: 'var(--shadow-2)', overflow: 'hidden',
      border: '1px solid var(--line)',
    }}>
      <div style={{ position: 'absolute', inset: 0, opacity: 0.45,
        background: 'radial-gradient(at 20% 0%, rgba(255,255,255,0.18), transparent 40%), radial-gradient(at 90% 100%, rgba(0,0,0,0.4), transparent 50%)',
        pointerEvents: 'none' }} />
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', position: 'relative' }}>
        <div style={{ fontSize: 12, opacity: 0.85, fontWeight: 600 }}>{card.cardType.toUpperCase()}</div>
        <div style={{ fontSize: 14, fontWeight: 800, letterSpacing: '0.04em' }}>{card.cardNetwork.toUpperCase()}</div>
      </div>
      <div style={{ marginTop: 56, fontSize: 20, fontFamily: 'var(--font-mono)', letterSpacing: '0.18em', position: 'relative' }}>
        •••• •••• •••• {last4}
      </div>
      <div style={{ marginTop: 12, display: 'flex', justifyContent: 'space-between', fontSize: 11, position: 'relative' }}>
        <div>
          <div style={{ opacity: 0.7 }}>HOLDER</div>
          <div style={{ fontWeight: 600 }}>{card.cardHolderName}</div>
        </div>
        <div>
          <div style={{ opacity: 0.7 }}>EXP</div>
          <div style={{ fontWeight: 600 }}>{card.expiryDate}</div>
        </div>
      </div>
      {frozen && (
        <div style={{
          position: 'absolute', inset: 0, display: 'grid', placeItems: 'center',
          background: 'rgba(10,14,26,0.55)', backdropFilter: 'blur(2px)',
        }}>
          <span className="chip" style={{ fontWeight: 700 }}>FROZEN</span>
        </div>
      )}
    </div>
  );
}
