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
      <main className="bs-page">
        {/* ─── Top navigation header (exact match to product overview header) ─── */}
        <header className="public-site-header public-product-site-header">
          <div className="public-site-header__inner public-product-site-header__inner">
            <Link
              href={`/c/${creator.slug}`}
              className="public-site-brand public-product-brand"
              aria-label={`${creator.name} storefront`}
            >
              {creator.avatarUrl ? (
                <Image
                  src={creator.avatarUrl}
                  alt=""
                  width={36}
                  height={36}
                  className="public-site-brand__avatar"
                  unoptimized
                  priority
                />
              ) : (
                <span className="public-site-brand__fallback" aria-hidden="true">
                  {creator.name.trim().slice(0, 1).toUpperCase()}
                </span>
              )}
              <strong className="public-site-brand__name">{creator.name}</strong>
            </Link>

            <div className="public-site-header__actions public-product-site-header__actions">
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
                className="public-site-login public-product-login"
              >
                {isLoggedIn ? 'My account' : 'Log in'}
              </Link>
            </div>
          </div>
        </header>

        {/* ─── Main store container ─── */}
        <div className="bs-container">
          {/* ─── Creator profile & about section (above products) ─── */}
          <section className="bs-profile" aria-labelledby="creator-display-name">
            <div className="bs-profile__avatar-wrap">
              {creator.avatarUrl ? (
                <Image
                  src={creator.avatarUrl}
                  alt={`${creator.name} profile`}
                  width={80}
                  height={80}
                  className="bs-profile__avatar-img"
                  unoptimized
                  priority
                />
              ) : (
                <span className="bs-profile__avatar-fallback" aria-hidden="true">
                  {creator.name.trim().slice(0, 1).toUpperCase()}
                </span>
              )}
            </div>

            <div className="bs-profile__content">
              <div className="bs-profile__identity">
                <h1 id="creator-display-name" className="bs-profile__name">
                  {creator.name}
                </h1>
                <div className="bs-profile__meta">
                  <span className="bs-profile__handle">@{creator.slug}</span>
                  <span className="bs-profile__badge">
                    <Sparkles size={11} aria-hidden="true" />
                    <span>Verified Creator</span>
                  </span>
                </div>
              </div>

              {aboutText && <p className="bs-profile__about">{aboutText}</p>}

              {(creator.whatsappE164 || socialLinks.length > 0) && (
                <div className="bs-profile__links">
                  {creator.whatsappE164 && (
                    <a
                      href={`https://wa.me/${creator.whatsappE164.replace('+', '')}`}
                      target="_blank"
                      rel="noreferrer"
                      className="bs-profile__link-btn"
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
                      className="bs-profile__link-btn"
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
          <section className="bs-catalog" aria-label="Creator Catalog">
            {/* Catalog Toolbar: category tabs + search bar */}
            <div className="bs-catalog__toolbar">
              {categoryTabs.length > 2 ? (
                <div className="bs-catalog__tabs" role="tablist" aria-label="Filter products">
                  {categoryTabs.map(({ id, label, count }) => {
                    const isActive = selectedCategory === id;
                    return (
                      <button
                        key={id}
                        type="button"
                        role="tab"
                        aria-selected={isActive}
                        className={`bs-catalog__tab-pill ${isActive ? 'is-active' : ''}`}
                        onClick={() => setSelectedCategory(id)}
                      >
                        <span>{label}</span>
                        <small>{count}</small>
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div className="bs-catalog__heading-wrap">
                  <h2 className="bs-catalog__heading">Products</h2>
                </div>
              )}

              {currencyProducts.length > 0 && (
                <label className="bs-search-box">
                  <Search size={16} aria-hidden="true" className="bs-search-box__icon" />
                  <span className="sr-only">Search products</span>
                  <input
                    type="search"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Search products..."
                  />
                  {query && (
                    <button
                      type="button"
                      className="bs-search-box__clear"
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
              <div className="bs-catalog__grid">
                {visibleProducts.map((product) => {
                  const isFree = BigInt(product.priceMinor) === 0n;
                  const priceLabel = isFree ? 'Free' : formatMoney(product.priceMinor, product.currency);

                  return (
                    <Link
                      href={`/c/${creator.slug}/${product.slug}`}
                      className="bs-product-card"
                      key={product.id}
                    >
                      {/* Thumbnail container */}
                      <div className="bs-product-card__thumb">
                        {product.coverUrl ? (
                          <Image
                            src={product.coverUrl}
                            alt=""
                            fill
                            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                            className="bs-product-card__img"
                            unoptimized
                          />
                        ) : (
                          <div className="bs-product-card__thumb--empty">
                            <div className="bs-product-card__thumb-icon">
                              {iconForType(product.type)}
                            </div>
                            <span>{product.title}</span>
                          </div>
                        )}
                        <span className="bs-product-card__badge-pill">
                          {labelForType(product.type)}
                        </span>
                      </div>

                      {/* Content Body */}
                      <div className="bs-product-card__body">
                        <span className="bs-product-card__eyebrow">
                          {labelForType(product.type)}
                        </span>
                        <h3 className="bs-product-card__title">{product.title}</h3>
                        {product.description && (
                          <p className="bs-product-card__desc">{product.description}</p>
                        )}
                        <div className="bs-product-card__footer">
                          <strong className="bs-product-card__price">{priceLabel}</strong>
                          <span className="bs-product-card__action">
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
              <div className="bs-empty-state">
                <div className="bs-empty-state__icon" aria-hidden="true">
                  <Package size={26} />
                </div>
                <h3>
                  {query.trim()
                    ? 'No matching products'
                    : selectedCategory !== 'all'
                      ? 'No products in this category'
                      : 'No products available yet'}
                </h3>
                <p>
                  {query.trim()
                    ? `No products match "${query}" in ${currency}. Try a different keyword or reset filters.`
                    : selectedCategory !== 'all'
                      ? `There are no ${categoryTabs.find((t) => t.id === selectedCategory)?.label.toLowerCase()} in ${currency} right now.`
                      : `Check back soon to see new offers from ${creator.name}.`}
                </p>
                {query.trim() ? (
                  <button
                    type="button"
                    className="bs-empty-state__btn"
                    onClick={() => setQuery('')}
                  >
                    Clear search
                  </button>
                ) : selectedCategory !== 'all' ? (
                  <button
                    type="button"
                    className="bs-empty-state__btn"
                    onClick={() => setSelectedCategory('all')}
                  >
                    View all products
                  </button>
                ) : null}
              </div>
            )}
          </section>

          {/* ─── Authentic Onselli Logo Footer ─── */}
          <footer className="bs-footer">
            <Link href="/" className="bs-footer__pill" aria-label="Powered by Onselli">
              <span className="bs-footer__powered">Powered by</span>
              <Image
                src="/logo.png"
                alt="Onselli"
                width={20}
                height={20}
                className="bs-footer__logo"
                priority={false}
              />
              <span className="bs-footer__wordmark">Onselli</span>
            </Link>
          </footer>
        </div>
      </main>
    </PublicCartProvider>
  );
}
