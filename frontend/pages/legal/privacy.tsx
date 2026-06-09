import React from "react";
import Head from "next/head";
import Link from "next/link";

// NOTE: This is a good-faith DRAFT scaffold, not legal advice. Have counsel review
// and tailor it (NDPR / GDPR / COPPA as applicable) before relying on it.
export default function PrivacyPolicyPage() {
  return (
    <>
      <Head><title>Privacy Policy — LearnPath AI</title></Head>
      <div className="min-h-screen bg-background text-white">
        <div className="mx-auto max-w-3xl px-6 py-12">
          <Link href="/" className="text-sm text-accent-light hover:text-white">← Back</Link>
          <div className="mt-4 mb-6 rounded-xl border border-warning/30 bg-warning-muted px-4 py-3 text-sm text-warning">
            Draft template — pending legal review. Not yet a binding policy.
          </div>
          <h1 className="text-3xl font-bold tracking-tight">Privacy Policy</h1>
          <p className="mt-1 text-sm text-white/40">Last updated: (set on publish)</p>

          <div className="prose-invert mt-8 space-y-6 text-sm leading-relaxed text-white/70">
            <section>
              <h2 className="text-lg font-semibold text-white">1. Who we are</h2>
              <p>LearnPath AI (&ldquo;we&rdquo;) provides an AI-powered learning platform. This policy explains
              what personal data we collect, why, and your rights over it.</p>
            </section>
            <section>
              <h2 className="text-lg font-semibold text-white">2. Data we collect</h2>
              <ul className="list-disc pl-5 space-y-1">
                <li><strong>Account:</strong> email, name, and (for password accounts) a hashed password; or your Google profile if you sign in with Google.</li>
                <li><strong>Learning activity:</strong> topics searched, paths built, videos watched, quiz answers, mastery, streaks, notes, and uploads you create.</li>
                <li><strong>Billing:</strong> plan and transaction records (card details are handled by our payment processor, not stored by us).</li>
                <li><strong>Technical:</strong> request logs, device/browser info, and error diagnostics.</li>
              </ul>
            </section>
            <section>
              <h2 className="text-lg font-semibold text-white">3. How we use it</h2>
              <p>To provide and personalise learning, build and adapt paths, process payments, prevent abuse,
              and improve the service. We process AI generation through third-party model providers; uploaded
              content is sent to them to produce summaries, notes, and quizzes.</p>
            </section>
            <section>
              <h2 className="text-lg font-semibold text-white">4. Sharing</h2>
              <p>We share data with processors that run the service (hosting, database, AI model provider,
              payment processor, error monitoring). We do not sell your personal data.</p>
            </section>
            <section>
              <h2 className="text-lg font-semibold text-white">5. Your rights</h2>
              <p>You can <strong>export</strong> or <strong>delete</strong> your data from
              {" "}<Link href="/settings" className="text-accent-light hover:text-white">Settings → Privacy &amp; data</Link>.
              Depending on your jurisdiction (e.g. NDPR, GDPR) you may also have rights to access, rectify,
              restrict, or object to processing. Contact us to exercise these.</p>
            </section>
            <section>
              <h2 className="text-lg font-semibold text-white">6. Retention</h2>
              <p>We keep account and learning data while your account is active. On deletion we anonymise the
              personal identifiers tied to your account.</p>
            </section>
            <section>
              <h2 className="text-lg font-semibold text-white">7. Children</h2>
              <p>If the service is used by minors (e.g. exam-prep students), additional protections and
              parental-consent requirements may apply. (To be finalised with counsel.)</p>
            </section>
            <section>
              <h2 className="text-lg font-semibold text-white">8. Contact</h2>
              <p>Questions or requests: <span className="text-white">privacy@learnpath.ai</span> (placeholder).</p>
            </section>
          </div>

          <p className="mt-10 text-xs text-white/30">
            See also our <Link href="/legal/terms" className="text-accent-light hover:text-white">Terms of Service</Link>.
          </p>
        </div>
      </div>
    </>
  );
}
