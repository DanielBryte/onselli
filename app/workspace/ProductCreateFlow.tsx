'use client';

import WorkspaceSelect from '@/app/components/ui/WorkspaceSelect';
import ProductDescriptionEditor from '@/app/components/ui/ProductDescriptionEditor';
import ChoiceCard from '@/app/components/ui/ChoiceCard';
import Dialog from '@/app/components/ui/Dialog';
import Button from '@/app/components/ui/Button';
import ProductMediaPickerModal, { type MediaAsset } from './products/ProductMediaPickerModal';
import ProductPublishCelebration from '@/app/components/ProductPublishCelebration';

import { FormEvent, useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import {
  ArrowLeft,
  ArrowRight,
  Download,
  Eye,
  EyeOff,
  FilePlus2,
  FolderOpen,
  GraduationCap,
  ImagePlus,
  Loader2,
  Link2,
  PackageOpen,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import { useCreatorWorkspaceIdentity } from './CreatorWorkspaceIdentity';
import { currencyMinorToDecimal, decimalToCurrencyMinor } from '@/lib/money.mjs';
import { normalizeProductDescription } from '@/lib/product-description.mjs';
import { generateProductSlug } from '@/lib/product-slug';
import CourseCurriculumEditor from './products/[productId]/edit/CourseCurriculumEditor';

export type OfferType = 'course' | 'download' | 'payment_link' | 'bundle';
const toCurrencyMinor = (value: string, currency: string) => {
  try {
    return decimalToCurrencyMinor(value, currency).toString();
  } catch {
    return null;
  }
};
const makeSlug = (value: string) =>
  value
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 120);
const DOWNLOAD_ACCEPT = '.pdf,.zip,.epub,.docx,.pptx,.xlsx,.mp3,.m4a,.wav,.ogg,.mp4,.mov,.webm,.png,.jpg,.jpeg,.webp,.gif';
const DOWNLOAD_MAX_FILES = 20;
const DOWNLOAD_MAX_BYTES = 100 * 1024 * 1024;
const isSupportedDownload = (file: File) =>
  DOWNLOAD_ACCEPT.split(',').includes(`.${file.name.split('.').pop()?.toLowerCase() ?? ''}`) &&
  file.size > 0 &&
  file.size <= DOWNLOAD_MAX_BYTES;
const offerTypes: { value: OfferType; label: string; icon: typeof GraduationCap }[] = [
  { value: 'download', label: 'Digital download', icon: Download },
  { value: 'course', label: 'Online course', icon: GraduationCap },
  { value: 'payment_link', label: 'Payment link', icon: Link2 },
  { value: 'bundle', label: 'Bundle', icon: PackageOpen },
];
const typeCopy: Record<
  OfferType,
  {
    noun: string;
    titleLabel: string;
    linkLabel: string;
    descriptionLabel: string;
    detailsHeading: string;
    detailsHint: string;
    pricingHint: string;
    nextStep: string;
  }
> = {
  course: {
    noun: 'course',
    titleLabel: 'Name',
    linkLabel: 'Course page link',
    descriptionLabel: 'Description',
    detailsHeading: 'Describe your course',
    detailsHint: 'Tell learners what they will learn and who the course is for.',
    pricingHint: 'Set the price learners will pay to enroll in your course.',
    nextStep: 'Build and save the course curriculum before publishing.',
  },
  download: {
    noun: 'digital download',
    titleLabel: 'Name',
    linkLabel: 'Download page link',
    descriptionLabel: 'Description',
    detailsHeading: 'Describe your download',
    detailsHint: 'Tell buyers what files or resources they will receive.',
    pricingHint: 'Set the price buyers will pay to access your digital files.',
    nextStep:
      'After a successful payment, buyers receive your private files or the saved HTTPS delivery link.',
  },
  payment_link: {
    noun: 'payment link',
    titleLabel: 'Name',
    linkLabel: 'Payment page link',
    descriptionLabel: 'Description',
    detailsHeading: 'What are you collecting payment for?',
    detailsHint: 'Name the payment and explain what the buyer receives after checkout.',
    pricingHint: 'Choose a fixed amount or let customers choose an amount for this payment link.',
    nextStep: 'Review the payment details, then publish the link or save it as a draft.',
  },
  bundle: {
    noun: 'bundle',
    titleLabel: 'Name',
    linkLabel: 'Bundle page link',
    descriptionLabel: 'Description',
    detailsHeading: 'Describe your bundle',
    detailsHint: 'Explain what buyers get from the included courses and downloads.',
    pricingHint: 'Set one price for the complete bundle. Included items must share its currency.',
    nextStep: 'Choose and save at least two published courses or downloads in the same currency.',
  },
};
const money = (minor: string, currency = 'NGN') =>
  new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency,
    maximumFractionDigits: 2,
  }).format(Number(currencyMinorToDecimal(minor || '0', currency)));

