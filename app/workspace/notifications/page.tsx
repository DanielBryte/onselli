import Link from 'next/link';
import { desc, eq } from 'drizzle-orm';
import { ArrowRight, Bell, CircleDollarSign, Wallet } from 'lucide-react';
import CreatorNav from '../CreatorNav';
import { requireCreator } from '@/src/server/auth/permissions';
import { getDatabase } from '@/src/server/db';
import { orders, payouts } from '@/src/server/db/schema';

type ActivityItem = { id: string; kind: 'order' | 'payout'; title: string; detail: string; date: Date; href: string };
const statusCopy: Record<string, string> = {
  paid: 'Payment confirmed', refunded: 'Refund issued', failed: 'Payment failed', expired: 'Checkout expired', cancelled: 'Cancelled', pending: 'Payment pending', needs_review: 'Needs review',
  requested: 'Requested', approved: 'Approved', processing: 'Processing', completed: 'Paid', rejected: 'Declined',
};

function amount(minor: bigint, currency: string) {
  try { return new Intl.NumberFormat('en-NG', { style: 'currency', currency, maximumFractionDigits: 2 }).format(Number(minor) / 100); }
  catch { return `${currency} ${(Number(minor) / 100).toLocaleString('en-NG')}`; }
}

export default async function WorkspaceNotificationsPage() {
  const { creator } = await requireCreator();
  const db = getDatabase();
  const [recentOrders, recentPayouts] = await Promise.all([
    db.select({ id: orders.id, number: orders.number, status: orders.status, totalMinor: orders.totalMinor, currency: orders.currency, date: orders.updatedAt })
      .from(orders).where(eq(orders.creatorId, creator.id)).orderBy(desc(orders.updatedAt)).limit(15),
    db.select({ id: payouts.id, status: payouts.status, amountMinor: payouts.amountMinor, currency: payouts.currency, date: payouts.updatedAt })
      .from(payouts).where(eq(payouts.creatorId, creator.id)).orderBy(desc(payouts.updatedAt)).limit(15),
  ]);

  const activity: ActivityItem[] = [
    ...recentOrders.map((order): ActivityItem => ({ id: order.id, kind: 'order', title: `Order #${order.number}`, detail: `${statusCopy[order.status] ?? order.status}${order.status === 'paid' ? ` · ${amount(order.totalMinor, order.currency)}` : ''}`, date: order.date, href: '/workspace/orders' })),
    ...recentPayouts.map((payout): ActivityItem => ({ id: payout.id, kind: 'payout', title: 'Payout update', detail: `${statusCopy[payout.status] ?? payout.status} · ${amount(payout.amountMinor, payout.currency)}`, date: payout.date, href: '/workspace/earnings' })),
  ].sort((a, b) => b.date.getTime() - a.date.getTime()).slice(0, 30);

  function formatDate(date: Date) {
    try { return new Intl.DateTimeFormat('en-NG', { dateStyle: 'medium', timeStyle: 'short', timeZone: creator.timezone }).format(date); }
    catch { return new Intl.DateTimeFormat('en-NG', { dateStyle: 'medium', timeStyle: 'short' }).format(date); }
  }

  return <main className="creator-dashboard"><CreatorNav/><div className="creator-dashboard__main">
    <header className="creator-dashboard__topbar"><div className="creator-breadcrumb"><Link href="/workspace">Workspace</Link><span>/</span><strong>Notifications</strong></div></header>
    <div className="creator-dashboard__body studio-overview notifications-page">
      <header className="workspace-page-heading"><h1>Notifications</h1><p>Recent updates about orders and payouts.</p></header>
      <section className="notifications-panel" aria-labelledby="notifications-activity-title">
        <header className="notifications-panel__heading"><h2 id="notifications-activity-title">Recent activity</h2></header>
        {activity.length ? <div className="notifications-list">{activity.map(item => <article className="notifications-item" key={`${item.kind}-${item.id}`}>
          <span className="notifications-item__icon">{item.kind === 'order' ? <CircleDollarSign size={18}/> : <Wallet size={18}/>}</span>
          <div className="notifications-item__copy"><strong>{item.title}</strong><span>{item.detail}</span><time dateTime={item.date.toISOString()}>{formatDate(item.date)}</time></div>
          <Link href={item.href} className="notifications-item__link">View<ArrowRight size={14}/></Link>
        </article>)}</div> : <div className="notifications-empty"><span><Bell size={20}/></span><strong>No activity yet</strong><p>Sales and payout updates will appear here.</p></div>}
      </section>
    </div>
  </div></main>;
}
