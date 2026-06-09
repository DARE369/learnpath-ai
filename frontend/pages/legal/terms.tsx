import React from "react";
import Head from "next/head";
import Link from "next/link";

// NOTE: Good-faith DRAFT scaffold, not legal advice. Review with counsel before launch.
export default function TermsPage() {
  return (
    <>
      <Head><title>Terms of Service — LearnPath AI</title></Head>
      <div className="min-h-screen bg-background text-white">
        <div className="mx-auto max-w-3xl px-6 py-12">
          <Link href="/" className="text-sm text-accent-light hover:text-white">← Back</Link>
          <div className="mt-4 mb-6 rounded-xl border border-warning/30 bg-warning-muted px-4 py-3 text-sm text-warning">
            Draft template — pending legal review. Not yet binding terms.
          </div>
          <h1 className="text-3xl font-bold tracking-tight">Terms of Service</h1>
          <p className="mt-1 text-sm text-white/40">Last updated: (set on publish)</p>

          <div className="mt-8 space-y-6 text-sm leading-relaxed text-white/70">
            <section>
              <h2 className="text-lg font-semibold text-white">1. The service</h2>
              <p>LearnPath AI curates third-party educational videos and generates learning aids (paths,
              summaries, quizzes, notes). Generated content is provided &ldquo;as is&rdquo; and may contain errors —
              verify anything you rely on for exams or important decisions.</p>
            </section>
            <section>
              <h2 className="text-lg font-semibold text-white">2. Accounts</h2>
              <p>You are responsible for your account and for keeping your credentials secure. You must provide
              accurate information and be permitted to use the service in your jurisdiction.</p>
            </section>
            <section>
              <h2 className="text-lg font-semibold text-white">3. Acceptable use</h2>
              <p>Don&apos;t abuse the service: no scraping at scale, no attempting to overload generation, no
              uploading unlawful content, no reverse-engineering or circumventing limits.</p>
            </section>
            <section>
              <h2 className="text-lg font-semibold text-white">4. Content sources, copyright &amp; takedowns</h2>
              <p>Videos are sourced from YouTube and remain the property of their creators; we link/embed them
              subject to YouTube&apos;s Terms. We do not host the videos. If you are a rights holder and believe
              content is used improperly, contact <span className="text-white">legal@learnpath.ai</span>{" "}
              (placeholder) and we will review and, where appropriate, remove or de-list it.</p>
            </section>
            <section>
              <h2 className="text-lg font-semibold text-white">5. Payments</h2>
              <p>Paid plans are billed via our payment processor. Upgrades are pro-rated; downgrades take effect
              at the next renewal. (Refund terms to be finalised with counsel.)</p>
            </section>
            <section>
              <h2 className="text-lg font-semibold text-white">6. Disclaimers &amp; liability</h2>
              <p>The service is provided without warranties to the extent permitted by law. We are not liable
              for indirect or consequential losses. (Final limitation-of-liability language pending counsel.)</p>
            </section>
            <section>
              <h2 className="text-lg font-semibold text-white">7. Changes</h2>
              <p>We may update these terms; material changes will be notified in-app or by email.</p>
            </section>
            <section>
              <h2 className="text-lg font-semibold text-white">8. Contact</h2>
              <p><span className="text-white">support@learnpath.ai</span> (placeholder).</p>
            </section>
          </div>

          <p className="mt-10 text-xs text-white/30">
            See also our <Link href="/legal/privacy" className="text-accent-light hover:text-white">Privacy Policy</Link>.
          </p>
        </div>
      </div>
    </>
  );
}