export default function ProductCreateFlow({
  type,
  onCancel,
}: {
  type: OfferType;
  onCancel: () => void;
}) {
  const router = useRouter();
  const { workspaceSlug } = useCreatorWorkspaceIdentity();
  const [title, setTitle] = useState('');
  const [slug] = useState(() => generateProductSlug());
  const [description, setDescription] = useState('');
  const [descriptionText, setDescriptionText] = useState('');
  const [price, setPrice] = useState('');
  const [minimumPrice, setMinimumPrice] = useState('100');
  const [currency, setCurrency] = useState<'NGN' | 'USD'>('NGN');
  const [amountType, setAmountType] = useState<'fixed' | 'customer_chooses'>('fixed');
  const [deliveryMode, setDeliveryMode] = useState<'uploaded_files' | 'external_link'>(
    'uploaded_files',
  );
  const [externalUrl, setExternalUrl] = useState('');
  const [buyerConfirmation, setBuyerConfirmation] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [libraryFiles, setLibraryFiles] = useState<Array<{ id: string; name: string; contentType: string; sizeBytes: string; previewUrl: string | null }>>([]);
  const [selectedLibraryFiles, setSelectedLibraryFiles] = useState<string[]>([]);
  const [libraryPickerOpen, setLibraryPickerOpen] = useState(false);
  const [contentAttested, setContentAttested] = useState(false);
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [coverPreviewUrl, setCoverPreviewUrl] = useState<string | null>(null);
  const [coverPickerOpen, setCoverPickerOpen] = useState(false);
  const [coverAssetId, setCoverAssetId] = useState<string | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const previewCloseRef = useRef<HTMLButtonElement>(null);
  const [uploadProgress, setUploadProgress] = useState<{ name: string; percent: number } | null>(
    null,
  );
  const [createdProductId, setCreatedProductId] = useState<string | null>(null);
  const [courseStep, setCourseStep] = useState<0 | 1 | 2>(0);
  const [maxSales, setMaxSales] = useState('');
  const [contentReady, setContentReady] = useState(false);
  const [bundleProducts, setBundleProducts] = useState<
    Array<{ id: string; title: string; type: string; status: string; currency: string; priceMinor: string }>
  >([]);
  const [bundleSelection, setBundleSelection] = useState<string[]>([]);
  const [bundleLoading, setBundleLoading] = useState(false);
  const [bundleError, setBundleError] = useState('');
  const [bundleRefresh, setBundleRefresh] = useState(0);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [publishCelebrating, setPublishCelebrating] = useState(false);
  const [activeSubmitIntent, setActiveSubmitIntent] = useState<'draft' | 'published' | null>(null);
  const finishPublishCelebration = useCallback(() => {
    setPublishCelebrating(false);
    onCancel();
    router.replace('/workspace/products');
    router.refresh();
  }, [onCancel, router]);
  const eligibleBundleProducts = bundleProducts.filter(
    (product) => product.status === 'published' && product.currency === currency,
  );
  const bundleReady =
    bundleSelection.length >= 2 &&
    bundleSelection.length <= 20 &&
    bundleSelection.every((id) => eligibleBundleProducts.some((product) => product.id === id));
  const selected = offerTypes.find((item) => item.value === type)!;
  const copy = typeCopy[type];
  const chosenAmount =
    type === 'payment_link' && amountType === 'customer_chooses' ? minimumPrice : price;
  const displayMinor = toCurrencyMinor(chosenAmount, currency);
  const reportContentReady = useCallback((ready: boolean) => setContentReady(ready), []);
  const clearFieldError = (field: string) =>
    setFieldErrors((current) => (current[field] ? { ...current, [field]: '' } : current));

  useEffect(() => {
    if (!coverFile) {
      setCoverPreviewUrl(null);
      return;
    }
    const previewUrl = URL.createObjectURL(coverFile);
    setCoverPreviewUrl(previewUrl);
    return () => URL.revokeObjectURL(previewUrl);
  }, [coverFile]);

  useEffect(() => {
    if (!previewOpen) return;
    const previousFocus = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    previewCloseRef.current?.focus();
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setPreviewOpen(false);
      if (event.key === 'Tab') {
        event.preventDefault();
        previewCloseRef.current?.focus();
      }
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', closeOnEscape);
      previousFocus?.focus();
    };
  }, [previewOpen]);

  async function prepareContentDraft(exitAfter = false) {
    if (createdProductId || (type !== 'course' && type !== 'bundle')) {
      if (exitAfter) {
        toast.success('Draft saved.');
        onCancel();
        router.push('/workspace/products');
        router.refresh();
      }
      return;
    }
    if (title.trim().length < 3 || descriptionText.trim().length < 10 || descriptionText.length > 6000) {
      setFieldErrors({
        title: title.trim().length < 3 ? 'Enter at least 3 characters.' : '',
        description: descriptionText.trim().length < 10 ? 'Add at least 10 characters.' : descriptionText.length > 6000 ? 'Keep the description under 6,000 characters.' : '',
      });
      return;
    }
    setBusy(true);
    try {
      const response = await fetch('/api/workspace/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type,
          title,
          slug,
          description,
          priceMinor: '0',
          currency,
          currencyOptions: [],
          status: 'draft',
          amountType: 'fixed',
          maxSales: null,
          refundWindowDays: 0,
        }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || !result.product?.id) {
        if (response.status === 409) {
          setFieldErrors({ slug: result.error ?? 'Choose a different page link.' });
          return;
        }
        throw new Error(result.error ?? `Your ${copy.noun} draft could not be prepared.`);
      }
      setCreatedProductId(result.product.id as string);
      if (exitAfter) {
        toast.success('Draft saved.');
        onCancel();
        router.push('/workspace/products');
        router.refresh();
        return;
      }
      if (type === 'course') setCourseStep(1);
      toast.success('Draft started.');
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : `Your ${copy.noun} draft could not be prepared.`);
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    if (type !== 'bundle') return;
    const controller = new AbortController();
    setBundleLoading(true);
    fetch('/api/workspace/products', { cache: 'no-store', signal: controller.signal })
      .then(async (response) => { const payload = await response.json().catch(() => ({})); if (!response.ok) throw new Error(payload.error ?? 'Products could not be loaded.'); return payload; })
      .then((payload) => setBundleProducts(Array.isArray(payload.products) ? payload.products.filter((p: {type:string;id:string}) => ['course','download'].includes(p.type) && p.id !== createdProductId) : []))
      .catch((cause) => { if (!controller.signal.aborted) setBundleError(cause instanceof Error ? cause.message : 'Products could not be loaded.'); })
      .finally(() => { if (!controller.signal.aborted) setBundleLoading(false); });
    return () => controller.abort();
  }, [type, createdProductId, bundleRefresh]);

  function uploadFile(url: string, contentType: string, file: File) {
    return new Promise<void>((resolve, reject) => {
      const request = new XMLHttpRequest();
      request.open('PUT', url);
      request.setRequestHeader('Content-Type', contentType);
      request.upload.onprogress = (event) => {
        if (event.lengthComputable)
          setUploadProgress({
            name: file.name,
            percent: Math.round((event.loaded / event.total) * 100),
          });
      };
      request.onerror = () =>
        reject(new Error('The browser could not reach file storage. Check your connection and confirm the R2 bucket CORS policy allows PUT requests from this app origin with the Content-Type header.'));
      request.onabort = () => reject(new Error('Upload was interrupted. You can retry.'));
      request.ontimeout = () => reject(new Error('The upload timed out before storage responded. Check your connection and R2 bucket availability, then try again.'));
      request.timeout = 120_000;
      request.onload = () =>
        request.status >= 200 && request.status < 300
          ? resolve()
          : reject(new Error(`Storage rejected the file (HTTP ${request.status}). Check the R2 bucket CORS policy and upload permissions.`));
      request.send(file);
    });
  }

  async function uploadCover(productId: string, file: File) {
    const body = new FormData();
    body.set('cover', file);
    const response = await fetch(`/api/workspace/products/${encodeURIComponent(productId)}/cover`, {
      method: 'POST',
      body,
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.error ?? 'Your cover image could not be uploaded.');
  }

  function openMediaPicker() {
    setLibraryPickerOpen(true);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const submitter = (event.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null;
    const requestedStatus: 'draft' | 'published' =
      submitter?.value === 'draft' ? 'draft' : 'published';
    setFieldErrors({});
    setBundleError('');
    if (type === 'course' && requestedStatus === 'published' && !contentReady) {
      toast.error('Finish and save a publish-ready course curriculum before publishing.');
      return;
    }
    if (type === 'bundle' && requestedStatus === 'published' && !bundleReady) {
      setBundleError('Choose at least two published courses or downloads in the selected currency.');
      return;
    }
    if (type === 'bundle' && bundleSelection.length === 1) {
      setBundleError('Select one more product, or remove this selection to save an empty draft.');
      return;
    }
    if (
      title.trim().length < 3 ||
      descriptionText.trim().length < 10 || descriptionText.length > 6000
    ) {
      setFieldErrors({
        title: title.trim().length < 3 ? 'Enter at least 3 characters.' : '',
        description: descriptionText.trim().length < 10 ? 'Add at least 10 characters.' : descriptionText.length > 6000 ? 'Keep the description under 6,000 characters.' : '',
      });
      return;
    }
    const priceMinor = toCurrencyMinor(chosenAmount, currency);
    if (!priceMinor) {
      setFieldErrors({ price: `Enter a valid ${currency} amount.` });
      return;
    }
    if (type === 'payment_link' && amountType === 'fixed' && BigInt(priceMinor) <= 0n) {
      setFieldErrors({ price: 'Enter a positive amount.' });
      return;
    }
    if (currency === 'NGN' && BigInt(priceMinor) > 0n && BigInt(priceMinor) < 10_000n) {
      setFieldErrors({ price: 'Paid NGN offers start at ₦100.' });
      return;
    }
    if (
      type === 'download' &&
      requestedStatus === 'published' &&
      deliveryMode === 'uploaded_files' &&
      (!files.length && !selectedLibraryFiles.length)
    ) {
      setFieldErrors({ delivery: 'Add at least one file before publishing this download.' });
      return;
    }
    if (type === 'download' && requestedStatus === 'published' && deliveryMode === 'uploaded_files' && !buyerConfirmation.trim()) {
      setFieldErrors({ delivery: 'Add a confirmation message buyers will see after purchase.' });
      document.getElementById('buyer-confirmation-message')?.focus();
      return;
    }
    if (type === 'download' && deliveryMode === 'uploaded_files' && files.length + selectedLibraryFiles.length > DOWNLOAD_MAX_FILES) {
      setFieldErrors({ delivery: `A download can contain up to ${DOWNLOAD_MAX_FILES} files.` });
      return;
    }
    if (
      type === 'download' &&
      requestedStatus === 'published' &&
      deliveryMode === 'external_link'
    ) {
      try {
        const url = new URL(externalUrl.trim());
        if (url.protocol !== 'https:' || !url.hostname || url.username || url.password)
          throw new Error();
      } catch {
        setFieldErrors({ delivery: 'Enter a valid HTTPS link without a username or password.' });
        return;
      }
    }
    if (type !== 'payment_link' && requestedStatus === 'published' && !contentAttested) {
      setFieldErrors({ attestation: 'Confirm the content meets Onselli’s requirements before publishing.' });
      window.setTimeout(() => {
        const field = document.getElementById('offer-content-attestation');
        field?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        field?.focus();
      }, 0);
      return;
    }
    setBusy(true);
    setActiveSubmitIntent(requestedStatus);
    let createdInThisAttempt = false;
    try {
      let productId = createdProductId;
      if (!productId) {
        const response = await fetch('/api/workspace/products', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type,
            title,
            slug,
            description,
            priceMinor,
            currency,
            currencyOptions: [],
            status: ['course', 'bundle', 'download'].includes(type) ? 'draft' : requestedStatus,
            amountType: type === 'bundle' ? 'fixed' : amountType,
            minAmountMinor:
              type === 'payment_link' && amountType === 'customer_chooses' ? priceMinor : undefined,
            maxSales: maxSales ? Number(maxSales) : null,
            refundWindowDays: 0,
            thankYou: { message: buyerConfirmation },
          }),
        });
        const result = await response.json().catch(() => ({}));
        if (
          response.status === 402 &&
          (result.code === 'PLAN_LIMIT' || result.code === 'UPGRADE_REQUIRED')
        )
          window.dispatchEvent(new Event('onselli:open-pricing'));
        if (response.status === 409) {
          setFieldErrors({ slug: result.error ?? 'Choose a different page link.' });
          setBusy(false);
          setActiveSubmitIntent(null);
          return;
        }
        if (!response.ok || !result.product?.id)
          throw new Error(result.error ?? 'Your product could not be saved.');
        productId = result.product.id as string;
        setCreatedProductId(productId);
        createdInThisAttempt = true;
      } else {
        const updateResponse = await fetch(
          `/api/workspace/products/${encodeURIComponent(productId)}`,
          {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              type,
              title,
              slug,
              description,
              priceMinor,
              currency,
              currencyOptions: [],
              status: 'draft',
              amountType: type === 'bundle' ? 'fixed' : amountType,
              minAmountMinor:
                type === 'payment_link' && amountType === 'customer_chooses'
                  ? priceMinor
                  : undefined,
              maxSales: maxSales ? Number(maxSales) : null,
              refundWindowDays: 0,
              thankYou: { message: buyerConfirmation },
            }),
          },
        );
        const updateResult = await updateResponse.json().catch(() => ({}));
        if (updateResponse.status === 409) {
          setFieldErrors({ slug: updateResult.error ?? 'Choose a different page link.' });
          setBusy(false);
          setActiveSubmitIntent(null);
          return;
        }
        if (!updateResponse.ok)
          throw new Error(updateResult.error ?? 'Your product details could not be updated.');
      }
      const encodedProductId = encodeURIComponent(productId);
      if (coverFile) await uploadCover(productId, coverFile);
      if (type === 'bundle' && bundleSelection.length >= 2) {
        const itemsResponse = await fetch(
          `/api/workspace/products/${encodedProductId}/bundle-items`,
          {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ productIds: bundleSelection }),
          },
        );
        const itemsResult = await itemsResponse.json().catch(() => ({}));
        if (!itemsResponse.ok) {
          setBundleError(
            itemsResult.error ?? 'The selected products could not be added to this bundle.',
          );
          setBusy(false);
          setActiveSubmitIntent(null);
          return;
        }
      }
      if (type === 'download') {
        const deliveryResponse = await fetch(`/api/workspace/products/${encodedProductId}/files`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            deliveryMode,
            externalUrl: deliveryMode === 'external_link' ? externalUrl.trim() : null,
          }),
        });
        const deliveryResult = await deliveryResponse.json().catch(() => ({}));
        if (!deliveryResponse.ok)
          throw new Error(deliveryResult.error ?? 'Delivery settings could not be saved.');
        let remainingFiles = [...files];
        if (deliveryMode === 'uploaded_files') {
          for (const file of files) {
            const initResponse = await fetch(`/api/workspace/products/${encodedProductId}/files`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ fileName: file.name, sizeBytes: file.size }),
            });
            const init = await initResponse.json().catch(() => ({}));
            if (!initResponse.ok)
              throw new Error(init.error ?? `Could not prepare ${file.name} for upload.`);
            await uploadFile(init.uploadUrl, init.contentType, file);
            const completeResponse = await fetch(
              `/api/workspace/products/${encodedProductId}/files/complete`,
              {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ fileId: init.fileId }),
              },
            );
            const complete = await completeResponse.json().catch(() => ({}));
            if (!completeResponse.ok)
              throw new Error(complete.error ?? `Could not verify ${file.name}.`);
            remainingFiles = remainingFiles.filter((item) => item !== file);
            setFiles(remainingFiles);
          }
          for (const assetId of selectedLibraryFiles) {
            const response = await fetch(`/api/workspace/products/${encodedProductId}/files`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ assetId }) });
            const result = await response.json().catch(() => ({}));
            if (!response.ok) throw new Error(result.error ?? 'A selected library file could not be attached.');
          }
        }
        if (requestedStatus === 'published') {
          const publishResponse = await fetch(`/api/workspace/products/${encodedProductId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: 'published', contentAttested }),
          });
          const publishResult = await publishResponse.json().catch(() => ({}));
          if (!publishResponse.ok) {
            if (publishResponse.status === 402)
              window.dispatchEvent(new Event('onselli:open-pricing'));
            throw new Error(
              publishResult.error ?? 'Delivery is ready, but the download could not be published.',
            );
          }
        }
      }
      if (
        (type === 'course' || type === 'bundle' || type === 'payment_link') &&
        requestedStatus === 'published'
      ) {
        const publishResponse = await fetch(`/api/workspace/products/${encodedProductId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: 'published', contentAttested }),
        });
        const publishResult = await publishResponse.json().catch(() => ({}));
        if (!publishResponse.ok) {
          if (publishResponse.status === 402)
            window.dispatchEvent(new Event('onselli:open-pricing'));
          throw new Error(
            publishResult.error ?? `Your ${copy.noun} is ready, but could not be published.`,
          );
        }
      }
      if (requestedStatus === 'draft') {
        toast.success('Draft saved.');
        onCancel();
        router.push('/workspace/products');
        router.refresh();
        return;
      }
      setBusy(false);
      setActiveSubmitIntent(null);
      setUploadProgress(null);
      setPublishCelebrating(true);
      return;
    } catch (cause) {
      const message =
        cause instanceof Error ? cause.message : 'Your product could not be saved. Try again.';
      const recovery =
        type === 'download'
          ? 'Your draft is saved. Review the files or link and try again.'
          : type === 'course'
            ? 'Your course draft and saved curriculum are still available. Review the content and try again.'
            : type === 'bundle'
              ? 'Your bundle draft and saved contents are still available. Review the included products and try again.'
              : 'Your draft is saved. Review the details and retry.';
      toast.error(createdInThisAttempt || createdProductId ? `${message} ${recovery}` : message);
      setBusy(false);
      setActiveSubmitIntent(null);
      setUploadProgress(null);
    }
  }

  return (
    <div className="creator-dashboard__body studio-overview product-editor product-create product-create--single-page">
      <header className="product-create__topbar">
        <button
          type="button"
          className="product-create__back"
          onClick={onCancel}
          aria-label="Back to products"
          title="Back to products"
        >
          <ArrowLeft size={21} />
        </button>
        <h1>{type === 'course' ? 'Create a course' : 'What are you offering?'}</h1>
        <div className="product-create__top-actions">
          <button
            type="button"
            className="product-create__preview-toggle"
            onClick={() => setPreviewOpen((open) => !open)}
            aria-label={previewOpen ? 'Hide buyer preview' : 'Show buyer preview'}
            aria-expanded={previewOpen}
            aria-controls={previewOpen ? 'product-buyer-preview' : undefined}
            aria-haspopup="dialog"
            title={previewOpen ? 'Hide preview' : 'Preview'}
          >
            {previewOpen ? <EyeOff size={20} /> : <Eye size={20} />}
          </button>
          <button
            className="product-create__save-draft"
            type={type === 'course' && courseStep < 2 ? 'button' : 'submit'}
            form={type === 'course' && courseStep < 2 ? undefined : 'product-create-form'}
            name={type === 'course' && courseStep < 2 ? undefined : 'submitIntent'}
            value="draft"
            disabled={busy}
            aria-busy={busy && activeSubmitIntent === 'draft'}
            onClick={
              type === 'course' && courseStep === 0
                ? () => void prepareContentDraft(true)
                : type === 'course' && courseStep === 1
                  ? () => {
                      toast.success('Draft saved.');
                      onCancel();
                      router.push('/workspace/products');
                      router.refresh();
                    }
                  : undefined
            }
          >
            {busy && activeSubmitIntent === 'draft' ? (
              <>
                Saving draft… <Loader2 size={16} className="product-create__button-spinner" />
              </>
            ) : (
              'Save as draft'
            )}
          </button>
          {type === 'course' && courseStep < 2 ? (
            <button
              type="button"
              className="product-create__publish"
              disabled={busy || (courseStep === 1 && !createdProductId)}
              onClick={() => {
                if (courseStep === 0) void prepareContentDraft(false);
                else setCourseStep(2);
              }}
            >
              {busy ? (
                <>
                  Saving… <Loader2 size={16} className="product-create__button-spinner" />
                </>
              ) : courseStep === 0 ? (
                'Save & continue'
              ) : (
                'Continue to pricing'
              )}
            </button>
          ) : (
            <button
              className="product-create__publish"
              type="submit"
              form="product-create-form"
              name="submitIntent"
              value="publish"
              disabled={busy || (type === 'course' && !contentReady)}
              aria-busy={busy && activeSubmitIntent === 'published'}
            >
              {busy && activeSubmitIntent === 'published' ? (
                uploadProgress ? (
                  `Uploading ${uploadProgress.percent}%`
                ) : (
                  <>
                    Publishing… <Loader2 size={16} className="product-create__button-spinner" />
                  </>
                )
              ) : (
                'Publish'
              )}
            </button>
          )}
        </div>
      </header>
      {type === 'course' && (
        <nav className="course-create-steps" aria-label="Course setup steps">
          {['Basics', 'Curriculum', 'Pricing & publish'].map((label, index) => {
            const isAccessible = index === 0 || !!createdProductId;
            return (
              <button
                type="button"
                key={label}
                className={courseStep === index ? 'is-current' : courseStep > index ? 'is-complete' : ''}
                disabled={!isAccessible}
                onClick={() => {
                  if (isAccessible) {
                    setCourseStep(index as 0 | 1 | 2);
                  }
                }}
                aria-current={courseStep === index ? 'step' : undefined}
              >
                <span>{index + 1}</span>
                {label}
              </button>
            );
          })}
        </nav>
      )}
      <form id="product-create-form" className="product-editor__layout" onSubmit={submit} noValidate>
        <section className="product-editor__form" data-product-type={type}>
          {type === 'course' && courseStep === 0 && <section className="course-create-step-heading"><h2>Start with the course basics</h2><p>Give learners a clear idea of what they’ll learn. You can refine these details later.</p></section>}
          <section className="product-create__section" hidden={type === 'course' && courseStep !== 0}>
            <div className={`field ${fieldErrors.title ? 'has-error' : ''}`}>
              <label htmlFor="offer-title">{copy.titleLabel}</label>
              <input
                id="offer-title"
                value={title}
                onChange={(event) => {
                  clearFieldError('title');
                  setTitle(event.target.value);
                }}
                required
                aria-invalid={Boolean(fieldErrors.title)}
                aria-describedby={fieldErrors.title ? 'offer-title-error' : undefined}
                minLength={3}
                maxLength={140}
                placeholder={
                  type === 'course'
                    ? 'The Brand Clarity Course'
                    : type === 'download'
                      ? 'Enter a name for this download'
                      : type === 'bundle'
                        ? 'The Creator Starter Bundle'
                        : 'Design deposit'
                }
              />
              {fieldErrors.title && (
                <p className="field-error" id="offer-title-error" role="alert">
                  {fieldErrors.title}
                </p>
              )}
            </div>
            <div className={`field ${fieldErrors.description ? 'has-error' : ''}`}>
              <label htmlFor="offer-description">{copy.descriptionLabel}</label>
              <ProductDescriptionEditor
                id="offer-description"
                value={description}
                onChange={(json, text) => {
                  clearFieldError('description');
                  setDescription(json);
                  setDescriptionText(text);
                }}
                invalid={Boolean(fieldErrors.description)}
                describedBy={fieldErrors.description ? 'offer-description-error' : undefined}
                placeholder={
                  type === 'course'
                    ? 'What will learners be able to do after this course?'
                    : type === 'download'
                      ? 'What files or resources will buyers receive?'
                      : type === 'bundle'
                        ? 'Which outcomes or resources does this collection bring together?'
                        : 'What is the buyer paying for, and what happens next?'
                }
              />
              <small>{descriptionText.length.toLocaleString()} / 6,000 characters</small>
              {fieldErrors.description && (
                <p className="field-error" id="offer-description-error" role="alert">
                  {fieldErrors.description}
                </p>
              )}
            </div>
            <div className={`field ${fieldErrors.cover ? 'has-error' : ''}`}>
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
                        setCoverPreviewUrl(null);
                        clearFieldError('cover');
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
              {fieldErrors.cover && <p className="field-error" role="alert">{fieldErrors.cover}</p>}
            </div>
            {type === 'download' && <p className="product-editor__callout">{copy.nextStep}</p>}
          </section>
          {type !== 'course' && <section className="product-create__section">
            <h2>Set your {copy.noun} price</h2>
            <p className="product-editor__intro">
              Set your price in NGN or USD.
            </p>
            {type === 'payment_link' && (
              <div className="field">
                <label htmlFor="amount-type">Amount</label>
                <WorkspaceSelect
                  id="amount-type"
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
            {!(type === 'payment_link' && amountType === 'customer_chooses') && (
              <div className="field">
                <label htmlFor="offer-currency">Main price currency</label>
                <WorkspaceSelect
                  id="offer-currency"
                  value={currency}
                  onChange={(event) => {
                    const nextCurrency = event.target.value as 'NGN' | 'USD';
                    if (type === 'bundle' && nextCurrency !== currency) {
                      setBundleSelection((current) =>
                        current.filter((id) =>
                          bundleProducts.some(
                            (product) =>
                              product.id === id &&
                              product.currency === nextCurrency &&
                              product.status === 'published',
                          ),
                        ),
                      );
                      setBundleError('');
                    }
                    setCurrency(nextCurrency);
                  }}
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
              <label htmlFor="offer-price">
                {type === 'payment_link' && amountType === 'customer_chooses'
                  ? 'Minimum amount (NGN)'
                  : `Price (${currency})`}
              </label>
              <div className="studio-naira-input">
                <span>{currency === 'NGN' ? '₦' : '$'}</span>
                <input
                  id="offer-price"
                  aria-invalid={Boolean(fieldErrors.price)}
                  aria-describedby={fieldErrors.price ? 'offer-price-error' : undefined}
                  type="text"
                  inputMode="decimal"
                  value={chosenAmount}
                  onChange={(event) => {
                    clearFieldError('price');
                    return type === 'payment_link' && amountType === 'customer_chooses'
                      ? setMinimumPrice(event.target.value)
                      : setPrice(event.target.value);
                  }}
                  placeholder="0.00"
                  required
                />
              </div>
              <small className="product-create__field-note">
                {currency === 'NGN'
                  ? type === 'payment_link'
                    ? 'Payment links require a positive price. Paid amounts start at ₦100.'
                    : 'Use 0 for a free offer. Paid offers start at ₦100.'
                  : 'Set the amount in USD. Bachs handles supported local currency conversion at checkout.'}
              </small>
              {fieldErrors.price && (
                  <p className="field-error" id="offer-price-error" role="alert">
                  {fieldErrors.price}
                </p>
              )}
            </div>
            <div className="field">
              <label htmlFor="sales-cap">
                Sales limit <span className="studio-optional">Optional</span>
              </label>
              <input
                id="sales-cap"
                type="number"
                min="1"
                step="1"
                value={maxSales}
                onChange={(event) => setMaxSales(event.target.value)}
                placeholder="No limit"
              />
              <small>Leave blank for unlimited sales.</small>
            </div>
          </section>}
          {type === 'course' && (
            <section className="product-create__section" hidden={courseStep !== 1} aria-hidden={courseStep !== 1}>
              <div className="course-create-step-heading"><h2>Build your curriculum</h2><p>Organize the course into modules, then add text, video, or quiz lessons. Upload a video or use a YouTube or Vimeo link.</p></div>
              {createdProductId ? (
                <CourseCurriculumEditor
                  key={createdProductId}
                  productId={createdProductId}
                  onReadyChange={reportContentReady}
                />
              ) : (
                <button
                  className="button button--outline"
                  type="button"
                  onClick={() => void prepareContentDraft()}
                  disabled={busy}
                >
                  Save details to build your curriculum
                </button>
              )}
            </section>
          )}
          {type === 'course' && (
            <section
              className="product-create__section"
              hidden={courseStep !== 2}
              aria-hidden={courseStep !== 2}
            >
              <div className="course-create-step-heading">
                <h2>Set your course price</h2>
                <p>
                  Choose what learners pay. You can save as a draft and publish when the curriculum
                  is ready.
                </p>
              </div>
              <div className="field">
                <label htmlFor="offer-currency">Main price currency</label>
                <WorkspaceSelect
                  id="offer-currency"
                  value={currency}
                  onChange={(event) => setCurrency(event.target.value as 'NGN' | 'USD')}
                >
                  <option value="NGN">NGN</option>
                  <option value="USD">USD</option>
                </WorkspaceSelect>
              </div>
              <div className={`field ${fieldErrors.price ? 'has-error' : ''}`}>
                <label htmlFor="offer-price">Price ({currency})</label>
                <div className="studio-naira-input">
                  <span>{currency === 'NGN' ? '₦' : '$'}</span>
                  <input
                    id="offer-price"
                    inputMode="decimal"
                    value={price}
                    onChange={(event) => {
                      clearFieldError('price');
                      setPrice(event.target.value);
                    }}
                    placeholder="0.00"
                    required
                  />
                </div>
                <small>
                  {currency === 'NGN'
                    ? 'Use 0 for a free course. Paid offers start at ₦100.'
                    : 'Set the amount in USD.'}
                </small>
                {fieldErrors.price && (
                  <p className="field-error" role="alert">
                    {fieldErrors.price}
                  </p>
                )}
              </div>
              <div className="field">
                <label htmlFor="sales-cap">
                  Sales limit <span className="studio-optional">Optional</span>
                </label>
                <input
                  id="sales-cap"
                  type="number"
                  min="1"
                  step="1"
                  value={maxSales}
                  onChange={(event) => setMaxSales(event.target.value)}
                  placeholder="No limit"
                />
              </div>
              <div
                className={`product-create__attestation${fieldErrors.attestation ? ' has-error' : ''}`}
              >
                <label htmlFor="offer-content-attestation">
                  <input
                    id="offer-content-attestation"
                    type="checkbox"
                    required
                    checked={contentAttested}
                    onChange={(event) => {
                      setContentAttested(event.target.checked);
                      clearFieldError('attestation');
                    }}
                  />
                  <span>
                    I confirm I own or have permission to sell this content and it follows Onselli’s{' '}
                    <a href="/legal/terms" target="_blank" rel="noreferrer">
                      content rules
                    </a>
                    .
                  </span>
                </label>
                {fieldErrors.attestation && (
                  <p className="field-error" role="alert">
                    {fieldErrors.attestation}
                  </p>
                )}
              </div>
              <p
                className={`course-create-readiness ${contentReady ? 'is-ready' : ''}`}
                role="status"
              >
                {contentReady
                  ? 'Your curriculum is ready to publish.'
                  : 'Add and publish at least one complete lesson in the Curriculum step before publishing.'}
              </p>
            </section>
          )}
          {type === 'bundle' && (
            <section className="product-create__section">
              <h2>Choose what buyers get</h2>
              <p className="product-editor__intro">
                Choose 2–20 of your published courses or downloads. Buyers receive every selected product.
              </p>
              <div className="bundle-editor product-create__bundle-picker">
                <p className="bundle-editor__count" aria-live="polite">
                  {bundleSelection.length} of 20 selected · {currency} only
                </p>
                {bundleError && bundleProducts.length > 0 && <p className="field-error" role="alert">{bundleError}</p>}
                {bundleLoading ? (
                  <p className="product-create__bundle-message" role="status">Loading your published products…</p>
                ) : bundleError && bundleProducts.length === 0 ? (
                  <div className="product-create__bundle-empty">
                    <strong>Couldn’t load your products</strong>
                    <span>{bundleError}</span>
                    <button className="button button--outline" type="button" onClick={() => setBundleRefresh((value) => value + 1)}>Try again</button>
                  </div>
                ) : bundleProducts.length === 0 ? (
                  <div className="product-create__bundle-empty">
                    <strong>No courses or downloads yet</strong>
                    <span>Publish a course or digital download first. It will appear here to add to your bundle.</span>
                  </div>
                ) : eligibleBundleProducts.length === 0 ? (
                  <div className="product-create__bundle-empty">
                    <strong>No published products in {currency}</strong>
                    <span>Publish a course or download in {currency}, or change the bundle currency above.</span>
                  </div>
                ) : (
                  <div className="bundle-editor__list" role="group" aria-label="Products included in this bundle">
                    {eligibleBundleProducts.map((product) => {
                      const checked = bundleSelection.includes(product.id);
                      return (
                        <label className="bundle-editor__item" key={product.id}>
                          <input
                            type="checkbox"
                            checked={checked}
                            disabled={!checked && bundleSelection.length >= 20}
                            onChange={() => {
                              setBundleError('');
                              setBundleSelection((current) => checked
                                ? current.filter((id) => id !== product.id)
                                : current.length < 20 ? [...current, product.id] : current);
                            }}
                          />
                          <span className="bundle-editor__check" aria-hidden="true">{checked ? '✓' : ''}</span>
                          <span className="bundle-editor__details">
                            <strong>{product.title}</strong>
                            <small>{product.type === 'course' ? 'Online course' : 'Digital download'} · Published</small>
                          </span>
                          <span>{money(product.priceMinor, product.currency)}</span>
                        </label>
                      );
                    })}
                  </div>
                )}
                {bundleProducts.length > 0 && eligibleBundleProducts.length > 0 && bundleSelection.length < 2 && (
                  <small className="product-create__bundle-note">Select at least 2 products before publishing.</small>
                )}
              </div>
            </section>
          )}
          {type === 'download' && (
            <section className="product-create__section">
              <h2>Delivery</h2>
              <p className="product-editor__intro">
                Upload private files or add the secure link buyers receive after payment.
              </p>
              <div
                className="product-editor__delivery-choice"
                role="radiogroup"
                aria-label="Delivery method"
              >
                <ChoiceCard
                  type="radio"
                  name="download-delivery-mode"
                  value="uploaded_files"
                  checked={deliveryMode === 'uploaded_files'}
                  onChange={() => setDeliveryMode('uploaded_files')}
                  label="Upload files"
                  description="Files are delivered after a paid order."
                  icon={<Upload size={17} aria-hidden="true" />}
                  className={deliveryMode === 'uploaded_files' ? 'is-selected' : ''}
                />
                <ChoiceCard
                  type="radio"
                  name="download-delivery-mode"
                  value="external_link"
                  checked={deliveryMode === 'external_link'}
                  onChange={() => setDeliveryMode('external_link')}
                  label="Use a secure link"
                  description="Redirect buyers to a URL after purchase."
                  icon={<Link2 size={17} aria-hidden="true" />}
                  className={deliveryMode === 'external_link' ? 'is-selected' : ''}
                />
              </div>
              {deliveryMode === 'uploaded_files' ? (
                <div className={`product-editor__upload-box ${fieldErrors.delivery ? 'has-error' : ''}`}>
                  <input
                    id="download-files"
                    aria-invalid={Boolean(fieldErrors.delivery)}
                    aria-describedby={fieldErrors.delivery ? 'download-delivery-error' : undefined}
                    type="file"
                    accept={DOWNLOAD_ACCEPT}
                    multiple
                    onChange={(event) => {
                      const selectedFiles = Array.from(event.target.files ?? []);
                      const invalid = selectedFiles.find((file) => !isSupportedDownload(file));
                      if (invalid) {
                        setFieldErrors({ delivery: `${invalid.name} is unsupported or larger than 100 MB.` });
                        event.target.value = '';
                        return;
                      }
                      const merged = [...files, ...selectedFiles];
                      if (merged.length > DOWNLOAD_MAX_FILES) {
                        setFieldErrors({ delivery: `Choose up to ${DOWNLOAD_MAX_FILES} files.` });
                        event.target.value = '';
                        return;
                      }
                      clearFieldError('delivery');
                      setFiles(merged);
                      event.target.value = '';
                    }}
                  />
                  <button type="button" className="product-create__open-file-picker" onClick={() => void openMediaPicker()}><FilePlus2 size={18}/><span>{files.length || selectedLibraryFiles.length ? 'Manage files' : 'Add files'}</span><small>{files.length + selectedLibraryFiles.length === 1 ? '1 file added' : `${files.length + selectedLibraryFiles.length} files added`}</small></button>
                  {selectedLibraryFiles.length > 0 && <ul aria-label="Selected library files">{libraryFiles.filter((asset) => selectedLibraryFiles.includes(asset.id)).map((asset) => <li key={asset.id}><span><strong>{asset.name}</strong><small>{asset.contentType} · {(Number(asset.sizeBytes) / (1024 * 1024)).toFixed(2)} MB</small></span><button type="button" aria-label={`Remove ${asset.name}`} onClick={() => setSelectedLibraryFiles((current) => current.filter((id) => id !== asset.id))}><X size={15}/></button></li>)}</ul>}
                  {fieldErrors.delivery && <p className="field-error" id="download-delivery-error" role="alert">{fieldErrors.delivery}</p>}
                  {files.length > 0 && (
                    <ul>
                      {files.map((file, index) => (
                        <li key={`${file.name}-${file.size}-${index}`}>
                          <span>
                            <strong>{file.name}</strong>
                            <small>
                              {(file.size / (1024 * 1024)).toFixed(file.size < 1024 * 1024 ? 2 : 1)}{' '}
                              MB
                            </small>
                          </span>
                          <button
                            type="button"
                            aria-label={`Remove ${file.name}`}
                            onClick={() => {
                              setFiles((current) =>
                                current.filter((_, fileIndex) => fileIndex !== index),
                              );
                              clearFieldError('delivery');
                            }}
                          >
                            <Trash2 size={15} />
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                  {uploadProgress && (
                    <div className="product-editor__upload-progress-card" role="status" aria-live="polite">
                      <div className="product-editor__upload-progress-heading">
                        <strong>Uploading 1 file…</strong>
                        <button
                          type="button"
                          aria-label="Dismiss upload status"
                          onClick={() => setUploadProgress(null)}
                        >
                          <X size={18} />
                        </button>
                      </div>
                      <div className="product-editor__upload-progress-file">
                        <span className="product-editor__upload-progress-icon" aria-hidden="true"><FilePlus2 size={22} /></span>
                        <span className="product-editor__upload-progress-copy">
                          <strong>{uploadProgress.name}</strong>
                          <small>Uploading · {uploadProgress.percent}%</small>
                          <span className="product-editor__upload-progress-track" aria-hidden="true">
                            <span style={{ width: `${uploadProgress.percent}%` }} />
                          </span>
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className={`field ${fieldErrors.delivery ? 'has-error' : ''}`}>
                  <label htmlFor="download-external-url">Redirect URL</label>
                  <input
                    id="download-external-url"
                    type="url"
                    inputMode="url"
                    autoComplete="url"
                    value={externalUrl}
                    aria-invalid={Boolean(fieldErrors.delivery)}
                    aria-describedby={fieldErrors.delivery ? 'download-delivery-error' : undefined}
                    onChange={(event) => { setExternalUrl(event.target.value); clearFieldError('delivery'); }}
                    placeholder="https://example.com/your-download"
                    maxLength={2048}
                  />
                  <small>Buyers are redirected here after purchase. Use a secure HTTPS address.</small>
                  {fieldErrors.delivery && <p className="field-error" id="download-delivery-error" role="alert">{fieldErrors.delivery}</p>}
                </div>
              )}
              {deliveryMode === 'uploaded_files' && (
                <div className="product-create__confirmation">
                  <h3>Buyer confirmation message</h3>
                  <p className="product-editor__intro">Buyers see this after payment is confirmed.</p>
                  <label className="field" htmlFor="buyer-confirmation-message">
                    <span className="sr-only">Message to buyers after purchase</span>
                    <textarea
                      id="buyer-confirmation-message"
                      rows={4}
                      maxLength={500}
                      aria-invalid={Boolean(fieldErrors.delivery?.includes('confirmation message'))}
                      value={buyerConfirmation}
                      onChange={(event) => { setBuyerConfirmation(event.target.value); clearFieldError('delivery'); }}
                      placeholder="Enter confirmation message here"
                    />
                    <small>{buyerConfirmation.length}/500 characters</small>
                    {fieldErrors.delivery?.includes('confirmation message') && <span className="field-error" role="alert">{fieldErrors.delivery}</span>}
                  </label>
                </div>
              )}
            </section>
          )}
          {type !== 'payment_link' && type !== 'course' && (
            <div className={`product-create__attestation${fieldErrors.attestation ? ' has-error' : ''}`}>
              <label htmlFor="offer-content-attestation">
                <input
                  id="offer-content-attestation"
                  type="checkbox"
                  required
                  checked={contentAttested}
                  aria-invalid={Boolean(fieldErrors.attestation)}
                  aria-describedby={fieldErrors.attestation ? 'offer-content-attestation-error' : undefined}
                  onChange={(event) => {
                    setContentAttested(event.target.checked);
                    clearFieldError('attestation');
                  }}
                />
                <span>I confirm I own or have permission to sell this content, and it contains no illegal, adult, or prohibited material. See Onselli’s <a href="/legal/terms" target="_blank" rel="noreferrer">content rules</a>.</span>
              </label>
              {fieldErrors.attestation && <p className="field-error" id="offer-content-attestation-error">{fieldErrors.attestation}</p>}
            </div>
          )}
        </section>
      </form>
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
          clearFieldError('cover');
          setCoverFile(file);
          setCoverAssetId(null);
          setCoverPreviewUrl(URL.createObjectURL(file));
        }}
        onSelectLibraryAsset={(asset: MediaAsset) => {
          clearFieldError('cover');
          setCoverAssetId(asset.id);
          setCoverPreviewUrl(asset.previewUrl ?? null);
          setCoverFile(null);
        }}
        onAttachSelected={() => {}}
      />
      <ProductMediaPickerModal
        open={libraryPickerOpen}
        onOpenChange={setLibraryPickerOpen}
        initialSelectedAssetIds={selectedLibraryFiles}
        maxFiles={DOWNLOAD_MAX_FILES - files.length}
        busy={busy}
        onUploadFromComputer={(uploadedFiles) => {
          const invalid = uploadedFiles.find(
            (file) => !isSupportedDownload(file) || file.size > DOWNLOAD_MAX_BYTES,
          );
          if (invalid) {
            setFieldErrors({ delivery: `${invalid.name} is unsupported or larger than 100 MB.` });
            return;
          }
          const merged = [...files, ...uploadedFiles];
          if (merged.length + selectedLibraryFiles.length > DOWNLOAD_MAX_FILES) {
            setFieldErrors({ delivery: `Choose up to ${DOWNLOAD_MAX_FILES} files.` });
            return;
          }
          clearFieldError('delivery');
          setFiles(merged);
        }}
        onAttachSelected={(selectedIds, assets) => {
          if (assets && assets.length) {
            setLibraryFiles((current) => {
              const map = new Map(current.map((a) => [a.id, a]));
              assets.forEach((a) => map.set(a.id, a));
              return Array.from(map.values());
            });
          }
          setSelectedLibraryFiles(selectedIds);
          clearFieldError('delivery');
          setLibraryPickerOpen(false);
        }}
      />
      {previewOpen && (
        <div
          className="product-create__preview-backdrop"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setPreviewOpen(false);
          }}
        >
          <section
            id="product-buyer-preview"
            className="product-create__preview-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="product-preview-title"
          >
            <header className="product-create__preview-modal-header">
              <div>
                <span>BUYER VIEW</span>
                <h2 id="product-preview-title">Preview your {copy.noun}</h2>
              </div>
              <button
                ref={previewCloseRef}
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
                className={`product-editor__cover product-create__preview-cover product-create__preview-cover--${type}`}
              >
                {coverPreviewUrl ? (
                  <img src={coverPreviewUrl} alt="" />
                ) : (
                  <strong>{title || `Your ${copy.noun}`}</strong>
                )}
              </div>
              <div className="product-editor__buyer-content">
                <small>{selected.label}</small>
                <h3>{title || `Untitled ${copy.noun}`}</h3>
                <p>{descriptionText || normalizeProductDescription(description) || 'Add a short description so buyers know what they will receive.'}</p>
                <strong>{displayMinor ? money(displayMinor, currency) : 'Set a price'}</strong>
              </div>
            </article>
          </section>
        </div>
      )}
      {publishCelebrating && (
        <ProductPublishCelebration onComplete={finishPublishCelebration} />
      )}
    </div>
  );
}
