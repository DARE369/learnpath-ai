import React, { useEffect, useState } from "react";
import Head from "next/head";
import Link from "next/link";
import { useRouter } from "next/router";
import { Search, Network, Route, RotateCcw, GraduationCap, Users, School } from "lucide-react";
import { useAuth } from "../hooks/useAuth";
import { homeForRole } from "../components/layout/nav";
import { ThresholdRing } from "../ui-v2/primitives";
import { color, font } from "../ui-v2/tokens";

const STEPS = [
  { n: 1, Icon: Search, title: "Tell us what you want to learn", desc: "Type any topic, or pick an exam track — WAEC/JAMB, SAT, IELTS, TOEFL." },
  { n: 2, Icon: Network, title: "We score every candidate video", desc: "An 11-criterion rubric checks pedagogy, clarity, credibility and more — anything below the bar is thrown out, regardless of view count." },
  { n: 3, Icon: Route, title: "What passes gets sequenced", desc: "Videos are ordered by what each one assumes you already know, not by upload date or channel." },
  { n: 4, Icon: RotateCcw, title: "You get checked, not just entertained", desc: "A short question after every video, plus a review queue that resurfaces what you're starting to forget." },
];

const FEATURES = [
  { title: "Quality-scored, not just popular", desc: "An 11-point rubric — pedagogy, clarity, credibility, production and more — filters out videos that rank well but teach badly." },
  { title: "Prerequisite-ordered, not just sorted", desc: "A concept graph maps what each video assumes you already know, so the path never skips a step ahead of you." },
  { title: "A tutor that knows where you are", desc: "Ask a question and get an answer scoped to the exact video and concept you're on — no new tab, no re-explaining context." },
  { title: "Spaced repetition, not just a progress bar", desc: "Flashcards and missed questions resurface right before you'd forget them, not once and then gone." },
];

const ROLES = [
  { eyebrow: "Independent learner", title: "Learn a topic or pass an exam", short: "Student", role: "student", desc: "Search a topic or pick WAEC/JAMB, SAT, IELTS or TOEFL. Get a real, watchable path with a mastery score behind it." },
  { eyebrow: "Educator", title: "See who needs you today", short: "Teacher", role: "teacher", desc: "A dashboard that surfaces at-risk students first, assignments you can grade in minutes, and one inbox per class." },
  { eyebrow: "Administrator", title: "One signal for the whole school", short: "School", role: "school_admin", desc: "Institutional health, billing, and every teacher and student roster in one place, with early warning before something goes off track." },
];

function SectionEyebrow({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontFamily: font.mono, fontSize: 11, letterSpacing: "0.07em", textTransform: "uppercase", color: color.textFaint, marginBottom: 10 }}>
      {children}
    </div>
  );
}

