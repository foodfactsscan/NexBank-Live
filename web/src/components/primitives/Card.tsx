import { HTMLAttributes } from 'react';

type Variant = 'solid' | 'glass' | 'gradient';

interface Props extends HTMLAttributes<HTMLDivElement> {
  variant?: Variant;
  padding?: number | string;
}

export function Card({ variant = 'solid', padding, style, className, ...rest }: Props) {
  const cls = variant === 'glass' ? 'card-glass' : variant === 'gradient' ? 'card-gradient' : 'card';
  const composed = className ? `${cls} ${className}` : cls;
  return <div className={composed} style={{ padding, ...style }} {...rest} />;
}
