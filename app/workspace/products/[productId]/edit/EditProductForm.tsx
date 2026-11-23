'use client';

import WorkspaceSelect from '@/app/components/ui/WorkspaceSelect';
import ProductDescriptionEditor from '@/app/components/ui/ProductDescriptionEditor';
import { FormEvent, useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, ArrowRight, Eye, EyeOff, ImagePlus, Loader2, X } from 'lucide-react';
import CourseCurriculumEditor from './CourseCurriculumEditor';
import BundleItemsEditor from './BundleItemsEditor';
import DigitalFileManager, { type DeliveryFormState } from '../files/DigitalFileManager';
import { currencyMinorToDecimal, decimalToCurrencyMinor } from '@/lib/money.mjs';
import ProductMediaPickerModal, { type MediaAsset } from '../../ProductMediaPickerModal';
import ProductPublishCelebration from '@/app/components/ProductPublishCelebration';
import { toast } from 'sonner';

type ProductData = {
  id: string;
  creatorSlug: string;
  type: 'course' | 'download' | 'payment_link' | 'bundle';
  title: string;
  slug: string;
  description: string;
  descriptionContent?: string;
  thankYou?: { message?: string } | null;
  coverUrl?: string | null;
  priceMinor: string;
  currency: 'NGN' | 'USD';
  currencyOptions: Array<{ currency: string; amountMinor: string }>;
  minAmountMinor: string | null;
  amountType: 'fixed' | 'customer_chooses';
  maxSales: number | null;
  refundWindowDays: number;
  status: 'draft' | 'published' | 'archived';
};

const toMinor = (value: string, currency = 'NGN') => {
  try {
    return decimalToCurrencyMinor(value, currency).toString();
  } catch {
    return null;
  }
};

const money = (minor: string, currency = 'NGN') =>
  new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency,
    maximumFractionDigits: 2,
  }).format(Number(currencyMinorToDecimal(minor || '0', currency)));

