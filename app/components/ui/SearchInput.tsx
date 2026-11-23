'use client';

import { forwardRef, type InputHTMLAttributes } from 'react';
import { Search, X } from 'lucide-react';

export type SearchInputProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> & {
  onClear?: () => void;
  sizeVariant?: 'sm' | 'md' | 'lg';
};

const SearchInput = forwardRef<HTMLInputElement, SearchInputProps>(function SearchInput(
  { className = '', value, onClear, onChange, sizeVariant = 'md', disabled, placeholder = 'Search…', ...props },
  ref,
) {
  const hasValue = Boolean(value && String(value).length > 0);

  return (
    <div className={`ui-search-input ui-search-input--${sizeVariant}${disabled ? ' is-disabled' : ''}`}>
      <Search size={15} strokeWidth={1.8} className="ui-search-input__icon" aria-hidden="true" />
      <input
        ref={ref}
        type="search"
        value={value}
        onChange={onChange}
        disabled={disabled}
        placeholder={placeholder}
        className={`ui-input ui-input--${sizeVariant} ${className}`.trim()}
        {...props}
      />
      {hasValue && onClear && (
        <button
          type="button"
          onClick={onClear}
          aria-label="Clear search"
          className="ui-search-input__clear"
          tabIndex={-1}
        >
          <X size={12} strokeWidth={2.2} />
        </button>
      )}
    </div>
  );
});

export default SearchInput;
