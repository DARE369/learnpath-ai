'use client';

import React, { useState } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';

function token(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('access_token') ?? sessionStorage.getItem('access_token');
}

export default function UploadPage() {
  const router = useRouter();
  const [mode, setMode] = useState<'file' | 'url'>('file');
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLoading(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch('/api/content/upload', {
        method: 'POST',
        headers: token() ? { Authorization: `Bearer ${token()}` } : {},
        body: fd,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Upload failed');
      router.push(`/content/${data.content_id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
      setLoading(false);
    }
  };

  const handleUrl = async () => {
    if (!url.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/content/upload-url', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token() ? { Authorization: `Bearer ${token()}` } : {}),
        },
        body: JSON.stringify({ url: url.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Could not ingest URL');
      router.push(`/content/${data.content_id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not ingest URL');
      setLoading(false);
    }
  };

  return (
    <>
      <Head><title>Upload Notes — LearnPath AI</title></Head>
      <div className="min-h-screen bg-background">
        <div className="max-w-2xl mx-auto px-6 py-12">
          <h1 className="text-2xl font-bold text-white">Upload Your Notes</h1>
          <p className="text-white/50 mt-1">
            Turn any document into an AI explanation, flashcards, matched videos, and a practice quiz.
          </p>

          <div className="flex gap-2 mt-6">
            <button
              onClick={() => setMode('file')}
              className={`px-4 py-2 rounded-lg text-sm border transition ${mode === 'file' ? 'bg-accent text-white border-accent' : 'bg-surface border-border text-white/60 hover:text-white'}`}
            >📄 Upload file</button>
            <button
              onClick={() => setMode('url')}
              className={`px-4 py-2 rounded-lg text-sm border transition ${mode === 'url' ? 'bg-accent text-white border-accent' : 'bg-surface border-border text-white/60 hover:text-white'}`}
            >🔗 Paste URL</button>
          </div>

          {error && (
            <div className="mt-4 rounded-lg border border-red-500/40 bg-red-500/10 p-3 text-red-300 text-sm">{error}</div>
          )}

          <div className="mt-6">
            {loading ? (
              <div className="flex flex-col items-center justify-center py-16 bg-surface-elevated border border-border rounded-2xl">
                <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin mb-3" />
                <p className="text-white/50 text-sm">Extracting your content…</p>
              </div>
            ) : mode === 'file' ? (
              <label className="block cursor-pointer">
                <div className="border-2 border-dashed border-border rounded-2xl p-12 text-center bg-surface-elevated hover:border-accent transition">
                  <div className="text-4xl mb-3">📄</div>
                  <p className="text-white font-medium">Click to choose a file</p>
                  <p className="text-white/40 text-sm mt-1">PDF, Word, Text, or Image · up to 50MB</p>
                  <p className="text-white/30 text-xs mt-2">
                    Scanned PDFs &amp; photos of notes are read with OCR.
                  </p>
                </div>
                <input
                  type="file"
                  className="hidden"
                  accept=".pdf,.doc,.docx,.txt,.md,.jpg,.jpeg,.png,.webp"
                  onChange={handleFile}
                />
              </label>
            ) : (
              <div className="bg-surface-elevated border border-border rounded-2xl p-6">
                <input
                  type="url"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleUrl()}
                  placeholder="https://example.com/article"
                  className="w-full px-4 py-3 rounded-xl bg-surface border border-border text-white placeholder-white/30 focus:border-accent outline-none"
                />
                <button
                  onClick={handleUrl}
                  disabled={!url.trim()}
                  className="mt-3 w-full px-4 py-3 bg-accent text-white rounded-xl font-medium hover:opacity-90 transition disabled:opacity-40"
                >
                  Ingest URL
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
