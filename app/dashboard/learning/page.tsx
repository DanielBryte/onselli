'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { ArrowRight, BookOpen, CircleAlert, Library, RefreshCw } from 'lucide-react';
import DownloadButton from '../../learn/DownloadButton';
import BuyerAccountMenu from '@/app/components/BuyerAccountMenu';

type LearningItem = {
  id: string;
  title: string;
  kind: string;
  content_body: string;
  description?: string;
  courseProgress?: { totalLessons: number; completedLessons: number; percent: number; resumeLessonId: string | null; resumePositionSeconds: number } | null;
  deliveryMode?: 'uploaded_files' | 'external_link' | null;
  externalUrl?: string | null;
  files?: { id: string; file_name: string; size_bytes: number | string }[];
  creator: { display_name: string; slug: string } | null;
  order: { id: string; amount: number | string; currency: string } | null;
};

export default function LearningLibraryPage() {
  const [items, setItems] = useState<LearningItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [needsPurchaseVerification, setNeedsPurchaseVerification] = useState(false);

  const loadLibrary = useCallback(async () => {
    setLoading(true);
    setError('');
    setNeedsPurchaseVerification(false);
    try {
      const response = await fetch('/api/learning', { cache: 'no-store' });
      const payload = await response.json();
      if (!response.ok) {
        setNeedsPurchaseVerification(response.status === 401);
        setError(response.status === 401 ? 'Sign in or verify the email you used at checkout to open your purchases.' : 'We couldn’t load your library right now. Please try again.');
        return;
      }
      setItems(Array.isArray(payload.items) ? payload.items : []);
    } catch {
      setError('We couldn’t connect to your library. Check your connection and try again.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void loadLibrary(); }, [loadLibrary]);

  return (
    <main className="min-h-screen bg-canvas text-ink">
      <header className="sticky top-0 z-40 border-b border-border-subtle bg-white/95 backdrop-blur">
        <div className="mx-auto flex h-[68px] max-w-[1180px] items-center justify-between gap-4 px-6 max-[600px]:h-[60px] max-[600px]:px-4">
          <Link href="/" className="inline-flex items-center gap-2.5 text-ink no-underline" aria-label="Onselli home">
            <img src="/logo.png" alt="" className="size-9 rounded-[10px] object-cover" />
            <span className="text-base font-bold tracking-[-.03em]">Onselli</span>
          </Link>
          <nav className="flex items-center gap-3 max-[600px]:gap-2" aria-label="Buyer navigation">
            <Link href="/purchase/access" className="hidden text-[13px] font-semibold text-ink-secondary no-underline hover:text-brand-strong min-[601px]:inline">Find a purchase</Link>
            <BuyerAccountMenu />
          </nav>
        </div>
      </header>

      <div className="mx-auto w-full max-w-[1180px] px-6 pb-20 pt-14 max-[760px]:px-5 max-[600px]:px-4 max-[600px]:pt-9">
        <div className="mb-9 max-w-[760px]">
          <span className="section-kicker">YOUR LEARNING LIBRARY</span>
          <h1 className="mb-0 mt-3 text-[clamp(34px,5vw,54px)] font-bold leading-[1.04] tracking-[-.055em] text-ink">Your purchases, all in one place.</h1>
          <p className="mb-0 mt-4 max-w-[640px] text-base leading-[1.65] text-muted max-[600px]:text-sm">Open courses and downloads you’ve purchased from creators, and pick up where you left off.</p>
        </div>

        {loading ? (
          <section className="rounded-2xl border border-border bg-white p-8 text-sm text-muted max-[600px]:p-5" aria-live="polite">Loading your library…</section>
        ) : error ? (
          <section className="rounded-2xl border border-border bg-white p-7 max-[600px]:p-5" role="alert">
            <div className="flex items-start gap-3">
              <CircleAlert className="mt-0.5 shrink-0 text-brand-strong" size={20} aria-hidden="true" />
              <div>
                <h2 className="m-0 text-lg font-semibold text-ink">Your library isn’t available yet</h2>
                <p className="mb-0 mt-2 max-w-[620px] text-sm leading-relaxed text-muted">{error}</p>
              </div>
            </div>
            <div className="mt-6 flex flex-wrap items-center gap-3">
              <button type="button" onClick={() => void loadLibrary()} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-brand-strong px-5 text-[13px] font-semibold text-white transition-colors hover:bg-display-strong focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"><RefreshCw size={15} aria-hidden="true"/>Try again</button>
              <Link href="/purchase/access" className="inline-flex min-h-11 items-center justify-center rounded-full border border-border px-5 text-[13px] font-semibold text-ink no-underline hover:bg-surface">Recover purchase access</Link>
              {needsPurchaseVerification && <Link href={`/login?next=${encodeURIComponent('/dashboard/learning')}`} className="text-[13px] font-semibold text-brand-strong underline underline-offset-4">Sign in</Link>}
            </div>
          </section>
        ) : items.length ? (
          <section aria-label="Your purchases" className="grid gap-4">
            {items.map((item) => (
              <article key={item.id} className="grid grid-cols-[1fr_auto] gap-5 rounded-2xl border border-border bg-white p-6 max-[600px]:grid-cols-1 max-[600px]:gap-3 max-[600px]:p-5">
                <div className="min-w-0">
                  <span className="text-[10px] font-bold uppercase tracking-[.09em] text-brand-strong">{item.kind === 'course' ? 'COURSE' : 'DIGITAL DOWNLOAD'}</span>
                  <h2 className="mb-0 mt-2 text-xl font-semibold tracking-[-.025em] text-ink">{item.title}</h2>
                  <p className="mb-0 mt-1 text-sm text-muted">By {item.creator?.display_name ?? 'Creator'}</p>
                  {item.kind.toLowerCase() === 'download' && (item.deliveryMode === 'external_link' ? item.externalUrl ? <div className="mt-4"><a className="inline-flex min-h-11 items-center gap-2 rounded-full bg-brand-strong px-5 text-[13px] font-semibold text-white no-underline hover:bg-display-strong" href={item.externalUrl} target="_blank" rel="noopener noreferrer">Open your download <ArrowRight size={15}/></a><p className="mb-0 mt-2 max-w-[680px] text-xs leading-relaxed text-muted">This opens an external site. The creator cannot revoke access already granted there, and that site may have its own access rules.</p></div> : <p className="mb-0 mt-3 text-sm text-muted">Your external download link is unavailable. Contact the creator for help.</p> : item.files?.length ? <div className="mt-4 flex flex-wrap gap-2">{item.files.map(file => <DownloadButton key={file.id} fileId={file.id} fileName={file.file_name}/>)}</div> : <p className="mb-0 mt-3 text-sm text-muted">Your download is not available yet. Contact the creator for help.</p>)}
                  {item.kind.toLowerCase() === 'course' && <><p className="mb-2 mt-4 text-sm text-muted">{item.courseProgress?.completedLessons ?? 0} of {item.courseProgress?.totalLessons ?? 0} lessons complete</p><div className="h-2 w-full max-w-[420px] overflow-hidden rounded-full bg-border-subtle" role="progressbar" aria-label={`${item.courseProgress?.percent ?? 0}% of course complete`} aria-valuenow={item.courseProgress?.percent ?? 0} aria-valuemin={0} aria-valuemax={100}><span className="block h-full rounded-full bg-brand" style={{ width: `${item.courseProgress?.percent ?? 0}%` }}/></div><Link href={`/dashboard/learning/courses/${encodeURIComponent(item.id)}`} className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-full bg-brand-strong px-5 text-[13px] font-semibold text-white no-underline hover:bg-display-strong">{item.courseProgress?.completedLessons ? 'Continue course' : 'Start course'} <ArrowRight size={15}/></Link></>}
                  {item.order && <a href={`mailto:hello@onselli.com?subject=${encodeURIComponent(`Purchase support ${item.order.id}`)}&body=${encodeURIComponent(`Please help me with purchase ${item.order.id} for ${item.title}. I would like to ask about access or request a refund.`)}`} className="mt-4 inline-block text-[13px] font-semibold text-brand-strong underline underline-offset-4">Get purchase support or request a refund</a>}
                </div>
                <span className="grid size-11 place-items-center rounded-full bg-brand-tint text-brand-strong max-[600px]:hidden"><BookOpen size={20} aria-hidden="true"/></span>
              </article>
            ))}
          </section>
        ) : (
          <section className="flex min-h-[280px] flex-col items-center justify-center rounded-2xl border border-dashed border-border-hover bg-white px-6 py-12 text-center max-[600px]:min-h-[240px]">
            <span className="grid size-12 place-items-center rounded-full bg-brand-tint text-brand-strong"><Library size={22} aria-hidden="true"/></span>
            <h2 className="mb-0 mt-4 text-xl font-semibold tracking-[-.025em] text-ink">Your library is ready when you are</h2>
            <p className="mb-0 mt-2 max-w-[430px] text-sm leading-relaxed text-muted">When you purchase a course or download through a creator’s storefront, it will show up here.</p>
            <Link href="/purchase/access" className="mt-5 inline-flex min-h-11 items-center justify-center rounded-full border border-border px-5 text-[13px] font-semibold text-ink no-underline hover:bg-surface">Find a purchase</Link>
          </section>
        )}
      </div>
    </main>
  );
}
