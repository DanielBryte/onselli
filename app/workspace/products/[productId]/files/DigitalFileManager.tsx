'use client';

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import ChoiceCard from '@/app/components/ui/ChoiceCard';
import Dialog from '@/app/components/ui/Dialog';
import Button from '@/app/components/ui/Button';
import ProductMediaPickerModal from '@/app/workspace/products/ProductMediaPickerModal';
import { ArrowLeft, ArrowRight, FileDown, FilePlus2, FolderOpen, LoaderCircle, RefreshCw, Trash2, Upload, X } from 'lucide-react';

type DownloadFile = { id: string; asset_id: string | null; file_name: string; size_bytes: string; status: 'PENDING' | 'READY'; position: number };
type Product = { id: string; title: string; status: string; kind: string };
type DeliverySaveResponse = { delivery?: { mode?: DeliveryMode; externalUrl?: string | null }; productStatus?: string; error?: string };
type DeliveryMode = 'uploaded_files' | 'external_link';
export type DeliveryFormState = { mode: DeliveryMode; externalUrl: string; readyFileCount: number; loaded: boolean; busy: boolean };
type FilesPayload = { product?: Product; delivery?: { mode?: DeliveryMode; externalUrl?: string | null }; files?: DownloadFile[]; maxFiles?: number; maxFileBytes?: number; error?: string };
const ACCEPTED_FILES = '.pdf,.zip,.epub,.docx,.pptx,.xlsx,.mp3,.m4a,.wav,.ogg,.mp4,.mov,.webm,.png,.jpg,.jpeg,.webp,.gif';
const ACCEPTED_EXTENSIONS = new Set(ACCEPTED_FILES.split(','));
const MAX_FILES = 20;
const MAX_FILE_BYTES = 100 * 1024 * 1024;

