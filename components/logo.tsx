import { useId } from "react";

// The app mark: a smiling speech bubble (a caption that made you laugh).
// Same drawing as app/icon.svg.
export function Logo({ className = "h-7 w-7" }: { className?: string }) {
  // The header and footer both draw it, so each needs its own gradient id.
  const gradientId = useId();
  return (
    <svg aria-hidden viewBox="0 0 32 32" className={className}>
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#2563eb" />
          <stop offset="1" stopColor="#7c3aed" />
        </linearGradient>
      </defs>
      <rect width="32" height="32" rx="8" fill={`url(#${gradientId})`} />
      <path
        d="M9.5 7.5h13a3.5 3.5 0 0 1 3.5 3.5v6.5a3.5 3.5 0 0 1-3.5 3.5h-6.5l-5 4.5v-4.5h-1.5A3.5 3.5 0 0 1 6 17.5V11a3.5 3.5 0 0 1 3.5-3.5z"
        fill="#fff"
      />
      <circle cx="12.5" cy="12.3" r="1.3" fill="#5b21b6" />
      <circle cx="19.5" cy="12.3" r="1.3" fill="#5b21b6" />
      <path
        d="M11.8 15.4c1.1 1.6 2.5 2.4 4.2 2.4s3.1-.8 4.2-2.4"
        fill="none"
        stroke="#5b21b6"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
    </svg>
  );
}
