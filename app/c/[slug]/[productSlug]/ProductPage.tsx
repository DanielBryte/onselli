import Link from 'next/link';
import Image from 'next/image';
import { notFound } from 'next/navigation';
import {
  ArrowUpRight,
  BookOpen,
  Check,
  CircleHelp,
  CirclePlay,
  Download,
  FileText,
  GraduationCap,
  LockKeyhole,
  ShieldCheck,
} from 'lucide-react';
import { and, asc, eq, inArray, isNull } from 'drizzle-orm';
import { getDatabase } from '@/src/server/db';
import {
  bundleProductItems,
  courseSections,
  creators,
  entitlements,
  lessons,
  productFiles,
  products,
} from '@/src/server/db/schema';
import { getCreatorIdForSlug } from '@/src/server/workspaces/resolve-slug';
import CheckoutButton from '../../../components/CheckoutButton';
import { currencyMinorToDecimal } from '@/lib/money.mjs';
import { productDescriptionHtml } from '@/lib/product-description.mjs';
import { validateExternalDownloadUrl } from '@/lib/storage/external-download.mjs';
import { getCurrentSession } from '@/src/server/auth/permissions';
import { getCreatorLogoUrl } from '@/src/server/workspaces/logo';
import { AddToCartButton, CartTrigger, PublicCartProvider } from '@/app/components/PublicCart';
import PublicCurrencySelect from '@/app/components/PublicCurrencySelect';

function safeCourseEmbed(value: string) {
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:') return '';
    if (['youtube.com', 'www.youtube.com', 'm.youtube.com'].includes(url.hostname)) {
      const parts = url.pathname.split('/');
      const id =
        url.searchParams.get('v') ??
        (['embed', 'shorts', 'live'].includes(parts[1] ?? '') ? parts[2] : '');
      return id ? `https://www.youtube-nocookie.com/embed/${encodeURIComponent(id)}` : '';
    }
    if (url.hostname === 'youtu.be') {
      return url.pathname.length > 1
        ? `https://www.youtube-nocookie.com/embed/${encodeURIComponent(url.pathname.slice(1))}`
        : '';
    }
    if (['vimeo.com', 'www.vimeo.com', 'player.vimeo.com'].includes(url.hostname)) {
      const id = url.pathname.split('/').filter(Boolean).at(-1);
      return id && /^\d+$/.test(id) ? `https://player.vimeo.com/video/${id}` : '';
    }
  } catch {
    return '';
  }
  return '';
}

