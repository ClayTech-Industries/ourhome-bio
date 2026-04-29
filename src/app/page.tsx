"use client";

import { useEffect, useState } from "react";
import { HomeExperience } from "@/components/HomeExperience";
import { Onboarding } from "@/components/Onboarding";
import { getHome, subscribe } from "@/lib/storage/local";

export default function Page() {
  const [ready, setReady] = useState(false);
  const [hasHome, setHasHome] = useState(false);

  useEffect(() => {
    const check = () => setHasHome(getHome() !== null);
    check();
    setReady(true);
    return subscribe(check);
  }, []);

  if (!ready) {
    return <div className="fixed inset-0 bg-[#1a0f0a]" />;
  }

  if (!hasHome) {
    return <Onboarding onComplete={() => setHasHome(true)} />;
  }

  return <HomeExperience />;
}
