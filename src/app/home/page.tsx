"use client";

import { useEffect, useState } from "react";
import { getHome } from "@/lib/storage/local";
import { Onboarding } from "@/components/Onboarding";
import { HomeExperience } from "@/components/HomeExperience";

export default function HomePage() {
  const [ready, setReady] = useState(false);
  const [hasHome, setHasHome] = useState(false);

  useEffect(() => {
    const home = getHome();
    setHasHome(!!home);
    setReady(true);
  }, []);

  if (!ready) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-[#1a0f0a]">
        <div className="text-amber-100/30 text-sm tracking-[0.2em] uppercase">
          opening the door...
        </div>
      </div>
    );
  }

  if (!hasHome) {
    return <Onboarding onComplete={() => setHasHome(true)} />;
  }

  return <HomeExperience />;
}