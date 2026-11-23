'use client';

import WorkspaceSelect from '@/app/components/ui/WorkspaceSelect';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { DndContext, KeyboardSensor, PointerSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core';
import { SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, Check, Eye, GripVertical, Monitor, Plus, Smartphone, Trash2 } from 'lucide-react';
import CreatorNav from '../CreatorNav';
import { siteSectionTypes, type siteDraftSchema } from '@/src/server/sites/validation';
import type { z } from 'zod';

type SiteDraft = z.infer<typeof siteDraftSchema>;
type SitePage = { id: string; slug: string; title: string; isHome: boolean; draftContent: { sections?: SiteDraft['sections'] } | null; seo: SiteDraft['seo'] };
type SiteState = { id: string; status: string; theme: SiteDraft['theme']; seo: SiteDraft['seo'] };
const labels: Record<typeof siteSectionTypes[number], string> = { hero: 'Hero', rich_text: 'Text', product_grid: 'Products', featured_product: 'Featured product', course_grid: 'Courses', form: 'Form', testimonials: 'Testimonials', stats: 'Statistics', faq: 'FAQ', image: 'Image', video: 'Video', cta: 'Call to action', social_links: 'Social links', newsletter: 'Email signup', contact: 'Contact' };
const selectableSectionTypes = siteSectionTypes;
const templates: { id: SiteDraft['theme']['template']; title: string; tone: string }[] = [
  { id: 'studio', title: 'Studio', tone: 'sage' }, { id: 'editorial', title: 'Editorial', tone: 'cream' }, { id: 'minimal', title: 'Minimal', tone: 'stone' }, { id: 'warm', title: 'Warm', tone: 'clay' }, { id: 'modern', title: 'Modern', tone: 'blue' },
];
const freshSection = (type: typeof siteSectionTypes[number], id: string): SiteDraft['sections'][number] => ({ id, type, visible: true, content: { eyebrow: '', title: labels[type], body: '', buttonText: '', buttonUrl: '' } });

function SortableSection({ section, index, count, onMove, onRemove, onChange }: { section: SiteDraft['sections'][number]; index: number; count: number; onMove: (direction: -1 | 1) => void; onRemove: () => void; onChange: (next: SiteDraft['sections'][number]) => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: section.id });
  return <article ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.65 : 1 }} className="site-section-card">
    <header><button type="button" className="site-section-drag" aria-label={'Reorder ' + labels[section.type]} {...attributes} {...listeners}><GripVertical size={15}/></button><span>{labels[section.type]}</span><div><button type="button" aria-label="Move section up" disabled={index === 0} onClick={() => onMove(-1)}><ArrowUp size={14}/></button><button type="button" aria-label="Move section down" disabled={index === count - 1} onClick={() => onMove(1)}><ArrowDown size={14}/></button><button type="button" aria-label="Remove section" onClick={onRemove}><Trash2 size={14}/></button></div></header>
    <label>Heading<input value={section.content.title ?? ''} maxLength={180} onChange={(event) => onChange({ ...section, content: { ...section.content, title: event.target.value } })}/></label>
    <label>Supporting copy<textarea value={section.content.body ?? ''} maxLength={4000} rows={3} onChange={(event) => onChange({ ...section, content: { ...section.content, body: event.target.value } })}/></label>
    {(section.type === 'hero' || section.type === 'cta') && <div className="site-section-fields"><label>Button label<input value={section.content.buttonText ?? ''} maxLength={60} onChange={(event) => onChange({ ...section, content: { ...section.content, buttonText: event.target.value } })}/></label><label>Button link<input value={section.content.buttonUrl ?? ''} maxLength={500} placeholder="/p/your-offer" onChange={(event) => onChange({ ...section, content: { ...section.content, buttonUrl: event.target.value } })}/></label></div>}
  </article>;
}

