import React from 'react';

interface HangingFanoosLanternsProps {
  mobileMenuOpen?: boolean;
}

interface LanternConfig {
  id: string;
  side: 'left' | 'right';
  offset: string;
  chainHeightDesktop: number;
  chainHeightMobile: number;
  widthDesktop: number;
  widthMobile: number;
  heightDesktop: number;
  heightMobile: number;
  pendulumClass: string;
  flameClass: string;
  glowClass: string;
  auraSizeDesktop: number;
  auraSizeMobile: number;
  hideOnMobile?: boolean;
}

const LANTERNS: LanternConfig[] = [
  // 1. Outer Left (Long Chain - Frames Header Edge)
  {
    id: 'outer-left',
    side: 'left',
    offset: '3.5%',
    chainHeightDesktop: 108,
    chainHeightMobile: 64,
    widthDesktop: 56,
    widthMobile: 42,
    heightDesktop: 84,
    heightMobile: 64,
    pendulumClass: 'animate-fanoos-pendulum-1',
    flameClass: 'animate-fanoos-flame-1',
    glowClass: 'animate-fanoos-glow-1',
    auraSizeDesktop: 200,
    auraSizeMobile: 150,
    hideOnMobile: false,
  },
  // 2. Inner Left (Short Chain - Cascading Canopy, Clear of Title)
  {
    id: 'inner-left',
    side: 'left',
    offset: '10.5%',
    chainHeightDesktop: 68,
    chainHeightMobile: 48,
    widthDesktop: 48,
    widthMobile: 38,
    heightDesktop: 72,
    heightMobile: 58,
    pendulumClass: 'animate-fanoos-pendulum-2',
    flameClass: 'animate-fanoos-flame-2',
    glowClass: 'animate-fanoos-glow-2',
    auraSizeDesktop: 168,
    auraSizeMobile: 130,
    hideOnMobile: true,
  },
  // 3. Inner Right (Short Chain - Cascading Canopy, Clear of Title)
  {
    id: 'inner-right',
    side: 'right',
    offset: '10.5%',
    chainHeightDesktop: 68,
    chainHeightMobile: 48,
    widthDesktop: 48,
    widthMobile: 38,
    heightDesktop: 72,
    heightMobile: 58,
    pendulumClass: 'animate-fanoos-pendulum-3',
    flameClass: 'animate-fanoos-flame-3',
    glowClass: 'animate-fanoos-glow-3',
    auraSizeDesktop: 168,
    auraSizeMobile: 130,
    hideOnMobile: true,
  },
  // 4. Outer Right (Long Chain - Frames Header Edge)
  {
    id: 'outer-right',
    side: 'right',
    offset: '3.5%',
    chainHeightDesktop: 108,
    chainHeightMobile: 64,
    widthDesktop: 56,
    widthMobile: 42,
    heightDesktop: 84,
    heightMobile: 64,
    pendulumClass: 'animate-fanoos-pendulum-4',
    flameClass: 'animate-fanoos-flame-4',
    glowClass: 'animate-fanoos-glow-4',
    auraSizeDesktop: 200,
    auraSizeMobile: 150,
    hideOnMobile: false,
  },
];

/**
 * Hanging Islamic Fanoos Lanterns
 * Suspended from the bottom border of the sticky top navbar.
 * Non-blocking decorative layer (pointer-events: none, z-45, overflow: visible).
 */
