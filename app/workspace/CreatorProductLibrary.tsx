'use client';

import WorkspaceSelect from '@/app/components/ui/WorkspaceSelect';
import Input from '@/app/components/ui/Input';
import SearchInput from '@/app/components/ui/SearchInput';
import Dialog from '@/app/components/ui/Dialog';
import Button from '@/app/components/ui/Button';
import Badge from '@/app/components/ui/Badge';
import EmptyState from '@/app/components/ui/EmptyState';
import DropdownMenu from '@/app/components/ui/DropdownMenu';

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type ChangeEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Archive, Copy, Download, ExternalLink, Eye, Folder, FolderPlus, GraduationCap, Link2, MoreVertical, Package, PackageOpen, Pencil, Plus, RefreshCw, Search, ShoppingBag, Trash2, X } from 'lucide-react';
import ProductCreateFlow, { type OfferType } from './ProductCreateFlow';
import { WorkspaceDataLoading } from './WorkspaceLoading';

type Product = { id: string; title: string; slug: string; type: string; status: 'draft' | 'published' | 'archived'; currency: string; priceMinor: string; updatedAt: string; salesCount: number; revenueMinor: string; coverUrl?: string | null };
type Summary = { total: number; published: number; drafts: number; archived: number; revenueByCurrency: { currency: string; amountMinor: string }[]; salesCount: number };
type Filter = 'all' | 'published' | 'draft' | 'archived';
type MediaFolder = { id: string; name: string; count: number; isDefault?: boolean };

const typeDetails: Record<string, { label: string; icon: typeof Package }> = {
  course: { label: 'Course', icon: GraduationCap },
  download: { label: 'Digital download', icon: Download },
  payment_link: { label: 'Payment link', icon: Link2 },
  bundle: { label: 'Bundle', icon: Package },
};
const creationFormats = [
  { id: 'download', label: 'Digital download', detail: 'Deliver files or a private download link.', icon: Download },
  { id: 'course', label: 'Online course', detail: 'Teach with lessons and guided content.', icon: GraduationCap },
  { id: 'payment_link', label: 'Payment link', detail: 'Collect a fixed or customer-chosen amount.', icon: Link2 },
  { id: 'bundle', label: 'Bundle', detail: 'Combine published courses and downloads.', icon: PackageOpen },
];
const formatMoney = (minor: string | number, currency: string) => new Intl.NumberFormat(undefined, { style: 'currency', currency, maximumFractionDigits: 2 }).format(Number(minor) / 100);
const formatDate = (value: string) => new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(value));
const fileTypeLabel = (contentType: string) => {
  const labels: Record<string, string> = { 'image/png': 'PNG image', 'image/jpeg': 'JPEG image', 'image/webp': 'WebP image', 'image/gif': 'GIF image', 'audio/mpeg': 'MP3 audio', 'audio/mp4': 'M4A audio', 'video/mp4': 'MP4 video', 'video/quicktime': 'MOV video', 'video/webm': 'WebM video', 'application/pdf': 'PDF document', 'application/zip': 'ZIP archive', 'application/epub+zip': 'EPUB document' };
  if (labels[contentType]) return labels[contentType];
  if (contentType.startsWith('image/')) return `${contentType.slice(6).toUpperCase()} image`;
  if (contentType.startsWith('audio/')) return `${contentType.slice(6).toUpperCase()} audio`;
  if (contentType.startsWith('video/')) return `${contentType.slice(6).toUpperCase()} video`;
  if (contentType.includes('wordprocessingml')) return 'DOCX document';
  if (contentType.includes('presentationml')) return 'PPTX document';
  if (contentType.includes('spreadsheetml')) return 'XLSX document';
  return contentType.split('/').pop()?.toUpperCase() || 'File';
};

