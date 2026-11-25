'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useCallback, useMemo, useState } from 'react';
import {
  ArrowRight,
  BookOpen,
  Download,
  Globe,
  Layers,
  MessageCircle,
  Package,
  Search,
  ShoppingBag,
  Sparkles,
  X,
} from 'lucide-react';
import { currencyMinorToDecimal } from '@/lib/money.mjs';
import { CartTrigger, PublicCartProvider } from '@/app/components/PublicCart';
import PublicCurrencySelect from '@/app/components/PublicCurrencySelect';

type Creator = {
  slug: string;
  name: string;
  headline: string | null;
  bio: string | null;
  avatarUrl: string | null;
  whatsappE164: string | null;
  socialLinks: Record<string, string>;
  storefrontTitle: string;
};

type Product = {
  id: string;
  slug: string;
  title: string;
  type: string;
  description: string;
  coverUrl: string | null;
  priceMinor: string;
  currency: string;
};

type Props = {
  creator: Creator;
  products: Product[];
  initialEmail?: string;
  initialCurrency?: 'NGN' | 'USD';
  isLoggedIn?: boolean;
};

const labelForType = (type: string) => {
  const map: Record<string, string> = {
    course: 'Course',
    download: 'Digital download',
    bundle: 'Bundle',
    payment_link: 'Payment link',
    physical: 'Physical product',
    merchandise: 'Merchandise',
    store: 'Physical product',
  };
  return map[type] || type.replaceAll('_', ' ');
};

const iconForType = (type: string) => {
  if (type === 'course') return <BookOpen size={18} aria-hidden="true" />;
  if (type === 'download') return <Download size={18} aria-hidden="true" />;
  if (type === 'bundle') return <Layers size={18} aria-hidden="true" />;
  if (type === 'physical' || type === 'merchandise' || type === 'store') {
    return <ShoppingBag size={18} aria-hidden="true" />;
  }
  return <Package size={18} aria-hidden="true" />;
};

