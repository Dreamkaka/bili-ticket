"use client";

export function BootMark({ className = "" }: { className?: string }) {
  return (
    <div className={`flex flex-col items-center gap-5 ${className}`}>
      <svg
        viewBox="0 0 96 96"
        className="boot-mark-spin h-16 w-16 text-[var(--ink)] sm:h-20 sm:w-20"
        fill="none"
        aria-hidden
      >
        <path
          d="M48 10 L82 30 L82 66 L48 86 L14 66 L14 30 Z"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinejoin="round"
          opacity="0.95"
        />
        <path
          d="M48 10 L48 46 L82 66"
          stroke="currentColor"
          strokeWidth="1.4"
          strokeLinejoin="round"
          opacity="0.75"
        />
        <path
          d="M48 46 L14 66"
          stroke="currentColor"
          strokeWidth="1.4"
          strokeLinejoin="round"
          opacity="0.75"
        />
        <path
          d="M30 38 L48 28 L66 38 L48 48 Z"
          stroke="currentColor"
          strokeWidth="1.2"
          opacity="0.55"
        />
        <path
          d="M48 48 L48 68"
          stroke="currentColor"
          strokeWidth="1.2"
          opacity="0.45"
        />
      </svg>
      <div className="text-center">
        <p className="text-sm font-semibold tracking-[0.28em] text-[var(--ink)] sm:text-base">
          我tm票呢
        </p>
        <p className="mt-1.5 text-[10px] tracking-[0.22em] text-[var(--ink-faint)]">
          WHERE ARE MY TICKET?!
        </p>
      </div>
    </div>
  );
}
