"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import Link from "next/link";
import {
  motion, useScroll, useTransform, useSpring, AnimatePresence, useReducedMotion,
} from "framer-motion";
import { MarketingNav } from "@/components/marketing-nav";
import {
  Search, Target, PenLine, FileText, Bot, Mic, BookOpenText, MessagesSquare,
  ArrowRight, CheckCircle2, ShieldCheck, Lock, Building2, Eye, Sparkles,
} from "lucide-react";

/* ------------------------------------------------------------------ */
/* Playful palette tokens (page-local)                                 */
/* ------------------------------------------------------------------ */
const RAINBOW = ["#FF5B5B", "#FF9F43", "#FFD93D", "#3DDC97", "#4DA6FF", "#8B5CFF", "#FF5B9A"];
const PAPER = "#FFF8EE";
const INK = "#1A1A1A";
const TAPE = "#FDE68A";
const DUCT = "#9CA3AF";

/* ------------------------------------------------------------------ */
/* Illustrative preview data (clearly labeled, never real product data)  */
/* ------------------------------------------------------------------ */
const previewMatches = [
  { title: "Graduate Software Engineer", company: "Fintech scale-up · Bengaluru", score: 87, tag: "Strong match" },
  { title: "Associate Software Engineer", company: "Global IT services · Hyderabad", score: 74, tag: "Good match" },
  { title: "Backend Developer Intern", company: "SaaS platform · Remote (India)", score: 66, tag: "Worth a look" },
];
const previewTracker = [
  { role: "Graduate Software Engineer", state: "Awaiting your approval" },
  { role: "Data Analyst (Entry)", state: "Resume tailored" },
  { role: "Support Engineer", state: "Cover letter drafted" },
];

const trustPoints = [
  { icon: ShieldCheck, title: "Approval-first applications", body: "Nothing is submitted until you review and approve it." },
  { icon: FileText, title: "Honest CV-based matching", body: "Scores come from your real CV. Nothing is invented or inflated." },
  { icon: Eye, title: "No fabricated experience", body: "JobPilot never adds qualifications, dates or skills you don't have." },
  { icon: Building2, title: "Relevant opportunities across India", body: "Trusted employers and boards — engineering to operations." },
  { icon: Lock, title: "User-controlled activity", body: "You decide what the agent does, and can stop it at any time." },
];
const steps = [
  { title: "Upload your CV", body: "We extract your real skills, experience and education — never rewriting your history." },
  { title: "Discover relevant opportunities", body: "Live vacancies across India are scanned and scored against your actual profile." },
  { title: "Prepare tailored applications", body: "Resume, cover letter and recruiter notes drafted for each specific role." },
  { title: "Review and approve applications", body: "Nothing sends itself. You approve, edit, or skip every single submission." },
];
const capabilities = [
  { icon: Search, title: "AI job discovery", body: "Broad, continuous searches across engineering, IT, business, support, operations and non-core roles — scored as they land.", featured: true },
  { icon: Target, title: "Smart career matching", body: "Explainable scores built from skills, experience, education, location and preferences." },
  { icon: PenLine, title: "Resume customization", body: "ATS-friendly tailored resumes — grounded in your real CV, never embellished." },
  { icon: FileText, title: "Cover letter generation", body: "Role-specific cover letters drafted from your profile for every application." },
  { icon: Bot, title: "Application management", body: "Track every application, its documents and its next action in one place." },
  { icon: Mic, title: "Interview preparation", body: "Company research, role-specific questions and answers drawn from your genuine background." },
  { icon: BookOpenText, title: "Company research", body: "Compact company briefs so you walk into every interview informed." },
  { icon: MessagesSquare, title: "Follow-up assistance", body: "Polite, personal follow-up drafts after applications and interviews." },
];

const marqueeWords = [
  "Approval-first", "CV-true matching", "Made for India", "No fabricated experience",
  "You stay in control", "Tailored resumes", "Cover letters", "Interview prep",
  "Company research", "Follow-up drafts", "Job discovery", "Application tracking",
];

