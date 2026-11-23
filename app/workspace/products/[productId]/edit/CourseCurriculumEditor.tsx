'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
  BookOpen,
  Check,
  ChevronDown,
  ChevronUp,
  CircleHelp,
  CirclePlay,
  FileText,
  Film,
  Loader2,
  Paperclip,
  Plus,
  Trash2,
  Upload,
  Video,
  X,
} from 'lucide-react';
import WorkspaceSelect from '@/app/components/ui/WorkspaceSelect';
import Dialog from '@/app/components/ui/Dialog';
import Button from '@/app/components/ui/Button';
import ProductDescriptionEditor from '@/app/components/ui/ProductDescriptionEditor';
import { uploadBunnyTus, type BunnyTusCredentials } from '@/lib/courses/bunny-tus-upload';
import { validateCoursePublishReadiness } from '@/lib/courses/curriculum-rules.mjs';

type QuizOption = { id: string; text: string };
type QuizQuestion = {
  id: string;
  prompt: string;
  options: QuizOption[];
  correctOptionId: string;
};
type Quiz = {
  version?: number;
  questions: QuizQuestion[];
  passingScore: number;
  maxAttempts: number | null;
  revealCorrectAnswers: boolean;
};
type Lesson = {
  id?: string;
  _key?: string;
  title: string;
  type: 'text' | 'video' | 'quiz';
  text: string;
  videoUrl: string;
  videoSource?: 'external' | 'hosted';
  videoStatus?: 'uploading' | 'processing' | 'ready' | 'failed' | null;
  bunnyVideoId?: string | null;
  status: 'draft' | 'published';
  isFreePreview: boolean;
  quiz?: Quiz;
};
type Section = {
  id?: string;
  _key?: string;
  title: string;
  status: 'draft' | 'published';
  lessons: Lesson[];
};
type Resource = {
  id: string;
  name: string;
  sizeBytes: string;
  status: 'ready' | 'pending';
  position: number;
};

function newKey() {
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`;
}

function safeEmbedPreview(value: string) {
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:') return '';
    if (['youtube.com', 'www.youtube.com', 'm.youtube.com'].includes(url.hostname)) {
      const parts = url.pathname.split('/');
      const id =
        url.searchParams.get('v') ??
        (['embed', 'shorts', 'live'].includes(parts[1] ?? '') ? parts[2] : '');
      return id ? `https://www.youtube-nocookie.com/embed/${encodeURIComponent(id)}` : '';
    }
    if (url.hostname === 'youtu.be') {
      return url.pathname.length > 1
        ? `https://www.youtube-nocookie.com/embed/${encodeURIComponent(url.pathname.slice(1))}`
        : '';
    }
    if (['vimeo.com', 'www.vimeo.com', 'player.vimeo.com'].includes(url.hostname)) {
      const id = url.pathname.split('/').filter(Boolean).at(-1);
      return id && /^\d+$/.test(id) ? `https://player.vimeo.com/video/${id}` : '';
    }
  } catch {
    return '';
  }
  return '';
}