export const HangingFanoosLanterns: React.FC<HangingFanoosLanternsProps> = ({
  mobileMenuOpen = false,
}) => {
  return (
    <div
      aria-hidden="true"
      className={`absolute top-full left-0 right-0 pointer-events-none z-[45] overflow-visible select-none ${
        mobileMenuOpen ? 'hidden md:block' : 'block'
      }`}
    >
      {LANTERNS.map((lantern) => {
        const positionStyle: React.CSSProperties = {
          [lantern.side]: lantern.offset,
        };

        return (
          <div
            key={lantern.id}
            className={`absolute top-0 flex flex-col items-center pointer-events-none ${
              lantern.hideOnMobile ? 'hidden md:flex' : 'flex'
            } ${lantern.pendulumClass}`}
            style={{
              ...positionStyle,
              transformOrigin: 'top center',
            }}
          >
            {/* Top Hook Anchor touching navbar bottom border */}
            <div className="w-2.5 h-1.5 -mt-0.5 rounded-b-xs bg-gradient-to-b from-[#78350f] via-[#b45309] to-[#d97706] shadow-[0_1px_3px_rgba(0,0,0,0.35)] z-20 shrink-0" />

            {/* Delicate Antique-Gold Chain (Desktop & Mobile) */}
            <div className="hidden sm:block shrink-0">
              <FanoosChainSvg height={lantern.chainHeightDesktop} />
            </div>
            <div className="block sm:hidden shrink-0">
              <FanoosChainSvg height={lantern.chainHeightMobile} />
            </div>

            {/* Suspended Fanoos Lantern with Warm Radiant Candlelight Aura */}
            <div className="relative flex items-center justify-center -mt-1 shrink-0">
              {/* Layer 1: Soft, Wide Radial Candlelight Aura */}
              <div
                className={`absolute left-1/2 top-[52%] -translate-x-1/2 -translate-y-1/2 pointer-events-none rounded-full z-0 mix-blend-screen ${lantern.glowClass}`}
                style={{
                  width: `${lantern.auraSizeDesktop}px`,
                  height: `${lantern.auraSizeDesktop}px`,
                  background:
                    'radial-gradient(circle, rgba(254, 243, 199, 0.52) 0%, rgba(251, 191, 36, 0.38) 32%, rgba(245, 158, 11, 0.14) 62%, transparent 80%)',
                }}
              />

              {/* Layer 2: Wide horizontal candlelight side-spread */}
              <div
                className="absolute left-1/2 top-[52%] -translate-x-1/2 -translate-y-1/2 pointer-events-none rounded-full z-0 blur-lg opacity-80 mix-blend-screen"
                style={{
                  width: `${Math.round(lantern.auraSizeDesktop * 1.35)}px`,
                  height: `${Math.round(lantern.auraSizeDesktop * 0.85)}px`,
                  background:
                    'radial-gradient(ellipse at center, rgba(251, 191, 36, 0.28) 0%, rgba(245, 158, 11, 0.12) 48%, transparent 72%)',
                }}
              />

              {/* Layer 3: Downward candlelight cone */}
              <div
                className="absolute left-1/2 top-[76%] -translate-x-1/2 -translate-y-1/2 pointer-events-none rounded-full z-0 blur-md opacity-65 mix-blend-screen"
                style={{
                  width: `${Math.round(lantern.auraSizeDesktop * 0.75)}px`,
                  height: `${Math.round(lantern.auraSizeDesktop * 0.45)}px`,
                  background:
                    'radial-gradient(ellipse at center, rgba(254, 240, 138, 0.35) 0%, rgba(245, 158, 11, 0.10) 55%, transparent 75%)',
                }}
              />

              {/* Fanoos Lantern Body SVG (Desktop) */}
              <div className="hidden sm:block relative z-10">
                <FanoosLanternSvg
                  width={lantern.widthDesktop}
                  height={lantern.heightDesktop}
                  flameClass={lantern.flameClass}
                />
              </div>

              {/* Fanoos Lantern Body SVG (Mobile) */}
              <div className="block sm:hidden relative z-10">
                <FanoosLanternSvg
                  width={lantern.widthMobile}
                  height={lantern.heightMobile}
                  flameClass={lantern.flameClass}
                />
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};

/**
 * Delicate Antique-Gold Chain SVG
 * Alternating vertical and angled elliptical brass links
 */
const FanoosChainSvg: React.FC<{ height: number }> = ({ height }) => {
  const linkStep = 5;
  const count = Math.max(3, Math.floor(height / linkStep));
  const links = [];

  for (let i = 0; i < count; i++) {
    const y = i * linkStep + 3.5;
    const isEven = i % 2 === 0;
    links.push(
      <ellipse
        key={i}
        cx="4"
        cy={y}
        rx={isEven ? 1.8 : 1.2}
        ry={isEven ? 3.4 : 2.9}
        stroke={isEven ? '#D97706' : '#92400E'}
        strokeWidth={isEven ? 1.25 : 1.05}
        fill="none"
      />
    );
  }

  return (
    <svg
      width="8"
      height={height}
      viewBox={`0 0 8 ${height}`}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="overflow-visible"
    >
      {/* Chain link highlights */}
      <defs>
        <linearGradient id="chainShine" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#92400E" />
          <stop offset="45%" stopColor="#FDE68A" />
          <stop offset="100%" stopColor="#B45309" />
        </linearGradient>
      </defs>
      {links}
    </svg>
  );
};

/**
 * Ornate Islamic Geometric Fanoos SVG
 * Classical onion dome, crescent finial, arabesque lattice cutouts,
 * frosted amber glass, and living flickering candle flame.
 */
interface FanoosLanternSvgProps {
  width: number;
  height: number;
  flameClass: string;
}

const FanoosLanternSvg: React.FC<FanoosLanternSvgProps> = ({
  width,
  height,
  flameClass,
}) => {
  return (
    <svg
      viewBox="0 0 64 96"
      width={width}
      height={height}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="overflow-visible"
      style={{
        filter:
          'drop-shadow(0 0 10px rgba(251, 191, 36, 0.45)) drop-shadow(0 4px 12px rgba(217, 119, 6, 0.35))',
      }}
    >
      <defs>
        {/* Antique Brass Gradient */}
        <linearGradient id="fanoosBrassGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#524021" />
          <stop offset="28%" stopColor="#B45309" />
          <stop offset="50%" stopColor="#F59E0B" />
          <stop offset="72%" stopColor="#92400E" />
          <stop offset="100%" stopColor="#524021" />
        </linearGradient>

        {/* Polished Gold Trim */}
        <linearGradient id="fanoosGoldTrim" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#92400E" />
          <stop offset="35%" stopColor="#FEF3C7" />
          <stop offset="65%" stopColor="#FDE68A" />
          <stop offset="100%" stopColor="#B45309" />
        </linearGradient>

        {/* Radiant Frosted Amber Glass */}
        <radialGradient id="fanoosGlassAmber" cx="50%" cy="52%" r="50%">
          <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.95" />
          <stop offset="22%" stopColor="#FEF08A" stopOpacity="0.9" />
          <stop offset="50%" stopColor="#FDE047" stopOpacity="0.85" />
          <stop offset="78%" stopColor="#F59E0B" stopOpacity="0.82" />
          <stop offset="100%" stopColor="#D97706" stopOpacity="0.88" />
        </radialGradient>

        {/* Living Candle Flame Gradient */}
        <linearGradient id="fanoosFlameGrad" x1="50%" y1="0%" x2="50%" y2="100%">
          <stop offset="0%" stopColor="#FFFFFF" />
          <stop offset="20%" stopColor="#FEF08A" />
          <stop offset="55%" stopColor="#FDE047" />
          <stop offset="82%" stopColor="#F97316" />
          <stop offset="100%" stopColor="#DC2626" />
        </linearGradient>

        {/* Glass Side Shadowing for 3D Hexagonal Depth */}
        <linearGradient id="fanoosPaneShadow" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#78350F" stopOpacity="0.45" />
          <stop offset="25%" stopColor="#F59E0B" stopOpacity="0.1" />
          <stop offset="75%" stopColor="#F59E0B" stopOpacity="0.1" />
          <stop offset="100%" stopColor="#78350F" stopOpacity="0.45" />
        </linearGradient>
      </defs>

      {/* 1. TOP SUSPENSION RING & STUD */}
      <circle
        cx="32"
        cy="7"
        r="4.5"
        stroke="url(#fanoosBrassGrad)"
        strokeWidth="2.2"
        fill="none"
      />
      <circle
        cx="32"
        cy="7"
        r="3.2"
        stroke="url(#fanoosGoldTrim)"
        strokeWidth="0.8"
        fill="none"
      />
      <rect
        x="30"
        y="11.5"
        width="4"
        height="2.5"
        rx="1"
        fill="url(#fanoosGoldTrim)"
      />

      {/* 2. ISLAMIC CRESCENT FINIAL (HILAL) */}
      <path
        d="M 32 14 C 34.2 14 35.8 15.6 35.8 17.8 C 35.8 19.8 34.2 21.2 32 21.2 C 33.4 20.2 33.8 18.6 33.2 17.2 C 32.7 15.8 31.6 15 32 14 Z"
        fill="url(#fanoosGoldTrim)"
      />
      <circle cx="32" cy="19.5" r="1.2" fill="url(#fanoosGoldTrim)" />

      {/* 3. ARCHED ONION / MINARET DOME CAP */}
      {/* Dome Main Body */}
      <path
        d="M 32 20 C 30 23 24 26 18 30.5 C 14.5 32 13 33 13 34 L 51 34 C 51 33 49.5 32 46 30.5 C 40 26 34 23 32 20 Z"
        fill="url(#fanoosBrassGrad)"
        stroke="#78350F"
        strokeWidth="0.8"
      />

      {/* 3D Convex Rib Lines on Dome */}
      <path
        d="M 32 20 C 31 24.5 27 29.5 24 34"
        stroke="url(#fanoosGoldTrim)"
        strokeWidth="0.9"
        strokeOpacity="0.85"
      />
      <path
        d="M 32 20 C 33 24.5 37 29.5 40 34"
        stroke="url(#fanoosGoldTrim)"
        strokeWidth="0.9"
        strokeOpacity="0.85"
      />
      <path
        d="M 32 20 L 32 34"
        stroke="#FEF3C7"
        strokeWidth="0.8"
        strokeOpacity="0.9"
      />

      {/* Dome Lower Scalloped Filigree Rim */}
      <rect
        x="12"
        y="33.5"
        width="40"
        height="3"
        rx="1"
        fill="url(#fanoosGoldTrim)"
        stroke="#78350F"
        strokeWidth="0.6"
      />

      {/* 4. RADIANT AMBER GLASS CHAMBER */}
      {/* Background Radiant Amber Glow */}
      <rect
        x="14"
        y="36"
        width="36"
        height="33"
        rx="2"
        fill="url(#fanoosGlassAmber)"
      />
      <rect
        x="14"
        y="36"
        width="36"
        height="33"
        rx="2"
        fill="url(#fanoosPaneShadow)"
      />

      {/* Arabesque Ogee Pointed Islamic Arches on Glass */}
      <path
        d="M 23 68 L 23 47 C 23 43 27 39.5 32 37.5 C 37 39.5 41 43 41 47 L 41 68 Z"
        fill="none"
        stroke="#B45309"
        strokeWidth="1.1"
        strokeOpacity="0.75"
      />
      <path
        d="M 14 68 L 14 47 C 14 44 17 41.5 22 40 L 22 68 Z"
        fill="none"
        stroke="#B45309"
        strokeWidth="0.9"
        strokeOpacity="0.65"
      />
      <path
        d="M 50 68 L 50 47 C 50 44 47 41.5 42 40 L 42 68 Z"
        fill="none"
        stroke="#B45309"
        strokeWidth="0.9"
        strokeOpacity="0.65"
      />

      {/* Filigree Star / Diamond Cutout Details */}
      <path
        d="M 32 40 L 34 43 L 32 46 L 30 43 Z"
        fill="#FEF3C7"
        fillOpacity="0.85"
      />

      {/* 5. LIVING FLICKERING CANDLE & TEARDROP FLAME */}
      {/* Candle Pedestal / Holder */}
      <path
        d="M 28 64 L 36 64 L 35 67 L 29 67 Z"
        fill="url(#fanoosGoldTrim)"
        stroke="#78350F"
        strokeWidth="0.5"
      />

      {/* White Wax Pillar */}
      <rect
        x="30"
        y="58"
        width="4"
        height="6.5"
        rx="0.8"
        fill="#FFFBEB"
        stroke="#D97706"
        strokeWidth="0.4"
      />
      {/* Wick */}
      <line
        x1="32"
        y1="58"
        x2="32"
        y2="55.5"
        stroke="#451A03"
        strokeWidth="0.8"
        strokeLinecap="round"
      />

      {/* Animated Flickering Teardrop Flame */}
      <g className={flameClass} style={{ transformOrigin: '32px 53px' }}>
        {/* Outer Flame Halos */}
        <circle cx="32" cy="51" r="9" fill="#FDE047" fillOpacity="0.3" filter="blur(2px)" />
        <circle cx="32" cy="51" r="5" fill="#FEF08A" fillOpacity="0.45" filter="blur(1px)" />

        {/* Outer Teardrop Flame */}
        <path
          d="M 32 43 C 34.2 46.5 36.2 49.5 36.2 52.2 C 36.2 54.8 34.3 56.6 32 56.6 C 29.7 56.6 27.8 54.8 27.8 52.2 C 27.8 49.5 29.8 46.5 32 43 Z"
          fill="url(#fanoosFlameGrad)"
        />

        {/* Intense White-Hot Core Flame */}
        <path
          d="M 32 47.5 C 33.3 49.8 34.4 51.5 34.4 53 C 34.4 54.5 33.3 55.4 32 55.4 C 30.7 55.4 29.6 54.5 29.6 53 C 29.6 51.5 30.7 49.8 32 47.5 Z"
          fill="#FFFFFF"
          fillOpacity="0.96"
        />
      </g>

      {/* 6. BRASS CORNER PILLARS & MULLIONS (FRONT LAYER) */}
      <line
        x1="13.5"
        y1="34"
        x2="13.5"
        y2="69"
        stroke="url(#fanoosBrassGrad)"
        strokeWidth="2.4"
        strokeLinecap="round"
      />
      <line
        x1="22.5"
        y1="34"
        x2="22.5"
        y2="69"
        stroke="url(#fanoosBrassGrad)"
        strokeWidth="1.6"
      />
      <line
        x1="41.5"
        y1="34"
        x2="41.5"
        y2="69"
        stroke="url(#fanoosBrassGrad)"
        strokeWidth="1.6"
      />
      <line
        x1="50.5"
        y1="34"
        x2="50.5"
        y2="69"
        stroke="url(#fanoosBrassGrad)"
        strokeWidth="2.4"
        strokeLinecap="round"
      />

      {/* Mid-Girth Brass Rim */}
      <rect
        x="13"
        y="68.5"
        width="38"
        height="2.5"
        rx="0.8"
        fill="url(#fanoosGoldTrim)"
        stroke="#78350F"
        strokeWidth="0.5"
      />

      {/* 7. TAPERED HEXAGONAL BASE & ORNAMENTAL DROP PENDANT */}
      {/* Tapered Base Apron */}
      <path
        d="M 13 70.5 L 21 80 L 43 80 L 51 70.5 Z"
        fill="url(#fanoosBrassGrad)"
        stroke="#78350F"
        strokeWidth="0.8"
      />
      <path
        d="M 21 80 L 22.5 70.5"
        stroke="url(#fanoosGoldTrim)"
        strokeWidth="0.8"
        strokeOpacity="0.8"
      />
      <path
        d="M 43 80 L 41.5 70.5"
        stroke="url(#fanoosGoldTrim)"
        strokeWidth="0.8"
        strokeOpacity="0.8"
      />

      {/* Bottom Pedestal Collar */}
      <rect
        x="26"
        y="80"
        width="12"
        height="3"
        rx="1"
        fill="url(#fanoosGoldTrim)"
        stroke="#78350F"
        strokeWidth="0.5"
      />

      {/* Ornamental Acorn / Drop Pendant */}
      <path
        d="M 32 83.5 C 34.2 83.5 35.8 85.5 35.8 87.5 C 35.8 90 32 94.5 32 94.5 C 32 94.5 28.2 90 28.2 87.5 C 28.2 85.5 29.8 83.5 32 83.5 Z"
        fill="url(#fanoosGoldTrim)"
        stroke="#78350F"
        strokeWidth="0.6"
      />
      <circle cx="32" cy="87.5" r="1.3" fill="#FEF3C7" />
    </svg>
  );
};