export default async function PublicProductPage({
  creatorSlug,
  productSlug,
}: {
  creatorSlug: string;
  productSlug: string;
}) {
  const creatorId = await getCreatorIdForSlug(creatorSlug);
  const [row] = creatorId
    ? await getDatabase()
        .select({ product: products, creator: creators })
        .from(products)
        .innerJoin(creators, eq(products.creatorId, creators.id))
        .where(
          and(
            eq(creators.id, creatorId),
            eq(creators.status, 'active'),
            eq(products.slug, productSlug),
            eq(products.status, 'published'),
          ),
        )
        .limit(1)
    : [];

  if (!row) notFound();

  const db = getDatabase();
  const session = await getCurrentSession();
  const coverUrl = getCreatorLogoUrl(row.product.coverKey);
  const creatorLogoUrl = getCreatorLogoUrl(row.creator.avatarKey);

  let isEnrolled = false;
  if (session?.user?.id && row.product.type === 'course') {
    const [entitlement] = await db
      .select({ id: entitlements.id })
      .from(entitlements)
      .where(
        and(
          eq(entitlements.productId, row.product.id),
          eq(entitlements.userId, session.user.id),
          eq(entitlements.status, 'active'),
        ),
      )
      .limit(1);
    isEnrolled = Boolean(entitlement);
  }

  const sections =
    row.product.type === 'course'
      ? await db
          .select()
          .from(courseSections)
          .where(
            and(
              eq(courseSections.productId, row.product.id),
              eq(courseSections.creatorId, row.creator.id),
              eq(courseSections.status, 'published'),
            ),
          )
          .orderBy(asc(courseSections.position))
      : [];

  const sectionIds = sections.map((section) => section.id);
  const courseLessons = sectionIds.length
    ? await db
        .select()
        .from(lessons)
        .where(
          and(
            inArray(lessons.sectionId, sectionIds),
            eq(lessons.creatorId, row.creator.id),
            eq(lessons.status, 'published'),
            isNull(lessons.deletedAt),
          ),
        )
        .orderBy(asc(lessons.position))
    : [];

  const bundleItems =
    row.product.type === 'bundle'
      ? await db
          .select({ product: products })
          .from(bundleProductItems)
          .innerJoin(products, eq(bundleProductItems.includedProductId, products.id))
          .where(eq(bundleProductItems.bundleProductId, row.product.id))
          .orderBy(asc(bundleProductItems.position))
      : [];

  let bundleReady = true;
  if (row.product.type === 'bundle') {
    const ids = bundleItems.map(({ product }) => product.id);
    const readyFiles = ids.length
      ? await db
          .select({ productId: productFiles.productId })
          .from(productFiles)
          .where(
            and(
              inArray(productFiles.productId, ids),
              eq(productFiles.creatorId, row.creator.id),
              eq(productFiles.status, 'ready'),
            ),
          )
      : [];
    const readyDownloads = new Set(readyFiles.map((file) => file.productId));
    for (const { product } of bundleItems) {
      if (
        product.type === 'download' &&
        product.downloadDeliveryMode === 'external_link' &&
        validateExternalDownloadUrl(product.downloadExternalUrl)
      ) {
        readyDownloads.add(product.id);
      }
    }
    const readyCourseRows = ids.length
      ? await db
          .select({ productId: courseSections.productId })
          .from(courseSections)
          .innerJoin(lessons, eq(lessons.sectionId, courseSections.id))
          .where(
            and(
              inArray(courseSections.productId, ids),
              eq(courseSections.creatorId, row.creator.id),
              eq(courseSections.status, 'published'),
              eq(lessons.creatorId, row.creator.id),
              eq(lessons.status, 'published'),
              isNull(lessons.deletedAt),
            ),
          )
      : [];
    const readyCourses = new Set(readyCourseRows.map((item) => item.productId));
    bundleReady =
      bundleItems.length >= 2 &&
      bundleItems.length <= 20 &&
      bundleItems.every(
        ({ product }) =>
          product.creatorId === row.creator.id &&
          product.status === 'published' &&
          product.currency === row.product.currency &&
          product.amountType === 'fixed' &&
          (product.type === 'course'
            ? readyCourses.has(product.id)
            : product.type === 'download' && readyDownloads.has(product.id)),
      );
  }

  const typeLabel =
    row.product.type === 'download'
      ? 'Digital download'
      : row.product.type === 'payment_link'
        ? 'Payment link'
        : row.product.type === 'bundle'
          ? 'Bundle'
          : 'Online Course';

  const formatPrice = (minor: bigint) =>
    new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency: row.product.currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(Number(currencyMinorToDecimal(minor, row.product.currency)));

  const price =
    row.product.amountType === 'customer_chooses'
      ? `From ${formatPrice(row.product.minAmountMinor ?? 0n)}`
      : formatPrice(row.product.priceMinor);

  const hasUnsupportedCurrencyOptions =
    Array.isArray(row.product.currencyOptions) && row.product.currencyOptions.length > 0;

  return (
    <PublicCartProvider creatorSlug={row.creator.slug} initialEmail={session?.user.email ?? ''}>
    <main className="page-shell public-product-page">
      <header className="public-site-header public-product-site-header">
        <div className="public-site-header__inner public-product-site-header__inner">
          <Link
            href={`/c/${row.creator.slug}`}
            className="public-site-brand public-product-brand"
            aria-label={`${row.creator.displayName} storefront`}
          >
            {creatorLogoUrl ? (
              <Image
                src={creatorLogoUrl}
                alt=""
                width={36}
                height={36}
                className="public-site-brand__avatar"
                unoptimized
                priority
              />
            ) : (
              <span className="public-site-brand__fallback" aria-hidden="true">
                {row.creator.displayName.trim().slice(0, 1).toUpperCase()}
              </span>
            )}
            <strong className="public-site-brand__name">{row.creator.displayName}</strong>
          </Link>
          <div className="public-site-header__actions public-product-site-header__actions">
            <PublicCurrencySelect creatorSlug={row.creator.slug} currency={row.product.currency as 'NGN' | 'USD'} />
            <CartTrigger />
            <Link
              href={
                session?.user
                  ? '/dashboard/learning'
                  : `/login?next=${encodeURIComponent(`/c/${row.creator.slug}/${row.product.slug}`)}`
              }
              className="public-site-login public-product-login"
            >
              {session?.user ? 'My account' : 'Log in'}
            </Link>
          </div>
        </div>
      </header>
      <header className="public-product-header">
        <div className="public-product-header__inner">
          <div className="public-product-heading">
            <span className="public-product-kicker">
              {typeLabel.toUpperCase()} · BY{' '}
              <Link href={`/c/${row.creator.slug}`} className="public-product-creator-link">
                {row.creator.displayName.toUpperCase()}
              </Link>
            </span>
            <h1 className="public-product-title">{row.product.title}</h1>
            {row.creator.headline && (
              <p className="public-product-subtitle">{row.creator.headline}</p>
            )}
          </div>
        </div>
      </header>

      <section className="public-product-content">
        <div className="public-product-layout">
          {/* Main Left Column */}
          <article className="public-product-description">
            {coverUrl && (
              <div className="public-product-cover-wrap">
                <img
                  src={coverUrl}
                  alt={row.product.title}
                  className="public-product-cover-img"
                />
              </div>
            )}

            <h2>
              About this{' '}
              {row.product.type === 'course'
                ? 'course'
                : row.product.type === 'download'
                  ? 'download'
                  : row.product.type === 'bundle'
                    ? 'bundle'
                    : 'payment'}
            </h2>
            <div
              className="public-product-description__content"
              dangerouslySetInnerHTML={{
                __html: productDescriptionHtml(row.product.description),
              }}
            />

            {row.product.type === 'bundle' && (
              <section className="bundle-public-list" aria-labelledby="bundle-includes-heading">
                <h3 id="bundle-includes-heading">Included in this bundle</h3>
                {bundleItems.length ? (
                  <ul>
                    {bundleItems
                      .filter(
                        ({ product }) =>
                          product.status === 'published' && product.creatorId === row.creator.id,
                      )
                      .map(({ product }) => (
                        <li key={product.id}>
                          <span>
                            {product.type === 'course' ? 'Course' : 'Digital download'}
                          </span>
                          <strong>{product.title}</strong>
                        </li>
                      ))}
                  </ul>
                ) : (
                  <p>This bundle is temporarily unavailable.</p>
                )}
              </section>
            )}
          </article>

          {/* Sticky Right Purchase Column */}
          <aside className="public-product-purchase">
            {isEnrolled ? (
              <div className="public-product-enrolled-card">
                <div className="public-product-enrolled-badge">
                  <Check size={16} />
                  <span>You are enrolled</span>
                </div>
                <p>You have full access to this course in your library.</p>
                <Link
                  href={`/dashboard/learning/courses/${row.product.id}`}
                  className="button button--mint public-product-enrolled-cta"
                >
                  <GraduationCap size={16} /> Go to Course Player
                </Link>
              </div>
            ) : (
              <>
                <span className="section-kicker public-product-purchase__kicker">
                  {row.product.type === 'course'
                    ? 'Course enrollment'
                    : row.product.type === 'download'
                      ? 'Digital download'
                      : row.product.type === 'bundle'
                        ? 'Bundle purchase'
                        : 'Secure payment'}
                </span>
                <strong className="public-product-price">{price}</strong>
                {hasUnsupportedCurrencyOptions ? (
                  <p className="form-error" role="alert">
                    Checkout for this offer is being updated. Please contact the creator before
                    paying.
                  </p>
                ) : row.product.type === 'bundle' && !bundleReady ? (
                  <p className="public-product-unavailable" role="status">
                    This bundle is temporarily unavailable while the creator updates its included
                    products.
                  </p>
                ) : (
                  <CheckoutButton
                    productId={row.product.id}
                    returnPath={`/c/${row.creator.slug}/${row.product.slug}`}
                    amountType={row.product.amountType as 'fixed' | 'customer_chooses'}
                    priceMinor={row.product.priceMinor.toString()}
                    minAmountMinor={row.product.minAmountMinor?.toString() ?? null}
                    currency={row.product.currency}
                    initialEmail={session?.user.email ?? ''}
                    secondaryAction={
                      row.product.amountType === 'fixed' &&
                      row.product.priceMinor > 0n &&
                      ['course', 'download', 'bundle', 'payment_link'].includes(row.product.type) &&
                      !hasUnsupportedCurrencyOptions &&
                      (row.product.type !== 'bundle' || bundleReady) ? (
                        <AddToCartButton
                          item={{
                            productId: row.product.id,
                            title: row.product.title,
                            slug: row.product.slug,
                            priceMinor: row.product.priceMinor.toString(),
                            currency: row.product.currency,
                            quantity: 1,
                          }}
                        />
                      ) : null
                    }
                  />
                )}
              </>
            )}

            {row.product.type === 'course' && (
              <ul className="public-product-features">
                <li>
                  <GraduationCap size={14} /> Full access to {sections.length} modules &amp;{' '}
                  {courseLessons.length} lessons
                </li>
                <li>
                  <BookOpen size={14} /> Self-paced lifetime learning
                </li>
                <li>
                  <Download size={14} /> Downloadable worksheets &amp; resources
                </li>
                {row.product.refundWindowDays > 0 && (
                  <li>
                    <ShieldCheck size={14} />
                    {row.product.refundWindowDays}-day money-back guarantee
                  </li>
                )}
              </ul>
            )}
            {row.product.type !== 'course' && row.product.refundWindowDays > 0 && (
              <ul className="public-product-features">
                <li>
                  <ShieldCheck size={14} />
                  {row.product.refundWindowDays}-day money-back guarantee
                </li>
              </ul>
            )}

            <p className="public-product-secure-note">
              <LockKeyhole size={13} />
              {row.product.type === 'payment_link'
                ? 'Secure payment processing'
                : 'Secure checkout · Instant access'}
            </p>
          </aside>
        </div>

        {/* Course Curriculum & Syllabus Section */}
        {row.product.type === 'course' && (
          <section className="course-public-outline" aria-labelledby="curriculum-heading">
            <div className="course-public-outline__heading">
              <span className="section-kicker">SYLLABUS & CURRICULUM</span>
              <h2 id="curriculum-heading">What you’ll learn</h2>
              <p>
                {sections.length} {sections.length === 1 ? 'module' : 'modules'} ·{' '}
                {courseLessons.length} {courseLessons.length === 1 ? 'lesson' : 'lessons'}
              </p>
            </div>
            {sections.map((section, sectionIndex) => {
              const items = courseLessons.filter((lesson) => lesson.sectionId === section.id);
              if (!items.length) return null;

              return (
                <article className="course-public-outline__module" key={section.id}>
                  <div className="course-public-outline__module-header">
                    <span className="course-public-outline__module-index">
                      MODULE {sectionIndex + 1}
                    </span>
                    <h3>{section.title}</h3>
                    <small>
                      {items.length} {items.length === 1 ? 'lesson' : 'lessons'}
                    </small>
                  </div>
                  <div className="course-public-outline__lessons-list">
                    {items.map((lesson) => {
                      const text =
                        lesson.content &&
                        typeof lesson.content === 'object' &&
                        'text' in lesson.content
                          ? String(lesson.content.text ?? '')
                          : '';
                      const videoUrl =
                        lesson.content &&
                        typeof lesson.content === 'object' &&
                        'videoUrl' in lesson.content
                          ? String(lesson.content.videoUrl ?? '')
                          : '';

                      return (
                        <div className="course-public-outline__lesson" key={lesson.id}>
                          <div className="course-public-outline__lesson-main">
                            <span className="course-public-outline__lesson-icon">
                              {lesson.type === 'video' ? (
                                <CirclePlay size={16} />
                              ) : lesson.type === 'quiz' ? (
                                <CircleHelp size={16} />
                              ) : (
                                <FileText size={16} />
                              )}
                            </span>
                            <div className="course-public-outline__lesson-info">
                              <strong>{lesson.title}</strong>
                              <span className="course-public-outline__lesson-meta">
                                {lesson.type === 'video'
                                  ? 'Video lesson'
                                  : lesson.type === 'quiz'
                                    ? 'Quiz assessment'
                                    : 'Written lesson'}
                              </span>
                            </div>
                            {lesson.isFreePreview && (
                              <span className="course-public-outline__preview-pill">
                                Free Preview
                              </span>
                            )}
                          </div>
                          {lesson.isFreePreview && lesson.type === 'text' && text && (
                            <div className="course-public-outline__preview-text">
                              <p>{text.slice(0, 320)}{text.length > 320 ? '…' : ''}</p>
                            </div>
                          )}
                          {lesson.isFreePreview &&
                            lesson.type === 'video' &&
                            safeCourseEmbed(videoUrl) && (
                              <div className="course-public-outline__video">
                                <iframe
                                  src={safeCourseEmbed(videoUrl)}
                                  title={lesson.title}
                                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                  allowFullScreen
                                />
                              </div>
                            )}
                        </div>
                      );
                    })}
                  </div>
                </article>
              );
            })}
          </section>
        )}
      </section>
    </main>
    </PublicCartProvider>
  );
}
