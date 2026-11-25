'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { ChevronDown, Library, LogIn, LogOut, UserRound } from 'lucide-react';
import { authClient } from '@/src/server/auth/client';
import DropdownMenu from '@/app/components/ui/DropdownMenu';

type Props = { isLoggedIn?: boolean; nextPath?: string; userLabel?: string | null };

export default function BuyerAccountMenu({ isLoggedIn: initialLoggedIn, nextPath = '/dashboard/learning', userLabel }: Props) {
  const [isLoggedIn, setIsLoggedIn] = useState(initialLoggedIn);
  const [resolvedUserLabel, setResolvedUserLabel] = useState(userLabel);
  const [signingOut, setSigningOut] = useState(false);
  const [signOutError, setSignOutError] = useState('');

  useEffect(() => {
    if (initialLoggedIn !== undefined) return;
    let active = true;
    void authClient.getSession().then(({ data }) => {
      if (!active) return;
      setIsLoggedIn(Boolean(data?.user));
      setResolvedUserLabel(data?.user?.name || data?.user?.email || userLabel);
    }).catch(() => { if (active) setIsLoggedIn(false); });
    return () => { active = false; };
  }, [initialLoggedIn]);

  if (!isLoggedIn) {
    return <Link href={`/login?next=${encodeURIComponent(nextPath)}`} className="inline-flex h-10 items-center justify-center gap-2 whitespace-nowrap rounded-full border border-border px-4 text-[13px] font-semibold text-ink transition-colors hover:bg-surface focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand max-[480px]:h-9 max-[480px]:px-3">
      <LogIn size={16} aria-hidden="true"/><span>Log in</span>
    </Link>;
  }

  return <DropdownMenu
    label="Open your buyer account menu"
    className="buyer-account-menu"
    contentClassName="buyer-account-menu__content"
    trigger={<span className="inline-flex h-10 items-center justify-center gap-2 whitespace-nowrap rounded-full border border-border px-4 text-[13px] font-semibold text-ink transition-colors hover:bg-surface max-[480px]:h-9 max-[480px]:px-3"><UserRound size={16} aria-hidden="true"/><span className="max-[400px]:hidden">{resolvedUserLabel?.trim() || 'My account'}</span><span className="min-[401px]:hidden">Account</span><ChevronDown size={14} aria-hidden="true"/></span>}
  >
    <div className="buyer-account-menu__identity px-[10px] py-2" role="presentation">
      <span className="block text-[10px] font-bold tracking-[.08em] text-muted">YOUR ACCOUNT</span>
      <span className="mt-1 block max-w-[220px] overflow-hidden text-ellipsis whitespace-nowrap text-[13px] font-semibold text-ink">{resolvedUserLabel?.trim() || 'Onselli buyer'}</span>
    </div>
    <button role="menuitem" type="button" onClick={() => window.location.assign('/dashboard/learning')}><Library size={16} aria-hidden="true"/>My learning library</button>
    <button role="menuitem" type="button" onClick={() => window.location.assign('/purchase/access')}><UserRound size={16} aria-hidden="true"/>Recover a purchase</button>
    {signOutError && <p className="m-0 px-[10px] py-1 text-xs text-danger" role="alert">{signOutError}</p>}
    <button role="menuitem" type="button" disabled={signingOut} onClick={async () => { setSigningOut(true); setSignOutError(''); try { await authClient.signOut(); window.location.assign('/'); } catch { setSignOutError('Could not sign out. Please try again.'); } finally { setSigningOut(false); } }}><LogOut size={16} aria-hidden="true"/>{signingOut ? 'Signing out…' : 'Sign out'}</button>
  </DropdownMenu>;
}
