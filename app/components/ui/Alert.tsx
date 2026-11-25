import type { HTMLAttributes, ReactNode } from 'react';
import { AlertCircle, CheckCircle2, Info, TriangleAlert } from 'lucide-react';

export type AlertVariant = 'info' | 'success' | 'warning' | 'danger';

type AlertProps = HTMLAttributes<HTMLDivElement> & {
  variant?: AlertVariant;
  icon?: ReactNode;
  title?: string;
  children: ReactNode;
};

const defaultIcons = {
  info: Info,
  success: CheckCircle2,
  warning: TriangleAlert,
  danger: AlertCircle,
} satisfies Record<AlertVariant, typeof Info>;

export default function Alert({
  variant = 'info',
  icon,
  title,
  children,
  className = '',
  role,
  ...props
}: AlertProps) {
  const Icon = defaultIcons[variant];

  return (
    <div
      className={`ui-alert ui-alert--${variant}${className ? ` ${className}` : ''}`}
      role={role ?? (variant === 'danger' ? 'alert' : 'status')}
      {...props}
    >
      <span className="ui-alert__icon" aria-hidden="true">{icon ?? <Icon size={16} />}</span>
      <div className="ui-alert__content">
        {title && <strong className="mb-1 block font-semibold">{title}</strong>}
        {children}
      </div>
    </div>
  );
}
