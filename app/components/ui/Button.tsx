import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { Loader2 } from 'lucide-react';

export type ButtonVariant = 'primary' | 'secondary' | 'tertiary' | 'ghost' | 'quiet' | 'destructive' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'lg';

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  icon?: ReactNode;
  trailingIcon?: ReactNode;
};

export default function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  icon,
  trailingIcon,
  disabled,
  className = '',
  type = 'button',
  children,
  ...props
}: ButtonProps) {
  // Normalize legacy variant names
  const normalizedVariant =
    variant === 'quiet' || variant === 'ghost' ? 'tertiary' : variant === 'danger' ? 'destructive' : variant;

  return (
    <button
      type={type}
      disabled={disabled || loading}
      className={`ui-button ui-button--${normalizedVariant} ui-button--${size}${className ? ` ${className}` : ''}`.trim()}
      {...props}
    >
      {loading ? (
        <Loader2 size={size === 'sm' ? 14 : size === 'lg' ? 18 : 16} className="ui-button__spinner" aria-hidden="true" />
      ) : (
        icon && <span className="ui-button__icon" aria-hidden="true">{icon}</span>
      )}
      {children && <span className="ui-button__label">{children}</span>}
      {!loading && trailingIcon && <span className="ui-button__trailing-icon" aria-hidden="true">{trailingIcon}</span>}
    </button>
  );
}
