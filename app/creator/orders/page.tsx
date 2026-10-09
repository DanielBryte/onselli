'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { ArrowLeft, Mail, RotateCcw } from 'lucide-react';
import { getSupabase } from '@/lib/supabase';

type Order = { id: string; buyer_email: string; status: string; amount: number; platform_fee_amount: number; currency: string; created_at: string; paid_at: string | null; creator_products: { title: string } | null };

export default function CreatorOrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [refundBusy, setRefundBusy] = useState('');
  const [notice, setNotice] = useState('');
  useEffect(() => { let active = true; void (async () => {
    const supabase = getSupabase(); if (!supabase) { setError('Supabase is not configured.'); setLoading(false); return; }
    const { data: auth } = await supabase.auth.getUser(); if (!auth.user) { window.location.assign('/login'); return; }
    const { data: creator, error: creatorError } = await supabase.from('creators').select('id').eq('user_id', auth.user.id).maybeSingle();
    if (creatorError || !creator) { setError(creatorError?.message || 'Creator profile not found.'); setLoading(false); return; }
    const { data, error: ordersError } = await supabase.from('creator_orders').select('id,buyer_email,status,amount,platform_fee_amount,currency,created_at,paid_at,creator_products(title)').eq('creator_id', creator.id).order('created_at', { ascending: false });
    if (!active) return; if (ordersError) setError(ordersError.message); else setOrders((data ?? []) as unknown as Order[]); setLoading(false);
  })(); return () => { active = false; }; }, []);
  async function requestRefund(orderId: string, alreadyPending = false) {
    const supabase = getSupabase();
    if (!supabase || (!alreadyPending && !window.confirm('Request a full refund? The connected creator balance is debited the full customer payment. Onselli’s platform fee and Bachs processing fee are not returned.'))) return;
    setRefundBusy(orderId); setNotice('');
    const { data: auth } = await supabase.auth.getSession();
    const response = await fetch(`/api/creator/orders/${orderId}/refund`, { method: 'POST', headers: { Authorization: `Bearer ${auth.session?.access_token ?? ''}` } });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) setNotice(payload.error || 'Could not start the refund.');
    else { setNotice(payload.message || 'Refund request accepted.'); setOrders(current => current.map(order => order.id === orderId ? { ...order, status: 'REFUND_PENDING' } : order)); }
    setRefundBusy('');
  }
  return <main className="page-shell"><div className="page-content"><Link href="/creator" className="text-link" style={{ color: '#52645a' }}><ArrowLeft size={14}/> Back to studio</Link><div style={{ marginTop: 30 }}><span className="section-kicker">Creator workspace</span><h1 className="page-title">Your sales.</h1><p className="page-subtitle">Payment status is confirmed by provider webhooks. Contact buyers if they need help with access.</p></div>{notice && <p className="notice" style={{ marginTop: 18 }}>{notice}</p>}{loading ? <p>Loading sales…</p> : error ? <p className="form-error">{error}</p> : orders.length ? <div className="product-list" style={{ marginTop: 28 }}>{orders.map(order => { const creatorShare = Number(order.amount) - Number(order.platform_fee_amount); return <article className="product-row" key={order.id}><div style={{ minWidth: 0 }}><h2 style={{ margin: 0, fontSize: 14 }}>{order.creator_products?.title ?? 'Creator offer'}</h2><p>{order.buyer_email} · {new Date(order.created_at).toLocaleDateString()}</p><p style={{ color: '#233b2e', fontWeight: 800 }}>Sale {order.currency.trim()} {Number(order.amount).toLocaleString()} · Onselli fee {Number(order.platform_fee_amount).toLocaleString()}</p><p style={{ marginTop: 4, color: '#52645a', fontSize: 10 }}>Your share before Bachs processing fee: {order.currency.trim()} {creatorShare.toLocaleString()} <span className={`status-pill ${order.status === 'PAID' ? 'status-pill--published' : ''}`}>{order.status.toLowerCase()}</span></p></div><div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}><a className="button button--outline" style={{ color: '#014733', borderColor: '#cbd8cf' }} href={`mailto:${encodeURIComponent(order.buyer_email)}?subject=${encodeURIComponent(`Onselli purchase ${order.id}`)}`}><Mail size={14}/> Contact buyer</a>{['PAID','REFUND_PENDING'].includes(order.status) && <button className="button button--outline" disabled={refundBusy === order.id} onClick={() => void requestRefund(order.id, order.status === 'REFUND_PENDING')}><RotateCcw size={14}/>{refundBusy === order.id ? 'Requesting…' : order.status === 'REFUND_PENDING' ? 'Check refund' : 'Full refund'}</button>}</div></article>; })}</div> : <div className="empty-state" style={{ marginTop: 26 }}><h2>Your sales will appear here.</h2><p>When a buyer completes checkout, the confirmed order is added to your sales view.</p></div>}<p className="notice" style={{ marginTop: 20 }}>A refund is processed by Bachs asynchronously. On a connected direct charge, it debits the creator’s Bachs balance for the full customer payment; the Onselli platform fee and Bachs processing fee are not returned. A request may be refused if the balance cannot fund it. After Bachs confirms the refund, access to the purchase is revoked.</p></div></main>;
}
