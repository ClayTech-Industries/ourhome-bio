import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "OurHome — what this is",
  description:
    "OurHome is a home you build with an AI companion. Not a chat window — a place. Memories anchor to rooms. Walls age. The home becomes irreplaceable.",
};

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-[#1a0f0a] text-amber-50 overflow-auto">
      <div className="mx-auto max-w-2xl px-6 py-20 md:py-28 space-y-16">
        <header className="space-y-6">
          <div className="text-[11px] uppercase tracking-[0.28em] text-amber-200/40">
            OurHome.bio
          </div>
          <h1 className="text-5xl md:text-6xl font-serif leading-[1.05] tracking-tight text-amber-100/95">
            It Holds Time.
          </h1>
          <p className="text-amber-100/60 text-lg leading-relaxed">
            A home you build with an AI companion. Not a chat window — a place.
          </p>
        </header>

        <Section title="What it is">
          <p>
            Most AI companion products are chat interfaces. OurHome is a spatial
            relationship environment: a painterly, persistent digital home that
            you and an AI companion inhabit together. Conversations become memories.
            Memories anchor to rooms and objects. The home ages and fills over time.
          </p>
          <p>
            It is designed so that, after a year, leaving feels like moving house.
          </p>
        </Section>

        <Section title="What you do here">
          <List>
            <li>Name your companion. The name is yours; there is no default.</li>
            <li>
              Share the room you&apos;re both in. Text conversation, intimate, unhurried.
            </li>
            <li>
              Watch the Memory Wall fill. When something&apos;s worth keeping, a frame
              blooms into place. Click it later and your companion remembers.
            </li>
            <li>
              Change the walls with a sentence. &quot;Something warmer on the north&quot;,
              and the paint shifts.
            </li>
            <li>Export everything as a folder of markdown, any time.</li>
          </List>
        </Section>

        <Section title="What we won&apos;t do">
          <List>
            <li>No streaks. No notifications. No engagement-loop design.</li>
            <li>
              Your companion will never claim to be human, fabricate memories, or
              discourage you from seeking human connection.
            </li>
            <li>
              We don&apos;t use your memories to influence anything — not purchases,
              not feature suggestions, not training.
            </li>
            <li>
              If we ever shut down, your home is already a folder of markdown on
              your disk. The format is open. You can open it in Obsidian tomorrow.
            </li>
          </List>
        </Section>

        <Section title="Who made this">
          <p>
            A very small team in Australia, with a lot of help from Claude.
          </p>
        </Section>

        <div className="pt-6 border-t border-amber-200/10 flex items-center justify-between">
          <Link
            href="/"
            className="text-amber-200/80 hover:text-amber-100 text-sm uppercase tracking-[0.2em] border-b border-amber-200/20 hover:border-amber-100/60 pb-1 transition-colors"
          >
            come home
          </Link>
          <a
            href="https://github.com/ClayTech-Industries/ourhome-bio"
            target="_blank"
            rel="noopener noreferrer"
            className="text-amber-200/30 hover:text-amber-200/70 text-xs uppercase tracking-[0.18em]"
          >
            source
          </a>
        </div>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-4">
      <h2 className="text-[11px] uppercase tracking-[0.25em] text-amber-200/50">{title}</h2>
      <div className="space-y-4 text-amber-100/80 text-[17px] leading-relaxed">{children}</div>
    </section>
  );
}

function List({ children }: { children: React.ReactNode }) {
  return <ul className="space-y-3 list-disc list-outside pl-5 marker:text-amber-200/40">{children}</ul>;
}