export default function WebsiteBuilderPage() {
  const [site, setSite] = useState<SiteState | null>(null);
  const [pages, setPages] = useState<SitePage[]>([]);
  const [pageId, setPageId] = useState('');
  const [draft, setDraft] = useState<SiteDraft | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [preview, setPreview] = useState(false);
  const [mobile, setMobile] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const sensors = useSensors(useSensor(PointerSensor), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));

  const applyPage = useCallback((page: SitePage, siteState: SiteState) => {
    const content = page.draftContent;
    setPageId(page.id);
    setDraft({
      pageId: page.id, title: page.title, slug: page.slug, isHome: page.isHome,
      sections: content?.sections ?? [],
      seo: { title: page.seo?.title ?? '', description: page.seo?.description ?? '' },
      theme: siteState.theme ?? { template: 'studio', primary: '#014733', background: '#ffffff' }, publish: false,
    });
  }, []);

  useEffect(() => {
    let active = true;
    void fetch('/api/workspace/site', { cache: 'no-store' }).then(async (response) => {
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || 'The site builder could not load.');
      if (!active) return;
      setSite(result.site); setPages(result.pages);
      if (result.pages[0]) applyPage(result.pages[0], result.site);
    }).catch((cause) => { if (active) setError(cause instanceof Error ? cause.message : 'The site builder could not load.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [applyPage]);

  function moveSection(id: string, overId: string) {
    setDraft((current) => {
      if (!current) return current;
      const from = current.sections.findIndex((section) => section.id === id);
      const to = current.sections.findIndex((section) => section.id === overId);
      if (from < 0 || to < 0 || from === to) return current;
      const sections = [...current.sections]; const [item] = sections.splice(from, 1); sections.splice(to, 0, item!);
      return { ...current, sections };
    });
  }
  function dragEnd(event: DragEndEvent) {
    if (event.over && event.active.id !== event.over.id) moveSection(String(event.active.id), String(event.over.id));
  }
  function shift(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (!draft || target < 0 || target >= draft.sections.length) return;
    const sections = [...draft.sections]; const [item] = sections.splice(index, 1); sections.splice(target, 0, item!);
    setDraft({ ...draft, sections });
  }
  function patchSection(index: number, section: SiteDraft['sections'][number]) {
    if (!draft) return;
    const sections = [...draft.sections]; sections[index] = section; setDraft({ ...draft, sections });
  }
  async function addPage() {
    const title = window.prompt('Page title');
    if (!title?.trim()) return;
    const slug = title.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    const response = await fetch('/api/workspace/site', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title, slug }) });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) { setError(result.error || 'Could not add this page.'); return; }
    const nextPages = [...pages, result.page as SitePage]; setPages(nextPages);
    if (site) applyPage(result.page, site);
    setError('');
  }
  async function save(publish = false) {
    if (!draft) return;
    setSaving(true); setError(''); setNotice('');
    try {
      const response = await fetch('/api/workspace/site', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...draft, publish }) });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || 'Could not save your site.');
      const savedPage = result.page as SitePage;
      setPages((current) => current.map((page) => page.id === savedPage.id ? savedPage : page));
      if (result.site) setSite(result.site);
      setNotice(publish ? 'Your page is live.' : 'All changes saved.');
      setDraft((current) => current ? { ...current, publish: false } : current);
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not save your site.'); }
    finally { setSaving(false); }
  }
  const selectedPage = pages.find((page) => page.id === pageId);

  return <main className="creator-dashboard"><CreatorNav/><div className="creator-dashboard__main">
    <header className="creator-dashboard__topbar"><div className="creator-breadcrumb"><Link href="/workspace">Workspace</Link><span>/</span><strong>Website</strong></div><div className="site-builder-top-actions"><button type="button" className={preview ? 'is-active' : ''} onClick={() => setPreview(!preview)}><Eye size={14}/>{preview ? 'Edit site' : 'Preview'}</button><button type="button" onClick={() => void save(false)} disabled={saving || loading}><Check size={14}/>{saving ? 'Saving…' : 'Save draft'}</button><button type="button" className="site-builder-publish" onClick={() => void save(true)} disabled={saving || loading}><ArrowUpRightIcon/>{saving ? 'Saving…' : 'Publish'}</button></div></header>
    <div className="site-builder-layout">
      {!preview && <aside className="site-builder-editor"><div className="site-builder-heading"><Link href="/workspace" className="studio-back-link"><ArrowLeft size={14}/> Overview</Link><h1 className="sr-only">Website builder</h1></div>
        <section className="site-builder-control"><h2>Pages</h2><div className="site-page-list">{pages.map((page) => <button key={page.id} className={page.id === pageId ? 'is-active' : ''} onClick={() => site && applyPage(page, site)}>{page.title}<span>{page.isHome ? 'Home' : '/' + page.slug}</span></button>)}<button className="site-add-page" onClick={() => void addPage()}><Plus size={14}/> Add a page</button></div></section>
        {draft && <><section className="site-builder-control"><h2>Page settings</h2><label>Page title<input value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value })}/></label><label>Page address<input value={draft.slug} disabled={draft.isHome} onChange={(event) => setDraft({ ...draft, slug: event.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '') })}/></label></section>
        <section className="site-builder-control"><h2>Design</h2><label>Template<WorkspaceSelect value={draft.theme.template} onChange={(event) => setDraft({ ...draft, theme: { ...draft.theme, template: event.target.value as SiteDraft['theme']['template'] } })}>{templates.map((template) => <option key={template.id} value={template.id}>{template.title}</option>)}</WorkspaceSelect></label><div className="site-theme-colors"><label>Brand color<input type="color" value={draft.theme.primary} onChange={(event) => setDraft({ ...draft, theme: { ...draft.theme, primary: event.target.value } })}/></label><label>Background<input type="color" value={draft.theme.background} onChange={(event) => setDraft({ ...draft, theme: { ...draft.theme, background: event.target.value } })}/></label></div></section>
        <section className="site-builder-control"><h2>Search appearance</h2><label>SEO title<input maxLength={70} value={draft.seo.title} onChange={(event) => setDraft({ ...draft, seo: { ...draft.seo, title: event.target.value } })}/></label><label>Meta description<textarea maxLength={160} rows={3} value={draft.seo.description} onChange={(event) => setDraft({ ...draft, seo: { ...draft.seo, description: event.target.value } })}/></label></section>
        <section className="site-builder-control"><div className="site-sections-heading"><h2>Sections</h2><WorkspaceSelect aria-label="Add a page section" value="" onChange={(event) => { const type = event.target.value as typeof siteSectionTypes[number]; if (type && draft) setDraft({ ...draft, sections: [...draft.sections, freshSection(type, crypto.randomUUID())] }); }}><option value="">Add section…</option>{selectableSectionTypes.map((type) => <option key={type} value={type}>{labels[type]}</option>)}</WorkspaceSelect></div>
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={dragEnd}><SortableContext items={draft.sections.map((section) => section.id)} strategy={verticalListSortingStrategy}><div className="site-section-list">{draft.sections.map((section, index) => <SortableSection key={section.id} section={section} index={index} count={draft.sections.length} onMove={(direction) => shift(index, direction)} onRemove={() => setDraft({ ...draft, sections: draft.sections.filter((item) => item.id !== section.id) })} onChange={(next) => patchSection(index, next)}/>)}</div></SortableContext></DndContext>
          {!draft.sections.length && <div className="site-sections-empty"><span>Start with a section</span><small>Add a hero, product list, or any of the 15 page sections.</small></div>}
        </section></>}
      </aside>}
      <section className={'site-builder-preview' + (mobile ? ' is-mobile' : '')} style={draft ? { '--site-primary': draft.theme.primary, '--site-background': draft.theme.background } as React.CSSProperties : undefined}>
        <div className="site-preview-toolbar"><div><span/><span/><span/><small>{site?.status === 'published' ? 'Published' : 'Draft'} · onselli.com/c/{selectedPage?.slug ?? 'your-page'}</small></div><button onClick={() => setMobile(!mobile)} aria-label={mobile ? 'Show desktop preview' : 'Show mobile preview'}>{mobile ? <Monitor size={15}/> : <Smartphone size={15}/>}</button></div>
        <div className="site-preview-canvas"><div className="site-preview-brand"><span>{site?.seo?.title || 'Your business'}</span><nav>{pages.slice(0, 4).map((page) => <span key={page.id}>{page.title}</span>)}</nav></div>
          {!draft ? <div className="site-preview-skeleton"/> : <><div className="site-preview-page-title"><small>{draft.title}</small><h2>{draft.seo.title || 'A home for your work.'}</h2><p>{draft.seo.description || 'Share what you do and help people find the right next step.'}</p></div>{draft.sections.map((section) => <article className={'site-preview-block site-preview-block--' + section.type} key={section.id}><span>{labels[section.type]}</span><h3>{section.content.title || labels[section.type]}</h3><p>{section.content.body || 'Your content will appear here as you edit this section.'}</p>{section.content.buttonText && <b style={{ background: 'var(--site-primary)' }}>{section.content.buttonText}</b>}</article>)}</>}
          <footer className="site-preview-footer">Run. Sell. Grow.</footer>
        </div>
      </section>
    </div>
    {(error || notice) && <div className={'site-builder-toast' + (error ? ' is-error' : '')} role={error ? 'alert' : 'status'}>{error || notice}</div>}
  </div></main>;
}

function ArrowUpRightIcon() { return <ArrowRight size={14}/>; }
