import { ButtonHTMLAttributes, forwardRef } from 'react';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'success' | 'outline';
type Size = 'sm' | 'md' | 'lg';

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  block?: boolean;
  iconLeft?: React.ReactNode;
  iconRight?: React.ReactNode;
}

const styles: Record<Variant, React.CSSProperties> = {
  primary:   { background: 'var(--grad-brand)', color: '#fff', boxShadow: 'var(--shadow-3)' },
  secondary: { background: 'var(--bg-2)',       color: 'var(--text-1)', border: '1px solid var(--line-strong)' },
  ghost:     { background: 'transparent',       color: 'var(--text-1)' },
  outline:   { background: 'transparent',       color: 'var(--accent)',  border: '1px solid var(--accent)' },
  danger:    { background: 'var(--danger)',     color: '#fff' },
  success:   { background: 'var(--success)',    color: '#fff' },
};

const sizes: Record<Size, React.CSSProperties> = {
  sm: { height: 36, padding: '0 14px', fontSize: 'var(--fs-sm)', borderRadius: 'var(--r-md)' },
  md: { height: 44, padding: '0 18px', fontSize: 'var(--fs-md)', borderRadius: 'var(--r-md)' },
  lg: { height: 52, padding: '0 22px', fontSize: 'var(--fs-md)', borderRadius: 'var(--r-md)' },
};

export const Button = forwardRef<HTMLButtonElement, Props>(function Button(
  { variant = 'primary', size = 'md', loading, block, disabled, iconLeft, iconRight, children, style, ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      disabled={disabled || loading}
      style={{
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        gap: 8, fontWeight: 600, lineHeight: 1, cursor: 'pointer',
        transition: 'transform var(--t-fast) var(--ease-out), opacity var(--t-fast)',
        border: 'none',
        opacity: loading || disabled ? 0.7 : 1,
        width: block ? '100%' : undefined,
        ...sizes[size],
        ...styles[variant],
        ...style,
      }}
      onMouseDown={(e) => { (e.currentTarget as HTMLButtonElement).style.transform = 'scale(0.97)'; }}
      onMouseUp={(e) => { (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1)'; }}
      onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1)'; }}
      {...rest}
    >
      {loading
        ? <span aria-hidden style={{ width: 16, height: 16, border: '2px solid currentColor', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
        : iconLeft}
      <span>{children}</span>
      {iconRight}
      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </button>
  );
});
