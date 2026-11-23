import Link from 'next/link';
import { CreditCard, PlugZap, UserRound } from 'lucide-react';
import type { ReactNode } from 'react';
import CreatorNav from '../CreatorNav';

export default function SettingsLayout({ section, children }: { section: 'profile' | 'payouts' | 'integrations'; children: ReactNode }) {
  const currentLabel = section === 'profile' ? 'Profile' : section === 'payouts' ? 'Payout methods' : 'Integrations';
  return <main className="creator-dashboard"><CreatorNav/><div className="creator-dashboard__main">
    <header className="creator-dashboard__topbar"><div className="creator-breadcrumb"><Link href="/workspace">Workspace</Link><span>/</span><Link href="/workspace/settings/profile">Settings</Link><span>/</span><strong>{currentLabel}</strong></div></header>
    <div className="creator-dashboard__body studio-overview settings-page">
      <h1 className="sr-only">{currentLabel}</h1>
      <div className="settings-layout">
        <aside className="settings-sidebar" aria-label="Settings sections">
          <span>SETTINGS</span>
          <Link className={section === 'profile' ? 'is-active' : ''} href="/workspace/settings/profile" aria-current={section === 'profile' ? 'page' : undefined}><UserRound size={16}/> Profile</Link>
          <Link className={section === 'payouts' ? 'is-active' : ''} href="/workspace/settings/payouts" aria-current={section === 'payouts' ? 'page' : undefined}><CreditCard size={16}/> Payout methods</Link>
          <Link className={section === 'integrations' ? 'is-active' : ''} href="/workspace/settings/integrations" aria-current={section === 'integrations' ? 'page' : undefined}><PlugZap size={16}/> Integrations</Link>
        </aside>
        <div className="settings-content">{children}</div>
      </div>
    </div>
  </div></main>;
}
