"use client";

import { useEffect, useRef, useState } from "react";

interface Props {
  text: string;
  isComplete: boolean;
  className?: string;
}

/**
 * Character-by-character reveal for streaming companion messages.
 *
 * The key insight: we only ever render `displayedChars` characters of the
 * full text. Characters not yet revealed simply don't exist in the DOM.
 * This prevents the "flash of full text" that happened when we rendered
 * the full string with opacity tricks.
 */
export function StreamingMessage({ text, isComplete, className }: Props) {
  const [displayedChars, setDisplayedChars] = useState(0);
  const prevTextRef = useRef(text);
  const animatingRef = useRef(false);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    const prevLen = prevTextRef.current.length;
    const newLen = text.length;

    // If text hasn't grown, just show everything we have
    if (newLen <= prevLen) {
      prevTextRef.current = text;
      setDisplayedChars(newLen);
      return;
    }

    // On first ever text (prevLen === 0), start from 0
    // On subsequent chunks, continue from where we are
    const startFrom = displayedChars;
    const target = newLen;
    prevTextRef.current = text;

    // If we're already caught up, just snap
    if (startFrom >= target) {
      setDisplayedChars(target);
      return;
    }

    // Cancel any existing animation
    if (animatingRef.current) {
      cancelAnimationFrame(rafRef.current);
    }

    let lastTime = 0;
    // ~70 characters per second — feels like reading speed
    const charsPerMs = 70 / 1000;

    const animate = (time: number) => {
      if (!lastTime) lastTime = time;
      const delta = time - lastTime;
      lastTime = time;

      const charsToAdd = Math.max(1, Math.round(delta * charsPerMs));
      const newDisplayed = Math.min(displayedChars + charsToAdd, target);

      // React state update — triggers re-render showing more characters
      setDisplayedChars(newDisplayed);

      if (newDisplayed < target) {
        animatingRef.current = true;
        rafRef.current = requestAnimationFrame(animate);
      } else {
        animatingRef.current = false;
      }
    };

    animatingRef.current = true;
    rafRef.current = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(rafRef.current);
      animatingRef.current = false;
    };
  }, [text]);

  // Only render the characters we've revealed so far
  const visible = text.slice(0, displayedChars);

  return (
    <span className={className} style={{ whiteSpace: "pre-wrap" }}>
      {visible}
      {!isComplete && visible.length < text.length && (
        <span className="inline-block h-[1em] w-[2px] ml-0.5 align-middle bg-amber-200/60 animate-pulse" />
      )}
    </span>
  );
}

/**
 * Word-by-word reveal for completed companion messages.
 *
 * Instead of splitting on spaces and wrapping each word in inline-block
 * (which collapses whitespace between elements), we render the full text
 * but progressively change each word's opacity from 0 to 1.
 *
 * This preserves natural whitespace while still giving a staggered reveal.
 */
export function RevealedMessage({ text, className }: { text: string; className?: string }) {
  const words = text.split(/(\s+)/); // Keep whitespace tokens
  const [visibleCount, setVisibleCount] = useState(0);
  const hasAnimatedRef = useRef(false);

  useEffect(() => {
    // Reset animation when text changes (new message)
    hasAnimatedRef.current = false;
    setVisibleCount(0);

    let current = 0;
    const interval = setInterval(() => {
      current += 1;
      if (current >= words.length) {
        clearInterval(interval);
        hasAnimatedRef.current = true;
      }
      setVisibleCount(current);
    }, 30); // ~33 words/second — comfortable reading pace

    return () => clearInterval(interval);
  }, [text]);

  return (
    <span className={className} style={{ whiteSpace: "pre-wrap" }}>
      {words.map((word, i) => {
        // Whitespace tokens are always visible
        const isWhitespace = /^\s+$/.test(word);
        const isVisible = isWhitespace || i < visibleCount;

        return (
          <span
            key={i}
            style={{
              opacity: isVisible ? 1 : 0,
              transform: isVisible ? "translateY(0)" : "translateY(3px)",
              transition: "opacity 200ms ease, transform 200ms ease",
              // Don't use inline-block for whitespace — it collapses spaces
              display: isWhitespace ? "inline" : "inline-block",
            }}
          >
            {word}
          </span>
        );
      })}
    </span>
  );
}