export default function CourseCurriculumEditor({
  productId,
  onReadyChange,
}: {
  productId: string;
  onReadyChange?: (ready: boolean) => void;
}) {
  const [sections, setSections] = useState<Section[]>([]);
  const [savedValue, setSavedValue] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveFailed, setSaveFailed] = useState(false);
  const savingRef = useRef(false);
  const sectionsRef = useRef(sections);
  sectionsRef.current = sections;
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>({});
  const [resourcesByLesson, setResourcesByLesson] = useState<Record<string, Resource[]>>({});
  const [resourceBusy, setResourceBusy] = useState(false);
  const [resourceUploading, setResourceUploading] = useState(false);
  const [resourceCanceling, setResourceCanceling] = useState(false);
  const [resourceProgress, setResourceProgress] = useState<number | null>(null);
  const resourceUploadRef = useRef<XMLHttpRequest | null>(null);
  const resourceFinalizeControllerRef = useRef<AbortController | null>(null);
  const resourceCancelRequestedRef = useRef(false);
  const pendingResourceRef = useRef<{ lessonId: string; resourceId: string } | null>(null);
  const [resourceInput, setResourceInput] = useState<HTMLInputElement | null>(null);
  const [videoBusy, setVideoBusy] = useState(false);
  const [videoProgress, setVideoProgress] = useState(0);

  // Lesson Edit Modal State
  const [editingTarget, setEditingTarget] = useState<{
    sectionIndex: number;
    lessonIndex: number;
    isNew?: boolean;
  } | null>(null);

  // CRUD Confirmation Dialog States (Zero browser-based confirm!)
  const [moduleToDelete, setModuleToDelete] = useState<{
    index: number;
    title: string;
    lessonCount: number;
  } | null>(null);

  const [lessonToDelete, setLessonToDelete] = useState<{
    sectionIndex: number;
    lessonIndex: number;
    title: string;
  } | null>(null);

  const [resourceToDelete, setResourceToDelete] = useState<{
    resource: Resource;
    lessonId: string;
  } | null>(null);

  const [videoToDeleteConfirm, setVideoToDeleteConfirm] = useState(false);

  useEffect(() => {
    let active = true;
    void fetch(`/api/workspace/products/${encodeURIComponent(productId)}/curriculum`, {
      cache: 'no-store',
    })
      .then(async (response) => {
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(payload.error || 'The curriculum could not be loaded.');
        if (!active) return;
        const value = (payload.sections ?? []) as Section[];
        setSections(value);
        setSavedValue(JSON.stringify(value));
        setResourcesByLesson(
          Object.fromEntries(
            value.flatMap((section) =>
              section.lessons
                .filter((lesson) => lesson.id)
                .map((lesson) => [
                  lesson.id!,
                  (lesson as Lesson & { resources?: Resource[] }).resources ?? [],
                ]),
            ),
          ),
        );
      })
      .catch((cause) => {
        if (active)
          setError(
            cause instanceof Error ? cause.message : 'The curriculum could not be loaded.',
          );
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [productId]);

  const dirty = useMemo(() => JSON.stringify(sections) !== savedValue, [sections, savedValue]);
  const curriculumReady = useMemo(() => {
    const visibleLessons = sections
      .filter((section) => section.status === 'published')
      .flatMap((section) => section.lessons.filter((lesson) => lesson.status === 'published'));
    return (
      visibleLessons.length > 0 &&
      !validateCoursePublishReadiness(
        visibleLessons.map((lesson) => ({
          ...lesson,
          videoSource: lesson.videoSource ?? 'external',
        })),
      ) &&
      visibleLessons.every(
        (lesson) =>
          lesson.type !== 'quiz',
      )
    );
  }, [sections]);

  useEffect(() => {
    onReadyChange?.(!loading && !error && !dirty && curriculumReady);
  }, [curriculumReady, dirty, error, loading, onReadyChange]);

  const lessonCount = sections.reduce((total, section) => total + section.lessons.length, 0);

  // Active lesson being edited in the modal
  const activeLesson = useMemo(() => {
    if (!editingTarget) return null;
    const { sectionIndex, lessonIndex } = editingTarget;
    const section = sections[sectionIndex];
    const lesson = section?.lessons[lessonIndex];
    if (!section || !lesson) return null;
    return { sectionIndex, lessonIndex, section, lesson };
  }, [editingTarget, sections]);

  // Polling for Bunny hosted video transcoding
  useEffect(() => {
    const lesson = activeLesson?.lesson;
    if (
      !lesson?.id ||
      lesson.videoSource !== 'hosted' ||
      !lesson.bunnyVideoId ||
      !['uploading', 'processing'].includes(lesson.videoStatus ?? '')
    )
      return;
    let active = true;
    const refresh = async () => {
      try {
        const response = await fetch(
          `/api/workspace/products/${encodeURIComponent(productId)}/curriculum/${encodeURIComponent(lesson.id!)}/video`,
          { cache: 'no-store' },
        );
        const payload = await response.json().catch(() => ({}));
        if (
          !response.ok ||
          !active ||
          !['uploading', 'processing', 'ready', 'failed'].includes(payload.status)
        )
          return;
        setSections((current) => {
          const next = current.map((section) => ({
            ...section,
            lessons: section.lessons.map((item) =>
              item.id === lesson.id ? { ...item, videoStatus: payload.status } : item,
            ),
          }));
          setSavedValue(JSON.stringify(next));
          return next;
        });
      } catch {
        /* Retries next interval */
      }
    };
    void refresh();
    const timer = window.setInterval(() => void refresh(), 10_000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [
    productId,
    activeLesson?.lesson.id,
    activeLesson?.lesson.videoSource,
    activeLesson?.lesson.videoStatus,
    activeLesson?.lesson.bunnyVideoId,
  ]);

  function updateActiveLesson(patch: Partial<Lesson>) {
    if (!activeLesson) return;
    const { sectionIndex, lessonIndex } = activeLesson;
    setSections((current) =>
      current.map((section, sIdx) =>
        sIdx !== sectionIndex
          ? section
          : {
              ...section,
              lessons: section.lessons.map((lesson, lIdx) =>
                lIdx === lessonIndex ? { ...lesson, ...patch } : lesson,
              ),
            },
      ),
    );
    setNotice('');
  }

  function moveLessonToSection(targetIndex: number) {
    if (!activeLesson || targetIndex === activeLesson.sectionIndex || !sections[targetIndex]) return;
    const source = sections[activeLesson.sectionIndex];
    const lesson = source?.lessons[activeLesson.lessonIndex];
    const target = sections[targetIndex];
    if (!source || !lesson || !target) return;
    const next = sections.map((section, index) =>
      index === activeLesson.sectionIndex
        ? {
            ...section,
            lessons: section.lessons.filter((_, lIdx) => lIdx !== activeLesson.lessonIndex),
          }
        : index === targetIndex
          ? { ...section, lessons: [...section.lessons, lesson] }
          : section,
    );
    setSections(next);
    setEditingTarget({
      sectionIndex: targetIndex,
      lessonIndex: target.lessons.length,
      isNew: false,
    });
    setNotice('');
  }

  function addSection() {
    if (sections.length >= 50) return;
    const sectionKey = newKey();
    const section: Section = {
      _key: sectionKey,
      title: `Module ${sections.length + 1}`,
      status: 'published',
      lessons: [],
    };
    setSections((current) => [...current, section]);
    setNotice('');
  }

  function toggleSectionCollapse(key: string) {
    setCollapsedSections((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  function openAddLessonModal(sectionIndex: number, type: Lesson['type']) {
    if (lessonCount >= 100) return;
    const lessonKey = newKey();
    const questionId = newKey();
    const firstOptionId = newKey();
    const secondOptionId = newKey();
    const lesson: Lesson = {
      _key: lessonKey,
      title: '',
      type,
      text: '',
      videoUrl: '',
      videoSource: type === 'video' ? 'hosted' : 'external',
      status: 'published',
      isFreePreview: false,
      ...(type === 'quiz'
        ? {
            quiz: {
              questions: [
                {
                  id: questionId,
                  prompt: '',
                  options: [
                    { id: firstOptionId, text: '' },
                    { id: secondOptionId, text: '' },
                  ],
                  correctOptionId: '',
                },
              ],
              passingScore: 70,
              maxAttempts: 3,
              revealCorrectAnswers: false,
            },
          }
        : {}),
    };
    const currentLessons = sections[sectionIndex]?.lessons ?? [];
    setSections((current) =>
      current.map((section, index) =>
        index === sectionIndex
          ? { ...section, lessons: [...section.lessons, lesson] }
          : section,
      ),
    );
    const sec = sections[sectionIndex];
    if (sec) {
      const secKey = sec.id ?? sec._key!;
      setCollapsedSections((prev) => ({ ...prev, [secKey]: false }));
    }
    setEditingTarget({
      sectionIndex,
      lessonIndex: currentLessons.length,
      isNew: true,
    });
    setNotice('');
  }

  function moveSection(index: number, delta: number) {
    const nextIndex = index + delta;
    if (nextIndex < 0 || nextIndex >= sections.length) return;
    setSections((current) => {
      const next = [...current];
      const [section] = next.splice(index, 1);
      if (section) next.splice(nextIndex, 0, section);
      return next;
    });
    setNotice('');
  }

  function confirmDeleteModule() {
    if (!moduleToDelete) return;
    const index = moduleToDelete.index;
    setSections((current) => current.filter((_, position) => position !== index));
    setModuleToDelete(null);
    setNotice('');
  }

  function updateSectionTitle(index: number, title: string) {
    setSections((current) =>
      current.map((section, position) => (position === index ? { ...section, title } : section)),
    );
    setNotice('');
  }

  function moveLesson(sectionIndex: number, lessonIndex: number, delta: number) {
    const nextIndex = lessonIndex + delta;
    const list = sections[sectionIndex]?.lessons;
    if (!list || nextIndex < 0 || nextIndex >= list.length || !list[lessonIndex] || !list[nextIndex])
      return;
    setSections((current) =>
      current.map((section, index) => {
        if (index !== sectionIndex) return section;
        const lessons = [...section.lessons];
        const [moving] = lessons.splice(lessonIndex, 1);
        if (moving) lessons.splice(nextIndex, 0, moving);
        return { ...section, lessons };
      }),
    );
    setNotice('');
  }

  function confirmDeleteLesson() {
    if (!lessonToDelete) return;
    const { sectionIndex, lessonIndex } = lessonToDelete;
    setSections((current) =>
      current.map((section, index) =>
        index === sectionIndex
          ? {
              ...section,
              lessons: section.lessons.filter((_, position) => position !== lessonIndex),
            }
          : section,
      ),
    );
    setLessonToDelete(null);
    if (
      editingTarget &&
      editingTarget.sectionIndex === sectionIndex &&
      editingTarget.lessonIndex === lessonIndex
    ) {
      setEditingTarget(null);
    }
    setNotice('');
  }

  async function save() {
    if (savingRef.current || !dirty) return;
    savingRef.current = true;
    // Autosave incomplete lessons as drafts. A published text lesson must
    // never be sent until it has real content; otherwise server validation
    // rejects every debounce and the status footer appears to flicker.
    const snapshot = sections.map((section) => ({
      ...section,
      lessons: section.lessons.map((lesson) => lesson.type === 'text' && !lesson.text.replace(/<[^>]*>/g, '').trim()
        ? { ...lesson, status: 'draft' as const }
        : lesson),
    }));
    const snapshotJson = JSON.stringify(snapshot);
    setSaveFailed(false);
    setError('');
    setNotice('');
    setSaving(true);
    try {
      const response = await fetch(
        `/api/workspace/products/${encodeURIComponent(productId)}/curriculum`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sections: snapshot.map((section) => ({
              ...section,
              lessons: section.lessons.map((lesson) => ({
                ...lesson,
                videoSource: lesson.videoSource ?? 'external',
              })),
            })),
          }),
        },
      );
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        if (response.status === 402) window.dispatchEvent(new Event('onselli:open-pricing'));
        throw new Error(payload.error || 'The curriculum could not be saved.');
      }
      const updated = (payload.sections ?? snapshot) as Section[];
      setSections(updated);
      setSavedValue(JSON.stringify(updated));
      setNotice('All changes saved.');
      setResourcesByLesson(
        Object.fromEntries(
          updated.flatMap((section) =>
            section.lessons
              .filter((lesson) => lesson.id)
              .map((lesson) => [
                lesson.id!,
                (lesson as Lesson & { resources?: Resource[] }).resources ?? [],
              ]),
          ),
        ),
      );
    } catch (cause) {
      setSaveFailed(true);
      const message = cause instanceof Error ? cause.message : '';
      setError(/too small: expected string to have >=?\s*1 characters/i.test(message)
        ? 'A lesson or module title is missing. Add a title, then try saving again.'
        : message || 'The curriculum could not be saved.');
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  }

  useEffect(() => {
      if (!dirty || saving || saveFailed) return;
    const timer = setTimeout(() => {
      void save();
    }, 1200);
    return () => clearTimeout(timer);
  }, [dirty, saving, sections, saveFailed]);

  async function uploadHostedVideo(file: File) {
    if (!activeLesson?.lesson.id) {
      setError('Wait for this lesson to finish saving before uploading video.');
      return;
    }
    const lessonId = activeLesson.lesson.id;
    const response = await fetch(
      `/api/workspace/products/${encodeURIComponent(productId)}/curriculum/${encodeURIComponent(lessonId)}/video`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileName: file.name, sizeBytes: file.size }),
      },
    );
    const credentials = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(credentials.error || 'Could not prepare video upload.');

    setSections((current) => {
      const next = current.map((section) => ({
        ...section,
        lessons: section.lessons.map((lesson) =>
          lesson.id === lessonId
            ? {
                ...lesson,
                videoSource: 'hosted' as const,
                videoStatus: 'uploading' as const,
                bunnyVideoId: credentials.videoId,
              }
            : lesson,
        ),
      }));
      setSavedValue(JSON.stringify(next));
      return next;
    });

    await uploadBunnyTus(file, credentials as BunnyTusCredentials, setVideoProgress);
    setNotice('Upload complete! Video processing has started.');

    const statusResponse = await fetch(
      `/api/workspace/products/${encodeURIComponent(productId)}/curriculum/${encodeURIComponent(lessonId)}/video`,
      { cache: 'no-store' },
    );
    const statusPayload = await statusResponse.json().catch(() => ({}));
    if (
      statusResponse.ok &&
      ['uploading', 'processing', 'ready', 'failed'].includes(statusPayload.status)
    ) {
      setSections((current) => {
        const next = current.map((section) => ({
          ...section,
          lessons: section.lessons.map((lesson) =>
            lesson.id === lessonId ? { ...lesson, videoStatus: statusPayload.status } : lesson,
          ),
        }));
        setSavedValue(JSON.stringify(next));
        return next;
      });
    }
  }

  async function confirmRemoveHostedVideo() {
    if (!activeLesson?.lesson.id) return;
    setVideoBusy(true);
    try {
      const response = await fetch(
        `/api/workspace/products/${encodeURIComponent(productId)}/curriculum/${encodeURIComponent(activeLesson.lesson.id)}/video`,
        { method: 'DELETE' },
      );
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || 'The hosted video could not be removed.');
      setSections((current) => {
        const next = current.map((section) => ({
          ...section,
          lessons: section.lessons.map((lesson) =>
            lesson.id === activeLesson.lesson.id
              ? {
                  ...lesson,
                  bunnyVideoId: null,
                  videoStatus: null,
                  videoSource: 'hosted' as const,
                }
              : lesson,
          ),
        }));
        setSavedValue(JSON.stringify(next));
        return next;
      });
      setVideoToDeleteConfirm(false);
      setNotice('Hosted video removed.');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not remove video.');
    } finally {
      setVideoBusy(false);
    }
  }

  async function discardPendingResource() {
    const pending = pendingResourceRef.current;
    if (!pending) return;
    const response = await fetch(
      `/api/workspace/products/${encodeURIComponent(productId)}/curriculum/${encodeURIComponent(pending.lessonId)}/resources/${encodeURIComponent(pending.resourceId)}`,
      { method: 'DELETE' },
    );
    const result = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(result.error || 'The canceled attachment could not be removed.');
    }
    pendingResourceRef.current = null;
  }

  function cancelResourceUpload() {
    if (!resourceUploading || resourceCanceling) return;
    resourceCancelRequestedRef.current = true;
    setResourceCanceling(true);
    resourceUploadRef.current?.abort();
    resourceFinalizeControllerRef.current?.abort();
  }

  async function uploadResource(file: File) {
    if (!activeLesson?.lesson.id) {
      setError('Wait for this lesson to finish saving before adding resources.');
      return;
    }
    const lessonId = activeLesson.lesson.id;
    const response = await fetch(
      `/api/workspace/products/${encodeURIComponent(productId)}/curriculum/${encodeURIComponent(lessonId)}/resources`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: file.name, sizeBytes: file.size }),
      },
    );
    const init = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(init.error || 'Could not prepare resource upload.');
    pendingResourceRef.current = { lessonId, resourceId: init.resourceId };
    if (resourceCancelRequestedRef.current) {
      await discardPendingResource();
      throw new DOMException('Upload canceled.', 'AbortError');
    }

    await new Promise<void>((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      resourceUploadRef.current = xhr;
      xhr.open('PUT', init.uploadUrl);
      xhr.setRequestHeader('Content-Type', init.contentType);
      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable)
          setResourceProgress(Math.round((event.loaded / event.total) * 100));
      };
      xhr.onerror = () => reject(new Error('Upload interrupted. Check connection and retry.'));
      xhr.onabort = () => reject(new DOMException('Upload canceled.', 'AbortError'));
      xhr.onload = () =>
        xhr.status >= 200 && xhr.status < 300
          ? resolve()
          : reject(new Error('Upload failed. Retry uploading the resource.'));
      xhr.send(file);
    }).finally(() => {
      resourceUploadRef.current = null;
    });

    if (resourceCancelRequestedRef.current) {
      await discardPendingResource();
      throw new DOMException('Upload canceled.', 'AbortError');
    }

    const finalizeController = new AbortController();
    resourceFinalizeControllerRef.current = finalizeController;
    const completed = await fetch(
      `/api/workspace/products/${encodeURIComponent(productId)}/curriculum/${encodeURIComponent(lessonId)}/resources/${encodeURIComponent(init.resourceId)}/complete`,
      { method: 'POST', signal: finalizeController.signal },
    );
    resourceFinalizeControllerRef.current = null;
    const result = await completed.json().catch(() => ({}));
    if (!completed.ok) throw new Error(result.error || 'The resource could not be verified.');
    if (resourceCancelRequestedRef.current) {
      await discardPendingResource();
      throw new DOMException('Upload canceled.', 'AbortError');
    }

    const refreshed = await fetch(
      `/api/workspace/products/${encodeURIComponent(productId)}/curriculum`,
      { cache: 'no-store' },
    );
    if (resourceCancelRequestedRef.current) {
      await discardPendingResource();
      throw new DOMException('Upload canceled.', 'AbortError');
    }
    const curriculum = await refreshed.json().catch(() => ({}));
    if (resourceCancelRequestedRef.current) {
      await discardPendingResource();
      throw new DOMException('Upload canceled.', 'AbortError');
    }
    if (refreshed.ok) {
      const updated = (curriculum.sections ?? []) as Section[];
      const resourceList =
        (
          updated
            .flatMap((section) => section.lessons)
            .find((lesson) => lesson.id === lessonId) as
            | (Lesson & { resources?: Resource[] })
            | undefined
        )?.resources ?? [];
      setResourcesByLesson((current) => ({ ...current, [lessonId]: resourceList }));
    }
    pendingResourceRef.current = null;
  }

  async function confirmRemoveResource() {
    if (!resourceToDelete) return;
    const { resource, lessonId } = resourceToDelete;
    setResourceBusy(true);
    try {
      const response = await fetch(
        `/api/workspace/products/${encodeURIComponent(productId)}/curriculum/${encodeURIComponent(lessonId)}/resources/${encodeURIComponent(resource.id)}`,
        { method: 'DELETE' },
      );
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || 'This resource could not be removed.');
      setResourcesByLesson((current) => ({
        ...current,
        [lessonId]: (current[lessonId] ?? []).filter((item) => item.id !== resource.id),
      }));
      setResourceToDelete(null);
      setNotice('Resource removed.');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not remove resource.');
    } finally {
      setResourceBusy(false);
    }
  }

  if (loading) {
    return (
      <div
        className="course-curriculum__loading"
        role="status"
        aria-label="Loading course curriculum"
      >
        <span className="course-curriculum__skeleton-heading" />
        <div className="course-curriculum__skeleton-layout">
          <div className="course-curriculum__skeleton-module">
            <span />
            <i />
            <i />
          </div>
        </div>
      </div>
    );
  }

  return (
    <section className="course-curriculum" aria-labelledby="course-curriculum-title">
      {/* Top Header */}
      <header className="course-curriculum__header">
        <div>
          <h2 id="course-curriculum-title">Build your modules and lessons</h2>
          <p>
            {sections.length} {sections.length === 1 ? 'module' : 'modules'} · {lessonCount}{' '}
            {lessonCount === 1 ? 'lesson' : 'lessons'}
          </p>
        </div>
        <button
          className="button button--mint"
          type="button"
          onClick={addSection}
          disabled={sections.length >= 50}
        >
          <Plus size={15} /> Add module
        </button>
      </header>

      {error && (
        <p className="course-curriculum__error" role="alert">
          {error}
        </p>
      )}

      {/* Full-Row Modules Outline */}
      <div className="course-curriculum__layout">
        <div className="course-curriculum__outline">
          {sections.map((section, sectionIndex) => {
            const secKey = section.id ?? section._key!;
            const isCollapsed = Boolean(collapsedSections[secKey]);

            return (
              <article className="course-module" key={secKey}>
                <div className="course-module__top">
                  <span className="course-module__badge">MODULE {sectionIndex + 1}</span>
                  <div className="course-module__header-inputs">
                    <input
                      id={`module-title-${secKey}`}
                      className="course-module__title"
                      value={section.title}
                      maxLength={160}
                      onChange={(event) => updateSectionTitle(sectionIndex, event.target.value)}
                      placeholder={`Module ${sectionIndex + 1} title`}
                      aria-label={`Module ${sectionIndex + 1} title`}
                    />
                    <WorkspaceSelect
                      id={`module-status-${secKey}`}
                      className="course-module__status"
                      value={section.status}
                      aria-label={`${section.title} visibility`}
                      onChange={(event) => {
                        setSections((current) =>
                          current.map((item, index) =>
                            index === sectionIndex
                              ? { ...item, status: event.target.value as Section['status'] }
                              : item,
                          ),
                        );
                        setNotice('');
                      }}
                    >
                      <option value="published">Published</option>
                      <option value="draft">Draft</option>
                    </WorkspaceSelect>
                  </div>
                  <div className="course-module__tools">
                    <button
                      type="button"
                      aria-label="Move module up"
                      title="Move module up"
                      disabled={sectionIndex === 0}
                      onClick={() => moveSection(sectionIndex, -1)}
                    >
                      <ArrowUp size={14} />
                    </button>
                    <button
                      type="button"
                      aria-label="Move module down"
                      title="Move module down"
                      disabled={sectionIndex === sections.length - 1}
                      onClick={() => moveSection(sectionIndex, 1)}
                    >
                      <ArrowDown size={14} />
                    </button>
                    <button
                      type="button"
                      aria-label={isCollapsed ? 'Expand module' : 'Collapse module'}
                      title={isCollapsed ? 'Expand module' : 'Collapse module'}
                      onClick={() => toggleSectionCollapse(secKey)}
                    >
                      {isCollapsed ? <ChevronDown size={15} /> : <ChevronUp size={15} />}
                    </button>
                    <button
                      type="button"
                      className="course-module__delete"
                      aria-label={`Delete ${section.title}`}
                      title="Delete module"
                      onClick={() =>
                        setModuleToDelete({
                          index: sectionIndex,
                          title: section.title,
                          lessonCount: section.lessons.length,
                        })
                      }
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>

                {!isCollapsed && (
                  <>
                    <div className="course-module__lessons">
                      {section.lessons.map((lesson, lessonIndex) => {
                        const lessonKey = lesson.id ?? lesson._key!;
                        const ActiveIcon =
                          lesson.type === 'video'
                            ? CirclePlay
                            : lesson.type === 'quiz'
                              ? CircleHelp
                              : FileText;

                        const resourceCount = (resourcesByLesson[lesson.id ?? ''] ?? []).length;

                        return (
                          <div
                            key={lessonKey}
                            className="course-lesson-row"
                            onClick={() =>
                              setEditingTarget({
                                sectionIndex,
                                lessonIndex,
                                isNew: false,
                              })
                            }
                          >
                            <div className="course-lesson-row__left">
                              <span className="course-lesson-row__icon">
                                <ActiveIcon size={16} />
                              </span>
                              <div className="course-lesson-row__text">
                                <strong>{lesson.title || 'Untitled lesson'}</strong>
                                <div className="course-lesson-row__badges">
                                  <span className="course-lesson-row__badge is-type">
                                    {lesson.type.toUpperCase()}
                                  </span>
                                  {lesson.isFreePreview && (
                                    <span className="course-lesson-row__badge is-preview">
                                      Free preview
                                    </span>
                                  )}
                                  <span
                                    className={`course-lesson-row__badge is-${lesson.status}`}
                                  >
                                    {lesson.status === 'published' ? 'Published' : 'Draft'}
                                  </span>
                                  {lesson.type === 'video' && lesson.videoSource === 'hosted' && (
                                    <span className="course-lesson-row__badge is-hosted">
                                      {lesson.videoStatus === 'ready'
                                        ? '✓ Ready'
                                        : '⏳ Processing'}
                                    </span>
                                  )}
                                  {resourceCount > 0 && (
                                    <span className="course-lesson-row__badge is-resource">
                                      <Paperclip size={11} /> {resourceCount}{' '}
                                      {resourceCount === 1 ? 'file' : 'files'}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                            <div
                              className="course-lesson-row__right"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <button
                                type="button"
                                className="course-lesson-row__edit-btn"
                                onClick={() =>
                                  setEditingTarget({
                                    sectionIndex,
                                    lessonIndex,
                                    isNew: false,
                                  })
                                }
                              >
                                Edit lesson
                              </button>
                              <button
                                type="button"
                                className="course-lesson-row__tool"
                                aria-label="Move lesson up"
                                title="Move up"
                                disabled={lessonIndex === 0}
                                onClick={() => moveLesson(sectionIndex, lessonIndex, -1)}
                              >
                                <ArrowUp size={13} />
                              </button>
                              <button
                                type="button"
                                className="course-lesson-row__tool"
                                aria-label="Move lesson down"
                                title="Move down"
                                disabled={lessonIndex === section.lessons.length - 1}
                                onClick={() => moveLesson(sectionIndex, lessonIndex, 1)}
                              >
                                <ArrowDown size={13} />
                              </button>
                              <button
                                type="button"
                                className="course-lesson-row__delete"
                                aria-label={`Delete ${lesson.title || 'lesson'}`}
                                title="Delete lesson"
                                onClick={() =>
                                  setLessonToDelete({
                                    sectionIndex,
                                    lessonIndex,
                                    title: lesson.title,
                                  })
                                }
                              >
                                <Trash2 size={13} />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                      {section.lessons.length === 0 && (
                        <p className="course-module__empty-hint">
                          No lessons in this module yet. Add one below.
                        </p>
                      )}
                    </div>
                    <div className="course-module__add">
                      <button
                        type="button"
                        disabled={lessonCount >= 100}
                        onClick={() => openAddLessonModal(sectionIndex, 'video')}
                      >
                        <CirclePlay size={14} /> + Video lesson
                      </button>
                      <button
                        type="button"
                        disabled={lessonCount >= 100}
                        onClick={() => openAddLessonModal(sectionIndex, 'text')}
                      >
                        <FileText size={14} /> + Text lesson
                      </button>

                    </div>
                  </>
                )}
                {isCollapsed && (
                  <button
                    type="button"
                    className="course-module__collapsed-summary"
                    onClick={() => toggleSectionCollapse(secKey)}
                  >
                    <span>
                      {section.lessons.length}{' '}
                      {section.lessons.length === 1 ? 'lesson' : 'lessons'}
                    </span>
                    <span>Click to expand</span>
                  </button>
                )}
              </article>
            );
          })}

          {!sections.length && (
            <div className="course-curriculum__empty">
              <BookOpen size={28} />
              <strong>Start building your course structure</strong>
              <p>
                Add modules to divide your course into chapters or weeks, then add video lessons,
                written guides.
              </p>
              <button
                type="button"
                className="button button--mint"
                onClick={addSection}
              >
                <Plus size={15} /> Add your first module
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Curriculum Save Status Footer */}
      <footer className="course-curriculum__footer">
        <div>
          {saving || (dirty && !error) ? (
            <span className="course-curriculum__dirty">
              <Loader2 size={14} className="button-spinner" /> Saving changes…
            </span>
          ) : notice ? (
            <span className="course-curriculum__saved">
              <Check size={14} /> {notice}
            </span>
          ) : (
            <span>Curriculum is up to date</span>
          )}
        </div>
        {saveFailed && dirty && (
          <button
            type="button"
            className="button button--outline"
            onClick={() => {
              setError('');
              setSaveFailed(false);
              void save();
            }}
          >
            Retry save
          </button>
        )}
      </footer>

      {/* ====================================================================
          1. SCROLLABLE LESSON EDITOR MODAL (Matched to User's Screenshot)
         ==================================================================== */}
      {activeLesson && (
        <Dialog
          open={Boolean(editingTarget)}
          onOpenChange={(open) => {
            if (!open) {
              setEditingTarget(null);
              void save();
            }
          }}
          title={editingTarget?.isNew ? 'Add lesson' : 'Edit lesson'}
          describedBy="course-lesson-modal-desc"
          className="course-lesson-modal"
          overlayClassName="media-folder-dialog"
        >
          {/* Fixed Header */}
          <header className="course-lesson-modal__header">
            <div className="course-lesson-modal__header-left">
              <div className="course-lesson-modal__header-icon">
                <BookOpen size={20} />
              </div>
              <div className="course-lesson-modal__header-titles">
                <h2>{editingTarget?.isNew ? 'Add lesson' : 'Edit lesson'}</h2>
                <p id="course-lesson-modal-desc">Provide your lesson details</p>
              </div>
            </div>
            <button
              type="button"
              className="course-lesson-modal__close"
              aria-label="Close"
              onClick={() => {
                setEditingTarget(null);
                void save();
              }}
            >
              <X size={18} />
            </button>
          </header>

          {/* Scrollable Body */}
          <div className="course-lesson-modal__body">
            {/* Lesson Title */}
            <div className="field">
              <label htmlFor="modal-lesson-title">Lesson title</label>
              <input
                id="modal-lesson-title"
                value={activeLesson.lesson.title}
                maxLength={160}
                placeholder="e.g. Introduction to the course"
                onChange={(event) => updateActiveLesson({ title: event.target.value })}
              />
            </div>

            {/* Belongs to module (if multiple exist) */}
            {sections.length > 1 && (
              <div className="field course-lesson-modal__module-field">
                <label htmlFor="modal-lesson-module">Belongs to module</label>
                <WorkspaceSelect
                  id="modal-lesson-module"
                  className="course-lesson-modal__select-trigger"
                  menuClassName="course-lesson-modal__select-menu"
                  value={activeLesson.sectionIndex}
                  onChange={(event) => moveLessonToSection(Number(event.target.value))}
                >
                  {sections.map((section, index) => (
                    <option key={section.id ?? section._key} value={index}>
                      {/^(module|chapter|week)\s+\d+$/i.test(section.title.trim())
                        ? section.title
                        : `Module ${index + 1} · ${section.title}`}
                    </option>
                  ))}
                </WorkspaceSelect>
              </div>
            )}

            {/* Visibility & Free Preview Row */}
            <div className="course-lesson-modal__visibility-row">
              <div className="field course-lesson-modal__visibility-field">
                <label htmlFor="modal-lesson-visibility">Lesson visibility</label>
                <WorkspaceSelect
                  id="modal-lesson-visibility"
                  className="course-lesson-modal__select-trigger"
                  menuClassName="course-lesson-modal__select-menu"
                  value={activeLesson.lesson.status}
                  onChange={(event) =>
                    updateActiveLesson({ status: event.target.value as Lesson['status'] })
                  }
                >
                  <option value="published">Published (visible to enrolled learners)</option>
                  <option value="draft">Draft (hidden from learners)</option>
                </WorkspaceSelect>
              </div>

              <label
                className={`course-toggle ${
                  activeLesson.lesson.type === 'quiz' ||
                  (activeLesson.lesson.type === 'video' &&
                    activeLesson.lesson.videoSource === 'hosted')
                    ? 'is-disabled'
                    : ''
                }`}
              >
                <input
                  type="checkbox"
                  checked={activeLesson.lesson.isFreePreview}
                  disabled={
                    activeLesson.lesson.type === 'quiz' ||
                    (activeLesson.lesson.type === 'video' &&
                      activeLesson.lesson.videoSource === 'hosted')
                  }
                  onChange={(event) =>
                    updateActiveLesson({ isFreePreview: event.target.checked })
                  }
                />
                <span>Free preview for prospective buyers</span>
              </label>
            </div>

            {/* Lesson Description / Rich Text Editor */}
            <div className="field">
              <label htmlFor="modal-lesson-description">Lesson description</label>
              <ProductDescriptionEditor
                id="modal-lesson-description"
                value={activeLesson.lesson.text}
                onChange={(json, plain) => updateActiveLesson({ text: json || plain })}
                placeholder="Write lesson notes, action steps, or written content here..."
              />
            </div>

            {/* Media & Attachment Section (For Video Lessons) */}
            {activeLesson.lesson.type === 'video' && (
              <div className="course-lesson-modal__media-section">
                <div className="course-lesson-modal__section-heading">
                  <h3>Media & Attachment</h3>
                </div>

                <div className="field">
                  <label>Lesson media</label>
                  <div className="course-lesson-modal__radios">
                    <label className="course-lesson-modal__radio-label">
                      <input
                        type="radio"
                        name="videoSourceChoice"
                        checked={(activeLesson.lesson.videoSource ?? 'hosted') === 'hosted'}
                        onChange={() => {
                          updateActiveLesson({
                            videoSource: 'hosted',
                            isFreePreview: false,
                          });
                        }}
                      />
                      <span>Upload video</span>
                    </label>

                    <label className="course-lesson-modal__radio-label">
                      <input
                        type="radio"
                        name="videoSourceChoice"
                        checked={activeLesson.lesson.videoSource === 'external'}
                        onChange={() => {
                          if (activeLesson.lesson.bunnyVideoId) {
                            setError('Remove the hosted video before switching to an external link.');
                            return;
                          }
                          updateActiveLesson({
                            videoSource: 'external',
                          });
                        }}
                      />
                      <span>URL</span>
                    </label>
                  </div>
                </div>

                {/* Upload Video Branch */}
                {(activeLesson.lesson.videoSource ?? 'hosted') === 'hosted' ? (
                  <div className="course-lesson-modal__upload-box">
                    {activeLesson.lesson.bunnyVideoId ? (
                      <div className="course-hosted-video__card">
                        <div
                          className={`course-hosted-video__status is-${
                            activeLesson.lesson.videoStatus ?? 'uploading'
                          }`}
                          role="status"
                        >
                          {activeLesson.lesson.videoStatus === 'ready'
                            ? '✓ Ready to publish'
                            : activeLesson.lesson.videoStatus === 'failed'
                              ? '✕ Processing failed. Remove and upload again.'
                              : activeLesson.lesson.videoStatus === 'processing'
                                ? '⏳ Processing video on Bunny Stream…'
                                : '↑ Upload in progress…'}
                        </div>
                        <button
                          type="button"
                          className="button button--outline"
                          disabled={videoBusy}
                          onClick={() => setVideoToDeleteConfirm(true)}
                        >
                          <Trash2 size={14} /> Remove video
                        </button>
                      </div>
                    ) : (
                      <div className="course-lesson-modal__dropzone">
                        <label className="course-lesson-modal__dropzone-btn">
                          <strong>Click to upload or drag and drop</strong>
                          <small>.MP4 or .MOV</small>
                          <input
                            type="file"
                            accept="video/mp4,video/webm,video/quicktime,video/x-m4v,video/x-matroska,video/mpeg,video/ogg"
                            hidden
                            disabled={!activeLesson.lesson.id || dirty || videoBusy}
                            onChange={(event) => {
                              const file = event.target.files?.[0];
                              event.target.value = '';
                              if (!file) return;
                              setVideoBusy(true);
                              setError('');
                              setVideoProgress(0);
                              void uploadHostedVideo(file)
                                .catch((cause) =>
                                  setError(
                                    cause instanceof Error
                                      ? cause.message
                                      : 'Video upload failed.',
                                  ),
                                )
                                .finally(() => setVideoBusy(false));
                            }}
                          />
                        </label>
                        {videoBusy && (
                          <div className="course-hosted-video__progress-wrap">
                            <progress
                              value={videoProgress}
                              max={100}
                              aria-label="Hosted video upload progress"
                            />
                            <span>Uploading video: {videoProgress}%</span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="course-external-video">
                    <label className="course-curriculum__label">
                      Video link (YouTube or Vimeo)
                      <input
                        type="url"
                        value={activeLesson.lesson.videoUrl}
                        placeholder="https://www.youtube.com/watch?v=... or https://vimeo.com/..."
                        onChange={(event) =>
                          updateActiveLesson({ videoUrl: event.target.value })
                        }
                      />
                      <small>Use a public or unlisted YouTube or Vimeo link.</small>
                    </label>

                    {safeEmbedPreview(activeLesson.lesson.videoUrl) ? (
                      <div className="course-video-preview">
                        <iframe
                          src={safeEmbedPreview(activeLesson.lesson.videoUrl)}
                          title={activeLesson.lesson.title}
                          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                          allowFullScreen
                        />
                      </div>
                    ) : null}
                  </div>
                )}
              </div>
            )}

            {/* Quiz Authoring (For Quiz Lessons) */}
            {activeLesson.lesson.type === 'quiz' && (
              <div className="course-quiz-authoring">
                <div className="course-quiz-authoring__settings">
                  <label className="course-curriculum__label">
                    Passing score (%)
                    <input
                      type="number"
                      min={1}
                      max={100}
                      value={activeLesson.lesson.quiz?.passingScore ?? 70}
                      onChange={(event) =>
                        updateActiveLesson({
                          quiz: {
                            ...activeLesson.lesson.quiz!,
                            passingScore: Number(event.target.value),
                          },
                        })
                      }
                    />
                  </label>

                  <label className="course-curriculum__label">
                    Allowed attempts
                    <WorkspaceSelect
                      value={activeLesson.lesson.quiz?.maxAttempts ?? 'unlimited'}
                      onChange={(event) =>
                        updateActiveLesson({
                          quiz: {
                            ...activeLesson.lesson.quiz!,
                            maxAttempts:
                              event.target.value === 'unlimited'
                                ? null
                                : Number(event.target.value),
                          },
                        })
                      }
                    >
                      <option value="1">1 attempt</option>
                      <option value="2">2 attempts</option>
                      <option value="3">3 attempts</option>
                      <option value="5">5 attempts</option>
                      <option value="10">10 attempts</option>
                      <option value="unlimited">Unlimited attempts</option>
                    </WorkspaceSelect>
                  </label>
                </div>

                <label className="course-toggle" style={{ margin: '8px 0 16px' }}>
                  <input
                    type="checkbox"
                    checked={activeLesson.lesson.quiz?.revealCorrectAnswers ?? false}
                    onChange={(event) =>
                      updateActiveLesson({
                        quiz: {
                          ...activeLesson.lesson.quiz!,
                          revealCorrectAnswers: event.target.checked,
                        },
                      })
                    }
                  />
                  <span>Show correct answers to learners after submission</span>
                </label>

                <div className="course-quiz-authoring__questions-list">
                  {(activeLesson.lesson.quiz?.questions ?? []).map(
                    (question, questionIndex) => (
                      <fieldset
                        className="course-quiz-authoring__question"
                        key={question.id}
                      >
                        <div className="course-quiz-authoring__question-top">
                          <legend>Question {questionIndex + 1}</legend>
                          {activeLesson.lesson.quiz!.questions.length > 1 && (
                            <button
                              type="button"
                              className="button button--outline course-quiz-authoring__remove-q"
                              onClick={() =>
                                updateActiveLesson({
                                  quiz: {
                                    ...activeLesson.lesson.quiz!,
                                    questions: activeLesson.lesson.quiz!.questions.filter(
                                      (item) => item.id !== question.id,
                                    ),
                                  },
                                })
                              }
                            >
                              <Trash2 size={13} /> Remove
                            </button>
                          )}
                        </div>

                        <label className="course-curriculum__label">
                          Question prompt
                          <input
                            value={question.prompt}
                            maxLength={400}
                            placeholder="e.g. What is the fundamental concept of this module?"
                            onChange={(event) =>
                              updateActiveLesson({
                                quiz: {
                                  ...activeLesson.lesson.quiz!,
                                  questions: activeLesson.lesson.quiz!.questions.map(
                                    (item, index) =>
                                      index === questionIndex
                                        ? { ...item, prompt: event.target.value }
                                        : item,
                                  ),
                                },
                              })
                            }
                          />
                        </label>

                        <div className="course-quiz-authoring__options">
                          <span className="course-quiz-authoring__options-hint">
                            Mark the radio button next to the correct answer:
                          </span>
                          {question.options.map((option, optionIndex) => (
                            <div
                              className={`course-quiz-authoring__option ${
                                question.correctOptionId === option.id
                                  ? 'is-correct-pick'
                                  : ''
                              }`}
                              key={option.id}
                            >
                              <label
                                className="course-quiz-authoring__radio-wrap"
                                title="Mark as correct answer"
                              >
                                <input
                                  type="radio"
                                  name={`correct-${question.id}`}
                                  checked={question.correctOptionId === option.id}
                                  onChange={() =>
                                    updateActiveLesson({
                                      quiz: {
                                        ...activeLesson.lesson.quiz!,
                                        questions: activeLesson.lesson.quiz!.questions.map(
                                          (item, index) =>
                                            index === questionIndex
                                              ? { ...item, correctOptionId: option.id }
                                              : item,
                                        ),
                                      },
                                    })
                                  }
                                />
                                <span>Correct</span>
                              </label>
                              <input
                                className="course-quiz-authoring__option-input"
                                value={option.text}
                                maxLength={160}
                                placeholder={`Option ${optionIndex + 1}`}
                                onChange={(event) =>
                                  updateActiveLesson({
                                    quiz: {
                                      ...activeLesson.lesson.quiz!,
                                      questions: activeLesson.lesson.quiz!.questions.map(
                                        (item, index) =>
                                          index === questionIndex
                                            ? {
                                                ...item,
                                                options: item.options.map((choice, choiceIndex) =>
                                                  choiceIndex === optionIndex
                                                    ? { ...choice, text: event.target.value }
                                                    : choice,
                                                ),
                                              }
                                            : item,
                                      ),
                                    },
                                  })
                                }
                              />
                              {question.options.length > 2 && (
                                <button
                                  type="button"
                                  className="course-quiz-authoring__remove-opt"
                                  title="Remove option"
                                  onClick={() =>
                                    updateActiveLesson({
                                      quiz: {
                                        ...activeLesson.lesson.quiz!,
                                        questions: activeLesson.lesson.quiz!.questions.map(
                                          (item, index) =>
                                            index === questionIndex
                                              ? {
                                                  ...item,
                                                  options: item.options.filter(
                                                    (choice) => choice.id !== option.id,
                                                  ),
                                                  correctOptionId:
                                                    item.correctOptionId === option.id
                                                      ? ''
                                                      : item.correctOptionId,
                                                }
                                              : item,
                                        ),
                                      },
                                    })
                                  }
                                >
                                  <Trash2 size={13} />
                                </button>
                              )}
                            </div>
                          ))}
                        </div>

                        <button
                          type="button"
                          className="button button--outline course-quiz-authoring__add-opt"
                          disabled={question.options.length >= 6}
                          onClick={() =>
                            updateActiveLesson({
                              quiz: {
                                ...activeLesson.lesson.quiz!,
                                questions: activeLesson.lesson.quiz!.questions.map(
                                  (item, index) =>
                                    index === questionIndex
                                      ? {
                                          ...item,
                                          options: [
                                            ...item.options,
                                            { id: newKey(), text: '' },
                                          ],
                                        }
                                      : item,
                                ),
                              },
                            })
                          }
                        >
                          <Plus size={13} /> Add option
                        </button>
                      </fieldset>
                    ),
                  )}
                </div>

                <button
                  type="button"
                  className="button button--outline course-quiz-authoring__add-q"
                  disabled={(activeLesson.lesson.quiz?.questions.length ?? 0) >= 50}
                  onClick={() =>
                    updateActiveLesson({
                      quiz: {
                        ...activeLesson.lesson.quiz!,
                        questions: [
                          ...(activeLesson.lesson.quiz?.questions ?? []),
                          {
                            id: newKey(),
                            prompt: '',
                            options: [
                              { id: newKey(), text: '' },
                              { id: newKey(), text: '' },
                            ],
                            correctOptionId: '',
                          },
                        ],
                      },
                    })
                  }
                >
                  <Plus size={14} /> Add another question
                </button>
              </div>
            )}

            {/* Lesson Downloadable Attachments (PDF up to 20MB, etc.) */}
            <div className="course-lesson-modal__attachment-section">
              <input
                ref={setResourceInput}
                type="file"
                accept=".pdf,.zip,.epub,.docx,.pptx,.xlsx,.mp3,.png,.jpg,.jpeg,.webp"
                hidden
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  event.target.value = '';
                  if (!file) return;
                  resourceCancelRequestedRef.current = false;
                  pendingResourceRef.current = null;
                  setResourceUploading(true);
                  setResourceCanceling(false);
                  setResourceBusy(true);
                  setError('');
                  setResourceProgress(null);
                  void uploadResource(file)
                    .then(() => setNotice('Lesson resource uploaded.'))
                    .catch(async (cause) => {
                      if (resourceCancelRequestedRef.current) {
                        try {
                          await discardPendingResource();
                          setNotice('Attachment upload canceled.');
                        } catch (cleanupError) {
                          setError(
                            cleanupError instanceof Error
                              ? cleanupError.message
                              : 'The canceled attachment could not be removed.',
                          );
                        }
                        return;
                      }
                      const message = cause instanceof Error ? cause.message : 'Resource upload failed.';
                      if (pendingResourceRef.current) {
                        try {
                          await discardPendingResource();
                        } catch (cleanupError) {
                          setError(
                            `${message} ${cleanupError instanceof Error ? cleanupError.message : 'The incomplete attachment could not be removed.'}`,
                          );
                          return;
                        }
                      }
                      setError(message);
                    })
                    .finally(() => {
                      setResourceBusy(false);
                      setResourceUploading(false);
                      setResourceCanceling(false);
                      setResourceProgress(null);
                      resourceUploadRef.current = null;
                      resourceFinalizeControllerRef.current = null;
                      resourceCancelRequestedRef.current = false;
                    });
                }}
              />

              <button
                type="button"
                className="course-lesson-modal__add-attachment-btn"
                onClick={() => resourceInput?.click()}
                disabled={resourceBusy || !activeLesson.lesson.id}
              >
                <Plus size={15} /> Add lesson attachment (PDF up to 20MB)
              </button>

              {resourceUploading && (
                <div className="course-lesson-modal__upload-progress">
                  <div className="course-lesson-modal__upload-progress-copy" role="status" aria-live="polite">
                    <strong>{resourceCanceling ? 'Canceling upload…' : 'Uploading attachment'}</strong>
                    <span>
                      {resourceProgress === null
                        ? 'Preparing secure upload…'
                        : `${resourceProgress}% uploaded`}
                    </span>
                    <progress
                      value={resourceProgress ?? undefined}
                      max={100}
                      aria-label="Attachment upload progress"
                    />
                  </div>
                  <button
                    type="button"
                    className="course-lesson-modal__cancel-upload"
                    onClick={cancelResourceUpload}
                    disabled={resourceCanceling}
                  >
                    <X size={15} /> {resourceCanceling ? 'Canceling…' : 'Cancel upload'}
                  </button>
                </div>
              )}

              {/* Uploaded attachments list */}
              <div className="course-lesson-modal__attachments-list">
                {(resourcesByLesson[activeLesson.lesson.id ?? ''] ?? []).map((resource) => (
                  <div className="course-lesson-resource-row" key={resource.id}>
                    <span className="course-lesson-resource-row__name">
                      <FileText size={15} />
                      {resource.name}
                    </span>
                    <small>
                      {resource.status === 'ready'
                        ? `${(Number(resource.sizeBytes) / 1024 / 1024).toFixed(1)} MB`
                        : 'Incomplete'}
                    </small>
                    <button
                      type="button"
                      className="course-lesson-resource-row__remove"
                      disabled={resourceBusy}
                      onClick={() =>
                        setResourceToDelete({
                          resource,
                          lessonId: activeLesson.lesson.id!,
                        })
                      }
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Fixed Modal Footer with Onselli Green Brand Button */}
          <footer className="course-lesson-modal__footer">
            <Button
              variant="secondary"
              type="button"
              onClick={() => {
                setEditingTarget(null);
                void save();
              }}
            >
              Cancel
            </Button>
            <button
              type="button"
              className="course-lesson-modal__save-btn"
              onClick={() => {
                setEditingTarget(null);
                void save();
              }}
            >
              Save lesson
            </button>
          </footer>
        </Dialog>
      )}

      {/* ====================================================================
          2. CRUD CONFIRMATION MODALS (Native Onselli Component Modals)
         ==================================================================== */}

      {/* Delete Module Dialog */}
      <Dialog
        open={Boolean(moduleToDelete)}
        onOpenChange={(open) => {
          if (!open) setModuleToDelete(null);
        }}
        title="Delete module"
        describedBy="delete-module-desc"
        className="course-crud-dialog"
        overlayClassName="media-folder-dialog"
      >
        <div className="course-crud-dialog__content">
          <div className="course-crud-dialog__text">
            <h2>Delete module?</h2>
            <p id="delete-module-desc">
              Are you sure you want to delete <strong>“{moduleToDelete?.title}”</strong> and its{' '}
              {moduleToDelete?.lessonCount}{' '}
              {moduleToDelete?.lessonCount === 1 ? 'lesson' : 'lessons'}? This action cannot be
              undone.
            </p>
          </div>
        </div>
        <footer className="course-crud-dialog__footer">
          <Button variant="secondary" onClick={() => setModuleToDelete(null)}>
            Cancel
          </Button>
          <Button variant="danger" onClick={confirmDeleteModule}>
            Delete module
          </Button>
        </footer>
      </Dialog>

      {/* Delete Lesson Dialog */}
      <Dialog
        open={Boolean(lessonToDelete)}
        onOpenChange={(open) => {
          if (!open) setLessonToDelete(null);
        }}
        title="Delete lesson"
        describedBy="delete-lesson-desc"
        className="course-crud-dialog"
        overlayClassName="media-folder-dialog"
      >
        <div className="course-crud-dialog__content">
          <div className="course-crud-dialog__text">
            <h2>Delete lesson?</h2>
            <p id="delete-lesson-desc">
              Are you sure you want to delete{' '}
              <strong>“{lessonToDelete?.title || 'Untitled lesson'}”</strong>? This action cannot
              be undone.
            </p>
          </div>
        </div>
        <footer className="course-crud-dialog__footer">
          <Button variant="secondary" onClick={() => setLessonToDelete(null)}>
            Cancel
          </Button>
          <Button variant="danger" onClick={confirmDeleteLesson}>
            Delete lesson
          </Button>
        </footer>
      </Dialog>

      {/* Remove Resource Dialog */}
      <Dialog
        open={Boolean(resourceToDelete)}
        onOpenChange={(open) => {
          if (!open) setResourceToDelete(null);
        }}
        title="Remove attachment"
        describedBy="delete-resource-desc"
        className="course-crud-dialog"
        overlayClassName="media-folder-dialog"
      >
        <div className="course-crud-dialog__content">
          <div className="course-crud-dialog__text">
            <h2>Remove attachment?</h2>
            <p id="delete-resource-desc">
              Are you sure you want to remove{' '}
              <strong>“{resourceToDelete?.resource.name}”</strong> from this lesson?
            </p>
          </div>
        </div>
        <footer className="course-crud-dialog__footer">
          <Button
            variant="secondary"
            onClick={() => setResourceToDelete(null)}
            disabled={resourceBusy}
          >
            Cancel
          </Button>
          <Button
            variant="danger"
            onClick={() => void confirmRemoveResource()}
            disabled={resourceBusy}
          >
            {resourceBusy ? 'Removing…' : 'Remove attachment'}
          </Button>
        </footer>
      </Dialog>

      {/* Remove Hosted Video Dialog */}
      <Dialog
        open={videoToDeleteConfirm}
        onOpenChange={setVideoToDeleteConfirm}
        title="Remove hosted video"
        describedBy="delete-video-desc"
        className="course-crud-dialog"
        overlayClassName="media-folder-dialog"
      >
        <div className="course-crud-dialog__content">
          <div className="course-crud-dialog__text">
            <h2>Remove hosted video?</h2>
            <p id="delete-video-desc">
              Are you sure you want to remove the uploaded video from this lesson?
            </p>
          </div>
        </div>
        <footer className="course-crud-dialog__footer">
          <Button
            variant="secondary"
            onClick={() => setVideoToDeleteConfirm(false)}
            disabled={videoBusy}
          >
            Cancel
          </Button>
          <Button
            variant="danger"
            onClick={() => void confirmRemoveHostedVideo()}
            disabled={videoBusy}
          >
            {videoBusy ? 'Removing…' : 'Remove video'}
          </Button>
        </footer>
      </Dialog>
    </section>
  );
}
