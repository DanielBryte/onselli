'use client';

import { useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';

type DropdownMenuProps = {
  label: string;
  trigger: ReactNode;
  children: ReactNode;
  className?: string;
  contentClassName?: string;
};

export default function DropdownMenu({ label, trigger, children, className = '', contentClassName = '' }: DropdownMenuProps) {
  const [open, setOpen] = useState(false);
  const [openAbove, setOpenAbove] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    if (!open) return;

    const positionMenu = () => {
      const trigger = triggerRef.current;
      const content = contentRef.current;
      if (!trigger || !content) return;

      const triggerRect = trigger.getBoundingClientRect();
      const menuHeight = content.getBoundingClientRect().height;
      let clipTop = 0;
      let clipBottom = window.innerHeight;
      let ancestor = rootRef.current?.parentElement ?? null;

      while (ancestor && ancestor !== document.body) {
        const { overflowX, overflowY } = window.getComputedStyle(ancestor);
        if (/(auto|scroll|hidden|clip)/.test(`${overflowX} ${overflowY}`)) {
          const bounds = ancestor.getBoundingClientRect();
          clipTop = Math.max(clipTop, bounds.top);
          clipBottom = Math.min(clipBottom, bounds.bottom);
        }
        ancestor = ancestor.parentElement;
      }

      const spaceBelow = clipBottom - triggerRect.bottom - 6;
      const spaceAbove = triggerRect.top - clipTop - 6;
      setOpenAbove(spaceBelow < menuHeight && spaceAbove > spaceBelow);
    };

    positionMenu();
    window.addEventListener('resize', positionMenu);
    window.addEventListener('scroll', positionMenu, true);
    return () => {
      window.removeEventListener('resize', positionMenu);
      window.removeEventListener('scroll', positionMenu, true);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const closeOnOutsidePointer = (event: PointerEvent) => {
      if (event.target instanceof Node && !rootRef.current?.contains(event.target)) setOpen(false);
    };
    const closeOnEscape = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        setOpen(false);
        triggerRef.current?.focus();
      }
    };
    document.addEventListener('pointerdown', closeOnOutsidePointer);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('pointerdown', closeOnOutsidePointer);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [open]);

  const focusItem = (direction: 'first' | 'last') => {
    requestAnimationFrame(() => {
      const items = rootRef.current?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]:not(:disabled)');
      (direction === 'last' ? items?.[items.length - 1] : items?.[0])?.focus();
    });
  };

  const handleMenuKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const items = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>('[role="menuitem"]:not(:disabled)'));
    const index = items.indexOf(document.activeElement as HTMLButtonElement);
    let nextIndex: number | undefined;
    if (event.key === 'ArrowDown') nextIndex = (index + 1) % items.length;
    if (event.key === 'ArrowUp') nextIndex = (index - 1 + items.length) % items.length;
    if (event.key === 'Home') nextIndex = 0;
    if (event.key === 'End') nextIndex = items.length - 1;
    if (nextIndex !== undefined && items.length) {
      event.preventDefault();
      items[nextIndex]?.focus();
    }
    if (event.key === 'Tab') setOpen(false);
  };

  return (
    <div ref={rootRef} className={`ui-dropdown-menu ${className}`.trim()}>
      <button
        ref={triggerRef}
        type="button"
        className="ui-dropdown-menu__trigger"
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
        onKeyDown={(event) => {
          if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
            event.preventDefault();
            setOpen(true);
            focusItem(event.key === 'ArrowUp' ? 'last' : 'first');
          }
        }}
      >
        {trigger}
      </button>
      <div
        ref={contentRef}
        className={`ui-dropdown-menu__content${openAbove ? ' ui-dropdown-menu__content--above' : ''} ${contentClassName}`.trim()}
        role="menu"
        hidden={!open}
        onKeyDown={handleMenuKeyDown}
        onClickCapture={(event) => {
          if ((event.target as HTMLElement).closest('[role="menuitem"]')) setOpen(false);
        }}
      >
        {children}
      </div>
    </div>
  );
}
