'use client';

import { type ReactNode, useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Bell, Check, ChevronDown, ChevronRight, LogOut, Plus, Rocket, PanelLeftClose, PanelLeftOpen, Menu, X, Wallet, CircleDollarSign, LayoutDashboard } from 'lucide-react';
import { authClient } from '@/src/server/auth/client';
import { useCreatorWorkspaceIdentity } from './CreatorWorkspaceIdentity';
import PricingModal from './PricingModal';
import { WorkspaceAvatar } from '@/app/components/WorkspaceAvatar';

const primaryItems = [
  { href: '/workspace', label: 'Overview', icon: <LayoutDashboard className="creator-nav-icon creator-nav-icon--overview" size={18} strokeWidth={1.9}/>, exact: true },
  { href: '/workspace/notifications', label: 'Notifications', icon: <Bell size={18} strokeWidth={1.9}/> },
  { href: '/workspace/orders', label: 'Sales', icon: <CircleDollarSign size={18} strokeWidth={1.9}/> },
  { href: '/workspace/products', label: 'Products', icon: '/icons/products.svg' },
  { href: '/workspace/analytics', label: 'Analytics', icon: '/icons/analytics.svg' },
];

export default function CreatorNav() {
  const { workspaceSlug, workspaceLogoUrl, activeWorkspaceId, workspaces, planId, billingEnabled } = useCreatorWorkspaceIdentity();
  const pathname = usePathname();
  const router = useRouter();
  const [marketingOpen, setMarketingOpen] = useState(pathname.startsWith('/workspace/forms') || pathname.startsWith('/workspace/campaigns') || pathname.startsWith('/workspace/automations'));
  const [contactsOpen, setContactsOpen] = useState(pathname.startsWith('/workspace/contacts'));
  const [collapsed, setCollapsed] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [pricingOpen, setPricingOpen] = useState(false);
  const [workspaceError, setWorkspaceError] = useState('');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const drawerRef = useRef<HTMLElement>(null);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const openPricing = useCallback(() => { setDrawerOpen(false); setPricingOpen(true); }, []);
  useEffect(() => {
    window.addEventListener('onselli:open-pricing', openPricing);
    return () => window.removeEventListener('onselli:open-pricing', openPricing);
  }, [openPricing]);
  useEffect(() => setDrawerOpen(false), [pathname]);
  useEffect(() => {
    const desktopQuery = window.matchMedia('(min-width: 1024px)');
    const closeOnDesktop = (event: MediaQueryListEvent) => { if (event.matches) setDrawerOpen(false); };
    desktopQuery.addEventListener('change', closeOnDesktop);
    return () => desktopQuery.removeEventListener('change', closeOnDesktop);
  }, []);
  useEffect(() => {
    if (!drawerOpen) return;
    const body = document.body;
    const scrollY = window.scrollY;
    const previousStyles = { overflow: body.style.overflow, position: body.style.position, top: body.style.top, left: body.style.left, right: body.style.right, width: body.style.width };
    body.style.overflow = 'hidden';
    body.style.position = 'fixed';
    body.style.top = `-${scrollY}px`;
    body.style.left = '0';
    body.style.right = '0';
    body.style.width = '100%';
    const drawer = drawerRef.current;
    const closeButton = drawer?.querySelector<HTMLButtonElement>('.creator-nav-drawer-close');
    closeButton?.focus();
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') { event.preventDefault(); setDrawerOpen(false); return; }
      if (event.key !== 'Tab' || !drawer) return;
      const focusable = Array.from(drawer.querySelectorAll<HTMLElement>('a[href],button:not(:disabled),select:not(:disabled),[tabindex]:not([tabindex="-1"])'));
      if (!focusable.length) { event.preventDefault(); return; }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (!first || !last) { event.preventDefault(); return; }
      if (event.shiftKey && (document.activeElement === first || !drawer.contains(document.activeElement))) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && (document.activeElement === last || !drawer.contains(document.activeElement))) { event.preventDefault(); first.focus(); }
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      body.style.overflow = previousStyles.overflow;
      body.style.position = previousStyles.position;
      body.style.top = previousStyles.top;
      body.style.left = previousStyles.left;
      body.style.right = previousStyles.right;
      body.style.width = previousStyles.width;
      window.scrollTo(0, scrollY);
      menuButtonRef.current?.focus();
    };
  }, [drawerOpen]);
  async function signOut() {
    await authClient.signOut();
    router.replace('/');
  }
  async function switchWorkspace(workspaceId: string) {
    if (workspaceId === activeWorkspaceId) { setProfileOpen(false); return; }
    setWorkspaceError('');
    const response = await fetch('/api/workspace/workspaces', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ workspaceId }) });
    if (!response.ok) { setWorkspaceError('Could not switch workspaces. Try again.'); return; }
    window.location.assign('/workspace');
  }
  function createWorkspace() {
    setProfileOpen(false);
    setDrawerOpen(false);
    router.push('/workspace/workspaces');
  }
  const isActive = (href: string, exact = false) => exact ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);
  const renderLink = ({ href, label, icon, exact }: { href: string; label: string; icon?: string | ReactNode; exact?: boolean }) => {
    const active = isActive(href, exact);
    return <Link key={href} href={href} className={active ? 'active' : undefined} aria-current={active ? 'page' : undefined} title={collapsed ? label : undefined}>
      {typeof icon === 'string' ? <img className="creator-nav-icon" src={icon} alt="" aria-hidden="true"/> : icon}<span>{label}</span>
    </Link>;
  };
  return <>
  <header className="creator-mobile-topbar">
    <button ref={menuButtonRef} type="button" className="creator-mobile-menu" aria-label={drawerOpen ? 'Close workspace navigation' : 'Open workspace navigation'} aria-expanded={drawerOpen} aria-controls="creator-workspace-navigation" onClick={() => setDrawerOpen((open) => !open)}><Menu size={21}/></button>
    <Link href="/workspace" className="creator-mobile-brand" aria-label="Onselli workspace"><img src="/logo.png" alt=""/><strong>Onselli</strong></Link>
    <Link href="/workspace/notifications" className="creator-mobile-notifications" aria-label="Notifications"><Bell size={22} strokeWidth={1.8}/></Link>
  </header>
  {drawerOpen && <button type="button" className="creator-nav-backdrop" aria-label="Close workspace navigation" onClick={() => setDrawerOpen(false)}/>}
  <nav ref={drawerRef} id="creator-workspace-navigation" className={`creator-workspace__nav${collapsed ? ' is-collapsed' : ''}${drawerOpen ? ' is-drawer-open' : ''}`} aria-label="Creator workspace" role={drawerOpen ? 'dialog' : 'navigation'} aria-modal={drawerOpen ? true : undefined}>
    <div className="creator-nav-brand-row">
      <Link href="/workspace" className="creator-nav-brand" aria-label="Onselli home">
        <img src="/logo.png" alt="" />
        <strong>Onselli</strong>
      </Link>
      <button type="button" className="creator-nav-collapse" onClick={() => setCollapsed(!collapsed)} aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'} title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}>
        {collapsed ? <PanelLeftOpen size={19}/> : <PanelLeftClose size={19}/>}
      </button>
      <button type="button" className="creator-nav-drawer-close" aria-label="Close workspace navigation" onClick={() => setDrawerOpen(false)}><X size={20}/></button>
    </div>
    <div className="creator-nav-profile-wrap"><button type="button" className="creator-nav-profile" title={workspaceSlug || 'Creator workspace'} aria-expanded={profileOpen} onClick={() => { setWorkspaceError(''); setProfileOpen(!profileOpen); }}><WorkspaceAvatar src={workspaceLogoUrl} fallbackSeed={activeWorkspaceId || workspaceSlug || 'onselli'} className="creator-nav-profile-avatar"/><strong>{workspaceSlug || 'Creator workspace'}</strong><ChevronRight size={20}/></button>{profileOpen && <div className="creator-nav-profile-menu">
      {workspaces.length > 1 && <div className="creator-nav-workspaces"><span>YOUR WORKSPACES</span>{workspaces.map((workspace) => <button type="button" key={workspace.id} className={workspace.id === activeWorkspaceId ? 'is-current' : ''} onClick={() => void switchWorkspace(workspace.id)}><WorkspaceAvatar src={workspace.logoUrl} fallbackSeed={workspace.id} className="creator-nav-workspace-mark"/><span>{workspace.slug}</span>{workspace.id === activeWorkspaceId && <Check size={14}/>}</button>)}</div>}
      <button type="button" onClick={createWorkspace}><Plus size={16}/>Add new workspace</button>
      {workspaceError && <p role="alert">{workspaceError}</p>}
      <button type="button" onClick={() => void signOut()}><LogOut size={16}/>Sign out</button>
    </div>}</div>
    <div className="creator-nav-links">
      {primaryItems.map(renderLink)}
      {renderLink({ href: '/workspace/earnings', label: 'Wallet & Payouts', icon: <Wallet size={18} strokeWidth={1.9}/> })}
      <button type="button" className={`creator-nav-group-trigger${pathname.startsWith('/workspace/contacts') ? ' active' : ''}`} onClick={() => setContactsOpen(!contactsOpen)} aria-expanded={contactsOpen}>
        <img className="creator-nav-icon" src="/icons/contacts.svg" alt="" aria-hidden="true"/><span>Contacts</span><ChevronDown className="creator-nav-chevron" size={18}/>
      </button>
      {contactsOpen && <div className="creator-nav-subitems">{renderLink({ href: '/workspace/contacts', label: 'All contacts' })}</div>}
      <button type="button" className={`creator-nav-group-trigger${pathname.startsWith('/workspace/forms') || pathname.startsWith('/workspace/campaigns') || pathname.startsWith('/workspace/automations') ? ' active' : ''}`} onClick={() => setMarketingOpen(!marketingOpen)} aria-expanded={marketingOpen}>
        <img className="creator-nav-icon" src="/icons/marketing.svg" alt="" aria-hidden="true"/><span>Marketing</span><ChevronDown className="creator-nav-chevron" size={18}/>
      </button>
      {marketingOpen && <div className="creator-nav-subitems"><Link href="/workspace/campaigns" onClick={(event) => { if (billingEnabled && planId === 'free') { event.preventDefault(); openPricing(); } }}><span>Email campaigns</span>{billingEnabled && planId === 'free' && <span className="creator-nav-pro-badge">PRO</span>}</Link>{renderLink({ href: '/workspace/forms', label: 'Forms & leads' })}<span className="creator-nav-coming-soon" aria-label="Automation, coming soon"><span>Automation</span><small>Coming soon</small></span></div>}
      {renderLink({ href: '/workspace/media', label: 'Media Library', icon: '/icons/media-library.svg' })}
      {renderLink({ href: '/workspace/website', label: 'Website & Storefront', icon: '/icons/website.svg' })}
    </div>
    <div className="creator-nav-footer-links">
      <a href="mailto:support@onselli.com?subject=Onselli%20support" title={collapsed ? 'Support' : undefined}><img className="creator-nav-icon" src="/icons/support.svg" alt="" aria-hidden="true"/><span>Support</span></a>
      <Link href="/workspace/settings/profile" className={isActive('/workspace/settings') ? 'active' : undefined} title={collapsed ? 'Settings' : undefined}><img className="creator-nav-icon" src="/icons/settings.svg" alt="" aria-hidden="true"/><span>Settings</span></Link>
    </div>
    <PricingModal open={pricingOpen} onOpen={openPricing} onClose={() => setPricingOpen(false)} currentPlan={planId} billingEnabled={billingEnabled} trigger={<button type="button" className="creator-nav-pro" title={collapsed ? 'Grow your business with Pro' : undefined} aria-label="Grow your business with Pro"><Rocket size={18}/><span>Grow your business with Pro.</span></button>}/>
  </nav></>;
}