export default function EditProductForm({ productId }: { productId: string }) {
  const router = useRouter();
  const [product, setProduct] = useState<ProductData | null>(null);
  const [title, setTitle] = useState('');
  const [slug, setSlug] = useState('');
  const [description, setDescription] = useState('');
  const [descriptionText, setDescriptionText] = useState('');
  const [buyerConfirmation, setBuyerConfirmation] = useState('');
  const [coverUrl, setCoverUrl] = useState<string | null>(null);
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [coverPreviewUrl, setCoverPreviewUrl] = useState<string | null>(null);
  const [coverError, setCoverError] = useState('');
  const [coverPickerOpen, setCoverPickerOpen] = useState(false);
  const [coverAssetId, setCoverAssetId] = useState<string | null>(null);
  const [price, setPrice] = useState('');
  const [amountType, setAmountType] = useState<'fixed' | 'customer_chooses'>('fixed');
  const [refundWindowDays, setRefundWindowDays] = useState('0');
  const [maxSales, setMaxSales] = useState('');
  const [status, setStatus] = useState<ProductData['status']>('draft');
  const [currency, setCurrency] = useState<'NGN' | 'USD'>('NGN');
  const [contentAttested, setContentAttested] = useState(false);
  const [contentReady, setContentReady] = useState(true);
  const [courseStep, setCourseStep] = useState<0 | 1 | 2>(0);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [busyIntent, setBusyIntent] = useState<'draft' | 'publish' | 'save' | null>(null);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [notice, setNotice] = useState('');
  const [publishCelebrating, setPublishCelebrating] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [delivery, setDelivery] = useState<DeliveryFormState>({
    mode: 'uploaded_files',
    externalUrl: '',
    readyFileCount: 0,
    loaded: false,
    busy: false,
  });

  const onDeliveryChange = useCallback((next: DeliveryFormState) => {
    setDelivery(next);
    setFieldErrors((current) => (current.delivery ? { ...current, delivery: '' } : current));
    setError('');
  }, []);

  const finishPublishCelebration = useCallback(() => {
    setPublishCelebrating(false);
    router.replace('/workspace/products');
    router.refresh();
  }, [router]);

  useEffect(() => {
    let active = true;
    setDelivery({
      mode: 'uploaded_files',
      externalUrl: '',
      readyFileCount: 0,
      loaded: false,
      busy: false,
    });
    void fetch(`/api/workspace/products/${encodeURIComponent(productId)}`, { cache: 'no-store' })
      .then(async (response) => {
        const payload = await response.json().catch(() => ({}));
        if (response.status === 401) {
          router.replace(`/login?next=${encodeURIComponent(window.location.pathname)}`);
          return null;
        }
        if (!response.ok) throw new Error(payload.error || 'Product could not be loaded.');
        const row = payload.product as ProductData;
        if (!active || !row) return;
        setProduct(row);
        setTitle(row.title);
        setSlug(row.slug);
        setDescription(row.descriptionContent ?? row.description);
        setDescriptionText(row.description);
        setBuyerConfirmation(row.thankYou?.message ?? '');
        setCoverUrl(row.coverUrl ?? null);
        setCurrency(row.currency ?? 'NGN');
        setPrice(currencyMinorToDecimal(row.priceMinor, row.currency ?? 'NGN'));
        setAmountType(row.amountType);
        setRefundWindowDays(String(row.refundWindowDays));
        setMaxSales(row.maxSales === null ? '' : String(row.maxSales));
        setStatus(row.status);
      })
      .catch((cause) => {
        if (active) setError(cause instanceof Error ? cause.message : 'Product could not be loaded.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [productId]);

  useEffect(() => {
    if (!coverFile) {
      setCoverPreviewUrl(coverUrl);
      return;
    }
    const previewUrl = URL.createObjectURL(coverFile);
    setCoverPreviewUrl(previewUrl);
    return () => URL.revokeObjectURL(previewUrl);
  }, [coverFile, coverUrl]);

  const isCourse = product?.type === 'course';
  const isBundle = product?.type === 'bundle';
  const typeName =
    product?.type === 'payment_link'
      ? 'Payment link'
      : product?.type === 'download'
        ? 'Digital download'
        : product?.type === 'bundle'
          ? 'Bundle'
          : 'Course';

  const typeCopy =
    product?.type === 'payment_link'
      ? {
          title: 'Name',
          titlePlaceholder: 'Design deposit',
          link: 'Payment link',
          description: 'Description',
          descriptionPlaceholder: 'What is the buyer paying for, and what happens next?',
          priceHeading: 'Set your payment link price',
          priceHint: 'Choose a fixed amount or let customers choose what to pay.',
        }
      : product?.type === 'download'
        ? {
            title: 'Name',
            titlePlaceholder: 'Enter a name for this download',
            link: 'Download page link',
            description: 'Description',
            descriptionPlaceholder: 'What files or resources will buyers receive?',
            priceHeading: 'Set your download price',
            priceHint: 'Set the price buyers will pay to access your digital files.',
          }
        : product?.type === 'bundle'
          ? {
              title: 'Name',
              titlePlaceholder: 'The Creator Starter Bundle',
              link: 'Bundle page link',
              description: 'Description',
              descriptionPlaceholder:
                'Which outcomes or resources does this collection bring together?',
              priceHeading: 'Set your bundle price',
              priceHint:
                'Set one price for the complete bundle. Included products must share its currency.',
            }
          : {
              title: 'Course title',
              titlePlaceholder: 'The Complete Masterclass',
              link: 'Course page link',
              description: 'Course description',
              descriptionPlaceholder: 'What will learners be able to do after this course?',
              priceHeading: 'Set your course price',
              priceHint: 'Set the price learners will pay to enroll in your course.',
            };

  const priceField =
    amountType === 'customer_chooses' && product?.type === 'payment_link'
      ? 'Minimum amount'
      : 'Price';

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setNotice('');
    setFieldErrors({});
    if (!product) return;

    const submitter = (event.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null;
    const intent = submitter?.value ?? 'save';

    if (isCourse && intent === 'publish' && !contentReady) {
      toast.error('Add and publish at least one complete lesson in the curriculum before publishing.');
      setCourseStep(1);
      return;
    }

    if (product.type === 'download' && !delivery.loaded) {
      setError('Delivery details are still loading. Wait a moment and try again.');
      return;
    }
    if (product.type === 'download' && delivery.busy) {
      setError('Wait for the file operation to finish before saving or publishing.');
      return;
    }
    if (intent === 'publish' && product.type === 'download') {
      if (delivery.mode === 'uploaded_files' && delivery.readyFileCount === 0) {
        setFieldErrors({
          delivery: 'Add at least one ready file, or switch to an external HTTPS link, before publishing.',
        });
        document.getElementById('edit-delivery')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        return;
      }
      if (delivery.mode === 'uploaded_files' && !buyerConfirmation.trim()) {
        setFieldErrors({ delivery: 'Add a confirmation message buyers will see after purchase.' });
        document.getElementById('edit-buyer-confirmation')?.focus();
        return;
      }
      if (delivery.mode === 'external_link') {
        try {
          const url = new URL(delivery.externalUrl.trim());
          if (url.protocol !== 'https:' || !url.hostname || url.username || url.password)
            throw new Error();
        } catch {
          setFieldErrors({ delivery: 'Enter a valid HTTPS delivery link before publishing.' });
          document.getElementById('external-download-url')?.focus();
          return;
        }
      }
    }

    const invalid: Record<string, string> = {};
    if (title.trim().length < 3) invalid.title = 'Enter a name with at least 3 characters.';
    if (descriptionText.trim().length < 10)
      invalid.description = 'Add a description with at least 10 characters.';

    if (Object.keys(invalid).length) {
      setFieldErrors(invalid);
      if (isCourse && courseStep !== 0) setCourseStep(0);
      setTimeout(() => {
        document
          .getElementById(
            Object.keys(invalid)[0] === 'title'
              ? 'edit-title'
              : 'edit-description',
          )
          ?.focus();
      }, 50);
      return;
    }

    const priceMinor = toMinor(price, currency);
    if (!priceMinor) {
      setFieldErrors({ price: `Enter a valid ${currency} amount with up to two decimal places.` });
      if (isCourse && courseStep !== 2) setCourseStep(2);
      setTimeout(() => document.getElementById('edit-price')?.focus(), 50);
      return;
    }
    if (product.type === 'payment_link' && amountType === 'fixed' && BigInt(priceMinor) <= 0n) {
      setFieldErrors({ price: 'Payment links need a positive amount.' });
      document.getElementById('edit-price')?.focus();
      return;
    }
    if (currency === 'NGN' && BigInt(priceMinor) > 0n && BigInt(priceMinor) < 10_000n) {
      setFieldErrors({ price: 'Paid NGN products start at ₦100.' });
      if (isCourse && courseStep !== 2) setCourseStep(2);
      setTimeout(() => document.getElementById('edit-price')?.focus(), 50);
      return;
    }

    if (intent === 'publish' && product.type !== 'payment_link' && !contentAttested) {
      setFieldErrors({
        attestation: 'Confirm you have the right to sell this content before publishing.',
      });
      if (isCourse && courseStep !== 2) setCourseStep(2);
      setTimeout(() => {
        const field = document.getElementById('edit-content-attestation');
        field?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        field?.focus();
      }, 50);
      return;
    }

    const nextStatus: ProductData['status'] =
      intent === 'draft' ? 'draft' : intent === 'publish' ? 'published' : status;

    setBusy(true);
    setBusyIntent(intent === 'draft' || intent === 'publish' ? intent : 'save');
    try {
      const response = await fetch(`/api/workspace/products/${encodeURIComponent(productId)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: product.type,
          title,
          slug,
          description,
          priceMinor,
          currency,
          currencyOptions: [],
          amountType,
          minAmountMinor:
            product.type === 'payment_link' && amountType === 'customer_chooses'
              ? priceMinor
              : undefined,
          status: nextStatus,
          contentAttested,
          maxSales: maxSales ? Number(maxSales) : null,
          refundWindowDays: Number(refundWindowDays),
          thankYou: { message: buyerConfirmation },
          ...(product.type === 'download'
            ? {
                deliveryMode: delivery.mode,
                externalUrl: delivery.mode === 'external_link' ? delivery.externalUrl.trim() || null : null,
              }
            : {}),
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        if (response.status === 402) window.dispatchEvent(new Event('onselli:open-pricing'));
        throw new Error(payload.error || 'Changes could not be saved.');
      }
      setProduct(payload.product);
      setStatus(nextStatus);

      if (coverFile) {
        const body = new FormData();
        body.set('cover', coverFile);
        const coverResponse = await fetch(
          `/api/workspace/products/${encodeURIComponent(productId)}/cover`,
          { method: 'POST', body },
        );
        const coverPayload = await coverResponse.json().catch(() => ({}));
        if (!coverResponse.ok) {
          setNotice('Product details were saved.');
          throw new Error(
            coverPayload.error || 'Product details were saved, but the cover image could not be uploaded.',
          );
        }
        setCoverUrl(coverPayload.cover?.url ?? null);
        setCoverFile(null);
      }

      if (intent === 'draft') {
        toast.success('Draft saved.');
        router.push('/workspace/products');
        router.refresh();
        return;
      }

      if (intent === 'save') {
        toast.success('Changes saved.');
        router.push('/workspace/products');
        router.refresh();
        return;
      }

      if (nextStatus === 'published' && product.status !== 'published') {
        setNotice('');
        setPublishCelebrating(true);
      } else {
        setNotice('Changes saved.');
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Changes could not be saved.');
      document.getElementById('edit-form-error')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    } finally {
      setBusy(false);
      setBusyIntent(null);
    }
  }

  if (loading) {
    return (
      <div
        className="creator-dashboard__body studio-overview product-editor product-create product-create--single-page product-edit--single-page product-editor--loading"
        aria-busy="true"
        aria-label="Loading product editor"
      >
        <span className="sr-only" role="status">
          Loading product…
        </span>
        <header className="product-create__topbar">
          <span className="product-create__loading-back" />
          <span className="product-editor__loading-title" />
          <div className="product-create__top-actions">
            <span />
            <span />
            <span />
          </div>
        </header>
        <div className="product-editor__layout">
          <section className="product-editor__form">
            <div className="product-create__section">
              <div className="product-editor__loading-field">
                <i />
                <b />
              </div>
              <div className="product-editor__loading-field">
                <i />
                <b className="is-tall" />
              </div>
            </div>
          </section>
        </div>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="product-editor__error" role="alert">
        {error || 'Product could not be found.'}
        <Link href="/workspace/products">Back to products</Link>
      </div>
    );
  }

  return (
    <div className="creator-dashboard__body studio-overview product-editor product-create product-create--single-page product-edit--single-page">
      <header className="product-create__topbar">
        <Link
          href="/workspace/products"
          className="product-create__back"
          aria-label="Back to products"
          title="Back to products"
        >
          <ArrowLeft size={21} />
        </Link>
        <h1>Edit your {typeName.toLowerCase()}</h1>
        <div className="product-create__top-actions">
          <button
            type="button"
            className="product-create__preview-toggle"
            onClick={() => setPreviewOpen((open) => !open)}
            aria-label={previewOpen ? 'Hide buyer preview' : 'Show buyer preview'}
            aria-expanded={previewOpen}
            aria-haspopup="dialog"
            title="Preview"
          >
            {previewOpen ? <EyeOff size={20} /> : <Eye size={20} />}
          </button>
          <button
            className="product-create__save-draft"
            type="submit"
            form="product-edit-form"
            name="intent"
            value="draft"
            disabled={busy || (product.type === 'download' && delivery.busy)}
            aria-busy={busy && busyIntent === 'draft'}
          >
            {busy && busyIntent === 'draft' ? (
              <>
                Saving draft… <Loader2 size={16} className="product-create__button-spinner" />
              </>
            ) : (
              'Save as draft'
            )}
          </button>
          {isCourse && courseStep < 2 ? (
            <button
              type="button"
              className="product-create__publish"
              onClick={() => setCourseStep((s) => (s + 1) as 1 | 2)}
            >
              {courseStep === 0 ? 'Continue to curriculum' : 'Continue to pricing'}
            </button>
          ) : (
            <button
              className="product-create__publish"
              type="submit"
              form="product-edit-form"
              name="intent"
              value={status === 'published' || status === 'archived' ? 'save' : 'publish'}
              disabled={busy || (product.type === 'download' && delivery.busy)}
              aria-busy={busy && (busyIntent === 'publish' || busyIntent === 'save')}
            >
              {busy ? (
                <>
                  {busyIntent === 'publish' ? 'Publishing…' : 'Saving…'}{' '}
                  <Loader2 size={16} className="product-create__button-spinner" />
                </>
              ) : status === 'published' || status === 'archived' ? (
                'Save changes'
              ) : (
                'Publish'
              )}
            </button>
          )}
        </div>
      </header>

      {/* Symmetrical Course Stepper Navigation */}
      {isCourse && (
        <nav className="course-create-steps" aria-label="Course setup steps">
          {['Basics', 'Curriculum', 'Pricing & publish'].map((label, index) => (
            <button
              type="button"
              key={label}
              className={courseStep === index ? 'is-current' : 'is-complete'}
              onClick={() => setCourseStep(index as 0 | 1 | 2)}
              aria-current={courseStep === index ? 'step' : undefined}
            >
              <span>{index + 1}</span>
              {label}
            </button>
          ))}
        </nav>
      )}

      <form id="product-edit-form" className="product-editor__layout" onSubmit={save} noValidate>
        <section className="product-editor__form" data-product-type={product.type}>
          {error && (
            <p className="form-error" id="edit-form-error" role="alert">
              {error}
            </p>
          )}
          {notice && (
            <p className="product-library__notice" role="status">
              {notice}
            </p>
          )}

          {/* STEP 0: Basics */}
          <section
            className="product-create__section"
            hidden={isCourse && courseStep !== 0}
            aria-hidden={isCourse && courseStep !== 0}
          >
            {isCourse && (
              <div className="course-create-step-heading">
                <h2>Course basics & details</h2>
                <p>Edit course title, overview description, cover image, and your storefront link.</p>
              </div>
            )}
            <div className={`field ${fieldErrors.title ? 'has-error' : ''}`}>
              <label htmlFor="edit-title">{typeCopy.title}</label>
              <input
                id="edit-title"
                aria-invalid={Boolean(fieldErrors.title)}
                aria-describedby={fieldErrors.title ? 'edit-title-error' : undefined}
                value={title}
                onChange={(event) => {
                  setTitle(event.target.value);
                  setFieldErrors((current) => ({ ...current, title: '' }));
                }}
                required
                minLength={3}
                maxLength={140}
                placeholder={typeCopy.titlePlaceholder}
              />
              {fieldErrors.title && (
                <p className="field-error" id="edit-title-error" role="alert">
                  {fieldErrors.title}
                </p>
              )}
            </div>

            <div className={`field ${fieldErrors.description ? 'has-error' : ''}`}>
              <label htmlFor="edit-description">{typeCopy.description}</label>
              <ProductDescriptionEditor
                id="edit-description"
                value={description}
                invalid={Boolean(fieldErrors.description)}
                describedBy={fieldErrors.description ? 'edit-description-error' : undefined}
                onChange={(json, text) => {
                  setDescription(json);
                  setDescriptionText(text);
                  setFieldErrors((current) => ({ ...current, description: '' }));
                }}
                placeholder={typeCopy.descriptionPlaceholder}
              />
              <small>{descriptionText.length.toLocaleString()} / 6,000 characters</small>
              {fieldErrors.description && (
                <p className="field-error" id="edit-description-error" role="alert">
                  {fieldErrors.description}
                </p>
              )}
            </div>

            <div className={`field ${coverError ? 'has-error' : ''}`}>
              <label>
                Cover image <span className="studio-optional">Optional</span>
              </label>
              <div className="cover-image-picker">
                <button
                  type="button"
                  className="product-create__cover-upload"
                  onClick={() => setCoverPickerOpen(true)}
                  aria-label={coverPreviewUrl ? 'Change cover image' : 'Add cover image'}
                >
                  {coverPreviewUrl ? (
                    <>
                      <img src={coverPreviewUrl} alt="" />
                      <span className="product-create__cover-change">Change image</span>
                    </>
                  ) : (
                    <>
                      <ImagePlus size={22} aria-hidden="true" />
                      <strong>Add cover image</strong>
                    </>
                  )}
                </button>
                <div className="product-create__cover-guidance">
                  <strong>
                    {coverFile?.name || (coverPreviewUrl ? 'Cover image added' : 'Add a cover buyers will recognize')}
                  </strong>
                  <span>Use a square image for the best fit. Recommended size: 1080 × 1080 px.</span>
                  <small>JPG, PNG, WebP or GIF · up to 8 MB</small>
                  {coverPreviewUrl && (
                    <button
                      type="button"
                      onClick={() => {
                        setCoverFile(null);
                        setCoverAssetId(null);
                        setCoverError('');
                      }}
                    >
                      Remove image
                    </button>
                  )}
                </div>
              </div>
              <small className="product-create__cover-fallback">
                {coverFile
                  ? 'This image will be uploaded when you save.'
                  : 'No image? We’ll create a clean cover using your title.'}
              </small>
              {coverError && (
                <p className="field-error" role="alert">
                  {coverError}
                </p>
              )}
            </div>
            <div className="product-static-url-display">
              <span className="product-static-url-label">Page link</span>
              <p className="product-static-url-value">
                onselli.com/c/{product.creatorSlug || '...'}/{slug}
              </p>
              <small className="product-static-url-hint">Unique permanent link automatically generated for this product.</small>
            </div>
          </section>

          {/* STEP 1: Curriculum (Course Only) */}
          {isCourse && (
            <section
              className="product-create__section"
              hidden={courseStep !== 1}
              aria-hidden={courseStep !== 1}
            >
              <div className="course-create-step-heading">
                <h2>Course curriculum & syllabus</h2>
                <p>
                  Organize your course into modules with video lessons and written guides.
                </p>
              </div>
              <CourseCurriculumEditor
                key={product.id}
                productId={product.id}
                onReadyChange={setContentReady}
              />
            </section>
          )}

          {/* STEP 2: Pricing, Settings & Confirmation */}
          <section
            className="product-create__section"
            hidden={isCourse && courseStep !== 2}
            aria-hidden={isCourse && courseStep !== 2}
          >
            {isCourse && (
              <div className="course-create-step-heading">
                <h2>Pricing & access settings</h2>
                <p>Set what learners pay to enroll, sales caps, and confirmation message.</p>
              </div>
            )}
            {!isCourse && <h2>{typeCopy.priceHeading}</h2>}
            <p className="product-editor__intro">
              {typeCopy.priceHint} Prices are set in NGN or USD.
            </p>

            {product.type === 'payment_link' && (
              <div className="field">
                <label htmlFor="edit-amount-type">Amount</label>
                <WorkspaceSelect
                  id="edit-amount-type"
                  value={amountType}
                  onChange={(event) => {
                    const next = event.target.value as typeof amountType;
                    setAmountType(next);
                    if (next === 'customer_chooses') setCurrency('NGN');
                  }}
                >
                  <option value="fixed">Fixed amount</option>
                  <option value="customer_chooses">Customer chooses amount (NGN)</option>
                </WorkspaceSelect>
              </div>
            )}

            {!(product.type === 'payment_link' && amountType === 'customer_chooses') && (
              <div className="field">
                <label htmlFor="edit-currency">Main price currency</label>
                <WorkspaceSelect
                  id="edit-currency"
                  value={currency}
                  onChange={(event) => setCurrency(event.target.value as 'NGN' | 'USD')}
                >
                  <option value="NGN">NGN</option>
                  <option value="USD">USD</option>
                </WorkspaceSelect>
                <small>
                  USD checkout can show supported local currencies and methods when enabled on your
                  Bachs account. NGN stays in naira.
                </small>
              </div>
            )}

            <div className={`field ${fieldErrors.price ? 'has-error' : ''}`}>
              <label htmlFor="edit-price">
                {priceField} ({currency})
              </label>
              <div className="studio-naira-input">
                <span>{currency === 'NGN' ? '₦' : '$'}</span>
                <input
                  id="edit-price"
                  aria-invalid={Boolean(fieldErrors.price)}
                  aria-describedby={fieldErrors.price ? 'edit-price-error' : undefined}
                  value={price}
                  onChange={(event) => {
                    setPrice(event.target.value);
                    setFieldErrors((current) => ({ ...current, price: '' }));
                  }}
                  inputMode="decimal"
                  required
                />
                <small>{currency}</small>
              </div>
              <small>Use 0 for a free product. Paid NGN products start at ₦100.</small>
              {fieldErrors.price && (
                <p className="field-error" id="edit-price-error" role="alert">
                  {fieldErrors.price}
                </p>
              )}
            </div>

            <div className="field">
              <label htmlFor="edit-sales-cap">
                Sales limit <span className="studio-optional">Optional</span>
              </label>
              <input
                id="edit-sales-cap"
                type="number"
                min="1"
                step="1"
                value={maxSales}
                onChange={(event) => setMaxSales(event.target.value)}
                placeholder="No limit"
              />
              <small>Leave blank for unlimited sales.</small>
            </div>

            {product.type !== 'payment_link' && product.type !== 'download' && (
              <div
                className={`product-create__attestation${fieldErrors.attestation ? ' has-error' : ''}`}
              >
                <label htmlFor="edit-content-attestation">
                  <input
                    id="edit-content-attestation"
                    type="checkbox"
                    required
                    checked={contentAttested}
                    aria-invalid={Boolean(fieldErrors.attestation)}
                    aria-describedby={
                      fieldErrors.attestation ? 'edit-content-attestation-error' : undefined
                    }
                    onChange={(event) => {
                      setContentAttested(event.target.checked);
                      setFieldErrors((current) => ({ ...current, attestation: '' }));
                    }}
                  />
                  <span>
                    I confirm I own or have permission to sell this content, and it contains no
                    illegal, adult, or prohibited material. See Onselli’s{' '}
                    <a href="/legal/terms" target="_blank" rel="noreferrer">
                      content rules
                    </a>
                    .
                  </span>
                </label>
                {fieldErrors.attestation && (
                  <p className="field-error" id="edit-content-attestation-error" role="alert">
                    {fieldErrors.attestation}
                  </p>
                )}
              </div>
            )}

            {isCourse && (
              <p
                className={`course-create-readiness ${contentReady ? 'is-ready' : ''}`}
                role="status"
                style={{ marginTop: 20 }}
              >
                {contentReady
                  ? '✓ Your curriculum is ready to publish.'
                  : 'Add and publish at least one complete lesson in the Curriculum step before publishing.'}
              </p>
            )}
          </section>

          {/* Bundle & Download Specific Sections */}
          {isBundle && (
            <section className="product-create__section">
              <h2>Choose what buyers get</h2>
              <p className="product-editor__intro">
                Choose 2–20 of your published courses or downloads. Buyers receive every selected
                product.
              </p>
              <BundleItemsEditor key={product.id} productId={product.id} currency={currency} />
            </section>
          )}

          {product.type === 'download' && (
            <section id="edit-delivery" className="product-create__section product-edit__files">
              <h2>Delivery</h2>
              <p className="product-editor__intro">
                Choose what buyers receive. Your choice and any link are saved with the product when
                you save or publish.
              </p>
              <DigitalFileManager
                key={product.id}
                productId={product.id}
                embedded
                onDeliveryChange={onDeliveryChange}
              />
              {fieldErrors.delivery && (
                <p className="field-error" role="alert">
                  {fieldErrors.delivery}
                </p>
              )}
              {delivery.mode === 'uploaded_files' && (
                <div className="product-create__confirmation product-create__confirmation-wrap">
                  <h3>Buyer confirmation message</h3>
                  <p className="product-editor__intro">
                    Required for file delivery. Buyers see this after payment is confirmed.
                  </p>
                  <label className="field" htmlFor="edit-buyer-confirmation">
                    <span className="sr-only">Message to buyers after purchase</span>
                    <textarea
                      id="edit-buyer-confirmation"
                      rows={4}
                      maxLength={500}
                      required={status === 'published'}
                      aria-invalid={status === 'published' && !buyerConfirmation.trim()}
                      value={buyerConfirmation}
                      onChange={(event) => setBuyerConfirmation(event.target.value)}
                      placeholder="Enter confirmation message here"
                    />
                    <small>{buyerConfirmation.length}/500 characters</small>
                  </label>
                </div>
              )}
              <div className={`product-create__attestation${fieldErrors.attestation ? ' has-error' : ''}`}>
                <label htmlFor="edit-content-attestation">
                  <input
                    id="edit-content-attestation"
                    type="checkbox"
                    required
                    checked={contentAttested}
                    aria-invalid={Boolean(fieldErrors.attestation)}
                    aria-describedby={fieldErrors.attestation ? 'edit-content-attestation-error' : undefined}
                    onChange={(event) => {
                      setContentAttested(event.target.checked);
                      setFieldErrors((current) => ({ ...current, attestation: '' }));
                    }}
                  />
                  <span>
                    I confirm I own or have permission to sell this content, and it contains no
                    illegal, adult, or prohibited material. See Onselli’s{' '}
                    <a href="/legal/terms" target="_blank" rel="noreferrer">content rules</a>.
                  </span>
                </label>
                {fieldErrors.attestation && (
                  <p className="field-error" id="edit-content-attestation-error" role="alert">
                    {fieldErrors.attestation}
                  </p>
                )}
              </div>
            </section>
          )}
        </section>
      </form>

      {/* Preview Dialog */}
      {previewOpen && (
        <div
          className="product-create__preview-backdrop"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setPreviewOpen(false);
          }}
        >
          <section
            className="product-create__preview-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="edit-preview-title"
          >
            <header className="product-create__preview-modal-header">
              <div>
                <span>BUYER VIEW</span>
                <h2 id="edit-preview-title">Preview your {typeName.toLowerCase()}</h2>
              </div>
              <button
                className="product-create__preview-close"
                type="button"
                aria-label="Close preview"
                onClick={() => setPreviewOpen(false)}
              >
                <X size={19} />
              </button>
            </header>
            <article className="product-create__preview-card">
              <div
                className={`product-editor__cover product-create__preview-cover product-create__preview-cover--${product.type}`}
              >
                {coverPreviewUrl ? (
                  <img src={coverPreviewUrl} alt="" />
                ) : (
                  <strong>{title || `Your ${typeName.toLowerCase()}`}</strong>
                )}
              </div>
              <div className="product-editor__buyer-content">
                <small>{typeName}</small>
                <h3>{title || `Untitled ${typeName.toLowerCase()}`}</h3>
                <p>
                  {descriptionText ||
                    'Add a short description so buyers know what they will receive.'}
                </p>
                <strong>
                  {price ? money(toMinor(price, currency) ?? '0', currency) : 'Set a price'}
                </strong>
              </div>
            </article>
          </section>
        </div>
      )}
      <ProductMediaPickerModal
        open={coverPickerOpen}
        onOpenChange={setCoverPickerOpen}
        title="Choose a cover image"
        subtitle="Upload a new image or pick one from your Media Library."
        singleMode={true}
        acceptedFileTypes="image/png,image/jpeg,image/webp,image/gif"
        maxFileBytes={8 * 1024 * 1024}
        onUploadFromComputer={(files) => {
          const file = files[0];
          if (!file) return;
          setCoverError('');
          setCoverFile(file);
          setCoverAssetId(null);
          setCoverPreviewUrl(URL.createObjectURL(file));
        }}
        onSelectLibraryAsset={(asset: MediaAsset) => {
          setCoverError('');
          setCoverAssetId(asset.id);
          setCoverPreviewUrl(asset.previewUrl ?? null);
          setCoverFile(null);
        }}
        onAttachSelected={() => {}}
      />
      {publishCelebrating && (
        <ProductPublishCelebration onComplete={finishPublishCelebration} />
      )}
    </div>
  );
}
