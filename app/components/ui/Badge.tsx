import type { HTMLAttributes, ReactNode } from 'react';

export type BadgeVariant =
  | 'draft'
  | 'published'
  | 'archived'
  | 'active'
  | 'failed'
  | 'danger'
  | 'warning'
  | 'success'
  | 'neutral';

export type BadgeProps = HTMLAttributes<HTMLSpanElement> & {
  variant?: BadgeVariant;
  size?: 'sm' | 'md';
  dot?: boolean;
  icon?: ReactNode;
};

export default function Badge({
  variant = 'neutral',
  size = 'md',
  dot = false,
  icon,
  className = '',
  children,
  ...props
}: BadgeProps) {
  return (
    <span
      className={`ui-badge ui-badge--${variant} ui-badge--${size}${dot ? ' ui-badge--dot' : ''}${className ? ` ${className}` : ''}`.trim()}
      {...props}
    >
      {icon && <span className="ui-badge__icon" aria-hidden="true">{icon}</span>}
      {children}
    </span>
  );
}

export { Badge as StatusPill };
