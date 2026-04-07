interface ArgusLogoProps {
  /** Height of the icon in pixels. Width scales proportionally (80:120 ratio). */
  size?: number;
  className?: string;
}

/**
 * Argus diamond eye logo — tall diamond with a large dark-blue eyeball clipped inside.
 * Left arc of the circle is visible against the light-blue sclera background.
 * Small green iris oval sits near the centre.
 */
export default function ArgusLogo({ size = 32, className = '' }: ArgusLogoProps) {
  return (
    <svg
      width={Math.round(size * 0.8)}
      height={size}
      viewBox="0 0 160 200"
      xmlns="http://www.w3.org/2000/svg"
      aria-label="Argus logo"
      role="img"
      className={className}
    >
      <defs>
        <clipPath id="argus-diamond-clip">
          <polygon points="80,5 155,95 80,195 5,95" />
        </clipPath>
      </defs>

      {/* Light blue diamond */}
      <polygon points="80,5 155,95 80,195 5,95" fill="#7EC5E8" />

      {/* Large dark blue eyeball, clipped to diamond */}
      <g clipPath="url(#argus-diamond-clip)">
        <circle cx="95" cy="98" r="70" fill="#1B52B5" />
      </g>

      {/* Circle arc outline */}
      <g clipPath="url(#argus-diamond-clip)">
        <circle cx="95" cy="98" r="70" fill="none" stroke="#111111" strokeWidth={4} />
      </g>

      {/* Green iris oval */}
      <g clipPath="url(#argus-diamond-clip)">
        <ellipse cx="87" cy="104" rx="8" ry="6" fill="#2DA84E" />
      </g>

      {/* Diamond outline */}
      <polygon
        points="80,5 155,95 80,195 5,95"
        fill="none"
        stroke="#111111"
        strokeWidth={5}
        strokeLinejoin="miter"
      />
    </svg>
  );
}
