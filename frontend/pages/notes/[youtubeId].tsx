'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { BookOpen, Baby, FlaskConical, List, Map, FileCode, FileText, Download, Layers, Plus, ArrowLeft } from 'lucide-react';
import { printPdf } from '@/lib/printPdf';
import ShareButton from '@/components/Social/ShareButton';

type IconType = React.ComponentType<{ className?: string }>;

function authHeaders(): Record<string, string> {
  const token =
    typeof window !== 'undefined'
      ? localStorage.getItem('access_token') ?? sessionStorage.getItem('access_token')
      : null;
  return token
    ? { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }
    : { 'Content-Type': 'application/json' };
}

const STYLE_OPTIONS: { value: string; label: string; icon: IconType }[] = [
  { value: 'standard', label: 'Standard', icon: BookOpen },
  { value: 'simple', label: 'Simple', icon: Baby },
  { value: 'technical', label: 'Technical', icon: FlaskConical },
  { value: 'bullet_points', label: 'Bullets', icon: List },
  { value: 'mindmap', label: 'Mind Map', icon: Map },
];

interface NoteData {
  title: string;
  style: string;
  content: string;
  word_count: number;
  read_time_minutes: number;
}
interface Flashcard { id: string; front: string; back: string; concept: string; }

export default function NotesViewer() {
  const router = useRouter();
  const youtubeId = typeof router.query.youtubeId === 'string' ? router.query.youtubeId : '';
  const title = typeof router.query.title === 'string' ? router.query.title : '';

  const [style, setStyle] = useState('standard');
  const [note, setNote] = useState<NoteData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cards, setCards] = useState<Flashcard[] | null>(null);
  const [cardsLoading, setCardsLoading] = useState(false);
  const [flipped, setFlipped] = useState<Record<string, boolean>>({});
  const [reviewMsg, setReviewMsg] = useState<string | null>(null);
  const [addingReview, setAddingReview] = useState(false);

  const fetchNote = useCallback(async (s: string) => {
    if (!youtubeId) return;
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ style: s });
      if (title) params.append('title', title);
      const res = await fetch(`/api/notes/${youtubeId}?${params.toString()}`, { headers: authHeaders() });
      if (!res.ok) {
        const e = await res.json().catch(() => ({}));
        throw new Error(e.detail || 'Could not generate notes');
      }
      setNote(await res.json());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error');
    } finally {
      setLoading(false);
    }
  }, [youtubeId, title]);

  useEffect(() => { fetchNote(style); }, [fetchNote, style]);

  const download = (ext: string, mime: string) => {
    if (!note) return;
    const blob = new Blob([note.content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `notes-${youtubeId}.${ext}`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const loadFlashcards = async () => {
    setCardsLoading(true);
    try {
      const res = await fetch(`/api/notes/${youtubeId}/flashcards`, { headers: authHeaders() });
      const data = await res.json();
      setCards(data.flashcards || []);
    } catch {
      setCards([]);
    } finally {
      setCardsLoading(false);
    }
  };

  const addToReview = async () => {
    setAddingReview(true);
    setReviewMsg(null);
    try {
      const res = await fetch(`/api/notes/${youtubeId}/flashcards/add-to-review`, {
        method: 'POST',
        headers: authHeaders(),
      });
      const data = await res.json();
      setReviewMsg(
        data.added > 0
          ? `Added ${data.added} card${data.added === 1 ? '' : 's'} to your review deck.`
          : 'These cards are already in your review deck.'
      );
    } catch {
      setReviewMsg('Could not add to review deck.');
    } finally {
      setAddingReview(false);
    }
  };

  return (
    <>
      <Head><title>{note?.title || 'Study Notes'} — LearnPath AI</title></Head>
      <div className="min-h-screen bg-background">
        <div className="max-w-3xl mx-auto px-6 py-8">
          <Link href="/notes" className="inline-flex items-center gap-1 text-white/40 hover:text-white text-sm"><ArrowLeft className="h-3.5 w-3.5" /> All notes</Link>

          <h1 className="text-2xl font-bold text-white mt-3">{note?.title || 'Study Notes'}</h1>
          {note && (
            <p className="text-white/40 text-sm mt-1">
              {note.read_time_minutes} min read · {note.word_count} words · {style.replace('_', ' ')}
            </p>
          )}

          {/* Style switcher */}
          <div className="flex flex-wrap gap-2 mt-5">
            {STYLE_OPTIONS.map((o) => (
              <button
                key={o.value}
                onClick={() => setStyle(o.value)}
                disabled={loading}
                className={`px-3 py-1.5 rounded-lg text-sm border transition ${
                  style === o.value
                    ? 'bg-accent text-white border-accent'
                    : 'bg-surface border-border text-white/60 hover:text-white'
                } disabled:opacity-50`}
              >
                <span className="inline-flex items-center gap-1.5"><o.icon className="h-4 w-4" /> {o.label}</span>
              </button>
            ))}
          </div>

          {/* Content */}
          <div className="mt-6 bg-surface-elevated border border-border rounded-2xl p-6 min-h-[300px]">
            {loading ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin mb-3" />
                <p className="text-white/50 text-sm">Generating {style.replace('_', ' ')} notes…</p>
                <p className="text-white/30 text-xs mt-1">First time for a style can take ~10–20s.</p>
              </div>
            ) : error ? (
              <div className="text-center py-12">
                <p className="text-red-400">{error}</p>
                <button onClick={() => fetchNote(style)} className="mt-3 px-4 py-2 bg-surface border border-border rounded-lg text-white/70 hover:text-white">Retry</button>
              </div>
            ) : (
              <pre className="whitespace-pre-wrap break-words font-sans text-white/85 text-sm leading-relaxed">
                {note?.content}
              </pre>
            )}
          </div>

          {/* Actions */}
          {note && !loading && !error && (
            <div className="mt-5 flex flex-wrap gap-3">
              <button onClick={() => download('md', 'text/markdown')} className="inline-flex items-center gap-1.5 px-4 py-2 bg-surface border border-border rounded-lg text-white/70 hover:text-white text-sm"><FileCode className="h-4 w-4" /> Markdown</button>
              <button onClick={() => download('txt', 'text/plain')} className="inline-flex items-center gap-1.5 px-4 py-2 bg-surface border border-border rounded-lg text-white/70 hover:text-white text-sm"><FileText className="h-4 w-4" /> Text</button>
              <button onClick={() => note && printPdf(note.title || 'Study Notes', note.content)} className="inline-flex items-center gap-1.5 px-4 py-2 bg-surface border border-border rounded-lg text-white/70 hover:text-white text-sm"><Download className="h-4 w-4" /> PDF</button>
              <ShareButton itemType="note" itemRef={youtubeId} title={note?.title || 'Study notes'} />
              <button onClick={loadFlashcards} disabled={cardsLoading} className="inline-flex items-center gap-1.5 px-4 py-2 bg-accent/20 text-accent rounded-lg hover:bg-accent/30 text-sm font-medium disabled:opacity-50">
                <Layers className="h-4 w-4" /> {cardsLoading ? 'Generating…' : 'Flashcards'}
              </button>
            </div>
          )}

          {/* Flashcards */}
          {cards && (
            <div className="mt-6">
              <div className="flex items-center justify-between mb-3 gap-3 flex-wrap">
                <h2 className="text-lg font-semibold text-white">Flashcards ({cards.length})</h2>
                {cards.length > 0 && (
                  <div className="flex items-center gap-3">
                    {reviewMsg && <span className="text-white/50 text-xs">{reviewMsg}</span>}
                    <button
                      onClick={addToReview}
                      disabled={addingReview}
                      className="px-3 py-1.5 rounded-lg bg-accent/20 text-accent text-sm font-medium hover:bg-accent/30 transition disabled:opacity-50"
                    >
                      <span className="inline-flex items-center gap-1.5"><Plus className="h-3.5 w-3.5" /> {addingReview ? 'Adding…' : 'Add to review deck'}</span>
                    </button>
                  </div>
                )}
              </div>
              {cards.length === 0 ? (
                <p className="text-white/40 text-sm">No flashcards could be generated.</p>
              ) : (
                <div className="grid sm:grid-cols-2 gap-3">
                  {cards.map((c) => (
                    <button
                      key={c.id}
                      onClick={() => setFlipped((f) => ({ ...f, [c.id]: !f[c.id] }))}
                      className="text-left bg-surface-elevated border border-border rounded-xl p-4 hover:border-accent transition min-h-[90px]"
                    >
                      {flipped[c.id] ? (
                        <p className="text-white/80 text-sm">{c.back}</p>
                      ) : (
                        <p className="text-white font-medium text-sm">{c.front}</p>
                      )}
                      <p className="text-white/30 text-xs mt-2">{flipped[c.id] ? 'Click to hide' : 'Click to reveal'}</p>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