const formatMoney = (minor: string, currency: string) =>
  new Intl.NumberFormat(currency === 'USD' ? 'en-US' : 'en-NG', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(Number(currencyMinorToDecimal(BigInt(minor), currency)));

export default function BuyerStorefront({
  creator,
  products,
  initialEmail = '',
  initialCurrency = 'NGN',
  isLoggedIn = false,
}: Props) {
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [currency, setCurrency] = useState<'NGN' | 'USD'>(initialCurrency);
  const [query, setQuery] = useState('');

  // Handle client-side currency switch with URL sync
  const handleCurrencyChange = useCallback((nextCurrency: 'NGN' | 'USD') => {
    setCurrency(nextCurrency);
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      url.searchParams.set('currency', nextCurrency);
      window.history.replaceState(null, '', url);
    }
  }, []);

  // Filter products by currency first
  const currencyProducts = useMemo(() => {
    return products.filter((product) => product.currency === currency);
  }, [products, currency]);

  // Compute available category tabs based on products in this currency
  const categoryTabs = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const p of currencyProducts) {
      counts[p.type] = (counts[p.type] || 0) + 1;
    }

    const tabs: { id: string; label: string; count: number }[] = [
      { id: 'all', label: 'All products', count: currencyProducts.length },
    ];

    if (counts.course) {
      tabs.push({ id: 'course', label: 'Courses', count: counts.course });
    }
    if (counts.download) {
      tabs.push({ id: 'download', label: 'Digital downloads', count: counts.download });
    }
    if (counts.bundle) {
      tabs.push({ id: 'bundle', label: 'Bundles', count: counts.bundle });
    }
    const storeCount = (counts.physical || 0) + (counts.merchandise || 0) + (counts.store || 0);
    if (storeCount) {
      tabs.push({ id: 'store', label: 'Store', count: storeCount });
    }
    if (counts.payment_link) {
      tabs.push({ id: 'payment_link', label: 'Payment links', count: counts.payment_link });
    }

    return tabs;
  }, [currencyProducts]);

  // Filter products by selected category and search query
  const visibleProducts = useMemo(() => {
    return currencyProducts.filter((product) => {
      // 1. Category filter
      if (selectedCategory !== 'all') {
        if (selectedCategory === 'store') {
          const isStore =
            product.type === 'physical' ||
            product.type === 'merchandise' ||
            product.type === 'store';
          if (!isStore) return false;
        } else if (product.type !== selectedCategory) {
          return false;
        }
      }

      // 2. Search query filter
      if (query.trim()) {
        const hay = `${product.title} ${product.description} ${labelForType(product.type)}`.toLowerCase();
        if (!hay.includes(query.trim().toLowerCase())) return false;
      }

      return true;
    });
  }, [currencyProducts, selectedCategory, query]);

  const socialLinks = Object.entries(creator.socialLinks).filter(
    ([, url]) => typeof url === 'string' && url.trim().length > 0,
  );

  const aboutText = creator.bio || creator.headline;

  return (
    <PublicCartProvider creatorSlug={creator.slug} initialEmail={initialEmail}>
      <main className="flex min-h-screen flex-col bg-white font-sans text-ink">
        {/* ─── Top navigation header (exact match to product overview header) ─── */}
        <header className="sticky top-0 z-50 border-b border-border-subtle bg-white/[.98] backdrop-blur-xl">
          <div className="mx-auto flex h-[66px] max-w-[1140px] items-center justify-between gap-[18px] px-6 max-[760px]:h-[60px] max-[760px]:gap-3 max-[760px]:px-4">
            <Link
              href={`/c/${creator.slug}`}
              className="inline-flex min-w-0 items-center gap-[10px] transition-opacity hover:opacity-85"
              aria-label={`${creator.name} storefront`}
            >
              {creator.avatarUrl ? (
                <Image
                  src={creator.avatarUrl}
                  alt=""
                  width={36}
                  height={36}
                  className="size-9 shrink-0 rounded-full border border-border-subtle object-cover"
                  unoptimized
                  priority
                />
              ) : (
                <span className="grid size-9 shrink-0 place-items-center rounded-full border border-border bg-brand-tint text-sm font-bold text-display-strong" aria-hidden="true">
                  {creator.name.trim().slice(0, 1).toUpperCase()}
                </span>
              )}
              <strong className="overflow-hidden text-ellipsis whitespace-nowrap text-[15px] font-semibold tracking-[-.015em] text-ink max-[760px]:max-w-[120px] max-[760px]:text-sm">{creator.name}</strong>
            </Link>

            <div className="flex shrink-0 items-center gap-[10px]">
              <PublicCurrencySelect
                creatorSlug={creator.slug}
                currency={currency}
                onChange={handleCurrencyChange}
              />
              <CartTrigger />
              <Link
                href={
                  isLoggedIn
                    ? '/dashboard/learning'
                    : `/login?next=${encodeURIComponent(`/c/${creator.slug}`)}`
                }
                className="inline-flex h-9 min-h-9 items-center justify-center whitespace-nowrap rounded-[9px] border border-border bg-white px-[14px] text-[13px] font-semibold text-ink transition-all hover:border-brand-strong hover:bg-surface hover:text-display-strong max-[760px]:px-[10px] max-[760px]:text-xs"
              >
                {isLoggedIn ? 'My account' : 'Log in'}
              </Link>
            </div>
          </div>
        </header>

        {/* ─── Main store container ─── */}
        <div className="mx-auto flex w-full max-w-[1140px] flex-1 flex-col px-6 pt-11 pb-10 max-[760px]:px-4 max-[760px]:pt-7 max-[760px]:pb-8">
          {/* ─── Creator profile & about section (above products) ─── */}
          <section className="flex items-start gap-7 border-b border-border-subtle pb-9 max-[760px]:gap-[18px] max-[760px]:pb-6" aria-labelledby="creator-display-name">
            <div className="shrink-0">
              {creator.avatarUrl ? (
                <Image
                  src={creator.avatarUrl}
                  alt={`${creator.name} profile`}
                  width={80}
                  height={80}
                  className="size-[76px] rounded-full border-[1.5px] border-border-subtle object-cover shadow-[0_4px_16px_rgba(10,34,23,.04)] max-[760px]:size-[60px]"
                  unoptimized
                  priority
                />
              ) : (
                <span className="grid size-[76px] place-items-center rounded-full border-[1.5px] border-border bg-brand-tint text-[28px] font-extrabold text-display-strong max-[760px]:size-[60px]" aria-hidden="true">
                  {creator.name.trim().slice(0, 1).toUpperCase()}
                </span>
              )}
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex flex-col gap-1">
                <h1 id="creator-display-name" className="m-0 text-[clamp(26px,3.5vw,34px)] font-bold leading-[1.15] tracking-[-.035em] text-ink max-[760px]:text-2xl">
                  {creator.name}
                </h1>
                <div className="flex items-center gap-[10px]">
                  <span className="m-0 text-sm font-medium text-muted">@{creator.slug}</span>
                  <span className="inline-flex items-center gap-[5px] rounded-full bg-brand-tint px-2 py-[3px] text-[11px] font-semibold tracking-[.01em] text-display-strong">
                    <Sparkles size={11} aria-hidden="true" />
                    <span>Verified Creator</span>
                  </span>
                </div>
              </div>

              {aboutText && <p className="mt-3 mb-0 max-w-[620px] whitespace-pre-line text-sm leading-[1.65] text-muted">{aboutText}</p>}

              {(creator.whatsappE164 || socialLinks.length > 0) && (
                <div className="mt-4 flex flex-wrap gap-2">
                  {creator.whatsappE164 && (
                    <a
                      href={`https://wa.me/${creator.whatsappE164.replace('+', '')}`}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-[7px] rounded-full border border-border bg-white px-[14px] py-1.5 text-xs font-semibold text-ink transition-all hover:border-brand-strong hover:bg-surface-hover hover:text-display-strong"
                    >
                      <MessageCircle size={14} aria-hidden="true" />
                      <span>Contact creator</span>
                    </a>
                  )}
                  {socialLinks.map(([name, url]) => (
                    <a
                      href={url}
                      target="_blank"
                      rel="noreferrer"
                      key={name}
                      className="inline-flex items-center gap-[7px] rounded-full border border-border bg-white px-[14px] py-1.5 text-xs font-semibold text-ink transition-all hover:border-brand-strong hover:bg-surface-hover hover:text-display-strong"
                    >
                      <Globe size={14} aria-hidden="true" />
                      <span>{name}</span>
                    </a>
                  ))}
                </div>
              )}
            </div>
          </section>

          {/* ─── Products catalog area ─── */}
          <section className="mt-8" aria-label="Creator Catalog">
            {/* Catalog Toolbar: category tabs + search bar */}
            <div className="mb-6 flex flex-wrap items-center justify-between gap-4 max-[760px]:flex-col max-[760px]:items-stretch max-[760px]:gap-3">
              {categoryTabs.length > 2 ? (
                <div className="flex flex-wrap items-center gap-1.5" role="tablist" aria-label="Filter products">
                  {categoryTabs.map(({ id, label, count }) => {
                    const isActive = selectedCategory === id;
                    return (
                      <button
                        key={id}
                        type="button"
                        role="tab"
                        aria-selected={isActive}
                        className={`inline-flex min-h-9 items-center gap-1.5 rounded-full border px-[14px] text-[13px] font-semibold transition-all ${isActive ? 'border-display bg-display text-white' : 'border-border bg-white text-muted hover:border-border-hover hover:bg-canvas hover:text-ink'}`}
                        onClick={() => setSelectedCategory(id)}
                      >
                        <span>{label}</span>
                        <small className={`inline-flex h-[17px] min-w-[17px] items-center justify-center rounded-full px-1 text-[10px] font-bold ${isActive ? 'bg-white/20 text-white' : 'bg-black/[.06] text-inherit'}`}>{count}</small>
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div className="flex items-center">
                  <h2 className="m-0 text-xl font-bold tracking-[-.025em] text-ink">Products</h2>
                </div>
              )}

              {currencyProducts.length > 0 && (
                <label className="relative inline-flex min-w-[220px] items-center max-[760px]:w-full max-[760px]:min-w-0">
                  <Search size={16} aria-hidden="true" className="pointer-events-none absolute left-3 text-muted" />
                  <span className="sr-only">Search products</span>
                  <input
                    type="search"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Search products..."
                    className="h-9 w-full rounded-full border border-border bg-white pl-9 pr-8 text-[13px] text-ink outline-none transition-all placeholder:text-muted focus:border-brand focus:ring-2 focus:ring-brand/15"
                  />
                  {query && (
                    <button
                      type="button"
                      className="absolute right-[10px] grid size-[18px] place-items-center rounded-full bg-surface-subtle p-0 text-muted hover:bg-surface-hover"
                      onClick={() => setQuery('')}
                      aria-label="Clear search query"
                    >
                      <X size={13} />
                    </button>
                  )}
                </label>
              )}
            </div>

            {/* Products Grid */}
            {visibleProducts.length > 0 ? (
              <div className="grid grid-cols-[repeat(auto-fill,minmax(290px,1fr))] gap-[22px] max-[760px]:grid-cols-1 max-[760px]:gap-4">
                {visibleProducts.map((product) => {
                  const isFree = BigInt(product.priceMinor) === 0n;
                  const priceLabel = isFree ? 'Free' : formatMoney(product.priceMinor, product.currency);

                  return (
                    <Link
                      href={`/c/${creator.slug}/${product.slug}`}
                      className="group flex flex-col overflow-hidden rounded-2xl border border-[#e7ede8] bg-white text-inherit no-underline transition-[transform,box-shadow,border-color] duration-200 ease-[cubic-bezier(.16,1,.3,1)] hover:-translate-y-[3px] hover:border-[#c4d7cb] hover:shadow-[0_16px_36px_rgba(10,34,23,.08)]"
                      key={product.id}
                    >
                      {/* Thumbnail container */}
                      <div className="relative aspect-[16/10] w-full overflow-hidden bg-[#f4f6f4]">
                        {product.coverUrl ? (
                          <Image
                            src={product.coverUrl}
                            alt=""
                            fill
                            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                            className="object-cover transition-transform duration-[350ms] group-hover:scale-[1.025]"
                            unoptimized
                          />
                        ) : (
                          <div className="flex size-full flex-col items-center justify-center gap-2 bg-[radial-gradient(ellipse_at_80%_20%,#eaf5ed,#f3f6f3)] p-4 text-center text-muted">
                            <div className="grid size-[38px] place-items-center rounded-[10px] bg-white text-display-strong shadow-[0_4px_12px_rgba(10,34,23,.05)]">
                              {iconForType(product.type)}
                            </div>
                            <span>{product.title}</span>
                          </div>
                        )}
                        <span className="absolute top-[10px] left-[10px] rounded-md border border-white/85 bg-white/95 px-[9px] py-1 text-[10px] font-extrabold uppercase tracking-[.06em] text-ink shadow-[0_2px_8px_rgba(0,0,0,.05)] backdrop-blur-lg">
                          {labelForType(product.type)}
                        </span>
                      </div>

                      {/* Content Body */}
                      <div className="flex flex-1 flex-col px-5 pt-[18px] pb-5">
                        <span className="mb-1.5 block text-[11px] font-bold uppercase tracking-[.08em] text-muted">
                          {labelForType(product.type)}
                        </span>
                        <h3 className="mb-2 mt-0 line-clamp-2 text-[17px] font-semibold leading-[1.35] tracking-[-.025em] text-ink">{product.title}</h3>
                        {product.description && (
                          <p className="mb-4 mt-0 line-clamp-2 flex-1 text-[13px] leading-[1.55] text-muted">{product.description}</p>
                        )}
                        <div className="mt-auto flex items-center justify-between gap-3 border-t border-[#f0f4f1] pt-[14px]">
                          <strong className="text-lg font-extrabold tracking-[-.03em] text-ink">{priceLabel}</strong>
                          <span className="inline-flex items-center gap-[5px] text-xs font-semibold text-display transition-transform group-hover:translate-x-0.5">
                            <span>View</span>
                            <ArrowRight size={14} aria-hidden="true" />
                          </span>
                        </div>
                      </div>
                    </Link>
                  );
                })}
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed border-[#dce5df] bg-[#fafbfa] px-6 py-14 text-center">
                <div className="mx-auto mb-[14px] inline-grid size-12 place-items-center rounded-full bg-[#eef4f0] text-display-strong" aria-hidden="true">
                  <Package size={26} />
                </div>
                <h3 className="mb-1.5 mt-0 text-lg font-semibold tracking-[-.02em] text-ink">
                  {query.trim()
                    ? 'No matching products'
                    : selectedCategory !== 'all'
                      ? 'No products in this category'
                      : 'No products available yet'}
                </h3>
                <p className="mx-auto mb-[18px] mt-0 max-w-[440px] text-[13px] leading-[1.6] text-muted">
                  {query.trim()
                    ? `No products match "${query}" in ${currency}. Try a different keyword or reset filters.`
                    : selectedCategory !== 'all'
                      ? `There are no ${categoryTabs.find((t) => t.id === selectedCategory)?.label.toLowerCase()} in ${currency} right now.`
                      : `Check back soon to see new offers from ${creator.name}.`}
                </p>
                {query.trim() ? (
                  <button
                    type="button"
                    className="inline-flex min-h-[38px] items-center justify-center rounded-full bg-display px-[18px] text-[13px] font-semibold text-white transition-colors hover:bg-brand-strong"
                    onClick={() => setQuery('')}
                  >
                    Clear search
                  </button>
                ) : selectedCategory !== 'all' ? (
                  <button
                    type="button"
                    className="inline-flex min-h-[38px] items-center justify-center rounded-full bg-display px-[18px] text-[13px] font-semibold text-white transition-colors hover:bg-brand-strong"
                    onClick={() => setSelectedCategory('all')}
                  >
                    View all products
                  </button>
                ) : null}
              </div>
            )}
          </section>

          {/* ─── Authentic Onselli Logo Footer ─── */}
          <footer className="mt-auto flex justify-center pt-9">
            <Link href="/" className="inline-flex items-center gap-2 rounded-full border border-[#e5ece6] bg-white px-[15px] py-[7px] text-xs font-semibold text-muted shadow-[0_2px_8px_rgba(0,0,0,.02)] transition-all hover:border-brand-strong hover:text-display-strong" aria-label="Powered by Onselli">
              <span className="text-[11px] text-muted">Powered by</span>
              <Image
                src="/logo.png"
                alt="Onselli"
                width={20}
                height={20}
                className="size-[17px] object-contain"
                priority={false}
              />
              <span className="font-bold tracking-[-.02em]">Onselli</span>
            </Link>
          </footer>
        </div>
      </main>
    </PublicCartProvider>
  );
}
