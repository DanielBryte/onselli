'use client';

import { useEffect, useRef, useState } from 'react';
import { CircleHelp, LoaderCircle, Send } from 'lucide-react';

type Option = { id: string; text: string };
type Question = { id: string; prompt: string; options: Option[]; correctOptionId?: string };
type Quiz = { version: number; passingScore: number; maxAttempts: number | null; revealCorrectAnswers: boolean; questions: Question[] };
type Attempt = { id: string; status: 'in_progress' | 'submitted'; quiz: Quiz; answers: Record<string, string>; score?: number; passed?: boolean; correctCount?: number; totalCount?: number };

export default function CourseQuiz({ productId, lessonId, onPassed }: { productId: string; lessonId: string; onPassed: () => void }) {
  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [attempt, setAttempt] = useState<Attempt | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [remaining, setRemaining] = useState<number | null>(null);
  const [used, setUsed] = useState(0);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const onPassedRef = useRef(onPassed);
  onPassedRef.current = onPassed;
  const base = `/api/learning/courses/${encodeURIComponent(productId)}/lessons/${encodeURIComponent(lessonId)}/quiz`;

  async function readState() {
    const response = await fetch(base, { cache: 'no-store' });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.error || 'This quiz could not be loaded.');
    setQuiz(payload.quiz); setAttempt(payload.attempt); setAnswers(payload.attempt?.answers ?? {}); setRemaining(payload.attemptsRemaining); setUsed(payload.attemptsUsed ?? 0);
    if (payload.attempt?.passed) onPassedRef.current();
  }
  useEffect(() => { let current = true; setLoading(true); void fetch(base, { cache: 'no-store' }).then(async (response) => { const payload = await response.json().catch(() => ({})); if (!response.ok) throw new Error(payload.error || 'This quiz could not be loaded.'); if (!current) return; setQuiz(payload.quiz); setAttempt(payload.attempt); setAnswers(payload.attempt?.answers ?? {}); setRemaining(payload.attemptsRemaining); setUsed(payload.attemptsUsed ?? 0); if (payload.attempt?.passed) onPassedRef.current(); }).catch((cause) => { if (current) setError(cause instanceof Error ? cause.message : 'This quiz could not be loaded.'); }).finally(() => { if (current) setLoading(false); }); return () => { current = false; }; }, [base]);

  async function start() {
    setBusy(true); setError('');
    try { const response = await fetch(base, { method: 'POST' }); const payload = await response.json().catch(() => ({})); if (!response.ok) throw new Error(payload.error || 'An attempt could not be started.'); setAttempt(payload.attempt); setAnswers({}); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'An attempt could not be started.'); }
    finally { setBusy(false); }
  }
  async function submit() {
    if (!attempt) return;
    setBusy(true); setError('');
    try { const response = await fetch(`${base}/attempts/${encodeURIComponent(attempt.id)}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ answers }) }); const payload = await response.json().catch(() => ({})); if (!response.ok) throw new Error(payload.error || 'Your answers could not be submitted.'); setAttempt(payload.attempt); if (payload.attempt.passed) onPassed(); await readState(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Your answers could not be submitted.'); }
    finally { setBusy(false); }
  }

  if (loading) return <p className="course-player__unavailable" role="status">Loading quiz…</p>;
  if (!quiz) return <p className="course-player__unavailable" role="alert">{error || 'This quiz is unavailable.'}</p>;
  const activeQuiz = attempt?.quiz ?? quiz;
  return <section className="course-quiz" aria-label="Course quiz">
    <header><CircleHelp size={20}/><div><strong>Quiz</strong><p>Pass with {activeQuiz.passingScore}% or higher. {activeQuiz.maxAttempts === null ? 'You can retry as needed.' : `${activeQuiz.maxAttempts} attempts per version.`}</p></div></header>
    {attempt?.status === 'submitted' ? <div className={`course-quiz__result ${attempt.passed ? 'is-passed' : 'is-failed'}`} role="status"><strong>{attempt.passed ? 'Passed' : 'Not passed yet'} · {attempt.score}%</strong><p>{attempt.passed ? 'Your course progress has been updated.' : remaining === 0 ? 'No attempts remain for this version.' : 'Review the material and try again when you are ready.'}</p>{attempt.quiz.revealCorrectAnswers && <p>{attempt.correctCount} of {attempt.totalCount} correct. Correct choices are marked below.</p>}</div> : null}
    {attempt?.status === 'in_progress' && activeQuiz.questions.map((question, index) => <fieldset className="course-quiz__question" key={question.id}><legend>{index + 1}. {question.prompt}</legend>{question.options.map((option) => <label key={option.id}><input type="radio" name={`quiz-${attempt.id}-${question.id}`} checked={answers[question.id] === option.id} onChange={() => setAnswers((current) => ({ ...current, [question.id]: option.id }))}/><span>{option.text}</span></label>)}</fieldset>)}
    {attempt?.status === 'submitted' && activeQuiz.revealCorrectAnswers && activeQuiz.questions.map((question) => <div className="course-quiz__review" key={question.id}><strong>{question.prompt}</strong>{question.options.map((option) => <p key={option.id} className={option.id === question.correctOptionId ? 'is-correct' : answers[question.id] === option.id ? 'is-selected' : ''}>{option.text}{option.id === question.correctOptionId ? ' · Correct answer' : answers[question.id] === option.id ? ' · Your answer' : ''}</p>)}</div>)}
    {attempt?.status === 'in_progress' ? <button className="button button--mint" type="button" onClick={() => void submit()} disabled={busy || activeQuiz.questions.some((question) => !answers[question.id])}><Send size={15}/>{busy ? 'Submitting…' : 'Submit answers'}</button> : attempt?.passed ? null : remaining === 0 ? null : <button className="button button--mint" type="button" onClick={() => void start()} disabled={busy}><LoaderCircle size={15} className={busy ? 'is-spinning' : ''}/>{busy ? 'Starting…' : attempt ? 'Try again' : 'Start quiz'}</button>}
    {error && <p className="course-player__error" role="alert">{error}<button type="button" className="button button--outline" onClick={() => void readState()}>Retry</button></p>}
    {attempt?.status !== 'in_progress' && !attempt?.passed && remaining !== 0 && <small>{remaining === null ? `${used} attempts submitted · unlimited retries` : `${used} of ${activeQuiz.maxAttempts} attempts used`}</small>}
  </section>;
}
