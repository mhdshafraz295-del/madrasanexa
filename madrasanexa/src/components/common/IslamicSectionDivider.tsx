import React from 'react';

interface IslamicSectionDividerProps {
  className?: string;
  variant?: 'olive' | 'gold' | 'light';
}

/**
 * Islamic 8-Point Star (Rub el Hizb ۞) Section Divider
 * Thin tapering olive-gold gradient lines flanking a central 8-point geometric star and diamond accents.
 * 100% responsive down to 360px mobile viewports with zero horizontal overflow.
 */
export const IslamicSectionDivider: React.FC<IslamicSectionDividerProps> = ({
  className = '',
  variant = 'olive',
}) => {
  const isLight = variant === 'light';

  // Hairline gradient colors
  const lineLeft = isLight
    ? 'from-transparent via-white/30 to-white/70'
    : 'from-transparent via-[#8C8A58]/35 to-[#6B6A45]/80';
  const lineRight = isLight
    ? 'from-transparent via-white/30 to-white/70'
    : 'from-transparent via-[#8C8A58]/35 to-[#6B6A45]/80';

  const starColor = isLight ? 'text-white/85' : 'text-[#85845C]';
  const diamondColor = isLight ? 'fill-white/60' : 'fill-[#8C8A58]';
  const centerDotFill = isLight ? '#252525' : '#FAF9F5';

  return (
    <div
      className={`w-full max-w-5xl mx-auto px-4 sm:px-6 my-6 sm:my-10 flex items-center justify-center gap-3 sm:gap-4 overflow-hidden select-none pointer-events-none ${className}`}
      aria-hidden="true"
    >
      {/* Left tapering gradient hairline */}
      <div className={`h-[1px] flex-1 bg-gradient-to-r ${lineLeft} opacity-80`} />

      {/* Left subtle diamond accent */}
      <svg
        viewBox="0 0 8 8"
        className={`w-1.5 h-1.5 sm:w-2 sm:h-2 shrink-0 ${diamondColor} opacity-80`}
      >
        <path d="M4 0 L8 4 L4 8 L0 4 Z" />
      </svg>

      {/* Central 8-Point Star (Rub el Hizb ۞) */}
      <div className={`shrink-0 flex items-center justify-center ${starColor}`}>
        <svg
          viewBox="0 0 24 24"
          className="w-5 h-5 sm:w-6 sm:h-6 drop-shadow-[0_1px_2px_rgba(37,37,37,0.06)]"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          {/* Square 1 */}
          <rect
            x="4.75"
            y="4.75"
            width="14.5"
            height="14.5"
            rx="0.5"
            stroke="currentColor"
            strokeWidth="1.25"
            className="opacity-95"
          />
          {/* Square 2 (Rotated 45deg) */}
          <rect
            x="4.75"
            y="4.75"
            width="14.5"
            height="14.5"
            rx="0.5"
            transform="rotate(45 12 12)"
            stroke="currentColor"
            strokeWidth="1.25"
            className="opacity-95"
          />
          {/* Center Concentric Circle & Dot */}
          <circle cx="12" cy="12" r="2.75" fill="currentColor" className="opacity-85" />
          <circle cx="12" cy="12" r="1.1" fill={centerDotFill} />
        </svg>
      </div>

      {/* Right subtle diamond accent */}
      <svg
        viewBox="0 0 8 8"
        className={`w-1.5 h-1.5 sm:w-2 sm:h-2 shrink-0 ${diamondColor} opacity-80`}
      >
        <path d="M4 0 L8 4 L4 8 L0 4 Z" />
      </svg>

      {/* Right tapering gradient hairline */}
      <div className={`h-[1px] flex-1 bg-gradient-to-l ${lineRight} opacity-80`} />
    </div>
  );
};

export default IslamicSectionDivider;
