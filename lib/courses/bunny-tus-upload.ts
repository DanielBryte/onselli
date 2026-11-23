export type BunnyTusCredentials = { endpoint: string; libraryId: string; videoId: string; expires: number; signature: string };

function metadataValue(value: string) {
  const bytes = new TextEncoder().encode(value);
  let binary = '';
  bytes.forEach((byte) => { binary += String.fromCharCode(byte); });
  return btoa(binary);
}

function xhrRequest(url: string, method: string, headers: Record<string, string>, body?: Blob, onProgress?: (loaded: number) => void) {
  return new Promise<XMLHttpRequest>((resolve, reject) => {
    const xhr = new XMLHttpRequest(); xhr.open(method, url);
    Object.entries(headers).forEach(([key, value]) => xhr.setRequestHeader(key, value));
    xhr.upload.onprogress = (event) => { if (event.lengthComputable) onProgress?.(event.loaded); };
    xhr.onerror = () => reject(new Error('Upload interrupted. Check your connection and retry.'));
    xhr.onabort = () => reject(new Error('Upload was canceled.'));
    xhr.onload = () => resolve(xhr);
    xhr.send(body ?? null);
  });
}

export async function uploadBunnyTus(file: File, credentials: BunnyTusCredentials, onProgress: (percent: number) => void) {
  const common = {
    'Tus-Resumable': '1.0.0',
    AuthorizationSignature: credentials.signature,
    AuthorizationExpire: String(credentials.expires),
    LibraryId: credentials.libraryId,
    VideoId: credentials.videoId,
  };
  const created = await xhrRequest(credentials.endpoint, 'POST', {
    ...common,
    'Upload-Length': String(file.size),
    'Upload-Metadata': `filetype ${metadataValue(file.type)},title ${metadataValue(file.name)}`,
  });
  if (created.status !== 201) throw new Error('The video upload could not be started. Please retry.');
  const location = created.getResponseHeader('Location');
  if (!location) throw new Error('The video provider did not return an upload session. Please retry.');
  const uploadUrl = new URL(location, credentials.endpoint).toString();
  let offset = Number(created.getResponseHeader('Upload-Offset') ?? 0);
  const chunkSize = 16 * 1024 * 1024;
  let failures = 0;

  while (offset < file.size) {
    const end = Math.min(offset + chunkSize, file.size);
    const chunk = file.slice(offset, end);
    try {
      const sent = await xhrRequest(uploadUrl, 'PATCH', { ...common, 'Content-Type': 'application/offset+octet-stream', 'Upload-Offset': String(offset) }, chunk,
        (loaded) => onProgress(Math.min(100, Math.floor((offset + loaded) / file.size * 100))));
      if (sent.status !== 204) throw new Error('The video upload paused. Retrying…');
      const nextOffset = Number(sent.getResponseHeader('Upload-Offset'));
      if (!Number.isSafeInteger(nextOffset) || nextOffset <= offset || nextOffset > file.size) throw new Error('The video upload returned an invalid position.');
      offset = nextOffset; failures = 0; onProgress(Math.floor(offset / file.size * 100));
    } catch (error) {
      failures += 1;
      if (failures > 4) throw error;
      await new Promise((resolve) => setTimeout(resolve, 500 * (2 ** failures)));
      const head = await xhrRequest(uploadUrl, 'HEAD', common);
      if (head.status !== 200 && head.status !== 204) throw error;
      const recoveredOffset = Number(head.getResponseHeader('Upload-Offset'));
      if (!Number.isSafeInteger(recoveredOffset) || recoveredOffset < 0 || recoveredOffset > file.size) throw new Error('The upload could not resume safely. Please start again.');
      offset = recoveredOffset;
    }
  }
  onProgress(100);
}