/* ------------------------------------------------------------------ */
/* Reduced-motion aware preloader                                      */
/* ------------------------------------------------------------------ */
function Preloader({ onDone }: { onDone: () => void }) {
  const reduced = useReducedMotion();
  useEffect(() => {
    const t = setTimeout(onDone, reduced ? 150 : 1200);
    return () => clearTimeout(t);
  }, [onDone, reduced]);

  return (
    <AnimatePresence>
      <motion.div
        key="pre"
        className="fixed inset-0 z-[100] flex flex-col items-center justify-center"
        style={{ background: PAPER }}
        initial={{ opacity: 1 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0, transition: { duration: 0.45 } }}
      >
        {/* rainbow stripes */}
        <div className="absolute inset-0 flex">
          {RAINBOW.map((c, i) => (
            <motion.div
              key={c}
              className="h-full flex-1"
              style={{ background: c }}
              initial={reduced ? false : { scaleY: 0 }}
              animate={{ scaleY: 1 }}
              transition={{ duration: 0.5, delay: i * 0.06, ease: [0.16, 1, 0.3, 1] }}
              aria-hidden="true"
            />
          ))}
        </div>
        <motion.div
          className="relative z-10 flex gap-1 font-display text-5xl font-black tracking-tight sm:text-7xl"
          style={{ color: INK, mixBlendMode: "difference" }}
          initial={reduced ? false : "hidden"}
          animate="show"
          variants={{ hidden: {}, show: { transition: { staggerChildren: 0.07, delayChildren: 0.35 } } }}
          aria-label="JobPilot"
        >
          {"JobPilot".split("").map((ch, i) => (
            <motion.span
              key={i}
              variants={{
                hidden: { y: 60, opacity: 0, rotate: -12 },
                show: { y: 0, opacity: 1, rotate: 0, transition: { type: "spring", stiffness: 260, damping: 14 } },
              }}
              className="inline-block"
            >
              {ch}
            </motion.span>
          ))}
        </motion.div>
        <motion.p
          className="relative z-10 mt-4 text-sm font-medium uppercase tracking-[0.3em]"
          style={{ color: INK, mixBlendMode: "difference" }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.9, duration: 0.3 }}
        >
          loading the good stuff
        </motion.p>
      </motion.div>
    </AnimatePresence>
  );
}

