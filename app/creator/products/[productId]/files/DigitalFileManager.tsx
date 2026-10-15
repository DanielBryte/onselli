'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, ArrowRight, FileDown, Upload } from 'lucide-react';
import { getSupabase } from '@/lib/supabase';

type DownloadFile = { id: string; file_name: string; size_bytes: number; status: 'PENDING' | 'READY' };
type Product = { id: string; title: string; status: string; kind: string };

const ACCEPTED_FILES = '.pdf,.zip,.epub,.docx,.pptx,.xlsx,.mp3,.m4a,.png,.jpg,.jpeg,.webp';

export default function DigitalFileManager({ productId }: { productId: string }) {
  const router = useRouter();
  const [product, setProduct] = useState<Product | null>(null);
  const [fileInfo, setFileInfo] = useState<DownloadFile | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [publishAfterUpload, setPublishAfterUpload] = useState(false);

  useEffect(() => {
    let active = true;
    void (async () => {
      const supabase = getSupabase();
      if (!supabase) { setError('Supabase is not configured.'); setLoading(false); return; }
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) { router.replace('/login'); return; }
      const { data: ownedProduct, error: productError } = await supabase.from('creator_products').select('id,title,status,kind').eq('id', productId).single();
      if (productError || !ownedProduct || ownedProduct.kind !== 'DOWNLOAD') {
        if (active) { setError('Digital product not found or you do not have access to manage it.'); setLoading(false); }
        return;
      }
      const { data: session } = await supabase.auth.getSession();
      const response = await fetch(`/api/creator/products/${productId}/files`, { headers: { Authorization: `Bearer ${session.session?.access_token ?? ''}` }, cache: 'no-store' });
      const payload = await response.json().catch(() => ({}));
      if (!active) return;
      setProduct(ownedProduct as Product);
      if (!response.ok) setError(payload.error || 'Could not load your file setup.');
      else setFileInfo(payload.file ?? null);
      setPublishAfterUpload(new URLSearchParams(window.location.search).get('publish') === '1');
      setLoading(false);
    })();
    return () => { active = false; };
  }, [productId, router]);

  async function publishOffer() {
    const supabase = getSupabase();
    if (!supabase || !fileInfo || fileInfo.status !== 'READY') return;
    setBusy(true); setError('');
    const { error: updateError } = await supabase.from('creator_products').update({ status: 'PUBLISHED' }).eq('id', productId);
    setBusy(false);
    if (updateError) { setError(`File is ready, but the offer could not be published: ${updateError.message}`); return; }
    router.push('/creator'); router.refresh();
  }

  async function uploadFile() {
    const supabase = getSupabase();
    if (!supabase || !file) return;
    setBusy(true); setError(''); setNotice('');
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token;
    if (!token) { setBusy(false); setError('Your session expired. Log in again to upload this file.'); return; }
    let pendingFileId: string | null = null;
    try {
      if (fileInfo?.status === 'PENDING') {
        await fetch(`/api/creator/products/${productId}/files`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ fileId: fileInfo.id }) });
        setFileInfo(null);
      }

      const initResponse = await fetch(`/api/creator/products/${productId}/files`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileName: file.name, sizeBytes: file.size }),
      });
      const init = await initResponse.json().catch(() => ({}));
      if (!initResponse.ok) throw new Error(init.error || 'Could not start the upload.');
      pendingFileId = init.fileId;

      const uploadResponse = await fetch(init.uploadUrl, { method: 'PUT', headers: { 'Content-Type': init.contentType }, body: file });
      if (!uploadResponse.ok) throw new Error('The file upload failed. Check your connection and try again.');

      const completeResponse = await fetch(`/api/creator/products/${productId}/files/complete`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileId: init.fileId }),
      });
      const completion = await completeResponse.json().catch(() => ({}));
      if (!completeResponse.ok) throw new Error(completion.error || 'Could not verify the uploaded file.');

      const attachedFile = { id: init.fileId, file_name: file.name, size_bytes: file.size, status: 'READY' as const };
      pendingFileId = null;
      setFileInfo(attachedFile); setFile(null);
      if (publishAfterUpload) {
        const { error: updateError } = await supabase.from('creator_products').update({ status: 'PUBLISHED' }).eq('id', productId);
        if (updateError) { setError(`File is ready, but the offer could not be published: ${updateError.message}`); return; }
        router.push('/creator'); router.refresh();
        return;
      }
      setNotice('File is uploaded and private. Publish the offer when you are ready.');
    } catch (uploadError) {
      if (pendingFileId) await fetch(`/api/creator/products/${productId}/files`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ fileId: pendingFileId }) }).catch(() => undefined);
      setError(uploadError instanceof Error ? uploadError.message : 'The file upload failed. Check your connection and try again.');
    } finally {
      setBusy(false);
    }
  }

  const fileSize = (bytes: number) => `${(bytes / (1024 * 1024)).toFixed(bytes < 1024 * 1024 ? 2 : 1)} MB`;

  return <main className="page-shell"><div className="page-content" style={{ maxWidth: 760 }}>
    <Link href="/creator" className="text-link" style={{ color: '#52645a' }}><ArrowLeft size={14}/> Back to studio</Link>
    <div style={{ marginTop: 35 }}><span className="section-kicker">Digital product setup</span><h1 className="page-title">Add your download.</h1><p className="page-subtitle">{product ? `Attach the file buyers receive with “${product.title}”.` : 'Your product file is stored privately and only buyers with active access can download it.'}</p></div>
    {loading ? <p style={{ marginTop: 28 }}>Loading file setup…</p> : error && !product ? <p className="form-error" role="alert" style={{ marginTop: 24 }}>{error}</p> : <section className="form-card" style={{ marginTop: 26 }}>
      {fileInfo?.status === 'READY' ? <div className="product-row" style={{ padding: 0, border: 0 }}><div><span className="section-kicker">Private file ready</span><h2 style={{ margin: '6px 0', fontSize: 16 }}>{fileInfo.file_name}</h2><p>{fileSize(fileInfo.size_bytes)}</p></div><FileDown size={20}/></div> : <>
        <div className="field"><label htmlFor="product-file">Product file</label><input id="product-file" type="file" accept={ACCEPTED_FILES} onChange={event => setFile(event.target.files?.[0] ?? null)} required /></div>
        <p className="notice" style={{ marginTop: 10 }}>PDF, ZIP, EPUB, Office documents, MP3, M4A, PNG, JPG, or WEBP. Maximum 100 MB. The file is uploaded directly to your private Cloudflare R2 bucket.</p>
        <button className="button button--mint" type="button" onClick={() => void uploadFile()} disabled={busy || !file} style={{ width: '100%', marginTop: 16, background: '#014733', color: '#fff' }}>{busy ? 'Uploading securely…' : 'Upload file'} <Upload size={15}/></button>
      </>}
      {error && <p className="form-error" role="alert" style={{ marginTop: 15 }}>{error}</p>}
      {notice && <p className="notice" role="status" style={{ marginTop: 15 }}>{notice}</p>}
      {fileInfo?.status === 'READY' && product?.status !== 'PUBLISHED' && <button className="button button--mint" type="button" onClick={() => void publishOffer()} disabled={busy} style={{ width: '100%', marginTop: 20, background: '#014733', color: '#fff' }}>{busy ? 'Publishing…' : 'Publish offer'} <ArrowRight size={15}/></button>}
      {product?.status === 'PUBLISHED' && <p className="notice" style={{ marginTop: 16 }}>The sales page is live. Buyers receive this file after Bachs confirms their payment.</p>}
      {!fileInfo && <Link href="/creator" className="text-link" style={{ display: 'inline-flex', marginTop: 18, color: '#52645a' }}>Save as draft and finish later</Link>}
    </section>}
  </div></main>;
}
