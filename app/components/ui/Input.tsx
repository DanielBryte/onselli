import { forwardRef, type InputHTMLAttributes, type ReactNode } from 'react';

export type InputProps = InputHTMLAttributes<HTMLInputElement> & {
  error?: boolean | string;
  icon?: ReactNode;
  trailingIcon?: ReactNode;
  sizeVariant?: 'sm' | 'md' | 'lg';
};

const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { className = '', error, icon, trailingIcon, sizeVariant = 'md', disabled, id, ...props },
  ref,
) {
  const isInvalid = Boolean(error);

  if (icon || trailingIcon) {
    return (
      <div className={`ui-input-wrapper${disabled ? ' is-disabled' : ''}${isInvalid ? ' has-error' : ''}`}>
        {icon && <span className="ui-input__icon-left" aria-hidden="true">{icon}</span>}
        <input
          ref={ref}
          id={id}
          disabled={disabled}
          aria-invalid={isInvalid}
          className={`ui-input ui-input--${sizeVariant}${isInvalid ? ' ui-input--error' : ''} ${className}`.trim()}
          {...props}
        />
        {trailingIcon && <span className="ui-input__icon-right" aria-hidden="true">{trailingIcon}</span>}
      </div>
    );
  }

  return (
    <input
      ref={ref}
      id={id}
      disabled={disabled}
      aria-invalid={isInvalid}
      className={`ui-input ui-input--${sizeVariant}${isInvalid ? ' ui-input--error' : ''} ${className}`.trim()}
      {...props}
    />
  );
});

export default Input;
