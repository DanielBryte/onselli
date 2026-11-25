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
import BuyerAccountMenu from '@/app/components/BuyerAccountMenu';

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
    <main className="min-h-screen bg-white text-ink">
      <header className="sticky top-0 z-50 border-b border-border-subtle bg-white/[.98] backdrop-blur-xl">
        <div className="mx-auto flex h-[66px] max-w-[1140px] items-center justify-between gap-[18px] px-6 max-[760px]:h-[60px] max-[760px]:gap-3 max-[760px]:px-4">
          <Link
            href={`/c/${row.creator.slug}`}
            className="inline-flex min-w-0 items-center gap-[10px] transition-opacity hover:opacity-85"
            aria-label={`${row.creator.displayName} storefront`}
          >
            {creatorLogoUrl ? (
              <Image
                src={creatorLogoUrl}
                alt=""
                width={36}
                height={36}
                className="size-9 shrink-0 rounded-full border border-border-subtle object-cover"
                unoptimized
                priority
              />
            ) : (
              <span className="grid size-9 shrink-0 place-items-center rounded-full border border-border bg-brand-tint text-sm font-bold text-display-strong" aria-hidden="true">
                {row.creator.displayName.trim().slice(0, 1).toUpperCase()}
              </span>
            )}
            <strong className="overflow-hidden text-ellipsis whitespace-nowrap text-[15px] font-semibold tracking-[-.015em] text-ink max-[760px]:max-w-[120px] max-[760px]:text-sm">{row.creator.displayName}</strong>
          </Link>
          <div className="flex shrink-0 items-center gap-[10px]">
            <PublicCurrencySelect creatorSlug={row.creator.slug} currency={row.product.currency as 'NGN' | 'USD'} />
            <CartTrigger />
            <BuyerAccountMenu isLoggedIn={Boolean(session?.user)} nextPath={`/c/${row.creator.slug}/${row.product.slug}`} userLabel={session?.user?.name || session?.user?.email} />
          </div>
        </div>
      </header>
      <header className="bg-white px-6 pt-11 max-[860px]:px-5 max-[860px]:pt-6">
        <div className="mx-auto max-w-[1140px]">
          <div>
            <span className="mb-2 block text-[11px] font-extrabold uppercase tracking-[.09em] text-muted">
              {typeLabel.toUpperCase()} · BY{' '}
              <Link href={`/c/${row.creator.slug}`} className="text-inherit transition-colors hover:text-display-strong hover:underline">
                {row.creator.displayName.toUpperCase()}
              </Link>
            </span>
            <h1 className="m-0 max-w-[820px] text-[clamp(30px,4.2vw,44px)] font-extrabold leading-[1.15] tracking-[-.035em] text-ink">{row.product.title}</h1>
            {row.creator.headline && (
              <p className="mt-[10px] mb-0 max-w-[720px] text-base leading-[1.6] text-muted">{row.creator.headline}</p>
            )}
          </div>
        </div>
      </header>

      <section className="mx-auto max-w-[1100px] px-8 pt-8 pb-20 max-[860px]:px-5 max-[860px]:pt-5 max-[860px]:pb-16">
        <div className="grid grid-cols-[minmax(0,1fr)_360px] items-start gap-10 max-[860px]:grid-cols-1 max-[860px]:gap-6">
          {/* Main Left Column */}
          <article className="min-w-0 border-0 bg-transparent p-0">
            {coverUrl && (
              <div className="mb-7 aspect-[16/10] w-full overflow-hidden rounded-[14px] border border-border bg-[#f4f6f4]">
                <img
                  src={coverUrl}
                  alt={row.product.title}
                  className="block size-full object-cover"
                />
              </div>
            )}

            <h2 className="mb-[14px] mt-0 text-xl font-bold tracking-[-.02em] text-ink">
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
              className="text-[15px] leading-[1.7] text-ink-secondary [&_p]:mb-5 [&_p]:mt-0 [&_p]:text-[15px] [&_p]:leading-[1.7] [&_p]:text-ink-secondary [&_h3]:mt-[1.6em] [&_h3]:mb-[.6em] [&_h3]:text-lg [&_h3]:font-bold [&_h3]:tracking-[-.02em] [&_h3]:text-ink [&_h4]:mt-[1.4em] [&_h4]:mb-2 [&_h4]:text-base [&_h4]:font-semibold [&_h4]:text-ink [&_ul]:mb-5 [&_ol]:mb-5 [&_ul]:pl-6 [&_ol]:pl-6 [&_li]:mb-[.4em] [&_li]:leading-[1.65] [&_strong]:font-semibold [&_strong]:text-ink [&_a]:font-medium [&_a]:text-display-strong [&_a]:underline [&_a]:underline-offset-[3px] [&_blockquote]:my-[1.4em] [&_blockquote]:border-l-[3px] [&_blockquote]:border-[#07533c] [&_blockquote]:pl-4 [&_blockquote]:italic [&_blockquote]:text-ink-secondary"
              dangerouslySetInnerHTML={{
                __html: productDescriptionHtml(row.product.description),
              }}
            />

            {row.product.type === 'bundle' && (
              <section className="mt-6 rounded-xl border border-[#e1e9e3] bg-white p-4" aria-labelledby="bundle-includes-heading">
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
          <aside className="sticky top-20 rounded-[14px] border border-border bg-white px-[22px] pt-6 pb-5 shadow-[0_1px_2px_rgba(0,0,0,.04)] max-[860px]:static">
            {isEnrolled ? (
              <div className="grid gap-3 rounded-xl border border-[#dcece2] bg-[#f7fbf8] p-4">
                <div className="inline-flex items-center gap-2 text-sm font-bold text-display-strong">
                  <Check size={16} />
                  <span>You are enrolled</span>
                </div>
                <p className="m-0 text-[13px] leading-6 text-muted">You have full access to this course in your library.</p>
                <Link
                  href={`/dashboard/learning/courses/${row.product.id}`}
                  className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-brand px-4 text-sm font-semibold text-white hover:bg-brand-strong"
                >
                  <GraduationCap size={16} /> Go to Course Player
                </Link>
              </div>
            ) : (
              <>
                <span className="mb-1 block text-[10.5px] font-bold uppercase tracking-[.09em] text-muted">
                  {row.product.type === 'course'
                    ? 'Course enrollment'
                    : row.product.type === 'download'
                      ? 'Digital download'
                      : row.product.type === 'bundle'
                        ? 'Bundle purchase'
                        : 'Secure payment'}
                </span>
                <strong className="mb-[18px] block text-[30px] font-extrabold leading-[1.1] tracking-[-.04em] text-ink">{price}</strong>
                {hasUnsupportedCurrencyOptions ? (
                  <p className="rounded-lg border border-danger-border bg-danger-tint p-3 text-xs leading-5 text-danger-text" role="alert">
                    Checkout for this offer is being updated. Please contact the creator before
                    paying.
                  </p>
                ) : row.product.type === 'bundle' && !bundleReady ? (
                  <p className="rounded-[9px] border border-[#e3e8e4] bg-canvas p-3 text-xs leading-[1.5] text-muted" role="status">
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
              <ul className="mt-[18px] grid list-none gap-[9px] border-t border-[#f0f4f1] p-0 pt-4">
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
              <ul className="mt-[18px] grid list-none gap-[9px] border-t border-[#f0f4f1] p-0 pt-4">
                <li>
                  <ShieldCheck size={14} />
                  {row.product.refundWindowDays}-day money-back guarantee
                </li>
              </ul>
            )}

            <p className="mt-[18px] mb-0 flex items-center justify-center gap-1.5 border-t border-[#f0f4f1] pt-4 text-center text-[11.5px] leading-[1.4] text-disabled">
              <LockKeyhole size={13} />
              {row.product.type === 'payment_link'
                ? 'Secure payment processing'
                : 'Secure checkout · Instant access'}
            </p>
          </aside>
        </div>

        {/* Course Curriculum & Syllabus Section */}
        {row.product.type === 'course' && (
          <section className="mt-[22px] grid grid-cols-2 items-start gap-3 max-[700px]:mt-[15px] max-[700px]:grid-cols-1" aria-labelledby="curriculum-heading">
            <div className="col-span-full mb-[3px] max-[700px]:col-span-1">
              <span className="section-kicker">SYLLABUS & CURRICULUM</span>
              <h2 id="curriculum-heading" className="my-[5px] text-xl tracking-[-.03em] text-ink">What you’ll learn</h2>
              <p className="m-0 text-xs text-muted">
                {sections.length} {sections.length === 1 ? 'module' : 'modules'} ·{' '}
                {courseLessons.length} {courseLessons.length === 1 ? 'lesson' : 'lessons'}
              </p>
            </div>
            {sections.map((section, sectionIndex) => {
              const items = courseLessons.filter((lesson) => lesson.sectionId === section.id);
              if (!items.length) return null;

              return (
                <article className="overflow-hidden rounded-[11px] border border-[#e1e9e3] bg-white" key={section.id}>
                  <div>
                    <span>
                      MODULE {sectionIndex + 1}
                    </span>
                    <h3 className="m-0 border-b border-border bg-canvas px-[14px] py-3 text-[13px] font-semibold text-ink">{section.title}</h3>
                    <small className="px-[14px] py-[11px] text-[10px]">
                      {items.length} {items.length === 1 ? 'lesson' : 'lessons'}
                    </small>
                  </div>
                  <div>
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
                        <div className="border-b border-border px-[14px] py-[11px] last:border-b-0" key={lesson.id}>
                          <div className="flex items-center gap-2">
                            <span className="grid place-items-center text-muted">
                              {lesson.type === 'video' ? (
                                <CirclePlay size={16} />
                              ) : lesson.type === 'quiz' ? (
                                <CircleHelp size={16} />
                              ) : (
                                <FileText size={16} />
                              )}
                            </span>
                            <div className="grid min-w-0">
                              <strong className="text-xs font-semibold text-ink">{lesson.title}</strong>
                              <span className="text-[11px] text-muted">
                                {lesson.type === 'video'
                                  ? 'Video lesson'
                                  : lesson.type === 'quiz'
                                    ? 'Quiz assessment'
                                    : 'Written lesson'}
                              </span>
                            </div>
                            {lesson.isFreePreview && (
                              <span className="rounded-full bg-brand-tint px-[7px] py-[3px] text-[10px] font-semibold text-display-strong">
                                Free Preview
                              </span>
                            )}
                          </div>
                          {lesson.isFreePreview && lesson.type === 'text' && text && (
                            <div className="mt-[9px]">
                              <p className="m-0 whitespace-pre-wrap text-xs leading-[1.65] text-muted">{text.slice(0, 320)}{text.length > 320 ? '…' : ''}</p>
                            </div>
                          )}
                          {lesson.isFreePreview &&
                            lesson.type === 'video' &&
                            safeCourseEmbed(videoUrl) && (
                              <div className="relative mt-[10px] aspect-video overflow-hidden rounded-[7px] bg-[#111]">
                                <iframe
                                  src={safeCourseEmbed(videoUrl)}
                                  className="absolute inset-0 size-full border-0"
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
