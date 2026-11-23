const ALLOWED_NODES = new Set(['doc', 'paragraph', 'bulletList', 'orderedList', 'listItem', 'hardBreak', 'text']);
const ALLOWED_MARKS = new Set(['bold', 'italic', 'underline', 'link']);

function safeHref(value) {
  if (typeof value !== 'string') return null;
  try {
    const url = new URL(value);
    return ['http:', 'https:', 'mailto:'].includes(url.protocol) ? url.href : null;
  } catch { return null; }
}

function sanitizeNode(node) {
  if (!node || typeof node !== 'object' || Array.isArray(node) || !ALLOWED_NODES.has(node.type)) return null;
  const clean = { type: node.type };
  if (node.type === 'text') {
    if (typeof node.text !== 'string') return null;
    clean.text = node.text.slice(0, 6000);
  }
  if (Array.isArray(node.marks)) {
    const marks = node.marks.flatMap((mark) => {
      if (!mark || !ALLOWED_MARKS.has(mark.type)) return [];
      if (mark.type === 'link') {
        const href = safeHref(mark.attrs?.href);
        return href ? [{ type: 'link', attrs: { href, target: '_blank', rel: 'noopener noreferrer' } }] : [];
      }
      return [{ type: mark.type }];
    });
    if (marks.length) clean.marks = marks;
  }
  if (Array.isArray(node.content)) clean.content = node.content.map(sanitizeNode).filter(Boolean);
  return clean;
}

function asDocument(value) {
  let doc = value;
  if (typeof value === 'string') {
    try { doc = JSON.parse(value); } catch { return null; }
  }
  if (!doc || doc.type !== 'doc' || !Array.isArray(doc.content)) return null;
  return sanitizeNode(doc);
}

function textFromNode(node) {
  if (node.type === 'text') return node.text;
  if (node.type === 'hardBreak') return '\n';
  const text = (node.content ?? []).map(textFromNode).join('');
  return ['paragraph', 'listItem'].includes(node.type) ? `${text}\n` : text;
}

function escapeHtml(value) {
  return value.replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
}

function renderNode(node) {
  if (node.type === 'text') {
    let html = escapeHtml(node.text);
    for (const mark of node.marks ?? []) {
      if (mark.type === 'bold') html = `<strong>${html}</strong>`;
      if (mark.type === 'italic') html = `<em>${html}</em>`;
      if (mark.type === 'underline') html = `<u>${html}</u>`;
      if (mark.type === 'link') html = `<a href="${escapeHtml(mark.attrs.href)}" target="_blank" rel="noopener noreferrer">${html}</a>`;
    }
    return html;
  }
  if (node.type === 'hardBreak') return '<br>';
  const children = (node.content ?? []).map(renderNode).join('');
  if (node.type === 'paragraph') return `<p>${children || '<br>'}</p>`;
  if (node.type === 'bulletList') return `<ul>${children}</ul>`;
  if (node.type === 'orderedList') return `<ol>${children}</ol>`;
  if (node.type === 'listItem') return `<li>${children}</li>`;
  return children;
}

export function normalizeProductDescription(value) {
  if (typeof value === 'string') return value;
  if (!value || typeof value !== 'object' || Array.isArray(value)) return '';
  if (value.schemaVersion === 2) {
    const doc = asDocument(value.document);
    return doc ? (doc.content ?? []).map(textFromNode).join('').trim() : '';
  }
  return typeof value.text === 'string' ? value.text : '';
}

export function productDescriptionContent(value) {
  if (value && typeof value === 'object' && !Array.isArray(value) && value.schemaVersion === 2) {
    const doc = asDocument(value.document);
    if (doc) return JSON.stringify(doc);
  }
  const text = normalizeProductDescription(value);
  return JSON.stringify({ type: 'doc', content: text.split(/\n+/).map((line) => ({ type: 'paragraph', content: line ? [{ type: 'text', text: line }] : [] })) });
}

export function serializeProductDescription(value) {
  const document = asDocument(value);
  if (document) return { schemaVersion: 2, document };
  return { schemaVersion: 1, text: typeof value === 'string' ? value : '' };
}

export function productDescriptionHtml(value) {
  if (value && typeof value === 'object' && !Array.isArray(value) && value.schemaVersion === 2) {
    const doc = asDocument(value.document);
    return doc ? (doc.content ?? []).map(renderNode).join('') : '';
  }
  return normalizeProductDescription(value).split(/\n+/).map((line) => `<p>${escapeHtml(line)}</p>`).join('');
}
