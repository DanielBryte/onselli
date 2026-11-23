'use client';

import { Children, isValidElement, useEffect, useRef, type ReactNode } from 'react';
import * as Select from '@radix-ui/react-select';
import { Check, ChevronDown, ChevronUp } from 'lucide-react';

type OptionProps = { value?: string | number; disabled?: boolean; children?: ReactNode };
type SelectChange = { target: { value: string } };

type WorkspaceSelectProps = {
  value?: string | number;
  defaultValue?: string | number;
  onChange?: (event: SelectChange) => void;
  children: ReactNode;
  id?: string;
  name?: string;
  className?: string;
  menuClassName?: string;
  hideCheckmark?: boolean;
  disabled?: boolean;
  required?: boolean;
  autoFocus?: boolean;
  'aria-label'?: string;
  'aria-labelledby'?: string;
  'aria-describedby'?: string;
  'aria-invalid'?: boolean | 'true' | 'false';
};

export default function WorkspaceSelect({
  value,
  defaultValue,
  onChange,
  children,
  id,
  name,
  className = '',
  menuClassName = '',
  hideCheckmark = true,
  disabled,
  required,
  autoFocus,
  ...ariaProps
}: WorkspaceSelectProps) {
  const triggerRef = useRef<HTMLButtonElement>(null);
  const options = Children.toArray(children).flatMap((child) => {
    if (!isValidElement<OptionProps>(child) || child.type !== 'option') return [];
    return [{
      value: String(child.props.value ?? ''),
      disabled: child.props.disabled,
      label: child.props.children,
      key: child.key ?? String(child.props.value ?? ''),
    }];
  }).filter((option) => {
    // Sales and revenue are product metrics, not meaningful media metadata.
    // Keep the media route focused without changing the shared product select.
    const isMediaLibrary = typeof window !== 'undefined' && window.location.pathname.endsWith('/media');
    return !(isMediaLibrary && (option.value === 'sales' || option.value === 'revenue'));
  });
  const placeholder = options.find((option) => option.value === '')?.label;

  useEffect(() => {
    if (autoFocus) triggerRef.current?.focus();
  }, [autoFocus]);

  return (
    <Select.Root
      value={value === undefined ? undefined : String(value)}
      defaultValue={defaultValue === undefined ? undefined : String(defaultValue)}
      disabled={disabled}
      name={name}
      required={required}
      onValueChange={(nextValue) => onChange?.({ target: { value: nextValue } })}
    >
      <Select.Trigger
        ref={triggerRef}
        id={id}
        className={`workspace-select__trigger ${className}`.trim()}
        aria-required={required || undefined}
        {...ariaProps}
      >
        <Select.Value placeholder={placeholder} />
        <Select.Icon className="workspace-select__chevron" aria-hidden="true">
          <ChevronDown size={17} strokeWidth={1.8} />
        </Select.Icon>
      </Select.Trigger>
      <Select.Portal>
        <Select.Content className={`workspace-select__content ${menuClassName}`.trim()} position="popper" sideOffset={6}>
          <Select.ScrollUpButton className="workspace-select__scroll-button" aria-hidden="true">
            <ChevronUp size={15} />
          </Select.ScrollUpButton>
          <Select.Viewport className="workspace-select__viewport">
            {options.filter((option) => option.value !== '').map((option) => (
              <Select.Item
                key={option.key}
                className="workspace-select__item"
                value={option.value}
                disabled={option.disabled}
              >
                <Select.ItemText>{option.label}</Select.ItemText>
                {!hideCheckmark && <Select.ItemIndicator className="workspace-select__item-indicator">
                  <Check size={15} strokeWidth={2.2} />
                </Select.ItemIndicator>}
              </Select.Item>
            ))}
          </Select.Viewport>
          <Select.ScrollDownButton className="workspace-select__scroll-button" aria-hidden="true">
            <ChevronDown size={15} />
          </Select.ScrollDownButton>
        </Select.Content>
      </Select.Portal>
    </Select.Root>
  );
}
