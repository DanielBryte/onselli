import type { ReactNode } from 'react';

/** Shared top bar shell for workspace routes; page breadcrumbs and actions are supplied by each page. */
export function WorkspaceTopbar({ children }: { children: ReactNode }) {
  return <header className="creator-dashboard__topbar">{children}</header>;
}
