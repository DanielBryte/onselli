'use client';

import { createContext, useContext } from 'react';
import type { ReactNode } from 'react';

type CreatorWorkspaceIdentity = {
  workspaceName: string;
  workspaceSlug: string;
  workspaceLogoUrl: string | null;
  firstName: string;
  activeWorkspaceId: string;
  workspaces: { id: string; displayName: string; slug: string; logoUrl: string | null }[];
  workspaceCount: number;
  planId: 'free' | 'pro' | 'studio';
  billingEnabled: boolean;
};

const CreatorWorkspaceIdentityContext = createContext<CreatorWorkspaceIdentity>({
  workspaceName: '',
  workspaceSlug: '',
  workspaceLogoUrl: null,
  firstName: '',
  activeWorkspaceId: '',
  workspaces: [],
  workspaceCount: 0,
  planId: 'free',
  billingEnabled: false,
});

export function CreatorWorkspaceIdentityProvider({
  value,
  children,
}: {
  value: CreatorWorkspaceIdentity;
  children: ReactNode;
}) {
  return <CreatorWorkspaceIdentityContext.Provider value={value}>{children}</CreatorWorkspaceIdentityContext.Provider>;
}

export function useCreatorWorkspaceIdentity() {
  return useContext(CreatorWorkspaceIdentityContext);
}