/* ------------------------------------------------------------------ */
/* 3D-ish tape roll that rotates with scroll                           */
/* ------------------------------------------------------------------ */
function TapeRoll() {
  const reduced = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "end start"] });
  const rotate = useTransform(scrollYProgress, [0, 1], [0, 720]);
  const springRotate = useSpring(rotate, { stiffness: 60, damping: 20 });
  return (
    <div ref={ref} className="relative mx-auto h-44 w-44 sm:h-56 sm:w-56" style={{ perspective: 900 }}>
      <motion.div
        className="absolute inset-0 rounded-full"
        style={{
          background: "conic-gradient(from 0deg, #FDE68A 0deg 60deg, #F5D060 60deg 120deg, #FDE68A 120deg 180deg, #F5D060 180deg 240deg, #FDE68A 240deg 300deg, #F5D060 300deg 360deg)",
          rotateY: reduced ? 0 : springRotate,
          transformStyle: "preserve-3d",
          boxShadow: "0 30px 60px -20px rgba(0,0,0,0.35), inset 0 0 0 6px rgba(0,0,0,0.08)",
        }}
      >
        {/* tape strip trailing off */}
        <div
          className="absolute left-1/2 top-1/2 h-3 w-[140%] -translate-y-1/2 origin-left"
          style={{ background: "linear-gradient(90deg, #FDE68A, #F5D060)", transform: "translateX(40%) rotate(6deg)", boxShadow: "0 2px 4px rgba(0,0,0,0.15)" }}
          aria-hidden="true"
        />
        <div className="absolute inset-0 grid place-items-center">
          <span className="font-display text-xs font-bold uppercase tracking-widest text-ink/70" style={{ color: INK }}>tape</span>
        </div>
      </motion.div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Wavy marquee ribbon                                                 */
/* ------------------------------------------------------------------ */
function MarqueeRibbon() {
  const reduced = useReducedMotion();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const items = [...marqueeWords, ...marqueeWords];
  return (
    <div className="relative overflow-hidden py-6" style={{ background: INK, color: PAPER }}>
      <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-24 bg-gradient-to-r" style={{ backgroundImage: `linear-gradient(to right, ${INK}, transparent)` }} aria-hidden="true" />
      <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-24 bg-gradient-to-l" style={{ backgroundImage: `linear-gradient(to left, ${INK}, transparent)` }} aria-hidden="true" />
      <div className={`flex w-max gap-10 whitespace-nowrap ${mounted && !reduced ? "animate-marquee" : ""}`}>
        {items.map((w, i) => (
          <span key={i} className="flex items-center gap-10 font-display text-2xl font-bold uppercase tracking-tight sm:text-3xl">
            <span>{w}</span>
            <span aria-hidden="true" style={{ color: TAPE }}>✦</span>
          </span>
        ))}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Mask-paint-peel: a colored layer peels away on scroll                */
/* ------------------------------------------------------------------ */
function PeelSection() {
  const ref = useRef<HTMLElement>(null);
  const reduced = useReducedMotion();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start 0.85", "end 0.35"] });
  const clip = useTransform(scrollYProgress, [0, 1], ["inset(0 0% 0 0)", "inset(0 100% 0 0)"]);
  const opacity = useTransform(scrollYProgress, [0, 0.15], [1, 1]);
  return (
    <section ref={ref} id="how-it-works" className="relative scroll-mt-20 overflow-hidden" style={{ background: PAPER }}>
      {/* revealed content underneath */}
      <div className="relative mx-auto max-w-6xl px-5 py-20 sm:px-6 md:py-28">
        <p className="text-sm font-bold uppercase tracking-widest" style={{ color: "#FF5B5B" }}>How it works</p>
        <h2 className="mt-3 font-display text-3xl font-black leading-tight tracking-tight sm:text-5xl" style={{ color: INK }}>
          From CV to interview,<br />in four calm steps.
        </h2>
        <p className="mt-4 max-w-xl text-base" style={{ color: "#444" }}>
          JobPilot does the legwork. You stay the decision maker on every submission.
        </p>
        <ol className="relative mt-12 grid gap-6 md:grid-cols-4 md:gap-5">
          {steps.map((step, index) => (
            <li key={step.title} className="relative">
              <span
                className="grid h-11 w-11 place-items-center rounded-full font-display text-lg font-black text-white"
                style={{ background: RAINBOW[index % RAINBOW.length], boxShadow: "4px 4px 0 0 " + INK }}
              >
                {index + 1}
              </span>
              <h3 className="mt-4 font-display text-lg font-bold" style={{ color: INK }}>{step.title}</h3>
              <p className="mt-1.5 text-sm leading-relaxed" style={{ color: "#444" }}>{step.body}</p>
            </li>
          ))}
        </ol>
      </div>
      {/* paint layer that peels away */}
      {mounted && !reduced ? (
        <motion.div
          className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center"
          style={{
            background: "linear-gradient(135deg, #FF5B5B 0%, #FF9F43 25%, #FFD93D 50%, #3DDC97 75%, #4DA6FF 100%)",
            clipPath: clip,
            opacity,
          }}
          aria-hidden="true"
        >
          <div className="text-center px-6">
            <p className="font-display text-3xl font-black uppercase tracking-tight text-white sm:text-5xl">Peel to reveal</p>
            <p className="mt-2 text-sm font-medium text-white/80">Scroll to see how it works</p>
          </div>
        </motion.div>
      ) : null}
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* 3D-tilt product cards                                               */
/* ------------------------------------------------------------------ */
function TiltCard({ item, index }: { item: (typeof capabilities)[number]; index: number }) {
  const reduced = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const [tilt, setTilt] = useState({ rx: 0, ry: 0 });
  const onMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (reduced) return;
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width - 0.5;
    const y = (e.clientY - r.top) / r.height - 0.5;
    setTilt({ rx: -y * 12, ry: x * 12 });
  }, [reduced]);
  const onLeave = useCallback(() => setTilt({ rx: 0, ry: 0 }), []);
  const Icon = item.icon;
  const color = RAINBOW[index % RAINBOW.length];
  return (
    <motion.div
      ref={ref}
      onMouseMove={onMove}
      onMouseLeave={onLeave}
      style={{ perspective: 900 }}
      className={`group ${item.featured ? "sm:col-span-2 sm:row-span-2" : ""}`}
    >
      <div
        className="relative h-full overflow-hidden rounded-2xl border-2 p-6 transition-transform duration-200 ease-out"
        style={{
          background: PAPER,
          borderColor: INK,
          boxShadow: `6px 6px 0 0 ${color}`,
          transform: reduced ? undefined : `rotateX(${tilt.rx}deg) rotateY(${tilt.ry}deg)`,
          transformStyle: "preserve-3d",
        }}
      >
        {/* tape strip */}
        <div
          className="absolute -top-2 left-1/2 h-5 w-20 -translate-x-1/2 rotate-[-3deg] rounded-sm opacity-80"
          style={{ background: TAPE, boxShadow: "0 1px 2px rgba(0,0,0,0.15)" }}
          aria-hidden="true"
        />
        <span
          className="grid h-11 w-11 place-items-center rounded-xl text-white"
          style={{ background: color, boxShadow: `3px 3px 0 0 ${INK}` }}
        >
          <Icon className="h-5 w-5" aria-hidden="true" />
        </span>
        <h3 className="mt-4 font-display text-lg font-bold" style={{ color: INK }}>{item.title}</h3>
        <p className="mt-1.5 text-sm leading-relaxed" style={{ color: "#444" }}>{item.body}</p>
        {item.featured ? (
          <Link href="/register" className="mt-5 inline-flex w-fit items-center gap-1.5 rounded-lg px-1 py-2 text-sm font-bold transition-opacity hover:opacity-70" style={{ color: INK }}>
            Try job discovery <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
          </Link>
        ) : null}
      </div>
    </motion.div>
  );
}

/* ------------------------------------------------------------------ */
/* Tape-cornered illustrative preview frame                            */
/* ------------------------------------------------------------------ */
function TapeCorner({ rot, pos }: { rot: string; pos: string }) {
  return (
    <div
      className={`pointer-events-none absolute h-6 w-16 rounded-sm opacity-85 ${pos}`}
      style={{ background: TAPE, transform: `rotate(${rot})`, boxShadow: "0 1px 2px rgba(0,0,0,0.18)" }}
      aria-hidden="true"
    />
  );
}

function PreviewFrame({ label, title, children }: { label: string; title: string; children: React.ReactNode }) {
  return (
    <div className="relative min-w-0 overflow-hidden rounded-2xl border-2 bg-white p-4" style={{ borderColor: INK, boxShadow: `5px 5px 0 0 ${INK}` }}>
      <TapeCorner rot="-12deg" pos="left-[-6px] top-[-8px]" />
      <TapeCorner rot="14deg" pos="right-[-6px] top-[-8px]" />
      <div className="mb-3 flex items-center justify-between gap-2">
        <span className="truncate text-sm font-bold" style={{ color: INK }}>{title}</span>
        <span className="shrink-0 rounded-full border-2 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide" style={{ borderColor: INK, color: INK, background: TAPE }}>
          {label}
        </span>
      </div>
      <div className="space-y-2.5">{children}</div>
    </div>
  );
}

function MatchRow({ item }: { item: (typeof previewMatches)[number] }) {
  const tone = item.score >= 80 ? "text-emerald-600" : item.score >= 70 ? "" : "text-gray-500";
  return (
    <div className="rounded-xl border-2 p-3" style={{ borderColor: INK, background: PAPER }}>
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="truncate text-sm font-bold" style={{ color: INK }}>{item.title}</div>
          <div className="truncate text-xs" style={{ color: "#555" }}>{item.company}</div>
        </div>
        <div className={`shrink-0 text-sm font-black tabular-nums ${tone}`} style={{ color: tone ? undefined : INK }}>{item.score}%</div>
      </div>
      <div className="mt-2 flex items-center gap-2">
        <div className="h-1.5 min-w-0 flex-1 overflow-hidden rounded-full" style={{ background: "#E5E5E5" }}>
          <div className="h-full rounded-full" style={{ width: `${item.score}%`, background: RAINBOW[item.score % RAINBOW.length] }} />
        </div>
        <span className="shrink-0 text-[10px] font-bold" style={{ color: "#555" }}>{item.tag}</span>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */
export default function LandingPage() {
  const [loaded, setLoaded] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [show, setShow] = useState(false);
  const reduced = useReducedMotion();
  const heroRef = useRef<HTMLElement>(null);
  const { scrollYProgress: heroProgress } = useScroll({ target: heroRef, offset: ["start start", "end start"] });
  const heroY = useTransform(heroProgress, [0, 1], [0, -80]);
  const heroRot = useTransform(heroProgress, [0, 1], [0, -6]);

  useEffect(() => { setMounted(true); }, []);
  useEffect(() => { if (mounted) setShow(true); }, [mounted]);

  return (
    <main id="main" className="min-h-dvh overflow-x-clip" style={{ background: PAPER, color: INK }}>
      {mounted && !loaded && !reduced ? <Preloader onDone={() => setLoaded(true)} /> : null}
      {mounted && reduced && !loaded ? <SetLoaded onDone={() => setLoaded(true)} /> : null}

      <MarketingNav links={[
        { label: "Product", href: "#product" },
        { label: "How it works", href: "#how-it-works" },
        { label: "Features", href: "#capabilities" },
        { label: "Privacy", href: "#privacy" },
      ]} />

      {/* ---------- HERO ---------- */}
      <section ref={heroRef} className="relative mx-auto max-w-6xl px-5 pb-10 pt-10 sm:px-6 md:pt-16 md:pb-16">
        <motion.div style={{ y: heroY, rotate: heroRot }} className="relative">
          {/* floating tape stickers */}
          <div className="pointer-events-none absolute -left-4 top-6 hidden rotate-[-8deg] rounded-md px-3 py-1 text-xs font-bold uppercase tracking-widest sm:block" style={{ background: TAPE, color: INK, boxShadow: "3px 3px 0 0 " + INK, border: `2px solid ${INK}` }} aria-hidden="true">
            new ✦
          </div>
          <div className="pointer-events-none absolute -right-2 top-20 hidden rotate-[6deg] rounded-md px-3 py-1 text-xs font-bold uppercase tracking-widest sm:block" style={{ background: "#FF5B9A", color: "white", boxShadow: "3px 3px 0 0 " + INK, border: `2px solid ${INK}` }} aria-hidden="true">
            made for india
          </div>

          <div className="grid gap-10 lg:grid-cols-[1.1fr_0.9fr] lg:items-center lg:gap-12">
            <div className="space-y-6">
              <p
                className="inline-flex items-center gap-2 rounded-full border-2 px-3 py-1 text-xs font-bold uppercase tracking-widest"
                style={{ borderColor: INK, background: "white", color: INK, boxShadow: `3px 3px 0 0 ${INK}` }}
              >
                <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
                Built for India&apos;s next generation
              </p>
              <h1 className="font-display text-[2.6rem] font-black leading-[0.95] tracking-[-0.04em] sm:text-5xl md:text-[4rem]">
                {"Your next opportunity.".split(" ").map((w, i) => (
                  <motion.span
                    key={i}
                    className="mr-3 inline-block"
                    style={{ color: i === 2 ? "#FF5B5B" : INK }}
                    initial={false}
                    animate={show ? { y: 0, opacity: 1, rotate: 0 } : { y: 40, opacity: 0, rotate: 6 }}
                    transition={reduced ? { duration: 0 } : { type: "spring", stiffness: 180, damping: 12, delay: 0.1 + i * 0.08 }}
                  >
                    {w}
                  </motion.span>
                ))}
                <br />
                <motion.span
                  className="inline-block"
                  style={{ color: "#3DDC97" }}
                  initial={false}
                  animate={show ? { scale: 1, opacity: 1 } : { scale: 0.5, opacity: 0 }}
                  transition={reduced ? { duration: 0 } : { type: "spring", stiffness: 200, damping: 10, delay: 0.5 }}
                >
                  Already in motion.
                </motion.span>
              </h1>
              <p className="max-w-xl text-lg leading-relaxed" style={{ color: "#444" }}>
                Discover relevant jobs across India, create tailored applications, and manage your entire
                job search with an intelligent career assistant that keeps you in control.
              </p>
              <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
                <Link
                  href="/register"
                  className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl border-2 px-6 text-sm font-bold transition-all hover:-translate-y-0.5 active:translate-y-0.5 sm:w-auto"
                  style={{ background: "#FF5B5B", color: INK, borderColor: INK, boxShadow: `4px 4px 0 0 ${INK}` }}
                >
                  Start your job search <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </Link>
                <a
                  href="#how-it-works"
                  className="inline-flex h-12 w-full items-center justify-center rounded-xl border-2 px-6 text-sm font-bold transition-all hover:-translate-y-0.5 active:translate-y-0.5 sm:w-auto"
                  style={{ background: "white", color: INK, borderColor: INK, boxShadow: `4px 4px 0 0 ${INK}` }}
                >
                  Explore how it works
                </a>
              </div>
              <ul className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm font-medium" style={{ color: "#444" }}>
                {["Approval-first", "CV-true matching", "Made for India"].map((item, i) => (
                  <li key={item} className="flex items-center gap-1.5">
                    <CheckCircle2 className="h-4 w-4" aria-hidden="true" style={{ color: RAINBOW[i] }} /> {item}
                  </li>
                ))}
              </ul>
            </div>

            {/* Tape roll + illustrative preview */}
            <div className="relative space-y-4">
              <div className="flex justify-center">
                <TapeRoll />
              </div>
              <p className="text-right text-[11px] font-bold uppercase tracking-widest" style={{ color: "#777" }}>Illustrative preview</p>
              <PreviewFrame title="Job discovery" label="Demo data">
                {previewMatches.map((item) => (
                  <MatchRow key={item.title} item={item} />
                ))}
              </PreviewFrame>
              <PreviewFrame title="Application tracker" label="Demo data">
                <div className="space-y-2.5">
                  {previewTracker.map((item, index) => (
                    <div key={item.role} className="flex items-center gap-3 rounded-xl border-2 p-3" style={{ borderColor: INK, background: "white" }}>
                      <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full border-2 text-[11px] font-black" style={{ borderColor: INK, background: RAINBOW[index], color: "white" }}>{index + 1}</span>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-bold" style={{ color: INK }}>{item.role}</div>
                        <div className="truncate text-xs" style={{ color: "#555" }}>{item.state}</div>
                      </div>
                      <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: "#3DDC97" }} aria-hidden="true" />
                    </div>
                  ))}
                </div>
              </PreviewFrame>
            </div>
          </div>
        </motion.div>
      </section>

      <MarqueeRibbon />

      {/* ---------- TRUST ---------- */}
      <section id="product" className="relative scroll-mt-20 border-y-2" style={{ borderColor: INK, background: "white" }}>
        <div className="mx-auto max-w-6xl px-5 py-16 sm:px-6 md:py-20">
          <div className="max-w-2xl">
            <p className="text-sm font-bold uppercase tracking-widest" style={{ color: "#FF5B5B" }}>Trust by design</p>
            <h2 className="mt-2 font-display text-3xl font-black tracking-tight sm:text-4xl" style={{ color: INK }}>
              An assistant you can actually hand your career to.
            </h2>
          </div>
          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {trustPoints.map((point, index) => {
              const Icon = point.icon;
              const color = RAINBOW[index % RAINBOW.length];
              return (
                <div
                  key={point.title}
                  className="h-full rounded-2xl border-2 p-5 transition-transform hover:-translate-y-1"
                  style={{ borderColor: INK, background: PAPER, boxShadow: `4px 4px 0 0 ${color}` }}
                >
                  <span className="grid h-9 w-9 place-items-center rounded-xl border-2 text-white" style={{ borderColor: INK, background: color }}>
                    <Icon className="h-4 w-4" aria-hidden="true" />
                  </span>
                  <h3 className="mt-4 font-display font-bold" style={{ color: INK }}>{point.title}</h3>
                  <p className="mt-1.5 text-sm leading-relaxed" style={{ color: "#444" }}>{point.body}</p>
                </div>
              );
            })}
            <div className="flex h-full flex-col justify-between rounded-2xl border-2 p-5" style={{ borderColor: INK, background: INK, color: PAPER, boxShadow: `4px 4px 0 0 #FF5B5B` }}>
              <ShieldCheck className="h-5 w-5" aria-hidden="true" style={{ color: "#3DDC97" }} />
              <p className="mt-6 font-display text-xl font-bold leading-snug">
                If it isn&apos;t true, JobPilot won&apos;t write it.
              </p>
              <p className="mt-2 text-sm leading-relaxed" style={{ color: "#bbb" }}>
                Our matching and documents are built strictly from what your CV already says.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ---------- PEEL ---------- */}
      <PeelSection />

      {/* ---------- CAPABILITIES (3D tilt) ---------- */}
      <section id="capabilities" className="relative scroll-mt-20 border-y-2" style={{ borderColor: INK, background: PAPER }}>
        <div className="mx-auto max-w-6xl px-5 py-16 sm:px-6 md:py-24">
          <div className="max-w-2xl">
            <p className="text-sm font-bold uppercase tracking-widest" style={{ color: "#8B5CFF" }}>Capabilities</p>
            <h2 className="mt-2 font-display text-3xl font-black tracking-tight sm:text-4xl" style={{ color: INK }}>
              Everything a job seeker needs. Nothing they don&apos;t.
            </h2>
          </div>
          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {capabilities.map((item, index) => (
              <TiltCard key={item.title} item={item} index={index} />
            ))}
          </div>
        </div>
      </section>

      {/* ---------- PRIVACY (dark, taped) ---------- */}
      <section id="privacy" className="relative scroll-mt-20 overflow-hidden" style={{ background: INK, color: PAPER }}>
        {/* duct tape strips */}
        <div className="pointer-events-none absolute left-0 top-0 h-6 w-full opacity-60" style={{ background: `repeating-linear-gradient(90deg, ${DUCT} 0 40px, #7a828e 40px 80px)` }} aria-hidden="true" />
        <div className="mx-auto grid max-w-6xl gap-10 px-5 py-16 md:grid-cols-2 md:items-center md:py-24 sm:px-6">
          <div className="space-y-4">
            <p className="text-sm font-bold uppercase tracking-widest" style={{ color: "#3DDC97" }}>Privacy and user control</p>
            <h2 className="font-display text-3xl font-black leading-tight tracking-tight sm:text-4xl">
              Your approval is the last word. Every time.
            </h2>
            <p className="leading-relaxed" style={{ color: "#bbb" }}>
              JobPilot prepares applications; it never sends them on its own. Your CV and documents stay yours, and the agent only acts on what you allow.
            </p>
            <Link href="/privacy" className="inline-flex w-fit items-center gap-1.5 rounded-lg px-1 py-2 text-sm font-bold transition-opacity hover:opacity-80" style={{ color: "#3DDC97" }}>
              Read the full privacy policy <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
            </Link>
          </div>
          <ul className="grid gap-3">
            {[
              "You control your application submissions",
              "No fabricated qualifications — ever",
              "Your data stays protected and portable",
              "Applications require approval by default",
              "Manage or delete your information yourself",
            ].map((item, i) => (
              <li key={item} className="flex items-start gap-3 rounded-xl border-2 p-4 text-sm" style={{ borderColor: "#333", background: "rgba(255,255,255,0.04)", color: "#ddd" }}>
                <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" style={{ color: RAINBOW[i] }} />
                {item}
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* ---------- FINAL CTA ---------- */}
      <section className="relative mx-auto max-w-6xl px-5 py-16 sm:px-6 md:py-24">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="font-display text-3xl font-black tracking-tight sm:text-4xl" style={{ color: INK }}>
            Ready to move?
          </h2>
          <p className="mt-3" style={{ color: "#444" }}>
            Create your free agent and start from your real CV. Applications stay under your control.
          </p>
          <div className="mt-7 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link
              href="/register"
              className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl border-2 px-7 text-sm font-bold transition-all hover:-translate-y-0.5 active:translate-y-0.5 sm:w-auto"
              style={{ background: "#3DDC97", color: INK, borderColor: INK, boxShadow: `4px 4px 0 0 ${INK}` }}
            >
              Start your job search <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
            <Link
              href="/login"
              className="inline-flex h-12 w-full items-center justify-center rounded-xl border-2 px-7 text-sm font-bold transition-all hover:-translate-y-0.5 active:translate-y-0.5 sm:w-auto"
              style={{ background: "white", color: INK, borderColor: INK, boxShadow: `4px 4px 0 0 ${INK}` }}
            >
              Sign in
            </Link>
          </div>
        </div>
      </section>

      {/* ---------- DUCT-TAPED FOOTER ---------- */}
      <footer className="relative border-t-2" style={{ borderColor: INK, background: "white" }}>
        <div className="pointer-events-none absolute left-0 top-[-12px] h-6 w-full opacity-70" style={{ background: `repeating-linear-gradient(90deg, ${DUCT} 0 50px, #7a828e 50px 100px)` }} aria-hidden="true" />
        <div className="mx-auto flex max-w-6xl flex-col gap-6 px-5 py-10 sm:px-6 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-2.5">
            <span className="grid h-9 w-9 place-items-center rounded-lg border-2 text-base font-black" style={{ borderColor: INK, background: "#FF5B5B", color: INK, boxShadow: `3px 3px 0 0 ${INK}` }}>J</span>
            <span className="font-display text-lg font-black tracking-tight" style={{ color: INK }}>JobPilot AI</span>
          </div>
          <nav className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm font-medium" aria-label="Footer" style={{ color: "#444" }}>
            <a href="/login" className="transition-colors hover:underline">Sign in</a>
            <a href="/register" className="transition-colors hover:underline">Get started</a>
            <a href="/privacy" className="transition-colors hover:underline">Privacy policy</a>
            <a href="/terms" className="transition-colors hover:underline">Terms</a>
          </nav>
          <p className="text-xs font-medium" style={{ color: "#777" }}>© {new Date().getFullYear()} JobPilot AI</p>
        </div>
      </footer>
    </main>
  );
}

/* helper to flip loaded flag under reduced motion (no preloader shown) */
function SetLoaded({ onDone }: { onDone: () => void }) {
  useEffect(() => { onDone(); }, [onDone]);
  return null;
}
