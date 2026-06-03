'use client';

import React, { useState, useEffect } from 'react';
import Head from 'next/head';
import Link from 'next/link';

function authHeaders(): Record<string, string> {
  const token =
    typeof window !== 'undefined'
      ? localStorage.getItem('access_token') ?? sessionStorage.getItem('access_token')
      : null;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

interface NoteSummary {
  note_id: string;
  youtube_id: string;
  title: string;
  word_count: number;
  read_time_minutes: number;
  available_styles: string[];
  created_at: string | null;
}

export default function NotesLibrary() {
  const [notes, setNotes] = useState<NoteSummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/notes/', { headers: authHeaders() });
        const data = await res.json();
        setNotes(data.notes || []);
      } catch {
        setNotes([]);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <>
      <Head><title>My Study Materials — LearnPath AI</title></Head>
      <div className="min-h-screen bg-background">
        <div className="max-w-4xl mx-auto px-6 py-10">
          <h1 className="text-2xl font-bold text-white">My Study Materials</h1>
          <p className="text-white/50 mt-1 text-sm">
            AI-generated notes from videos you&apos;ve studied. Open a course video and tap
            &ldquo;Generate study notes&rdquo; to create more.
          </p>

          {loading ? (
            <div className="flex justify-center py-20">
              <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin" />
            </div>
          ) : notes.length === 0 ? (
            <div className="bg-surface-elevated border border-border rounded-2xl p-10 text-center mt-8">
              <div className="text-4xl mb-3">📚</div>
              <p className="text-white/60">No study notes yet.</p>
              <Link href="/explore" className="inline-block mt-4 px-4 py-2 bg-accent text-white rounded-lg hover:opacity-90 transition">
                Find something to learn
              </Link>
            </div>
          ) : (
            <div className="grid gap-3 mt-6">
              {notes.map((n) => (
                <Link
                  key={n.note_id}
                  href={`/notes/${n.youtube_id}`}
                  className="block bg-surface-elevated border border-border rounded-xl p-5 hover:border-accent transition"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <h2 className="text-white font-medium truncate">{n.title}</h2>
                      <p className="text-white/40 text-xs mt-1">
                        {n.read_time_minutes} min read · {n.word_count} words ·{' '}
                        {n.available_styles.length} style{n.available_styles.length === 1 ? '' : 's'} generated
                      </p>
                    </div>
                    <span className="text-white/30 text-sm flex-shrink-0">View →</span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
