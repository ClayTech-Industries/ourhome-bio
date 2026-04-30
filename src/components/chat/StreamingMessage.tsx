"use client";

import { useEffect, useRef, useState } from "react";

interface Props {
  text: string;
  isComplete: boolean;
  className?: string;
}

/**
 * Character-by-character reveal animation for companion messages.
 * Simulates a GSAP SplitText effect without the dependency.
 */
export function StreamingMessage({ text, isComplete, className }: Props) {
  const [displayedChars, setDisplayedChars] = useState(0);
  const prevTextRef = useRef(text);
  const isNewRef = useRef(true);

  useEffect(() => {
    const prevLen = prevTextRef.current.length;
    const newLen = text.length;
    const added = newLen - prevLen;

    if (added <= 0) {
      prevTextRef.current = text;
      setDisplayedChars(newLen);
      return;
    }

    // Animate only the newly added characters
    let current = prevLen;
    const target = newLen;
    isNewRef.current = prevLen === 0;

    const interval = setInterval(() => {
      current += 1;
      if (current >= target) {
        clearInterval(interval);
      }
      setDisplayedChars(current);
    }, 12); // ~83 chars/second — human reading speed feel

    prevTextRef.current = text;
    return () => clearInterval(interval);
  }, [text]);

  const visible = text.slice(0, displayedChars);
  const remaining = text.slice(displayedChars);

  return (
    <span className={className}>
      {visible}
      {remaining && (
        <span className="opacity-0">{remaining}</span>
      )}
      {!isComplete && (
        <span className="inline-block h-[1em] w-[2px] ml-0.5 align-middle bg-amber-200/60 animate-pulse" />
      )}
    </span>
  );
}

/**
 * Staggered word-by-word reveal for final (complete) companion messages.
 * Each word fades in with a slight upward motion.
 */
export function RevealedMessage({ text, className }: { text: string; className?: string }) {
  const words = text.split(/(\s+)/); // Keep whitespace tokens for layout
  const [visibleCount, setVisibleCount] = useState(0);

  useEffect(() => {
    setVisibleCount(0);
    let current = 0;
    const interval = setInterval(() => {
      current += 1;
      if (current >= words.length) {
        clearInterval(interval);
      }
      setVisibleCount(current);
    }, 35);
    return () => clearInterval(interval);
  }, [text]);

  return (
    <span className={className}>
      {words.map((word, i) => (
        <span
          key={i}
          className="inline-block transition-all duration-300"
          style={{
            opacity: i < visibleCount ? 1 : 0,
            transform: i < visibleCount ? "translateY(0)" : "translateY(4px)",
            transitionDelay: `${i * 15}ms`,
          }}
        >
          {word}
        </span>
      ))}
    </span>
  );
}