export default function DigitalFileManager({ productId, embedded = false, onDeliveryChange }: { productId: string; embedded?: boolean; onDeliveryChange?: (state: DeliveryFormState) => void }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const replaceTargetRef = useRef<string | null>(null);
  const deliveryInitializedRef = useRef(false);
  const [product, setProduct] = useState<Product | null>(null);
  const [files, setFiles] = useState<DownloadFile[]>([]);
  const [deliveryMode, setDeliveryMode] = useState<DeliveryMode>('uploaded_files');
  const [savedDeliveryMode, setSavedDeliveryMode] = useState<DeliveryMode>('uploaded_files');
  const [externalUrl, setExternalUrl] = useState('');
  const [savedExternalUrl, setSavedExternalUrl] = useState('');
  const [maxFiles, setMaxFiles] = useState(MAX_FILES);
  const [maxFileBytes, setMaxFileBytes] = useState(MAX_FILE_BYTES);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<number | null>(null);
  const [activeFile, setActiveFile] = useState('');
  const [replaceFileId, setReplaceFileId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [publishAfterUpload, setPublishAfterUpload] = useState(false);
  const [contentAttested, setContentAttested] = useState(false);
  const [libraryPickerOpen, setLibraryPickerOpen] = useState(false);
  const [fileToRemove, setFileToRemove] = useState<DownloadFile | null>(null);

  function openLibraryPicker() {
    setLibraryPickerOpen(true);
  }

  async function attachSelectedLibraryAssets(idsToAttach?: string[]) {
    const targetIds = idsToAttach ?? [];
    const selected = targetIds.filter((id) => !files.some((file) => file.asset_id === id));
    if (!selected.length) return;
    setBusy(true); setError(''); setNotice('');
    let added = 0;
    let failure = '';
    try {
      if (files.length + selected.length > maxFiles) throw new Error(`This download can contain up to ${maxFiles} files.`);
      if (embedded) { setDeliveryMode('uploaded_files'); setExternalUrl(''); }
      else if (deliveryMode !== 'uploaded_files' || savedDeliveryMode !== 'uploaded_files') await persistDelivery('uploaded_files', '');
      for (const assetId of selected) {
        const response = await fetch(`/api/workspace/products/${productId}/files`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ assetId }) });
        const result = await response.json().catch(() => ({}));
        if (!response.ok) { failure = result.error || 'Could not attach one of the selected files.'; break; }
        added += 1;
      }
      await loadFiles();
      if (!failure) { setLibraryPickerOpen(false); toast.success(`${added} ${added === 1 ? 'file added' : 'files added'} from Media Library.`); }
      else if (added) toast.warning(`${added} ${added === 1 ? 'file was' : 'files were'} added. ${failure}`);
      else toast.error(failure);
    } catch (cause) { toast.error(cause instanceof Error ? cause.message : 'Could not attach the selected files.'); }
    finally { setBusy(false); }
  }

  const loadFiles = useCallback(async (signal?: AbortSignal) => {
    const response = await fetch(`/api/workspace/products/${productId}/files`, { cache: 'no-store', signal });
    const payload = await response.json().catch(() => ({})) as FilesPayload;
    if (response.status === 401) { router.replace('/login'); return; }
    if (!response.ok || !payload.product || payload.product.kind !== 'DOWNLOAD') throw new Error(payload.error || 'Digital product not found.');
    setProduct(payload.product);
    setFiles(payload.files ?? []);
    const currentMode = payload.delivery?.mode === 'external_link' ? 'external_link' : 'uploaded_files';
    const currentUrl = payload.delivery?.externalUrl ?? '';
    if (!embedded || !deliveryInitializedRef.current) {
      setDeliveryMode(currentMode);
      setExternalUrl(currentUrl);
    }
    setSavedDeliveryMode(currentMode); setSavedExternalUrl(currentUrl);
    deliveryInitializedRef.current = true;
    setMaxFiles(payload.maxFiles ?? MAX_FILES);
    setMaxFileBytes(payload.maxFileBytes ?? MAX_FILE_BYTES);
  }, [embedded, productId, router]);

  const readyCount = files.filter((file) => file.status === 'READY').length;
  const productIsPublished = product?.status === 'published';
  useEffect(() => {
    onDeliveryChange?.({ mode: deliveryMode, externalUrl, readyFileCount: readyCount, loaded: deliveryInitializedRef.current, busy });
  }, [deliveryMode, externalUrl, readyCount, busy, onDeliveryChange]);

  async function retryLoadFiles() {
    setLoading(true); setError('');
    try { await loadFiles(); }
    catch (loadError) { setError(loadError instanceof Error ? loadError.message : 'Could not load your files.'); }
    finally { setLoading(false); }
  }

  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    void loadFiles(controller.signal).then(() => {
      if (active) {
        setPublishAfterUpload(!embedded && new URLSearchParams(window.location.search).get('publish') === '1');
        setLoading(false);
      }
    }).catch((loadError) => {
      if (active) { setError(loadError instanceof Error ? loadError.message : 'Could not load your files.'); setLoading(false); }
    });
    return () => { active = false; controller.abort(); };
  }, [loadFiles, embedded]);

  function hasConfiguredDelivery() {
    if (deliveryMode === 'uploaded_files') return savedDeliveryMode === 'uploaded_files' && readyCount > 0;
    return Boolean(externalUrl && product && deliveryMode === savedDeliveryMode && externalUrl === savedExternalUrl);
  }

  async function persistDelivery(mode: DeliveryMode, url: string) {
    const response = await fetch(`/api/workspace/products/${productId}/files`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ deliveryMode: mode, externalUrl: mode === 'external_link' ? url : null }),
    });
    const result = await response.json().catch(() => ({})) as DeliverySaveResponse;
    if (!response.ok) throw new Error(result.error || 'Delivery settings could not be saved.');
    const savedMode = result.delivery?.mode ?? mode;
    const savedUrl = result.delivery?.externalUrl ?? '';
    setDeliveryMode(savedMode); setSavedDeliveryMode(savedMode);
    setExternalUrl(savedUrl); setSavedExternalUrl(savedUrl);
    if (result.productStatus) setProduct((current) => current ? { ...current, status: result.productStatus! } : current);
    return savedMode;
  }

  async function saveDelivery() {
    setBusy(true); setError(''); setNotice('');
    try {
      const savedMode = await persistDelivery(deliveryMode, externalUrl);
      toast.success(savedMode === 'external_link' ? 'External delivery link saved.' : 'Private file delivery selected.');
    } catch (saveError) { toast.error(saveError instanceof Error ? saveError.message : 'Delivery settings could not be saved.'); }
    finally { setBusy(false); }
  }

  async function publishOffer(deliveryReadyAfterUpload = false) {
    if (!hasConfiguredDelivery() && !(deliveryReadyAfterUpload && deliveryMode === 'uploaded_files')) return;
    if (!contentAttested) {
      toast.error('Confirm you have the right to sell this content before publishing.');
      return;
    }
    setBusy(true); setError(''); setNotice('');
    try {
      const response = await fetch(`/api/workspace/products/${productId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: 'published', contentAttested }) });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) { if (response.status === 402 && result.code === 'PLAN_LIMIT') window.dispatchEvent(new Event('onselli:open-pricing')); throw new Error(result.error || 'Could not publish this download.'); }
      toast.success('Download published.'); router.push('/workspace/products'); router.refresh();
    } catch (publishError) { toast.error(publishError instanceof Error ? publishError.message : 'Could not publish this download.'); }
    finally { setBusy(false); }
  }

  function putFile(url: string, contentType: string, file: File) {
    return new Promise<void>((resolve, reject) => {
      const request = new XMLHttpRequest();
      request.open('PUT', url);
      request.setRequestHeader('Content-Type', contentType);
      request.upload.onprogress = (event) => { if (event.lengthComputable) setProgress(Math.round((event.loaded / event.total) * 100)); };
      request.onerror = () => reject(new Error('The browser could not reach file storage. Check your connection and confirm the R2 bucket CORS policy allows PUT requests from this app origin with the Content-Type header.'));
      request.onabort = () => reject(new Error('Upload was interrupted. You can retry the file.'));
      request.ontimeout = () => reject(new Error('The upload timed out before storage responded. Check your connection and R2 bucket availability, then try again.'));
      request.timeout = 120_000;
      request.onload = () => request.status >= 200 && request.status < 300 ? resolve() : reject(new Error(`Storage rejected the file (HTTP ${request.status}). Check the R2 bucket CORS policy and upload permissions.`));
      request.send(file);
    });
  }

  function openFilePicker(targetId: string | null = null) {
    replaceTargetRef.current = targetId;
    setReplaceFileId(targetId);
    if (inputRef.current) {
      inputRef.current.multiple = targetId === null;
      inputRef.current.click();
    }
  }

  async function uploadFiles(selected: File[], targetFileId: string | null = null) {
    if (!selected.length) return;
    if (targetFileId && selected.length > 1) { setError('Choose one file when replacing an existing file.'); return; }
    const readyCount = files.filter((file) => file.status === 'READY').length;
    const pendingCount = files.filter((file) => file.status === 'PENDING').length;
    if (!targetFileId && readyCount + pendingCount + selected.length > maxFiles) { setError(`This download can contain up to ${maxFiles} files.`); return; }
    const invalid = selected.find((file) => !ACCEPTED_EXTENSIONS.has(`.${file.name.split('.').pop()?.toLowerCase() ?? ''}`) || file.size < 1 || file.size > maxFileBytes);
    if (invalid) { setError(`${invalid.name} is not supported or exceeds the ${Math.round(maxFileBytes / 1024 / 1024)} MB limit.`); return; }

    setBusy(true); setError(''); setNotice('');
    if (embedded) { setDeliveryMode('uploaded_files'); setExternalUrl(''); }
    else if (deliveryMode === 'uploaded_files' && savedDeliveryMode !== 'uploaded_files') {
      try { await persistDelivery('uploaded_files', ''); }
      catch (saveError) {
        toast.error(saveError instanceof Error ? saveError.message : 'Private file delivery could not be saved.');
        setBusy(false);
        return;
      }
    }
    let completed = 0;
    let failed = false;
    for (const file of selected) {
      let pendingFileId: string | null = null;
      setActiveFile(file.name); setProgress(0);
      try {
        const initResponse = await fetch(`/api/workspace/products/${productId}/files`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ fileName: file.name, sizeBytes: file.size, ...(targetFileId ? { replaceFileId: targetFileId } : {}) }),
        });
        const init = await initResponse.json().catch(() => ({}));
        if (!initResponse.ok) throw new Error(init.error || 'Could not start the upload.');
        pendingFileId = init.fileId;
        await putFile(init.uploadUrl, init.contentType, file);
        const completeResponse = await fetch(`/api/workspace/products/${productId}/files/complete`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ fileId: init.fileId, ...(targetFileId ? { replaceFileId: targetFileId } : {}) }),
        });
        const completion = await completeResponse.json().catch(() => ({}));
        if (!completeResponse.ok) throw new Error(completion.error || 'Could not verify the uploaded file.');
        pendingFileId = null;
        completed += 1;
        if (completion.replacementCleanupPending) toast.warning(completion.error || 'New file is ready; remove the previous copy when storage is available.');
      } catch (uploadError) {
        if (pendingFileId) await fetch(`/api/workspace/products/${productId}/files`, { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ fileId: pendingFileId }) }).catch(() => undefined);
        failed = true;
        toast.error(uploadError instanceof Error ? uploadError.message : 'Upload failed. You can retry.');
        break;
      }
      targetFileId = null;
    }
    try { await loadFiles(); } catch { toast.error('Files uploaded, but the list could not refresh. Reload to check the current status.'); }
    setBusy(false); setProgress(null); setActiveFile(''); setReplaceFileId(null);
    if (completed && !failed) toast.success(`${completed === 1 ? 'File is' : `${completed} files are`} uploaded and private.`);
    if (publishAfterUpload && completed && !failed && deliveryMode === 'uploaded_files') await publishOffer(true);
    if (inputRef.current) inputRef.current.value = '';
  }

  async function removeFile(file: DownloadFile) {
    setBusy(true); setError(''); setNotice('');
    try {
      const response = await fetch(`/api/workspace/products/${productId}/files`, { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ fileId: file.id }) });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || 'Could not remove the file.');
      await loadFiles(); setFileToRemove(null); toast.success('File removed.');
    } catch (removeError) { toast.error(removeError instanceof Error ? removeError.message : 'Could not remove the file. Try again.'); }
    finally { setBusy(false); }
  }

  const fileSize = (bytes: number | string) => `${(Number(bytes) / (1024 * 1024)).toFixed(Number(bytes) < 1024 * 1024 ? 2 : 1)} MB`;

  return <section className={embedded ? 'product-file-manager product-file-manager--embedded' : 'creator-dashboard__body studio-overview product-file-manager'}><div className="product-file-manager__content" style={{ maxWidth: embedded ? 'none' : 880 }}>
    {!embedded && <><Link href="/workspace/products" className="text-link" style={{ color: '#52645a' }}><ArrowLeft size={14}/> Back to products</Link>
    <div style={{ marginTop: 24 }}><span className="section-kicker">Digital download</span><h1 className="page-title">{product ? `Files · ${product.title}` : 'Product files'}</h1><p className="page-subtitle">Choose the files or secure link buyers receive after payment.</p></div></>}
    {loading ? <p style={{ marginTop: 28 }} role="status">Loading delivery details…</p> : !product ? <div className="product-library__load-error" role="alert" style={{ marginTop: 24 }}><p>{error || 'Digital product not found.'}</p><button type="button" className="button button--outline" onClick={() => void retryLoadFiles()}><RefreshCw size={14}/> Try again</button></div> : <>
      <section className="form-card" style={{ marginTop: 22 }}>
        <h2 style={{ marginTop: 0, fontSize: 18 }}>How buyers receive this product</h2>
        <div className="product-file-manager__delivery-options" role="radiogroup" aria-label="Download delivery method">
          <ChoiceCard
            name="delivery-mode"
            value="uploaded_files"
            checked={deliveryMode === 'uploaded_files'}
            onChange={() => setDeliveryMode('uploaded_files')}
            label="Private files"
            className={`product-file-manager__delivery-option${deliveryMode === 'uploaded_files' ? ' is-selected' : ''}`}
          />
          <ChoiceCard
            name="delivery-mode"
            value="external_link"
            checked={deliveryMode === 'external_link'}
            onChange={() => setDeliveryMode('external_link')}
            label="External link"
            className={`product-file-manager__delivery-option${deliveryMode === 'external_link' ? ' is-selected' : ''}`}
          />
        </div>
        {deliveryMode === 'external_link' ? <div style={{ marginTop: 18 }}>
          <div className="field"><label htmlFor="external-download-url">Redirect URL</label><input id="external-download-url" type="url" inputMode="url" autoComplete="url" value={externalUrl} onChange={(event) => setExternalUrl(event.target.value)} placeholder="https://example.com/your-download" maxLength={2048}/><small>Buyers are redirected to this URL after purchase. Use a secure HTTPS address.</small></div>
          <p className="notice">Buyers will see this link in their library after payment is confirmed. Onselli does not host or protect content at the destination, and changing this link here cannot revoke access they already have there.</p>
          {!embedded && <button className="button button--mint" type="button" onClick={() => void saveDelivery()} disabled={busy || !externalUrl.trim()} style={{ marginTop: 12, background: '#014733', color: '#fff' }}>{busy ? 'Saving…' : 'Save external link'}</button>}
          {error && <p className="form-error" role="alert" style={{ marginTop: 15 }}>{error}</p>}
          {notice && <p className="notice" role="status" style={{ marginTop: 15 }}>{notice}</p>}
          {files.length > 0 && <p className="notice" style={{ marginTop: 12 }}>Your private files remain saved but will not be delivered while external-link mode is active.</p>}
        </div> : <>
        <p className="notice product-file-manager__private-note">Files stay in private storage. Buyers with a paid order and active access receive a short-lived download link.</p>
        {!embedded && savedDeliveryMode !== 'uploaded_files' && (
          <Button type="button" onClick={() => void saveDelivery()} disabled={busy} style={{ marginTop: 12 }}>
            {busy ? 'Saving…' : 'Save private file delivery'}
          </Button>
        )}
        <div className="product-file-manager__files-header">
          <div><h2 style={{ margin: 0, fontSize: 18 }}>Buyer files <span className="section-kicker">{readyCount} of {maxFiles} ready</span></h2><p style={{ margin: '6px 0 0' }}>Up to {maxFiles} files, {Math.round(maxFileBytes / 1024 / 1024)} MB each. PDF, ZIP, EPUB, Office documents, audio and images.</p></div>
          <button className="button button--mint" type="button" onClick={() => void openLibraryPicker()} disabled={busy || files.length >= maxFiles} style={{ background: '#014733', color: '#fff' }}><FilePlus2 size={15}/> Add files</button>
        </div>
        <input ref={inputRef} type="file" multiple={!replaceFileId} accept={ACCEPTED_FILES} onChange={(event) => { const selected = Array.from(event.target.files ?? []); event.target.value = ''; void uploadFiles(selected, replaceTargetRef.current); }} hidden />
        {files.length ? <div className="product-list" style={{ marginTop: 18 }}>{files.map((file) => <article className="product-row" key={file.id} style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <FileDown size={18} aria-hidden="true"/><div style={{ minWidth: 0, flex: 1 }}><strong style={{ display: 'block', overflowWrap: 'anywhere' }}>{file.file_name}</strong><small>{fileSize(file.size_bytes)} · {file.status === 'READY' ? 'Ready for buyers' : 'Upload incomplete'}</small></div>
          {file.status === 'READY' && <Button variant="secondary" size="sm" className="product-file-manager__file-action" type="button" disabled={busy} onClick={() => openFilePicker(file.id)} aria-label={`Replace ${file.file_name}`}><RefreshCw size={14}/> Replace</Button>}
          <Button variant={file.status === 'READY' ? 'danger' : 'secondary'} size="sm" className="product-file-manager__file-action" type="button" disabled={busy} onClick={() => setFileToRemove(file)} aria-label={`Remove ${file.status === 'READY' ? '' : 'incomplete '}${file.file_name}`}><Trash2 size={14}/> Remove</Button>
        </article>)}</div> : <div className="empty-state" style={{ marginTop: 20 }}><h3>No files added</h3><p>Add at least one file before publishing. Buyers get every ready file in their library after payment is confirmed.</p><button className="button button--outline" type="button" onClick={() => void openLibraryPicker()} disabled={busy}><Upload size={15}/> Choose files</button></div>}
        {busy && activeFile && <div aria-live="polite" style={{ marginTop: 16 }}><p style={{ marginBottom: 7 }}><LoaderCircle size={14} className="animate-spin"/> Uploading {activeFile}{progress !== null ? ` · ${progress}%` : '…'}</p><progress value={progress ?? 0} max={100} style={{ width: '100%' }} /></div>}
        {error && <p className="form-error" role="alert" style={{ marginTop: 15 }}>{error}</p>}
        {notice && <p className="notice" role="status" style={{ marginTop: 15 }}>{notice}</p>}
        {productIsPublished && <p className="notice" style={{ marginTop: 16 }}>Your sales page is live. New buyers receive these files after payment confirmation. Removing a file also removes it from future downloads by existing buyers.</p>}
        </>}
      </section>
      {!productIsPublished && !embedded && (
        <section className="form-card" style={{ marginTop: 16 }}>
          <h2 style={{ marginTop: 0, fontSize: 18 }}>Publish readiness</h2>
          <p>
            {deliveryMode === 'external_link'
              ? externalUrl
                ? hasConfiguredDelivery()
                  ? 'External delivery link is saved.'
                  : 'Save the external link before publishing.'
                : 'Add a valid HTTPS link before publishing.'
              : readyCount > 0
                ? `${readyCount} ${readyCount === 1 ? 'file is' : 'files are'} ready for delivery.`
                : 'Add at least one verified file to publish this download.'}
          </p>
          {deliveryMode === 'uploaded_files' && (
            <label className="product-file-manager__auto-publish">
              <input
                type="checkbox"
                checked={publishAfterUpload}
                onChange={(event) => setPublishAfterUpload(event.target.checked)}
              />
              Publish automatically after an upload is verified
            </label>
          )}
          <label className="product-file-manager__auto-publish">
            <input
              type="checkbox"
              required
              checked={contentAttested}
              onChange={(event) => setContentAttested(event.target.checked)}
            />
            <span>
              I confirm I own or have permission to sell this content, and it follows Onselli’s{' '}
              <a href="/legal/terms" target="_blank" rel="noreferrer">content rules</a>.
            </span>
          </label>
          <button
            className="button button--mint"
            type="button"
            onClick={() => void publishOffer()}
            disabled={busy || !hasConfiguredDelivery() || !contentAttested}
            style={{ background: '#014733', color: '#fff' }}
          >
            {busy ? 'Publishing…' : 'Publish download'} <ArrowRight size={15} />
          </button>
        </section>
      )}
      <ProductMediaPickerModal
        open={libraryPickerOpen}
        onOpenChange={setLibraryPickerOpen}
        alreadyAddedAssetIds={files.map((file) => file.asset_id).filter(Boolean) as string[]}
        maxFiles={maxFiles}
        maxFileBytes={maxFileBytes}
        acceptedFileTypes={ACCEPTED_FILES}
        busy={busy}
        onUploadFromComputer={(uploadedFiles) => {
          void uploadFiles(uploadedFiles);
        }}
        onAttachSelected={async (selectedIds) => {
          await attachSelectedLibraryAssets(selectedIds);
        }}
      />
      <Dialog open={Boolean(fileToRemove)} onOpenChange={(open) => { if (!open) setFileToRemove(null); }} title="Remove product file" describedBy="product-file-remove-description" className="product-file-remove-dialog" overlayClassName="media-folder-dialog">
        <button type="button" className="media-folder-dialog__close" aria-label="Close" onClick={() => setFileToRemove(null)}><X size={18}/></button>
        <div className="product-file-remove-dialog__content"><h2>Remove this file?</h2><p id="product-file-remove-description"><strong>{fileToRemove?.file_name}</strong> will be removed from this product’s buyer delivery. The upload will remain in your Media Library.</p></div>
        <footer className="product-file-picker__footer"><Button variant="secondary" onClick={() => setFileToRemove(null)} disabled={busy}>Cancel</Button><Button variant="danger" onClick={() => fileToRemove && void removeFile(fileToRemove)} disabled={busy}>{busy ? 'Removing…' : <><Trash2 size={15}/> Remove file</>}</Button></footer>
      </Dialog>
    </>}
  </div></section>;
}
