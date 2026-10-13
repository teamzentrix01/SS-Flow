"use client";

import { useEffect, useState } from "react";

export type ThemeChoice = "light" | "dark" | "system";

const storageKey = "ss-theme";

export function applyTheme(choice: ThemeChoice) {
  const dark =
    choice === "dark" ||
    (choice === "system" &&
      window.matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.dataset.theme = dark ? "dark" : "light";
  localStorage.setItem(storageKey, choice);
}

export function ThemeToggle() {
  const [choice, setChoice] = useState<ThemeChoice>(() => {
    if (typeof window === "undefined") return "system";
    const saved = localStorage.getItem(storageKey);
    return saved === "light" || saved === "dark" || saved === "system"
      ? saved
      : "system";
  });

  useEffect(() => {
    applyTheme(choice);
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => {
      const current = localStorage.getItem(storageKey);
      if (current === "system" || !current) applyTheme("system");
    };
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, [choice]);

  return (
    <div
      className="inline-flex rounded-[10px] border border-border bg-surface-muted p-1"
      role="radiogroup"
      aria-label="Theme"
    >
      {(["light", "dark", "system"] as const).map((option) => (
        <button
          key={option}
          type="button"
          role="radio"
          aria-checked={choice === option}
          onClick={() => {
            setChoice(option);
            applyTheme(option);
          }}
          className={`rounded-lg px-2.5 py-1 text-xs font-semibold capitalize transition ${choice === option ? "bg-accent text-white" : "text-muted hover:bg-accent-soft hover:text-accent"}`}
        >
          {option}
        </button>
      ))}
    </div>
  );
}
