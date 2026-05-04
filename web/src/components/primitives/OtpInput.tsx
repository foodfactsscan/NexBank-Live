import { useEffect, useRef } from 'react';

interface Props {
  length?: number;
  value: string;
  onChange: (v: string) => void;
  autoFocus?: boolean;
}

export function OtpInput({ length = 6, value, onChange, autoFocus }: Props) {
  const refs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    if (autoFocus) refs.current[0]?.focus();
  }, [autoFocus]);

  function setDigit(i: number, ch: string) {
    const digits = value.split('');
    digits[i] = ch;
    const next = digits.join('').slice(0, length);
    onChange(next);
  }

  return (
    <div role="group" aria-label="One-time code" style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
      {Array.from({ length }).map((_, i) => (
        <input
          key={i}
          ref={(el) => { refs.current[i] = el; }}
          type="text"
          inputMode="numeric"
          autoComplete="one-time-code"
          aria-label={`Digit ${i + 1}`}
          value={value[i] || ''}
          maxLength={1}
          onChange={(e) => {
            const ch = e.target.value.replace(/\D/g, '').slice(-1);
            if (!ch) return;
            setDigit(i, ch);
            if (i < length - 1) refs.current[i + 1]?.focus();
          }}
          onKeyDown={(e) => {
            if (e.key === 'Backspace' && !value[i] && i > 0) {
              refs.current[i - 1]?.focus();
              setDigit(i - 1, '');
            } else if (e.key === 'ArrowLeft' && i > 0) {
              refs.current[i - 1]?.focus();
            } else if (e.key === 'ArrowRight' && i < length - 1) {
              refs.current[i + 1]?.focus();
            }
          }}
          onPaste={(e) => {
            const text = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, length);
            if (text.length) {
              e.preventDefault();
              onChange(text.padEnd(length, ' ').slice(0, length).replace(/\s/g, ''));
              refs.current[Math.min(text.length, length - 1)]?.focus();
            }
          }}
          style={{
            width: 44, height: 52, textAlign: 'center',
            fontSize: 22, fontWeight: 700, letterSpacing: '-0.02em',
            background: 'var(--bg-3)', border: '1px solid var(--line)',
            borderRadius: 'var(--r-md)', color: 'var(--text-1)',
            outline: 'none',
          }}
        />
      ))}
    </div>
  );
}