export default function CreatorProductLibrary({ mediaOnly = false }: { mediaOnly?: boolean }) {
  const router = useRouter();
  const [products, setProducts] = useState<Product[]>([]);
  const [mediaAssets, setMediaAssets] = useState<(Product & { folderId: string; contentType: string; sizeBytes: string })[]>([]);
  const [summary, setSummary] = useState<Summary>({ total: 0, published: 0, drafts: 0, archived: 0, revenueByCurrency: [], salesCount: 0 });
  const [workspaceSlug, setWorkspaceSlug] = useState('');
  const [loading, setLoading] = useState(true);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [currencyFilter, setCurrencyFilter] = useState<'all' | 'NGN' | 'USD'>('all');
  const [statusFilter, setStatusFilter] = useState<Filter>('all');
  const [mediaKind, setMediaKind] = useState<'all' | 'audio' | 'image' | 'video' | 'documents'>('all');
  const [mediaFolders, setMediaFolders] = useState<MediaFolder[]>([]);
  // The library opens at the root so the default Uploads folder is always
  // visible (including when it contains zero files). New uploads still fall
  // back to this folder unless the creator explicitly chooses another one.
  const [activeFolderId, setActiveFolderId] = useState<string | null>(null);
  const [folderName, setFolderName] = useState('');
  const [folderDialogOpen, setFolderDialogOpen] = useState(false);
  const [selectedMedia, setSelectedMedia] = useState<string[]>([]);
  const [moveDialogOpen, setMoveDialogOpen] = useState(false);
  const [moveDestinationId, setMoveDestinationId] = useState('');
  const [renameTarget, setRenameTarget] = useState<{ id: string; name: string; kind: 'asset' | 'folder' } | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string; kind: 'asset' | 'folder' } | null>(null);
  const [productDeleteTarget, setProductDeleteTarget] = useState<Product | null>(null);
  const [sort, setSort] = useState('updated');
  const [busyId, setBusyId] = useState('');
  const [directUpload, setDirectUpload] = useState<{ name: string; percent: number | null; stage: 'preparing' | 'uploading' | 'verifying'; index: number; total: number } | null>(null);
  const uploadInputRef = useRef<HTMLInputElement>(null);
  const [selectedType, setSelectedType] = useState<OfferType | null>(null);
  const requestVersion = useRef(0);
  const activeRequest = useRef<AbortController | null>(null);

  const load = useCallback(async () => {
    activeRequest.current?.abort();
    const requestId = ++requestVersion.current;
    const diagnosticId = `product-list-${requestId}`;
    setLoading(true); setError('');
    let finalError = '';
    for (let attempt = 0; attempt < 2 && requestId === requestVersion.current; attempt += 1) {
      const controller = new AbortController();
      activeRequest.current = controller;
      let timedOut = false;
      const timeoutId = window.setTimeout(() => { timedOut = true; controller.abort(); }, 18_000);
      try {
        const response = await fetch('/api/workspace/products', { cache: 'no-store', signal: controller.signal, headers: { 'x-request-id': `${diagnosticId}-${attempt + 1}` } });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) {
          finalError = payload.error || 'Your products could not be loaded.';
          if (response.status < 500) break;
          continue;
        }
        if (!Array.isArray(payload.products)) { finalError = 'The products response was incomplete. Please try again.'; continue; }
        if (requestId === requestVersion.current) {
          setProducts(payload.products); setSummary(payload.summary ?? { total: 0, published: 0, drafts: 0, archived: 0, revenueByCurrency: [], salesCount: 0 }); setWorkspaceSlug(payload.workspaceSlug ?? ''); setHasLoaded(true); setLoading(false);
        }
        return;
      } catch (cause) {
        if (controller.signal.aborted && !timedOut) return;
        finalError = timedOut ? 'Products are taking longer than expected. Please try again.' : cause instanceof Error ? cause.message : 'Your products could not be loaded.';
      } finally {
        window.clearTimeout(timeoutId);
        if (activeRequest.current === controller) activeRequest.current = null;
      }
      if (attempt === 0) await new Promise((resolve) => window.setTimeout(resolve, 650));
    }
    if (requestId === requestVersion.current) setError(finalError || `We couldn’t load your products. Reference: ${diagnosticId}.`);
    if (requestId === requestVersion.current) setLoading(false);
  }, []);
  useEffect(() => { if (mediaOnly) return; void load(); return () => { requestVersion.current += 1; activeRequest.current?.abort(); }; }, [load, mediaOnly]);
  useEffect(() => {
    if (!mediaOnly) return;
    const controller = new AbortController();
    void fetch('/api/workspace/media', { cache: 'no-store', signal: controller.signal })
      .then(async (response) => {
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(payload.error || 'Could not load media files.');
        setMediaFolders(payload.folders || []);
        setMediaAssets((payload.assets || []).map((asset: { id: string; name: string; contentType: string; sizeBytes: string; createdAt: string; previewUrl: string | null; folderId: string }) => ({
          id: asset.id, title: asset.name, slug: asset.id, type: 'media_asset', status: 'draft', currency: 'NGN', priceMinor: '0', updatedAt: asset.createdAt, salesCount: 0, revenueMinor: '0', coverUrl: asset.previewUrl, folderId: asset.folderId, contentType: asset.contentType, sizeBytes: asset.sizeBytes,
        })));
        setHasLoaded(true); setLoading(false); setError('');
      }).catch((cause) => { if (!controller.signal.aborted) { setError(cause instanceof Error ? cause.message : 'Could not load media files.'); setHasLoaded(false); setLoading(false); } });
    return () => controller.abort();
  }, [mediaOnly]);

  useEffect(() => {
    if (!mediaOnly || !hasLoaded || !error) return;
    toast.error(error);
    setError('');
  }, [error, hasLoaded, mediaOnly]);
  useEffect(() => {
    if (mediaOnly) return;
    const requested = new URLSearchParams(window.location.search).get('kind');
    if (requested === 'course' || requested === 'download' || requested === 'payment_link' || requested === 'bundle') setSelectedType(requested);
  }, [mediaOnly]);
  useEffect(() => {
    if (mediaOnly && (sort === 'sales' || sort === 'revenue')) setSort('updated');
  }, [mediaOnly, sort]);
  useEffect(() => {
    if (!mediaOnly) return;
    const closeMenusOnOutsideClick = (event: MouseEvent) => {
      const target = event.target instanceof Element ? event.target : null;
      const clickedMenu = target?.closest<HTMLDetailsElement>('.media-library__card-menu, .media-library__folder-menu');
      const clickedSummary = target?.closest('summary');
      document.querySelectorAll<HTMLDetailsElement>('.media-library__card-menu[open], .media-library__folder-menu[open]').forEach((menu) => {
        if (menu !== clickedMenu || !clickedSummary) menu.open = false;
      });
    };
    const closeMenusOnEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      document.querySelectorAll<HTMLDetailsElement>('.media-library__card-menu[open], .media-library__folder-menu[open]').forEach((menu) => {
        menu.open = false;
        menu.querySelector<HTMLElement>('summary')?.focus();
      });
    };
    document.addEventListener('click', closeMenusOnOutsideClick);
    document.addEventListener('keydown', closeMenusOnEscape);
    return () => {
      document.removeEventListener('click', closeMenusOnOutsideClick);
      document.removeEventListener('keydown', closeMenusOnEscape);
    };
  }, [mediaOnly]);

  function startCreation(type: OfferType) {
    // Media Library uploads never open the product editor. The empty-state
    // action uses this same handler, so it must follow the direct uploader too.
    if (mediaOnly && type === 'download') {
      uploadInputRef.current?.click();
      return;
    }
    setSelectedType(type);
    if (!mediaOnly) router.push(`/workspace/products?kind=${type}`, { scroll: false });
  }

  async function uploadMediaFiles(files: File[]) {
    if (!files.length) return;
    setError(''); setDirectUpload({ name: files[0]!.name, percent: null, stage: 'preparing', index: 1, total: files.length });
    let pendingAssetId: string | null = null;
    let retryFromIndex = 0;
    try {
      for (const [fileIndex, file] of files.entries()) {
        retryFromIndex = fileIndex;
        setDirectUpload({ name: file.name, percent: null, stage: 'preparing', index: fileIndex + 1, total: files.length });
        const initResponse = await fetch('/api/workspace/media', { method: 'POST', signal: AbortSignal.timeout(30_000), headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ fileName: file.name, sizeBytes: file.size, folderId: activeFolderId ?? undefined }) });
        const init = await initResponse.json().catch(() => ({}));
        if (!initResponse.ok) throw new Error(init.error || `Could not prepare ${file.name}.`);
        pendingAssetId = init.assetId;
        await new Promise<void>((resolve, reject) => {
          const request = new XMLHttpRequest(); request.open('PUT', init.uploadUrl); request.setRequestHeader('Content-Type', init.contentType);
          request.timeout = 120_000;
          request.upload.onloadstart = () => setDirectUpload({ name: file.name, percent: 0, stage: 'uploading', index: fileIndex + 1, total: files.length });
          request.upload.onprogress = (event) => setDirectUpload({ name: file.name, percent: event.lengthComputable ? Math.round((event.loaded / event.total) * 100) : null, stage: 'uploading', index: fileIndex + 1, total: files.length });
          request.onerror = () => reject(new Error('The browser could not reach file storage. Check your connection and confirm the R2 bucket CORS policy allows PUT requests from this app origin with the Content-Type header.'));
          request.ontimeout = () => reject(new Error('The upload timed out before storage responded. Check your connection and R2 bucket availability, then try again.'));
          request.onload = () => request.status >= 200 && request.status < 300 ? resolve() : reject(new Error(`Storage rejected ${file.name} (HTTP ${request.status}). Check the R2 bucket CORS policy and upload permissions.`));
          request.send(file);
        });
        setDirectUpload({ name: file.name, percent: 100, stage: 'verifying', index: fileIndex + 1, total: files.length });
        const completeResponse = await fetch(`/api/workspace/media/${encodeURIComponent(init.assetId)}`, { method: 'POST', signal: AbortSignal.timeout(30_000) });
        const complete = await completeResponse.json().catch(() => ({}));
        if (!completeResponse.ok) throw new Error(complete.error || `Could not verify ${file.name}.`);
        pendingAssetId = null;
      }
      setDirectUpload(null); toast.success(`${files.length === 1 ? 'File' : `${files.length} files`} uploaded to your Media Library.`);
      const response = await fetch('/api/workspace/media', { cache: 'no-store' });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || 'The library could not be refreshed.');
      setMediaFolders(payload.folders || []);
      setMediaAssets((payload.assets || []).map((asset: { id: string; name: string; contentType: string; sizeBytes: string; createdAt: string; previewUrl: string | null; folderId: string }) => ({ id: asset.id, title: asset.name, slug: asset.id, type: 'media_asset', status: 'draft', currency: 'NGN', priceMinor: '0', updatedAt: asset.createdAt, salesCount: 0, revenueMinor: '0', coverUrl: asset.previewUrl, folderId: asset.folderId, contentType: asset.contentType, sizeBytes: asset.sizeBytes })));
    } catch (cause) {
      if (pendingAssetId) await fetch(`/api/workspace/media/${encodeURIComponent(pendingAssetId)}`, { method: 'DELETE' }).catch(() => undefined);
      setDirectUpload(null);
      toast.error(cause instanceof Error ? cause.message : 'The media upload failed.', { action: { label: 'Try again', onClick: () => void uploadMediaFiles(files.slice(retryFromIndex)) } });
      const response = await fetch('/api/workspace/media', { cache: 'no-store' }).catch(() => null);
      if (response?.ok) {
        const payload = await response.json().catch(() => ({}));
        setMediaFolders(payload.folders || []);
        setMediaAssets((payload.assets || []).map((asset: { id: string; name: string; contentType: string; sizeBytes: string; createdAt: string; previewUrl: string | null; folderId: string }) => ({ id: asset.id, title: asset.name, slug: asset.id, type: 'media_asset', status: 'draft', currency: 'NGN', priceMinor: '0', updatedAt: asset.createdAt, salesCount: 0, revenueMinor: '0', coverUrl: asset.previewUrl, folderId: asset.folderId, contentType: asset.contentType, sizeBytes: asset.sizeBytes })));
      }
    }
  }

  function handleMediaUpload(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files || []); event.target.value = ''; void uploadMediaFiles(files);
  }
  function openFolderDialog() {
    setFolderName('Untitled folder');
    setFolderDialogOpen(true);
  }
  function cancelCreation() {
    setSelectedType(null);
    if (!mediaOnly) router.replace('/workspace/products', { scroll: false });
    void load();
  }

  async function createMediaFolder(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const name = folderName.trim();
    if (!name) return;
    const response = await fetch('/api/workspace/media', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'create_folder', name }) });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) { toast.error(payload.error || 'Could not create folder.'); return; }
    setMediaFolders((current) => [...current, { ...payload.folder, count: 0 }]);
    setFolderName('');
    setFolderDialogOpen(false);
    setActiveFolderId(payload.folder.id);
    toast.success('Folder created.');
  }

  function toggleMediaSelection(id: string) {
    setSelectedMedia((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  }

  async function moveSelectedMedia(folderId: string) {
    const response = await fetch('/api/workspace/media', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'move', assetIds: selectedMedia, folderId }) });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) { toast.error(payload.error || 'Could not move files.'); return; }
    setMediaAssets((current) => current.map((asset) => selectedMedia.includes(asset.id) ? { ...asset, folderId } : asset));
    setMediaFolders((current) => current.map((folder) => ({ ...folder, count: mediaAssets.filter((asset) => asset.folderId === folder.id && !selectedMedia.includes(asset.id)).length + (folder.id === folderId ? selectedMedia.length : 0) })));
    setSelectedMedia([]);
    setMoveDialogOpen(false);
    setMoveDestinationId('');
    const movedCount = Number(payload.moved ?? selectedMedia.length);
    toast.success(`${movedCount} ${movedCount === 1 ? 'file' : 'files'} moved.`);
  }

  function selectMediaKind(kind: typeof mediaKind) {
    setMediaKind(kind);
    if (kind === 'all') setActiveFolderId(null);
  }

  function beginRename(target: { id: string; name: string; kind: 'asset' | 'folder' }) {
    setRenameTarget(target);
    setRenameValue(target.name);
  }

  async function saveRename(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const value = renameValue.trim();
    if (!renameTarget || !value) return;
    const response = await fetch(renameTarget.kind === 'asset' ? `/api/workspace/media/${encodeURIComponent(renameTarget.id)}` : '/api/workspace/media', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(renameTarget.kind === 'asset' ? { name: value } : { action: 'rename_folder', folderId: renameTarget.id, name: value }) });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) { toast.error(payload.error || 'Could not rename item.'); return; }
    if (renameTarget.kind === 'asset') setMediaAssets((current) => current.map((asset) => asset.id === renameTarget.id ? { ...asset, title: value } : asset));
    else setMediaFolders((current) => current.map((folder) => folder.id === renameTarget.id ? { ...folder, name: value } : folder));
    setRenameTarget(null);
    toast.success(`${renameTarget.kind === 'folder' ? 'Folder' : 'File'} renamed.`);
  }

  async function deleteMediaAsset(id: string) {
    const response = await fetch(`/api/workspace/media/${encodeURIComponent(id)}`, { method: 'DELETE' });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) { toast.error(payload.error || 'Could not delete file.'); return; }
    setMediaAssets((current) => current.filter((asset) => asset.id !== id));
    setMediaFolders((current) => current.map((folder) => folder.id === (mediaAssets.find((asset) => asset.id === id)?.folderId) ? { ...folder, count: Math.max(0, folder.count - 1) } : folder));
    setSelectedMedia((current) => current.filter((item) => item !== id));
    toast.success('File deleted.');
  }

  async function deleteMediaFolder(id: string) {
    const response = await fetch('/api/workspace/media', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'delete_folder', folderId: id }) });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) { toast.error(payload.error || 'Could not delete folder.'); return; }
    setMediaAssets((current) => current.map((asset) => asset.folderId === id ? { ...asset, folderId: payload.movedTo } : asset));
    setMediaFolders((current) => current.filter((folder) => folder.id !== id).map((folder) => folder.id === payload.movedTo ? { ...folder, count: folder.count + (mediaFolders.find((item) => item.id === id)?.count ?? 0) } : folder));
    if (activeFolderId === id) setActiveFolderId(null);
    toast.success('Folder deleted. Its files were moved to Uploads.');
  }

  async function confirmMediaDelete() {
    if (!deleteTarget) return;
    const target = deleteTarget;
    setDeleteTarget(null);
    if (target.kind === 'asset') await deleteMediaAsset(target.id);
    else await deleteMediaFolder(target.id);
  }


  const listed = useMemo(() => {
    const search = query.trim().toLowerCase();
    return products.filter((product) => (!mediaOnly || product.type === 'download') && (statusFilter === 'all' || product.status === statusFilter) && (typeFilter === 'all' || product.type === typeFilter) && (currencyFilter === 'all' || product.currency === currencyFilter) && (!search || product.title.toLowerCase().includes(search) || product.slug.toLowerCase().includes(search)))
      .sort((a, b) => sort === 'name' ? a.title.localeCompare(b.title) : sort === 'sales' ? b.salesCount - a.salesCount : sort === 'revenue' ? (currencyFilter === 'all' && a.currency !== b.currency ? a.currency.localeCompare(b.currency) : BigInt(b.revenueMinor) > BigInt(a.revenueMinor) ? 1 : BigInt(b.revenueMinor) < BigInt(a.revenueMinor) ? -1 : 0) : new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  }, [products, mediaOnly, query, statusFilter, typeFilter, currencyFilter, sort]);
  const mediaListed = mediaAssets.filter((asset) => mediaKind === 'all' || (mediaKind === 'image' ? asset.contentType.startsWith('image/') : mediaKind === 'audio' ? asset.contentType.startsWith('audio/') : mediaKind === 'video' ? asset.contentType.startsWith('video/') : !asset.contentType.startsWith('image/') && !asset.contentType.startsWith('audio/') && !asset.contentType.startsWith('video/'))).filter((asset) => !activeFolderId || asset.folderId === activeFolderId).filter((asset) => !query.trim() || asset.title.toLowerCase().includes(query.trim().toLowerCase())).sort((a, b) => sort === 'name' ? a.title.localeCompare(b.title) : new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  const mediaAssetName = (product: Product) => product.title;
  const activeFolderName = mediaFolders.find((folder) => folder.id === activeFolderId)?.name;

  if (selectedType) return <ProductCreateFlow type={selectedType} onCancel={cancelCreation}/>;

  async function changeStatus(product: Product, status: Product['status']) {
    setBusyId(product.id); setError('');
    try {
      const response = await fetch(`/api/workspace/products/${encodeURIComponent(product.id)}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status }) });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || 'Product status could not be updated.');
      toast.success(status === 'archived' ? `${product.title} archived.` : status === 'published' ? `${product.title} is live.` : `${product.title} moved to drafts.`);
      await load();
    } catch (cause) { toast.error(cause instanceof Error ? cause.message : 'Product status could not be updated.'); }
    finally { setBusyId(''); }
  }

  async function deleteDraftProduct() {
    if (!productDeleteTarget || busyId) return;
    const target = productDeleteTarget;
    setBusyId(target.id);
    try {
      const response = await fetch(`/api/workspace/products/${encodeURIComponent(target.id)}`, { method: 'DELETE' });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || 'Draft could not be deleted.');
      setProductDeleteTarget(null);
      toast.success(payload.cleanupPending ? 'Draft deleted. Some uploaded media may need provider cleanup.' : 'Draft deleted.');
      await load();
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : 'Draft could not be deleted.');
    } finally {
      setBusyId('');
    }
  }

  async function copyLink(product: Product) {
    try { await navigator.clipboard.writeText(`${window.location.origin}/c/${workspaceSlug}/${product.slug}`); toast.success('Product link copied.'); }
    catch { toast.error('Could not copy the link. Open the product page and copy its address.'); }
  }

  const title = mediaOnly ? 'Media library' : 'Products';
  const nextDraft = products.find((product) => product.status === 'draft');
  const nextDraftHref = nextDraft ? `/workspace/products/${nextDraft.id}/edit` : '';
  const countsUnavailable = !hasLoaded && (loading || Boolean(error));
  const tabs: { id: Filter | 'documents'; label: string; count: number | null }[] = mediaOnly ? [
    { id: 'all', label: 'All', count: countsUnavailable ? null : mediaAssets.length },
    { id: 'published', label: 'Audio', count: countsUnavailable ? null : mediaAssets.filter((asset) => asset.contentType.startsWith('audio/')).length },
    { id: 'draft', label: 'Image', count: countsUnavailable ? null : mediaAssets.filter((asset) => asset.contentType.startsWith('image/')).length },
    { id: 'archived', label: 'Video', count: countsUnavailable ? null : mediaAssets.filter((asset) => asset.contentType.startsWith('video/')).length },
    { id: 'documents', label: 'Documents', count: countsUnavailable ? null : mediaAssets.filter((asset) => !/^(image|audio|video)\//.test(asset.contentType)).length },
  ] : [
    { id: 'all', label: 'All', count: countsUnavailable ? null : mediaOnly ? products.filter((product) => product.type === 'download').length : summary.total },
    { id: 'published', label: 'Published', count: countsUnavailable ? null : products.filter((product) => product.status === 'published' && (!mediaOnly || product.type === 'download')).length },
    { id: 'draft', label: 'Drafts', count: countsUnavailable ? null : products.filter((product) => product.status === 'draft' && (!mediaOnly || product.type === 'download')).length },
    { id: 'archived', label: 'Archived', count: countsUnavailable ? null : products.filter((product) => product.status === 'archived' && (!mediaOnly || product.type === 'download')).length },
  ];

  return <div className={`creator-dashboard__body studio-overview product-library${mediaOnly ? ' product-library--media' : ''}`}>
    <div className="product-library__header"><div><h1 className={mediaOnly ? undefined : 'sr-only'}>{title}</h1>{mediaOnly && <p>Manage the files you make available to buyers.</p>}</div>{mediaOnly && <div className="media-library__header-actions"><button type="button" className="media-library__new-folder" onClick={openFolderDialog}><FolderPlus size={16}/>New folder</button><button type="button" className="creator-primary-action" onClick={() => uploadInputRef.current?.click()}><Plus size={16}/>Upload</button><input ref={uploadInputRef} className="sr-only" type="file" multiple accept=".pdf,.zip,.epub,.docx,.pptx,.xlsx,.mp3,.m4a,.wav,.ogg,.mp4,.mov,.webm,.png,.jpg,.jpeg,.webp,.gif" onChange={handleMediaUpload}/></div>}</div>
    {mediaOnly && directUpload && <div className="media-library__upload-status" role="status" aria-live="polite"><div><strong>{directUpload.stage === 'preparing' ? 'Preparing upload' : directUpload.stage === 'verifying' ? 'Verifying upload' : `Uploading ${directUpload.index} of ${directUpload.total} ${directUpload.total === 1 ? 'file' : 'files'}`}</strong><button type="button" aria-label="Dismiss upload status" onClick={() => setDirectUpload(null)}><X size={18}/></button></div><span><strong>{directUpload.name}</strong><small>{directUpload.stage === 'preparing' ? 'Getting file storage ready…' : directUpload.stage === 'verifying' ? 'Checking uploaded file…' : `Uploading · ${directUpload.percent === null ? 'In progress' : `${directUpload.percent}%`}`}</small><i className={directUpload.percent === null ? 'is-indeterminate' : ''}><b style={{ width: directUpload.percent === null ? undefined : `${directUpload.percent}%` }}/></i></span></div>}
    {mediaOnly && folderDialogOpen && (
      <Dialog open={folderDialogOpen} onOpenChange={setFolderDialogOpen} title="New folder" overlayClassName="media-folder-dialog" className="media-folder-dialog__create-form" asForm onSubmit={createMediaFolder}>
        <button type="button" className="media-folder-dialog__close" aria-label="Close" onClick={() => setFolderDialogOpen(false)}><X size={18}/></button>
        <h2 id="media-folder-title">New folder</h2>
        <Input autoFocus aria-label="Folder name" onFocus={(event) => event.currentTarget.select()} value={folderName} onChange={(event) => setFolderName(event.target.value)} placeholder="Untitled folder" maxLength={80}/>
        <div className="media-folder-dialog__actions"><Button variant="secondary" type="button" onClick={() => setFolderDialogOpen(false)}>Cancel</Button><Button type="submit" disabled={!folderName.trim()}>Create folder</Button></div>
      </Dialog>
    )}
    {!mediaOnly && <section className="product-library__formats" id="product-format-overview" aria-labelledby="product-format-heading"><div className="product-library__formats-heading"><div><h2 id="product-format-heading" tabIndex={-1}>What would you like to publish?</h2><p>Choose a format to start. Review everything before you publish.</p></div>{workspaceSlug && <Link className="product-library__store-preview" href={`/c/${encodeURIComponent(workspaceSlug)}`} target="_blank" rel="noreferrer" aria-label="Preview your buyer-facing storefront in a new tab"><Eye size={17} aria-hidden="true"/><span>Preview store</span><ExternalLink size={14} aria-hidden="true"/></Link>}</div><div className="product-library__format-grid">{creationFormats.map(({ id, label, detail, icon: Icon }) => <button type="button" className={`product-library__format-card product-library__format-card--${id}`} onClick={() => startCreation(id as OfferType)} key={id}><span className="product-library__format-icon"><Icon size={20} strokeWidth={1.9}/></span><strong>{label}</strong><small>{detail}</small></button>)}</div></section>}
    {!mediaOnly && loading && !products.length && <section className="product-library__stats product-library__stats--loading" aria-label="Product summary loading" aria-busy="true"><span className="sr-only" role="status">Loading product summary</span><article><span>Published</span><i aria-hidden="true"/><small>Available on your storefront</small></article><article><span>Drafts</span><i aria-hidden="true"/><small>Ready when you are</small></article><article><span>Product revenue</span><strong className="product-library__loading-zero">0</strong><small>0 confirmed sales</small></article></section>}
    {!mediaOnly && products.length > 0 && !error && <section className="product-library__stats" aria-label="Product summary">
      <article><span>Published</span><strong>{summary.published}</strong><small>Available on your storefront</small></article>
      <article className={nextDraft ? 'product-library__draft-stat' : undefined}><span>Drafts</span><strong>{summary.drafts}</strong>{nextDraft ? <Link className="product-library__stat-link" href={nextDraftHref}>Continue editing <span aria-hidden="true">→</span></Link> : <small>Ready when you are</small>}</article>
      <article><span>Product revenue</span>{summary.revenueByCurrency.length ? summary.revenueByCurrency.map((entry) => <strong key={entry.currency}>{formatMoney(entry.amountMinor, entry.currency)}</strong>) : <strong>{formatMoney('0', 'NGN')}</strong>}<small>{summary.salesCount.toLocaleString()} confirmed {summary.salesCount === 1 ? 'sale' : 'sales'}</small></article>
    </section>}
    {!mediaOnly && error && products.length > 0 && <div className="creator-dashboard-error" role="alert"><span>{error}</span><button type="button" onClick={() => void load()}><RefreshCw size={14}/> Try again</button></div>}
    {mediaOnly && renameTarget && (
      <Dialog open={Boolean(renameTarget)} onOpenChange={(open) => { if (!open) setRenameTarget(null); }} title={`Rename ${renameTarget.kind === 'folder' ? 'folder' : 'asset'}`} overlayClassName="media-folder-dialog" className="media-folder-dialog__panel" asForm onSubmit={saveRename}>
        <button type="button" className="media-folder-dialog__close" aria-label="Close" onClick={() => setRenameTarget(null)}><X size={18}/></button>
        <h2 id="media-rename-title">Rename {renameTarget.kind === 'folder' ? 'folder' : 'asset'}</h2>
        <p>Use a clear name so your library stays easy to scan.</p>
        <label><span>Name</span><Input autoFocus value={renameValue} onChange={(event) => setRenameValue(event.target.value)} maxLength={renameTarget.kind === 'asset' ? 180 : 80}/></label>
        <div className="media-folder-dialog__actions"><Button variant="secondary" type="button" onClick={() => setRenameTarget(null)}>Cancel</Button><Button type="submit" disabled={!renameValue.trim()}>Save</Button></div>
      </Dialog>
    )}
    {mediaOnly && deleteTarget && (
      <Dialog open={Boolean(deleteTarget)} onOpenChange={(open) => { if (!open) setDeleteTarget(null); }} title={`Delete ${deleteTarget.name}`} describedBy="media-delete-description" overlayClassName="media-folder-dialog" className="media-folder-dialog__panel media-library__delete-dialog">
        <button type="button" className="media-folder-dialog__close" aria-label="Cancel deletion" onClick={() => setDeleteTarget(null)}><X size={18}/></button>
        <h2 id="media-delete-title">Delete “{deleteTarget.name}”?</h2>
        <p id="media-delete-description">{deleteTarget.kind === 'folder' ? 'Files in this folder will move to Uploads.' : 'This permanently deletes the uploaded file. Files attached to products must first be removed from those products.'}</p>
        <div className="media-folder-dialog__actions"><Button variant="secondary" onClick={() => setDeleteTarget(null)}>Cancel</Button><Button variant="danger" onClick={() => void confirmMediaDelete()}>Delete</Button></div>
      </Dialog>
    )}
    {!mediaOnly && productDeleteTarget && (
      <Dialog open={Boolean(productDeleteTarget)} onOpenChange={(open) => { if (!open && busyId !== productDeleteTarget.id) setProductDeleteTarget(null); }} title="Delete draft" describedBy="product-delete-description" overlayClassName="media-folder-dialog" className="media-folder-dialog__panel product-delete-dialog">
        <button type="button" className="media-folder-dialog__close" aria-label="Close delete dialog" disabled={busyId === productDeleteTarget.id} onClick={() => setProductDeleteTarget(null)}><X size={18}/></button>
        <h2>Delete this draft?</h2>
        <p id="product-delete-description"><strong>“{productDeleteTarget.title}”</strong> will be permanently removed from your products. This can’t be undone.</p>
        <div className="media-folder-dialog__actions"><Button variant="secondary" disabled={busyId === productDeleteTarget.id} onClick={() => setProductDeleteTarget(null)}>Keep draft</Button><Button variant="danger" disabled={busyId === productDeleteTarget.id} onClick={() => void deleteDraftProduct()}>{busyId === productDeleteTarget.id ? 'Deleting…' : 'Delete draft'}</Button></div>
      </Dialog>
    )}
    {mediaOnly && moveDialogOpen && (
      <Dialog open={moveDialogOpen} onOpenChange={setMoveDialogOpen} title={`Move ${selectedMedia.length === 1 ? 'file' : 'files'}`} overlayClassName="media-folder-dialog" className="media-folder-dialog__panel media-library__move-dialog">
        <button type="button" className="media-folder-dialog__close" aria-label="Close" onClick={() => setMoveDialogOpen(false)}><X size={18}/></button>
        <h2 id="media-move-title">Move {selectedMedia.length === 1 ? 'file' : `${selectedMedia.length} files`}</h2>
        <p>{selectedMedia.length === 1 ? 'Choose the folder where this file should live.' : `Choose the folder where these ${selectedMedia.length} files should live.`}</p>
        <label className="media-library__move-destination"><span>Destination folder</span><WorkspaceSelect className="media-library__move-select" menuClassName="media-library__move-menu" value={moveDestinationId} onChange={(event) => setMoveDestinationId(event.target.value)}><option value="">Choose a folder</option>{mediaFolders.map((folder) => <option key={folder.id} value={folder.id}>{folder.name}</option>)}</WorkspaceSelect></label>
        <div className="media-folder-dialog__actions"><Button variant="secondary" onClick={() => setMoveDialogOpen(false)}>Cancel</Button><Button disabled={!moveDestinationId || selectedMedia.length === 0} onClick={() => void moveSelectedMedia(moveDestinationId)}>Move</Button></div>
      </Dialog>
    )}
    {mediaOnly && activeFolderId && <div className="media-library__breadcrumb" aria-label="Current folder"><button type="button" onClick={() => setActiveFolderId(null)}>All assets</button><span aria-hidden="true">/</span><strong>{activeFolderName || 'Folder'}</strong></div>}
    <section className="product-library__panel" aria-label="Product list">
      <div className={`product-library__tabs${mediaOnly ? ' product-library__tabs--media' : ''}`} role="group" aria-label={mediaOnly ? 'Filter media by type' : 'Filter products by status'}>{tabs.map((tab) => { const active = mediaOnly ? mediaKind === tab.label.toLowerCase() : statusFilter === tab.id; return <button key={tab.id} type="button" disabled={!hasLoaded} aria-pressed={active} className={active ? 'is-active' : ''} onClick={() => mediaOnly ? selectMediaKind(tab.label.toLowerCase() as typeof mediaKind) : setStatusFilter(tab.id as Filter)}>{tab.label}<span>{tab.count ?? '—'}</span></button>; })}</div>
      <div className={`product-library__toolbar${mediaOnly ? ' product-library__toolbar--media' : ''}`}>
        <div className="product-library__search-wrap">
          <SearchInput
            disabled={!hasLoaded}
            aria-label={mediaOnly ? 'Search assets' : 'Search products'}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onClear={() => setQuery('')}
            placeholder={mediaOnly ? 'Search files…' : 'Search products…'}
          />
        </div>
        {!mediaOnly && <label><span className="sr-only">Product type</span><WorkspaceSelect disabled={!hasLoaded} value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)}><option value="all">All types</option>{Object.entries(typeDetails).map(([key, value]) => <option key={key} value={key}>{value.label}</option>)}</WorkspaceSelect></label>}
        {!mediaOnly && <label><span className="sr-only">Product currency</span><WorkspaceSelect disabled={!hasLoaded} value={currencyFilter} onChange={(event) => setCurrencyFilter(event.target.value as typeof currencyFilter)}><option value="all">All currencies</option><option value="NGN">NGN</option><option value="USD">USD</option></WorkspaceSelect></label>}
        {mediaOnly && selectedMedia.length > 0 && <Button variant="secondary" size="sm" onClick={() => { setMoveDestinationId(''); setMoveDialogOpen(true); }} icon={<FolderPlus size={15}/>}>Move {selectedMedia.length === 1 ? 'file' : `${selectedMedia.length} files`}</Button>}
        <label><span className="sr-only">{mediaOnly ? 'Sort files' : 'Sort products'}</span><WorkspaceSelect disabled={!hasLoaded} value={sort} onChange={(event) => setSort(event.target.value)}><option value="updated">Recently updated</option>{!mediaOnly && <><option value="sales">Most sales</option><option value="revenue">Highest revenue</option></>}<option value="name">Name A–Z</option></WorkspaceSelect></label>
      </div>
      {loading && !hasLoaded ? <WorkspaceDataLoading label={mediaOnly ? 'media assets' : 'products'} variant={mediaOnly ? 'media' : 'table'} showMediaFolders={!activeFolderId}/> : error && !hasLoaded ? <div className="product-library__load-error" role="alert"><strong>We couldn’t load your products.</strong><p>{error}</p><button type="button" className="button button--outline" onClick={() => void load()}><RefreshCw size={14}/> Try again</button></div> : ((mediaOnly ? mediaListed : listed).length || mediaOnly) ? <>{mediaOnly && !activeFolderId && <section className="media-library__folders" aria-label="Folders"><div className="media-library__section-heading"><h2>Folders</h2><span>{mediaFolders.length}</span></div><div className="media-library__folder-grid">{mediaFolders.map((folder) => <article className={`media-library__folder-card${folder.isDefault ? ' is-default' : ''}`} key={folder.id}><button type="button" className="media-library__folder-open" onClick={() => setActiveFolderId(folder.id)}><Folder size={22}/><span><strong>{folder.name}</strong><small>{folder.count} {folder.count === 1 ? 'file' : 'files'}</small></span></button><DropdownMenu label={`Actions for ${folder.name}`} trigger={<MoreVertical size={16}/>} className="media-library__folder-menu"><button type="button" role="menuitem" onClick={() => beginRename({ id: folder.id, name: folder.name, kind: 'folder' })}><Pencil size={14}/>Rename</button>{folder.isDefault ? <button type="button" role="menuitem" disabled title="Uploads is the permanent default folder"><Trash2 size={14}/>Delete</button> : <button type="button" role="menuitem" className="is-danger" onClick={() => setDeleteTarget({ id: folder.id, name: folder.name, kind: "folder" })}><Trash2 size={14}/>Delete</button>}</DropdownMenu></article>)}</div></section>}<div className={mediaOnly ? 'media-library__grid' : 'product-library__table-wrap'} aria-busy={loading}>{mediaOnly ? (mediaListed.length ? mediaListed.map((product) => <article className={`media-library__card${selectedMedia.includes(product.id) ? ' is-selected' : ''}`} key={product.id}><div className="media-library__preview">{product.coverUrl ? <img src={product.coverUrl} alt={`Preview of ${mediaAssetName(product)}`}/> : <Package size={34}/>}<button type="button" aria-pressed={selectedMedia.includes(product.id)} aria-label={`${selectedMedia.includes(product.id) ? 'Deselect' : 'Select'} ${mediaAssetName(product)}`} onClick={() => toggleMediaSelection(product.id)}><span/></button><DropdownMenu label={`Actions for ${mediaAssetName(product)}`} trigger={<MoreVertical size={16}/>} className="media-library__card-menu"><button type="button" role="menuitem" onClick={() => beginRename({ id: product.id, name: mediaAssetName(product), kind: 'asset' })}><Pencil size={14}/>Rename</button><button type="button" role="menuitem" onClick={() => { setSelectedMedia([product.id]); setMoveDestinationId(''); setMoveDialogOpen(true); }}><FolderPlus size={14}/>Move</button><button type="button" role="menuitem" onClick={async () => { const response = await fetch(`/api/workspace/media/${encodeURIComponent(product.id)}`); const result = await response.json().catch(() => ({})); if (response.ok && result.url) window.location.assign(result.url); else setError(result.error || 'Could not download this file.'); }}><Download size={14}/>Download</button><button type="button" role="menuitem" className="is-danger" onClick={() => setDeleteTarget({ id: product.id, name: product.title, kind: "asset" })}><Trash2 size={14}/>Delete</button></DropdownMenu></div><strong>{mediaAssetName(product)}</strong><small>{fileTypeLabel(product.contentType)} · {(Number(product.sizeBytes) / (1024 * 1024)).toFixed(Number(product.sizeBytes) < 1024 * 1024 ? 2 : 1)} MB · {formatDate(product.updatedAt)}</small></article>) : <div className="media-library__empty" role="status"><span><Folder size={24}/></span><strong>{activeFolderId && !mediaAssets.some((asset) => asset.folderId === activeFolderId) ? 'This folder is empty' : query || mediaKind !== 'all' ? 'No files match these filters' : 'No files yet'}</strong><p>{activeFolderId && !mediaAssets.some((asset) => asset.folderId === activeFolderId) ? 'Upload files here, or return to all assets to move existing files into this folder.' : query || mediaKind !== 'all' ? 'Try another search or file type, or clear your filters.' : 'Upload files to start building your library.'}</p>{(activeFolderId && !mediaAssets.some((asset) => asset.folderId === activeFolderId) || !activeFolderId && !mediaAssets.length && !query && mediaKind === 'all') && <button type="button" onClick={() => uploadInputRef.current?.click()}><Plus size={15}/>Upload files</button>}{activeFolderId && <button type="button" className="media-library__empty-back" onClick={() => setActiveFolderId(null)}>Back to all assets</button>}</div>) : <table className="product-library__table"><thead><tr><th>Product</th><th>Price</th><th>Sales</th><th>Revenue</th><th>Status</th><th>Actions</th></tr></thead><tbody>{listed.map((product) => {
        const detail = typeDetails[product.type] ?? { label: product.type.replaceAll('_', ' '), icon: Package }; const Icon = detail.icon;
        return <tr key={product.id}><td><div className={`product-library__identity product-library__identity--${product.type}`}><span className="product-library__cover" aria-hidden="true">{product.coverUrl ? <img src={product.coverUrl} alt=""/> : <b style={{ '--cover-title-size': `${Math.max(5, Math.min(11, Math.sqrt(8000 / Math.max(product.title.length, 1))))}px` } as CSSProperties}>{product.title}</b>}</span><span className="product-library__name"><strong>{product.title}</strong><small>{detail.label} · Updated {formatDate(product.updatedAt)}</small></span></div></td><td>{Number(product.priceMinor) === 0 ? 'Free' : formatMoney(product.priceMinor, product.currency)}</td><td>{product.salesCount.toLocaleString()}</td><td>{formatMoney(product.revenueMinor, product.currency)}</td><td><Badge variant={product.status}>{product.status}</Badge></td><td><div className="product-library__actions"><DropdownMenu label={`Actions for ${product.title}`} trigger={<MoreVertical size={16}/>} className="product-library__row-menu"><button type="button" role="menuitem" onClick={() => router.push(`/workspace/products/${encodeURIComponent(product.id)}/edit`)}><Pencil size={14}/>{product.status === 'draft' ? 'Continue editing' : 'Edit product'}</button>{product.status === 'published' && <><button type="button" role="menuitem" onClick={() => window.open(`/c/${workspaceSlug}/${product.slug}`, '_blank', 'noopener,noreferrer')}><Eye size={14}/>View product</button><button type="button" role="menuitem" onClick={() => void copyLink(product)}><Copy size={14}/>Copy link</button><button type="button" role="menuitem" className="is-danger" disabled={busyId === product.id} onClick={() => void changeStatus(product, 'archived')}><Archive size={14}/>Archive</button></>}{product.status === 'archived' && <button type="button" role="menuitem" disabled={busyId === product.id} onClick={() => void changeStatus(product, 'draft')}><RefreshCw size={14}/>Restore to drafts</button>}{product.status === 'draft' && <button type="button" role="menuitem" className="is-danger" disabled={busyId === product.id} onClick={() => setProductDeleteTarget(product)}><Trash2 size={14}/>Delete draft</button>}</DropdownMenu></div></td></tr>;
      })}</tbody></table>}</div></> : <EmptyState icon={<ShoppingBag size={22} />} title={query || statusFilter !== 'all' || typeFilter !== 'all' || currencyFilter !== 'all' ? 'No products match these filters' : mediaOnly ? 'No digital downloads yet' : 'No products yet'} description={query || statusFilter !== 'all' || typeFilter !== 'all' || currencyFilter !== 'all' ? 'Try changing your search or filters.' : mediaOnly ? 'Create a download to make files available to your buyers.' : 'Choose a product type above to create your first offer.'} action={!query && statusFilter === 'all' && typeFilter === 'all' && currencyFilter === 'all' && mediaOnly ? <Button onClick={() => startCreation('download')} icon={<Plus size={15}/>}>Create a download</Button> : undefined} />}
    </section>
  </div>;
}

