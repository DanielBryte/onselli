import type { HTMLAttributes, ReactNode } from 'react';

export type CardProps = HTMLAttributes<HTMLDivElement> & {
  padding?: 'none' | 'sm' | 'md' | 'lg';
  hoverable?: boolean;
  flat?: boolean;
  children: ReactNode;
};

export default function Card({
  padding = 'md',
  hoverable = false,
  flat = false,
  className = '',
  children,
  ...props
}: CardProps) {
  const paddingClass = padding === 'none' ? 'p-0' : padding === 'sm' ? 'p-3' : padding === 'lg' ? 'ui-card--p6' : '';
  const hoverClass = hoverable ? 'ui-card--hover' : '';
  const flatClass = flat ? 'ui-card--flat' : '';

  return (
    <div className={`ui-card ${paddingClass} ${hoverClass} ${flatClass} ${className}`.trim()} {...props}>
      {children}
    </div>
  );
}

export { Card as Panel };
