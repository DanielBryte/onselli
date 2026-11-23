'use client';

import * as DialogPrimitive from '@radix-ui/react-dialog';
import type { ComponentProps, FormEventHandler, ReactNode } from 'react';

type DialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  describedBy?: string;
  children: ReactNode;
  className?: string;
  overlayClassName?: string;
  asForm?: boolean;
  onSubmit?: FormEventHandler<HTMLFormElement>;
  onCloseAutoFocus?: ComponentProps<typeof DialogPrimitive.Content>['onCloseAutoFocus'];
};

export default function Dialog({
  open,
  onOpenChange,
  title,
  describedBy,
  children,
  className = '',
  overlayClassName = '',
  asForm = false,
  onSubmit,
  onCloseAutoFocus,
}: DialogProps) {
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className={`ui-dialog__overlay ${overlayClassName}`.trim()} />
        <DialogPrimitive.Content
          className={`ui-dialog__content ${className}`.trim()}
          aria-describedby={describedBy}
          onCloseAutoFocus={onCloseAutoFocus}
          asChild={asForm}
        >
          {asForm ? (
            <form onSubmit={onSubmit}>
              <DialogPrimitive.Title className="sr-only">{title}</DialogPrimitive.Title>
              {children}
            </form>
          ) : (
            <>
              <DialogPrimitive.Title className="sr-only">{title}</DialogPrimitive.Title>
              {children}
            </>
          )}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