export default function LandingPage() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const [narrow, setNarrow] = useState(false);

  useEffect(() => {
    const check = () => setNarrow(window.innerWidth < 720);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  useEffect(() => {
    if (!loading && user) router.replace(homeForRole(user.role));
  }, [loading, user, router]);

  return (
    <>
      <Head>
        <title>LearnPath AI — Learn anything, faster</title>
        <meta name="description" content="AI-powered learning paths from the best educational videos on YouTube." />
      </Head>

      <div style={{ color: color.ink, background: color.paper, minHeight: "100vh", fontFamily: font.body }}>
        {/* Nav */}
        <div style={{ position: "sticky", top: 0, zIndex: 30, background: "rgba(250,248,244,0.92)", backdropFilter: "blur(6px)", borderBottom: `1px solid ${color.border}` }}>
          <div style={{ maxWidth: 1120, margin: "0 auto", padding: narrow ? "14px 20px" : "15px 32px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ fontFamily: font.display, fontWeight: 600, fontSize: 19 }}>LearnPath</div>
            <div style={{ display: "flex", alignItems: "center", gap: narrow ? 12 : 26 }}>
              <Link href="/auth/login" style={{ textDecoration: "none", color: color.ink, fontSize: 13.5, fontWeight: 600 }}>
                Sign in
              </Link>
              <Link href="/auth/signup" style={{ textDecoration: "none", padding: "9px 16px", fontSize: 13.5, fontWeight: 600, borderRadius: 6, background: "#2B3A67", color: "#fff" }}>
                Get early access
              </Link>
            </div>
          </div>
        </div>

        {/* Hero */}
        <div style={{ maxWidth: 1120, margin: "0 auto", padding: narrow ? "36px 20px 48px" : "72px 32px 68px", display: "grid", gridTemplateColumns: narrow ? "1fr" : "1.08fr 0.92fr", gap: 52, alignItems: "center" }}>
          <div>
            <div style={{ display: "inline-flex", alignItems: "center", gap: 7, fontFamily: font.mono, fontSize: 11, fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", color: "#8B4A3E", background: "#FBF0DD", padding: "5px 11px", borderRadius: 100, marginBottom: 18 }}>
              Early access · building in the open
            </div>
            <h1 style={{ fontFamily: font.display, fontWeight: 600, fontSize: narrow ? 34 : 48, lineHeight: 1.1, letterSpacing: "-0.01em", margin: "0 0 20px" }}>
              YouTube has the lesson. We find it, order it, and check you learned it.
            </h1>
            <p style={{ fontSize: 16.5, lineHeight: 1.6, color: color.inkSoft, maxWidth: 480, margin: "0 0 28px" }}>
              Type a topic or pick an exam track. LearnPath searches YouTube, scores every candidate video against an 11-point rubric, throws out anything that doesn&rsquo;t clear the bar, and sequences what&rsquo;s left by what it assumes you already know — not by upload date.
            </p>
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 16 }}>
              <Link href="/auth/signup" style={{ textDecoration: "none", padding: "12px 22px", fontSize: 14.5, fontWeight: 600, borderRadius: 6, background: "#2B3A67", color: "#fff" }}>
                Get early access
              </Link>
              <Link href="/auth/login" style={{ textDecoration: "none", padding: "12px 22px", fontSize: 14.5, fontWeight: 600, borderRadius: 6, border: "1px solid #CFCBC0", color: color.ink }}>
                Sign in
              </Link>
            </div>
            <div style={{ fontSize: 12.5, color: color.textFaint }}>Free while in early access · no card required</div>
          </div>

          <div style={{ background: color.chromeBg, borderRadius: 14, padding: "32px 30px", color: color.chromeText }}>
            <div style={{ display: "flex", alignItems: "center", gap: 22, marginBottom: 22 }}>
              <div style={{ flexShrink: 0 }}>
                <ThresholdRing pct={74} threshold={70} size={108} dark />
              </div>
              <div>
                <div style={{ fontFamily: font.mono, fontSize: 10.5, letterSpacing: "0.07em", textTransform: "uppercase", color: "#C8792A", marginBottom: 6 }}>
                  How mastery is scored
                </div>
                <div style={{ fontSize: 14.5, lineHeight: 1.55, color: "#D9D5C9" }}>
                  Every score in the product is measured against a pass line, not just a magnitude — 70% and above is ink, below is amber. One glance answers &ldquo;on track or not&rdquo; before the number even registers.
                </div>
              </div>
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              {["Search YouTube", "Score against the rubric", "Sequence by prerequisite"].map((desc, i) => (
                <div key={desc} style={{ flex: 1, background: "#1D212C", borderRadius: 8, padding: "11px 12px" }}>
                  <div style={{ fontFamily: font.mono, fontSize: 11, fontWeight: 600, color: "#C8792A", marginBottom: 3 }}>{String(i + 1).padStart(2, "0")}</div>
                  <div style={{ fontSize: 11.5, color: "#B8B5AB", lineHeight: 1.4 }}>{desc}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* How it works */}
        <div style={{ maxWidth: 1120, margin: "0 auto", padding: narrow ? "52px 20px" : "76px 32px", borderTop: `1px solid ${color.border}` }}>
          <SectionEyebrow>How it works</SectionEyebrow>
          <h2 style={{ fontFamily: font.display, fontWeight: 600, fontSize: narrow ? 25 : 32, margin: "0 0 40px", maxWidth: 600 }}>
            From a topic to a sequenced path, in one search.
          </h2>
          <div style={{ display: "grid", gridTemplateColumns: narrow ? "1fr" : "repeat(4, 1fr)", gap: 1, background: color.border, border: `1px solid ${color.border}`, borderRadius: 10, overflow: "hidden" }}>
            {STEPS.map((s) => (
              <div key={s.n} style={{ background: "#fff", padding: 24 }}>
                <div style={{ width: 36, height: 36, borderRadius: 8, background: color.surfaceElevated, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 16 }}>
                  <s.Icon size={17} strokeWidth={1.6} color="#2B3A67" />
                </div>
                <div style={{ fontFamily: font.mono, fontSize: 10.5, color: color.textFaint, marginBottom: 6 }}>STEP {s.n}</div>
                <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 8 }}>{s.title}</div>
                <div style={{ fontSize: 13.5, color: color.inkSoft, lineHeight: 1.55 }}>{s.desc}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Features */}
        <div style={{ background: "#F4F1EA", borderTop: `1px solid ${color.border}`, borderBottom: `1px solid ${color.border}` }}>
          <div style={{ maxWidth: 1120, margin: "0 auto", padding: narrow ? "52px 20px" : "76px 32px" }}>
            <SectionEyebrow>What makes it different from a playlist</SectionEyebrow>
            <h2 style={{ fontFamily: font.display, fontWeight: 600, fontSize: narrow ? 25 : 32, margin: "0 0 40px", maxWidth: 620 }}>
              Not another video library. A system that decides what you watch, in what order, and whether it worked.
            </h2>
            <div style={{ display: "grid", gridTemplateColumns: narrow ? "1fr" : "repeat(2, 1fr)", gap: 1, background: color.border, border: `1px solid ${color.border}`, borderRadius: 10, overflow: "hidden" }}>
              {FEATURES.map((f) => (
                <div key={f.title} style={{ background: "#fff", padding: 26 }}>
                  <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 8 }}>{f.title}</div>
                  <div style={{ fontSize: 13.5, color: color.inkSoft, lineHeight: 1.55 }}>{f.desc}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Roles */}
        <div style={{ maxWidth: 1120, margin: "0 auto", padding: narrow ? "52px 20px" : "76px 32px" }}>
          <SectionEyebrow>Built for everyone in the room</SectionEyebrow>
          <h2 style={{ fontFamily: font.display, fontWeight: 600, fontSize: narrow ? 25 : 32, margin: "0 0 40px" }}>
            One account type per job, not one dashboard trying to do everything.
          </h2>
          <div style={{ display: "grid", gridTemplateColumns: narrow ? "1fr" : "repeat(3, 1fr)", gap: 1, background: color.border, border: `1px solid ${color.border}`, borderRadius: 10, overflow: "hidden" }}>
            {ROLES.map((r) => (
              <Link key={r.role} href={`/auth/signup?role=${r.role}`} style={{ textDecoration: "none", color: "inherit", background: "#fff", padding: 28, display: "block" }}>
                <div style={{ fontFamily: font.mono, fontSize: 10.5, letterSpacing: "0.05em", textTransform: "uppercase", color: color.textFaint, marginBottom: 14 }}>{r.eyebrow}</div>
                <div style={{ fontFamily: font.display, fontWeight: 600, fontSize: 18, marginBottom: 10 }}>{r.title}</div>
                <div style={{ fontSize: 13.5, color: color.inkSoft, lineHeight: 1.55, marginBottom: 20 }}>{r.desc}</div>
                <div style={{ fontSize: 13, fontWeight: 600, color: "#2B3A67" }}>Get started as a {r.short} →</div>
              </Link>
            ))}
          </div>
        </div>

        {/* Final CTA */}
        <div style={{ background: color.chromeBg }}>
          <div style={{ maxWidth: 1120, margin: "0 auto", padding: narrow ? "52px 20px" : "72px 32px", textAlign: "center" }}>
            <h2 style={{ fontFamily: font.display, fontWeight: 600, fontSize: narrow ? 25 : 32, color: "#fff", margin: "0 0 16px" }}>
              We&rsquo;re early. That&rsquo;s why it&rsquo;s free.
            </h2>
            <p style={{ fontSize: 15, color: "#B8B5AB", margin: "0 auto 28px", maxWidth: 480 }}>
              No published user counts or star ratings yet — we&rsquo;d rather earn those than print them. Try building one real path and judge the videos it picks for yourself.
            </p>
            <Link href="/auth/signup" style={{ textDecoration: "none", padding: "13px 26px", fontSize: 14.5, fontWeight: 600, borderRadius: 6, background: "#fff", color: color.ink, display: "inline-block" }}>
              Get early access
            </Link>
          </div>
        </div>

        {/* Footer */}
        <div style={{ maxWidth: 1120, margin: "0 auto", padding: `28px ${narrow ? 20 : 32}px`, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
          <div style={{ fontFamily: font.display, fontWeight: 600, fontSize: 15 }}>LearnPath</div>
          <div style={{ display: "flex", gap: 20, flexWrap: "wrap" }}>
            <Link href="/legal/privacy" style={{ textDecoration: "none", color: color.textFaint, fontSize: 12.5 }}>Privacy Policy</Link>
            <Link href="/legal/terms" style={{ textDecoration: "none", color: color.textFaint, fontSize: 12.5 }}>Terms of Service</Link>
            <Link href="/auth/login" style={{ textDecoration: "none", color: color.textFaint, fontSize: 12.5 }}>Sign in</Link>
          </div>
        </div>
      </div>
    </>
  );
}
