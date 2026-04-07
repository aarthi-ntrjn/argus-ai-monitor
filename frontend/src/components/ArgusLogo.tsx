interface ArgusLogoProps {
  /** Height of the icon in pixels. Width scales proportionally (80:120 ratio). */
  size?: number;
  className?: string;
}

/**
 * Argus vertical eye logo.
 * The outer shape is a vertical almond (vesica piscis rotated 90°).
 * The eyeball is clipped to the eye outline with ~3/4 visible, nestled to the right.
 */
export default function ArgusLogo({ size = 32, className = '' }: ArgusLogoProps) {
  const width = Math.round((size * 80) / 120);
  return (
    <svg
      width={width}
      height={size}
      viewBox="0 0 80 120"
      xmlns="http://www.w3.org/2000/svg"
      aria-label="Argus logo"
      role="img"
      className={className}
    >
      <defs>
        <clipPath id="argus-eye-clip">
          <path d="M40 6 C60 20,78 38,78 60 S60 100,40 114 C20 100,2 82,2 60 S20 20,40 6 Z" />
        </clipPath>
      </defs>

      {/* Eye background */}
      <path d="M40 6 C60 20,78 38,78 60 S60 100,40 114 C20 100,2 82,2 60 S20 20,40 6 Z" fill="#f8fafc" />

      {/* Eyeball clipped to eye outline — center nudged right so ~3/4 is visible */}
      <g clipPath="url(#argus-eye-clip)">
        <circle cx="64" cy="60" r="30" fill="#e2e8f0" />
        <circle cx="64" cy="60" r="22" fill="#1d4ed8" />
        <circle cx="64" cy="60" r="18" fill="#1e40af" />
        <circle cx="64" cy="60" r="12" fill="#0f172a" />
        <circle cx="56" cy="52" r="6"  fill="white" opacity={0.85} />
        <circle cx="69" cy="68" r="3"  fill="white" opacity={0.35} />
      </g>

      {/* Outer eye outline */}
      <path
        d="M40 6 C60 20,78 38,78 60 S60 100,40 114 C20 100,2 82,2 60 S20 20,40 6 Z"
        fill="none"
        stroke="#0f172a"
        strokeWidth={5}
        strokeLinejoin="round"
      />
    </svg>
  );
}
