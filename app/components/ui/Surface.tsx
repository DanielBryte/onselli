import { createElement, type HTMLAttributes, type ReactNode } from 'react';

type SurfaceProps = HTMLAttributes<HTMLElement> & {
  as?: 'article' | 'div' | 'section';
  children: ReactNode;
};

export default function Surface({ as = 'div', className = '', children, ...props }: SurfaceProps) {
  return createElement(as, { ...props, className: `ui-surface${className ? ` ${className}` : ''}` }, children);
}
