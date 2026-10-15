'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useRouter } from 'next/navigation';
import { BarChart3, LayoutDashboard, LogOut, Package, ShoppingBag, Users, Wallet, ArrowUpRight } from 'lucide-react';
import { getSupabase } from '@/lib/supabase';

const items = [
  { href: '/creator', label: 'Overview', icon: LayoutDashboard, exact: true },
  { href: '/creator/products/new', label: 'Products', icon: Package },
  { href: '/creator/orders', label: 'Sales', icon: ShoppingBag },
  { href: '/creator/contacts', label: 'Contacts', icon: Users },
  { href: '/creator/analytics', label: 'Analytics', icon: BarChart3 },
  { href: '/creator/payouts', label: 'Payouts', icon: Wallet },
];

export default function CreatorNav() {
  const pathname = usePathname();
  const router = useRouter();
  async function signOut() {
    const supabase = getSupabase();
    if (supabase) await supabase.auth.signOut();
    router.replace('/');
  }
  return <nav className="creator-workspace__nav" aria-label="Creator workspace">
    <Link href="/creator" className="creator-nav-brand" aria-label="Onselli creator studio">
      <img src="/logo.png" alt="Onselli" />
      <span><strong>Creator studio</strong><small>Your business, in one place</small></span>
    </Link>
    <span className="creator-nav-label">WORKSPACE</span>
    <div className="creator-nav-links">{items.map(({ href, label, icon: Icon, exact }) => {
      const active = exact ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);
      return <Link key={href} href={href} className={active ? 'active' : undefined} aria-current={active ? 'page' : undefined}>
        <Icon size={17} strokeWidth={1.8} aria-hidden="true"/><span>{label}</span>{active && <ArrowUpRight className="creator-nav-active-mark" size={14} aria-hidden="true"/>}
      </Link>;
    })}</div>
    <div className="creator-nav-bottom"><span className="creator-nav-avatar">O</span><span><strong>Onselli</strong><small>Creator account</small></span><Link href="/creator/payouts" aria-label="Payment settings"><Wallet size={16}/></Link></div>
    <button className="creator-nav-signout" onClick={() => void signOut()}><LogOut size={16}/><span>Sign out</span></button>
  </nav>;
}
