import type { InputHTMLAttributes, ReactNode } from 'react';

type ChoiceCardProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> & {
  type?: 'radio' | 'checkbox';
  label: string;
  description?: string;
  icon?: ReactNode;
};

export default function ChoiceCard({ type = 'radio', label, description, icon, className = '', ...inputProps }: ChoiceCardProps) {
  return (
    <label className={`ui-choice-card ${className}`.trim()}>
      <input type={type} {...inputProps} />
      {icon}
      <span className="ui-choice-card__copy">
        <strong>{label}</strong>
        {description && <small>{description}</small>}
      </span>
    </label>
  );
}
