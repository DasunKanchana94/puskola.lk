/** Puskola mark: a palm-leaf manuscript leaf with its two string holes and written lines. */
export function BrandMark({ className = "mark" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 40 40" aria-hidden="true" focusable="false">
      <rect x="1" y="1" width="38" height="38" rx="10" fill="var(--accent)" />
      <g transform="rotate(-18 20 20)">
        <rect x="5" y="14" width="30" height="12" rx="6" fill="#f3d9a4" />
        <rect x="5" y="14" width="30" height="12" rx="6" fill="none" stroke="#c8901e" strokeWidth="1" />
        <path d="M10 18.2h20M10 21.8h20" stroke="#7a4a14" strokeWidth="1.1" strokeLinecap="round" opacity=".75" />
        <circle cx="13" cy="20" r="1.3" fill="#7a2214" />
        <circle cx="27" cy="20" r="1.3" fill="#7a2214" />
      </g>
    </svg>
  );
}
