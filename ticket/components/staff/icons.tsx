const base = {
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.8,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
};

type P = { size?: number; className?: string };

export const LockIcon = ({ size = 16, className }: P) => (
  <svg {...base} width={size} height={size} className={className}>
    <rect x="4" y="11" width="16" height="10" rx="2.5" />
    <path d="M8 11V8a4 4 0 0 1 8 0v3" />
  </svg>
);

export const GlobeIcon = ({ size = 16, className }: P) => (
  <svg {...base} width={size} height={size} className={className}>
    <circle cx="12" cy="12" r="9" />
    <path d="M3 12h18M12 3c2.6 2.6 3.9 5.6 3.9 9s-1.3 6.4-3.9 9c-2.6-2.6-3.9-5.6-3.9-9S9.4 5.6 12 3Z" />
  </svg>
);

export const NoteIcon = ({ size = 16, className }: P) => (
  <svg {...base} width={size} height={size} className={className}>
    <path d="M6 3h9l4 4v14H6Z" />
    <path d="M14 3v5h5M9 13h7M9 17h5" />
  </svg>
);

export const SendIcon = ({ size = 16, className }: P) => (
  <svg {...base} width={size} height={size} className={className}>
    <path d="M21 3 10 14M21 3l-7 18-4-7-7-4 18-7Z" />
  </svg>
);

export const ChevronRightIcon = ({ size = 18, className }: P) => (
  <svg {...base} strokeWidth={2} width={size} height={size} className={className}>
    <path d="M9 6l6 6-6 6" />
  </svg>
);

export const ArrowUpIcon = ({ size = 16, className }: P) => (
  <svg {...base} strokeWidth={2} width={size} height={size} className={className}>
    <path d="M12 19V5M5 12l7-7 7 7" />
  </svg>
);
