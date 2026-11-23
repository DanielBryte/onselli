'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Check, ChevronDown, ChevronLeft, ChevronRight, CircleHelp, CirclePlay, Download, FileText } from 'lucide-react';
import CourseQuiz from './CourseQuiz';

type LessonResource = { id: string; name: string; sizeBytes: string };
type Lesson = { id: string; title: string; type: 'text' | 'video' | 'quiz'; text: string; embedUrl: string; videoSource?: 'external' | 'hosted'; videoStatus?: string | null; resumePositionSeconds?: number; isFreePreview: boolean; completed: boolean; resources: LessonResource[] };
type Section = { id: string; title: string; lessons: Lesson[] };

const PLAYER_ORIGIN = 'https://player.mediadelivery.net';
const PLAYER_PROTOCOL_VERSION = '0.0.11';

function playerMessage(method: string, value?: unknown, listener?: string) {
  return JSON.stringify({ context: 'player.js', version: PLAYER_PROTOCOL_VERSION, method, ...(value === undefined ? {} : { value }), ...(listener ? { listener } : {}) });
}

export default function CoursePlayer({ productId, title, creatorName, sections, resumeLessonId }: { productId: string; title: string; creatorName: string; sections: Section[]; resumeLessonId: string }) {
  const flattened = useMemo(() => sections.flatMap((section) => section.lessons.map((lesson) => ({ ...lesson, sectionTitle: section.title }))), [sections]);
  const initialLesson = flattened.find((lesson) => lesson.id === resumeLessonId && !lesson.completed) ?? flattened.find((lesson) => !lesson.completed && lesson.resumePositionSeconds && lesson.resumePositionSeconds > 0) ?? flattened.find((lesson) => !lesson.completed) ?? flattened[0];
  const [activeId, setActiveId] = useState(initialLesson?.id ?? '');
  const [completedIds, setCompletedIds] = useState(() => new Set(flattened.filter((lesson) => lesson.completed).map((lesson) => lesson.id)));
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [progressSaving, setProgressSaving] = useState(false);
  const [progressPending, setProgressPending] = useState(false);
  const [error, setError] = useState('');
  const [downloadingId, setDownloadingId] = useState('');
  const [hostedEmbed, setHostedEmbed] = useState<{ lessonId: string; url: string } | null>(null);
  const [hostedUnavailable, setHostedUnavailable] = useState('');
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const pendingPosition = useRef<{ lessonId: string; seconds: number } | null>(null);
  const positionTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const savingPosition = useRef(false);
  const activeRef = useRef<Lesson & { sectionTitle: string } | undefined>(undefined);
  const activeIndex = flattened.findIndex((lesson) => lesson.id === activeId);
  const active = flattened[activeIndex];
  activeRef.current = active;
  const completeCount = completedIds.size;
  const percent = flattened.length ? Math.round(completeCount / flattened.length * 100) : 0;
  const markQuizPassed = useCallback((lessonId: string) => setCompletedIds((current) => new Set(current).add(lessonId)), []);

  const saveCompletion = useCallback(async (lessonId: string, completed: boolean) => {
    const response = await fetch(`/api/learning/courses/${encodeURIComponent(productId)}/progress`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'completion', lessonId, completed }),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.error || 'Progress could not be saved.');
    setCompletedIds((current) => { const next = new Set(current); completed ? next.add(lessonId) : next.delete(lessonId); return next; });
  }, [productId]);

  const flushPosition = useCallback(async (keepalive = false) => {
    if (savingPosition.current || !pendingPosition.current) return;
    savingPosition.current = true;
    setProgressSaving(true);
    const update = pendingPosition.current;
    pendingPosition.current = null;
    try {
      const response = await fetch(`/api/learning/courses/${encodeURIComponent(productId)}/progress`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'position', lessonId: update.lessonId, positionSeconds: update.seconds }), keepalive,
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || 'Playback position could not be saved.');
      setError('');
      if (!pendingPosition.current) setProgressPending(false);
    } catch (cause) {
      const pending = pendingPosition.current as { lessonId: string; seconds: number } | null;
      if (!pending || pending.lessonId !== update.lessonId) pendingPosition.current = update;
      setProgressPending(true);
      setError(cause instanceof Error ? cause.message : 'Playback position could not be saved.');
    } finally {
      savingPosition.current = false;
      setProgressSaving(false);
      if (pendingPosition.current && pendingPosition.current !== update && typeof navigator !== 'undefined' && navigator.onLine) void flushPosition();
    }
  }, [productId]);

  const queuePosition = useCallback((lessonId: string, seconds: number, immediate = false) => {
    if (!Number.isFinite(seconds) || seconds < 0) return;
    const rounded = Math.floor(seconds);
    if (pendingPosition.current?.lessonId === lessonId && Math.abs(pendingPosition.current.seconds - rounded) < 5) return;
    pendingPosition.current = { lessonId, seconds: rounded };
    setProgressPending(true);
    if (positionTimer.current) clearTimeout(positionTimer.current);
    if (immediate) void flushPosition(true);
    else positionTimer.current = setTimeout(() => void flushPosition(), 12_000);
  }, [flushPosition]);

  useEffect(() => {
    setHostedEmbed(null); setHostedUnavailable('');
    if (!active || active.type !== 'video' || active.videoSource !== 'hosted' || active.videoStatus !== 'ready') return;
    let current = true;
    void fetch(`/api/learning/courses/${encodeURIComponent(productId)}/lessons/${encodeURIComponent(active.id)}/playback`, { cache: 'no-store' })
      .then(async (response) => {
        const payload = await response.json().catch(() => ({}));
        if (!response.ok || typeof payload.playbackUrl !== 'string') throw new Error(payload.error || 'This video could not be opened.');
        if (current) setHostedEmbed({ lessonId: active.id, url: payload.playbackUrl });
      })
      .catch((cause) => { if (current) setHostedUnavailable(cause instanceof Error ? cause.message : 'This video could not be opened.'); });
    return () => { current = false; };
  }, [productId, active?.id, active?.type, active?.videoSource, active?.videoStatus]);

  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe || !active || hostedEmbed?.lessonId !== active.id) return;
    const lesson = active;
    const listenerName = `onselli-progress-${lesson.id}`;
    const send = (method: string, value?: unknown, listener?: string) => iframe.contentWindow?.postMessage(playerMessage(method, value, listener), PLAYER_ORIGIN);
    const initializePlayer = () => {
      send('addEventListener', 'timeupdate', listenerName);
      send('addEventListener', 'pause', `${listenerName}-pause`);
      send('addEventListener', 'ended', `${listenerName}-ended`);
      const resume = activeRef.current?.id === lesson.id ? activeRef.current.resumePositionSeconds ?? 0 : 0;
      if (resume > 5) send('setCurrentTime', resume);
    };
    const onMessage = (event: MessageEvent) => {
      if (event.origin !== PLAYER_ORIGIN || event.source !== iframe.contentWindow) return;
      let data: any;
      try { data = typeof event.data === 'string' ? JSON.parse(event.data) : event.data; } catch { return; }
      if (!data || data.context !== 'player.js') return;
      if (data.event === 'ready') initializePlayer();
      else if (data.event === 'timeupdate' && (data.listener === listenerName || data.listener === undefined)) {
        const seconds = Number(data.value?.seconds);
        if (Number.isFinite(seconds)) queuePosition(lesson.id, seconds);
      } else if (data.event === 'pause') {
        const position = pendingPosition.current;
        if (position?.lessonId === lesson.id) void flushPosition(true);
      } else if (data.event === 'ended') {
        const position = pendingPosition.current;
        if (position?.lessonId === lesson.id) void flushPosition(true);
        void saveCompletion(lesson.id, true).catch((cause) => setError(cause instanceof Error ? cause.message : 'Lesson completion could not be saved.'));
      }
    };
    window.addEventListener('message', onMessage);
    iframe.addEventListener('load', initializePlayer);
    initializePlayer();
    return () => {
      window.removeEventListener('message', onMessage);
      iframe.removeEventListener('load', initializePlayer);
      if (positionTimer.current) clearTimeout(positionTimer.current);
      const queued = pendingPosition.current;
      if (queued?.lessonId === lesson.id) void flushPosition(true);
    };
  }, [active?.id, hostedEmbed?.lessonId, flushPosition, queuePosition, saveCompletion]);

  useEffect(() => {
    const retry = () => { if (pendingPosition.current) void flushPosition(); };
    window.addEventListener('online', retry);
    const persistOnExit = () => { if (pendingPosition.current) void flushPosition(true); };
    window.addEventListener('pagehide', persistOnExit);
    return () => { window.removeEventListener('online', retry); window.removeEventListener('pagehide', persistOnExit); };
  }, [flushPosition]);

  async function toggleComplete() {
    if (!active || busy) return;
    setBusy(true); setError('');
    try { await saveCompletion(active.id, !completedIds.has(active.id)); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Progress could not be saved.'); }
    finally { setBusy(false); }
  }

  async function downloadResource(resource: LessonResource) {
    setDownloadingId(resource.id); setError('');
    try {
      const response = await fetch(`/api/learning/courses/${encodeURIComponent(productId)}/resources/${encodeURIComponent(resource.id)}`, { cache: 'no-store' });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || typeof payload.url !== 'string') throw new Error(payload.error || 'This resource could not be opened.');
      const link = document.createElement('a'); link.href = payload.url; link.download = resource.name; link.rel = 'noreferrer'; document.body.append(link); link.click(); link.remove();
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'This resource could not be opened.'); }
    finally { setDownloadingId(''); }
  }

  return <div className="course-player">
    <header className="course-player__heading"><div><span className="course-player__eyebrow">COURSE</span><h1>{title}</h1><p>By {creatorName}</p></div><div className="course-player__progress" aria-label={`${percent}% complete`}><span>{completeCount} of {flattened.length} lessons complete</span><div><i style={{ width: `${percent}%` }}/></div></div></header>
    <button type="button" className="course-player__mobile-toggle" onClick={() => setSidebarOpen((open) => !open)} aria-expanded={sidebarOpen}><span>Course content</span><span>{active?.sectionTitle ?? ''}<ChevronDown size={16}/></span></button>
    <div className="course-player__layout">
      <aside className={`course-player__sidebar ${sidebarOpen ? 'is-open' : ''}`} aria-label="Course lessons">{sections.map((section, sectionIndex) => <section className="course-player__section" key={section.id}><h2><span>Module {sectionIndex + 1}</span>{section.title}</h2>{section.lessons.map((lesson) => <button key={lesson.id} type="button" className={`course-player__lesson ${lesson.id === activeId ? 'is-active' : ''}`} onClick={() => { setActiveId(lesson.id); setSidebarOpen(false); setError(''); }}><span className="course-player__lesson-icon">{completedIds.has(lesson.id) ? <Check size={15}/> : lesson.type === 'video' ? <CirclePlay size={15}/> : lesson.type === 'quiz' ? <CircleHelp size={15}/> : <FileText size={15}/>}</span><span><strong>{lesson.title}</strong><small>{lesson.type === 'video' ? 'Video' : lesson.type === 'quiz' ? 'Quiz' : 'Lesson'}{lesson.isFreePreview ? ' · Preview' : ''}</small></span></button>)}</section>)}</aside>
      <article className="course-player__lesson-view">{active ? <><div className="course-player__lesson-heading"><div><span>{active.sectionTitle}</span><h2>{active.title}</h2></div><span className="course-player__type">{active.type === 'video' ? <><CirclePlay size={14}/> Video</> : active.type === 'quiz' ? <><CircleHelp size={14}/> Quiz</> : <><FileText size={14}/> Lesson</>}</span></div>{active.type === 'video' ? active.videoSource === 'hosted' ? hostedEmbed?.lessonId === active.id ? <div className="course-player__video"><iframe ref={iframeRef} src={hostedEmbed.url} title={active.title} allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowFullScreen referrerPolicy="strict-origin-when-cross-origin"/></div> : <p className="course-player__unavailable" role="status">{active.videoStatus === 'processing' || active.videoStatus === 'uploading' ? 'This video is still processing. It will be available here when it is ready.' : active.videoStatus === 'failed' ? 'This video could not be processed. Please contact the creator.' : hostedUnavailable || 'This video is not available right now.'}</p> : active.embedUrl ? <div className="course-player__video"><iframe src={active.embedUrl} title={active.title} allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowFullScreen referrerPolicy="strict-origin-when-cross-origin"/></div> : <p className="course-player__unavailable">This video is not available right now. Contact the creator for help.</p> : active.type === 'quiz' ? <CourseQuiz productId={productId} lessonId={active.id} onPassed={() => markQuizPassed(active.id)}/> : <div className="course-player__text">{active.text.split(/\n{2,}/).map((paragraph, index) => <p key={index}>{paragraph}</p>)}</div>}{active.resources.length > 0 && <section className="course-player__resources" aria-labelledby="lesson-resources-heading"><h3 id="lesson-resources-heading">Lesson resources</h3>{active.resources.map((resource) => <button key={resource.id} type="button" className="course-player__resource" disabled={downloadingId === resource.id} onClick={() => void downloadResource(resource)}><Download size={15}/><span>{resource.name}</span><small>{downloadingId === resource.id ? 'Preparing…' : `${(Number(resource.sizeBytes) / 1024 / 1024).toFixed(1)} MB`}</small></button>)}</section>}<div className="course-player__lesson-actions">{active.type !== 'quiz' && <button type="button" className={`button ${completedIds.has(active.id) ? 'button--outline' : 'button--mint'}`} onClick={() => void toggleComplete()} disabled={busy}>{completedIds.has(active.id) ? <><Check size={15}/> Completed</> : busy ? 'Saving…' : 'Mark as complete'}</button>}<span role="status" aria-live="polite">{progressSaving ? 'Saving progress…' : progressPending ? 'Unsaved playback progress' : ''}</span><div><button type="button" className="button button--outline" onClick={() => setActiveId(flattened[Math.max(0, activeIndex - 1)]?.id ?? active.id)} disabled={activeIndex <= 0} aria-label="Previous lesson"><ChevronLeft size={17}/></button><button type="button" className="button button--outline" onClick={() => setActiveId(flattened[Math.min(flattened.length - 1, activeIndex + 1)]?.id ?? active.id)} disabled={activeIndex >= flattened.length - 1} aria-label="Next lesson"><ChevronRight size={17}/></button></div></div>{error && <p className="course-player__error" role="alert">{error}</p>}</> : <div className="course-player__empty"><FileText size={24}/><h2>No lessons published yet</h2><p>The creator is still preparing the course content.</p></div>}</article>
    </div>
  </div>;
}
