import { InputHTMLAttributes, forwardRef, useId, useState } from 'react';

interface Props extends Omit<InputHTMLAttributes<HTMLInputElement>, 'size'> {
  label?: string;
  error?: string;
  hint?: string;
  iconLeft?: React.ReactNode;
  iconRight?: React.ReactNode;
}

export const Input = forwardRef<HTMLInputElement, Props>(function Input(
  { label, error, hint, iconLeft, iconRight, id, className, ...rest },
  ref,
) {
  const auto = useId();
  const inputId = id || auto;
  const describedBy = error ? `${inputId}-err` : hint ? `${inputId}-hint` : undefined;
  const [focused, setFocused] = useState(false);
  return (
    <label htmlFor={inputId} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {label && (
        <span style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-2)', fontWeight: 500 }}>{label}</span>
      )}
      <span style={{
        position: 'relative', display: 'flex', alignItems: 'center',
        background: 'var(--bg-3)',
        border: `1px solid ${error ? 'var(--danger)' : focused ? 'var(--accent)' : 'var(--line)'}`,
        borderRadius: 'var(--r-md)',
        boxShadow: focused && !error ? 'var(--shadow-glow)' : 'none',
        transition: 'border-color var(--t-fast), box-shadow var(--t-fast)',
        height: 48,
      }}>
        {iconLeft && <span style={{ paddingLeft: 14, color: 'var(--text-2)', display: 'inline-flex' }}>{iconLeft}</span>}
        <input
          ref={ref}
          id={inputId}
          aria-invalid={!!error || undefined}
          aria-describedby={describedBy}
          onFocus={(e) => { setFocused(true); rest.onFocus?.(e); }}
          onBlur={(e) => { setFocused(false); rest.onBlur?.(e); }}
          {...rest}
          style={{
            flex: 1, minWidth: 0, height: '100%',
            padding: `0 ${iconRight ? '8px' : '14px'} 0 ${iconLeft ? '10px' : '14px'}`,
            background: 'transparent', border: 'none', outline: 'none',
            color: 'var(--text-1)', fontSize: 'var(--fs-md)',
          }}
        />
        {iconRight && <span style={{ paddingRight: 10, display: 'inline-flex' }}>{iconRight}</span>}
      </span>
      {error
        ? <span id={`${inputId}-err`} style={{ fontSize: 'var(--fs-xs)', color: 'var(--danger)' }}>{error}</span>
        : hint
          ? <span id={`${inputId}-hint`} style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-3)' }}>{hint}</span>
          : null
      }
    </label>
  );
});
