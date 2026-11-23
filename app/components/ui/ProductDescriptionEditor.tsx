'use client';

import { EditorContent, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import Link from '@tiptap/extension-link';
import { Bold, Italic, Link2, List, Underline as UnderlineIcon } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import Input from '@/app/components/ui/Input';
import Button from '@/app/components/ui/Button';

function documentValue(value: string) {
  try {
    const parsed = JSON.parse(value);
    if (parsed?.type === 'doc' && Array.isArray(parsed.content)) return parsed;
  } catch { /* Legacy descriptions are plain text. */ }
  return { type: 'doc', content: value.split(/\n+/).map((text) => ({ type: 'paragraph', content: text ? [{ type: 'text', text }] : [] })) };
}

export default function ProductDescriptionEditor({ id, value, onChange, invalid, placeholder, describedBy }: {
  id: string;
  value: string;
  onChange: (json: string, plainText: string) => void;
  invalid?: boolean;
  placeholder: string;
  describedBy?: string;
}) {
  const [empty, setEmpty] = useState(true);
  const [linkPopoverOpen, setLinkPopoverOpen] = useState(false);
  const [linkText, setLinkText] = useState('');
  const [linkUrl, setLinkUrl] = useState('');
  const [linkError, setLinkError] = useState('');
  const editorRootRef = useRef<HTMLDivElement>(null);
  const linkButtonRef = useRef<HTMLButtonElement>(null);
  const linkPopoverRef = useRef<HTMLDivElement>(null);
  const linkUrlInputRef = useRef<HTMLInputElement>(null);
  const [linkPopoverLeft, setLinkPopoverLeft] = useState(8);
  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: false,
      }),
      Underline,
      Link.configure({
        openOnClick: false,
        autolink: true,
        linkOnPaste: true,
        HTMLAttributes: { rel: 'noopener noreferrer', target: '_blank' },
      }),
    ],
    content: documentValue(value),
    onUpdate: ({ editor: current }) => {
      const text = current.getText({ blockSeparator: '\n' });
      setEmpty(!text.trim());
      onChange(JSON.stringify(current.getJSON()), text);
    },
    editorProps: { attributes: { id, class: 'product-description-editor__body', 'data-placeholder': placeholder, role: 'textbox', 'aria-multiline': 'true', 'aria-required': 'true', 'aria-label': 'Product description', ...(invalid ? { 'aria-invalid': 'true' } : {}), ...(describedBy ? { 'aria-describedby': describedBy } : {}) } },
  });

  useEffect(() => {
    if (!editor) return;
    const current = JSON.stringify(editor.getJSON());
    if (value && value !== current) editor.commands.setContent(documentValue(value), { emitUpdate: false });
    setEmpty(editor.isEmpty);
  }, [editor, value]);

  useEffect(() => {
    if (!linkPopoverOpen) return;
    const button = linkButtonRef.current;
    const root = editorRootRef.current;
    if (button && root) {
      const buttonRect = button.getBoundingClientRect();
      const rootRect = root.getBoundingClientRect();
      const popoverWidth = Math.min(240, root.clientWidth - 16);
      setLinkPopoverLeft(Math.max(8, Math.min(buttonRect.left - rootRect.left, root.clientWidth - popoverWidth - 8)));
    }
    linkUrlInputRef.current?.focus();
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!linkPopoverRef.current?.contains(target) && !linkButtonRef.current?.contains(target)) setLinkPopoverOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setLinkPopoverOpen(false);
        linkButtonRef.current?.focus();
      }
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [linkPopoverOpen]);

  const activeEditor = editor;
  if (!activeEditor) return <div className="product-description-editor" aria-busy="true" />;
  function openLinkDialog() {
    const { from, to } = activeEditor!.state.selection;
    setLinkText(activeEditor!.state.doc.textBetween(from, to, ' '));
    setLinkUrl(activeEditor!.getAttributes('link').href ?? '');
    setLinkError('');
    setLinkPopoverOpen(true);
  }
  function addLink() {
    const text = linkText.trim();
    if (!text) { setLinkError('Enter the text you want people to click.'); return; }
    let href: string;
    try {
      const parsed = new URL(linkUrl.trim());
      if (!['https:', 'http:', 'mailto:'].includes(parsed.protocol)) throw new Error();
      href = parsed.href;
    } catch { setLinkError('Enter a valid web address or email link.'); return; }
    activeEditor!.chain().focus().insertContent({ type: 'text', text, marks: [{ type: 'link', attrs: { href } }] }).run();
    setLinkPopoverOpen(false);
  }
  const actions = [
    { label: 'Bold', icon: Bold, active: editor.isActive('bold'), run: () => editor.chain().focus().toggleBold().run() },
    { label: 'Italic', icon: Italic, active: editor.isActive('italic'), run: () => editor.chain().focus().toggleItalic().run() },
    { label: 'Underline', icon: UnderlineIcon, active: editor.isActive('underline'), run: () => editor.chain().focus().toggleUnderline().run() },
    { label: 'Bulleted list', icon: List, active: editor.isActive('bulletList'), run: () => editor.chain().focus().toggleBulletList().run() },
    { label: editor.isActive('link') ? 'Remove link' : 'Add link', icon: Link2, active: editor.isActive('link'), run: () => {
      if (editor.isActive('link')) { editor.chain().focus().unsetLink().run(); return; }
      openLinkDialog();
    } },
  ];

  return <div ref={editorRootRef} className={`product-description-editor${invalid ? ' is-invalid' : ''}`} data-empty={empty} data-placeholder={placeholder}>
    <div className="product-description-editor__toolbar" role="toolbar" aria-label="Description formatting">
      {actions.map(({ label, icon: Icon, active, run }) => <button key={label} ref={label === 'Add link' || label === 'Remove link' ? linkButtonRef : undefined} type="button" aria-label={label} aria-pressed={active} aria-expanded={label === 'Add link' ? linkPopoverOpen : undefined} title={label} className={active ? 'is-active' : ''} onMouseDown={(event) => event.preventDefault()} onClick={() => { if (label === 'Add link' && linkPopoverOpen) setLinkPopoverOpen(false); else run(); }}><Icon size={18} strokeWidth={2}/></button>)}
    </div>
    <EditorContent editor={editor} />
    <span className="sr-only">Basic formatting: bold, italic, underline, bulleted lists, and links.</span>
    {linkPopoverOpen && <div ref={linkPopoverRef} className="product-description-link-popover" style={{ left: linkPopoverLeft }} role="group" aria-label="Add a link" onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); addLink(); } }}>
      <label className="sr-only" htmlFor={`${id}-link-url`}>URL</label>
      <Input ref={linkUrlInputRef} id={`${id}-link-url`} value={linkUrl} onChange={(event) => { setLinkUrl(event.target.value); setLinkError(''); }} placeholder="Enter URL" inputMode="url" autoComplete="url" maxLength={2048}/>
      <label className="sr-only" htmlFor={`${id}-link-text`}>Link text</label>
      <Input id={`${id}-link-text`} value={linkText} onChange={(event) => { setLinkText(event.target.value); setLinkError(''); }} placeholder="Link text" maxLength={200}/>
      <small>Use a full web address or email link.</small>
      {linkError && <p className="product-description-link-popover__error" role="alert">{linkError}</p>}
      <footer><Button variant="secondary" onClick={() => setLinkPopoverOpen(false)}>Cancel</Button><Button type="button" onClick={addLink}>Add link</Button></footer>
    </div>}
  </div>;
}
