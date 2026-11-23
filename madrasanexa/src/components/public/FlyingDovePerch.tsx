import React, { useState, useEffect, useRef } from 'react';

interface FlyingDovePerchProps {
  className?: string;
  variant?: 'navbar-lead' | 'section';
  label?: string;
  enableFlock?: boolean;
}

export const FlyingDovePerch: React.FC<FlyingDovePerchProps> = ({
  className = '',
  variant = 'navbar-lead',
  enableFlock = true,
}) => {
  const [flightPhase, setFlightPhase] = useState<'flying' | 'landing' | 'perched'>('flying');
  const [showSparkle, setShowSparkle] = useState(false);
  const [isFluttering, setIsFluttering] = useState(false);
  const [flockActive, setFlockActive] = useState(enableFlock && variant === 'navbar-lead');
  const flutterTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    // Respect prefers-reduced-motion
    if (typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setFlightPhase('perched');
      setFlockActive(false);
      return;
    }

    // 0s -> 2.4s: Flying along curved arc with wing flapping
    // 2.4s -> 2.8s: Deceleration & wing folding (landing)
    const landingTimer = setTimeout(() => {
      setFlightPhase('landing');
    }, 2400);

    // 2.8s: Touchdown & Perch
    const perchedTimer = setTimeout(() => {
      setFlightPhase('perched');
      setShowSparkle(true);
      setTimeout(() => setShowSparkle(false), 1200);
    }, 2800);

    // 3.6s: Unmount companion flock overlay to free up all animation resources
    const flockTimer = setTimeout(() => {
      setFlockActive(false);
    }, 3600);

    return () => {
      clearTimeout(landingTimer);
      clearTimeout(perchedTimer);
      clearTimeout(flockTimer);
      if (flutterTimeoutRef.current) clearTimeout(flutterTimeoutRef.current);
    };
  }, [variant]);

  const handleDoveInteraction = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (flightPhase !== 'perched' || isFluttering) return;
    setIsFluttering(true);
    setShowSparkle(true);
    flutterTimeoutRef.current = setTimeout(() => {
      setIsFluttering(false);
      setShowSparkle(false);
    }, 650);
  };

  const isFlying = flightPhase === 'flying' || flightPhase === 'landing';

  return (
    <>
      {/* Companion Flock (5 accompanying doves soaring across the hero sky) */}
      {flockActive && (
        <div
          aria-hidden="true"
          className="fixed inset-0 pointer-events-none z-40 overflow-hidden"
          style={{ willChange: 'transform, opacity' }}
        >
          {/* Flock Dove 1: Size 52px */}
          <div className="absolute top-2 left-0 w-[52px] h-[52px] animate-flock-1">
            <CompanionDoveSvg size={52} wingDelay="0s" opacity={0.92} />
          </div>

          {/* Flock Dove 2: Size 48px */}
          <div className="absolute top-8 left-0 w-[48px] h-[48px] animate-flock-2">
            <CompanionDoveSvg size={48} wingDelay="0.05s" opacity={0.88} />
          </div>

          {/* Flock Dove 3: Size 46px */}
          <div className="absolute top-1 left-0 w-[46px] h-[46px] animate-flock-3">
            <CompanionDoveSvg size={46} wingDelay="0.1s" opacity={0.85} />
          </div>

          {/* Flock Dove 4: Size 50px */}
          <div className="absolute top-12 left-0 w-[50px] h-[50px] animate-flock-4">
            <CompanionDoveSvg size={50} wingDelay="0.15s" opacity={0.88} />
          </div>

          {/* Flock Dove 5: Size 42px */}
          <div className="absolute top-6 left-0 w-[42px] h-[42px] animate-flock-5">
            <CompanionDoveSvg size={42} wingDelay="0.2s" opacity={0.8} />
          </div>
        </div>
      )}

      {/* Lead Perching Dove ("Pura") */}
      <div
        className={`select-none ${
          isFlying ? 'pointer-events-none animate-dove-flight' : 'pointer-events-auto cursor-pointer'
        } ${
          variant === 'navbar-lead'
            ? 'absolute -top-[36px] sm:-top-[46px] -left-1 sm:-left-0.5 z-30'
            : 'absolute -top-[42px] left-1/2 -translate-x-1/2 z-20'
        } ${className}`}
        style={{
          transformOrigin: 'bottom center',
        }}
        onClick={handleDoveInteraction}
        onMouseEnter={handleDoveInteraction}
        title="🕊️ Pura — Islamic Symbol of Peace, Purity & Barakah"
        role="img"
        aria-label="Graceful White Dove perched on MadrasaNexa"
      >
        <div
          className={`relative transition-transform duration-300 ${
            isFluttering
              ? 'animate-dove-flutter'
              : flightPhase === 'perched'
              ? 'animate-dove-breath'
              : ''
          }`}
          style={{ transformOrigin: 'bottom center' }}
        >
          {/* Landing Sparkle / Shimmer Ring */}
          {showSparkle && (
            <div
              className="pointer-events-none absolute bottom-1 left-1/2 -translate-x-1/2 w-8 h-8 rounded-full border border-emerald-400/80 bg-gradient-to-r from-emerald-400/25 via-amber-300/20 to-teal-400/25 animate-dove-sparkle z-0"
              style={{ filter: 'blur(0.5px)' }}
            />
          )}

          {/* Soft Perch Glow on Light Backgrounds */}
          <div
            className="pointer-events-none absolute -bottom-1 left-1/2 -translate-x-1/2 w-7 h-2 rounded-full bg-emerald-500/20 blur-[3px]"
            aria-hidden="true"
          />

          {/* Scaled Lead Dove SVG: 58px x 58px on desktop / 46px x 46px on mobile */}
          <div className="w-[46px] h-[46px] sm:w-[58px] sm:h-[58px] relative z-10">
            <LeadDoveSvg isFlying={isFlying} isFluttering={isFluttering} />
          </div>
        </div>
      </div>
    </>
  );
};

/* ==========================================================================
   LEAD DOVE SVG VECTOR ARTWORK
   Crisp ivory/white feathers, emerald & slate outlines, warm gold beak,
   olive twig of peace, and natural animated wing paths.
   ========================================================================== */
interface LeadDoveSvgProps {
  isFlying: boolean;
  isFluttering: boolean;
}

const LeadDoveSvg: React.FC<LeadDoveSvgProps> = ({ isFlying, isFluttering }) => {
  return (
    <svg
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="w-full h-full overflow-visible"
      style={{
        filter:
          'drop-shadow(0 6px 14px rgba(16, 185, 129, 0.22)) drop-shadow(0 2px 4px rgba(51, 65, 85, 0.12))',
      }}
    >
      <defs>
        {/* Soft Ivory/White feather body gradient */}
        <linearGradient id="leadDoveBody" x1="15%" y1="10%" x2="85%" y2="90%">
          <stop offset="0%" stopColor="#FFFFFF" />
          <stop offset="60%" stopColor="#F8FAFC" />
          <stop offset="100%" stopColor="#F1F5F9" />
        </linearGradient>

        {/* Wing gradient for subtle depth */}
        <linearGradient id="leadDoveWing" x1="20%" y1="10%" x2="80%" y2="90%">
          <stop offset="0%" stopColor="#FFFFFF" />
          <stop offset="55%" stopColor="#F8FAFC" />
          <stop offset="100%" stopColor="#E2E8F0" />
        </linearGradient>

        {/* Gentle breast light reflection */}
        <linearGradient id="leadDoveChest" x1="0%" y1="0%" x2="100%" y2="50%">
          <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.9" />
          <stop offset="100%" stopColor="#ECFDF5" stopOpacity="0.4" />
        </linearGradient>

        {/* Warm gold beak gradient */}
        <linearGradient id="leadDoveGold" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#FBBF24" />
          <stop offset="100%" stopColor="#D97706" />
        </linearGradient>

        {/* Emerald olive twig gradient */}
        <linearGradient id="leadDoveEmerald" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#34D399" />
          <stop offset="100%" stopColor="#059669" />
        </linearGradient>
      </defs>

      {/* 1. FAR WING (Shown in flight or when fluttering) */}
      {(isFlying || isFluttering) && (
        <g className="animate-dove-flap-far" style={{ transformOrigin: '26px 28px' }}>
          <path
            d="M24 26 C21 16 16 7 7 3 C10 11 15 19 21 26 C22 28 24 28 24 26 Z"
            fill="url(#leadDoveWing)"
            stroke="#0F766E"
            strokeWidth="1.1"
            strokeOpacity="0.6"
            strokeLinejoin="round"
          />
          {/* Feather quills on far wing */}
          <path
            d="M13 10 C16 16 19 21 22 25"
            stroke="#334155"
            strokeWidth="0.8"
            strokeOpacity="0.4"
            strokeLinecap="round"
          />
        </g>
      )}

      {/* 2. TAIL FEATHERS (Graceful spread to lower-left) */}
      <g>
        <path
          d="M19 44 C13 47 6 51 3 55 C5 56 9 56 14 53 C16 54 20 50 22 47 Z"
          fill="url(#leadDoveWing)"
          stroke="#0F766E"
          strokeWidth="1.15"
          strokeOpacity="0.65"
          strokeLinejoin="round"
        />
        {/* Tail feather splits */}
        <path
          d="M7 54 C11 51 16 47 19 45 M11 55 C14 52 18 48 20 46"
          stroke="#334155"
          strokeWidth="0.8"
          strokeOpacity="0.45"
          strokeLinecap="round"
        />
      </g>

      {/* 3. TINY GOLD CLAWS / FEET (Perched precisely on the bottom baseline y=57) */}
      <g stroke="#D97706" strokeWidth="1.4" strokeLinecap="round">
        {/* Left Foot */}
        <path d="M25 51 L25 56 M23 57 L25 56 L27 57" />
        {/* Right Foot */}
        <path d="M30 51 L30 56 M28 57 L30 56 L32 57" />
      </g>

      {/* 4. DOVE BODY & BREAST (Serene, elegant curve) */}
      <path
        d="M26 17 C29 14 34 14 36 17 C38 19 38 23 35 26 C40 30 42 36 40 43 C38 49 33 53 26 53 C21 53 18 49 19 43 C20 37 22 27 26 17 Z"
        fill="url(#leadDoveBody)"
        stroke="#0F766E"
        strokeWidth="1.25"
        strokeOpacity="0.65"
        strokeLinejoin="round"
      />

      {/* Subtle chest highlight */}
      <path
        d="M27 22 C31 22 35 25 36 30 C37 36 35 44 28 48 C24 46 22 40 23 34 C24 28 25 23 27 22 Z"
        fill="url(#leadDoveChest)"
      />

      {/* 5. HEAD & EYE WITH GENTLE ANIMATED TILT */}
      <g className={!isFlying ? 'animate-dove-head' : ''} style={{ transformOrigin: '32px 18px' }}>
        {/* Crown highlight */}
        <path
          d="M27 16 C30 14 33 14 35 16"
          stroke="#FFFFFF"
          strokeWidth="1.5"
          strokeLinecap="round"
        />

        {/* Warm Gold Beak */}
        <path
          d="M36 18.5 L44 20.5 L36 22.5 Z"
          fill="url(#leadDoveGold)"
          stroke="#B45309"
          strokeWidth="0.8"
          strokeLinejoin="round"
        />

        {/* Eye (Slate Pupil with Gold Rim & White Catchlight) */}
        <circle cx="32" cy="18" r="1.8" fill="#D97706" />
        <circle cx="32" cy="18" r="1.3" fill="#1E293B" />
        <circle cx="32.4" cy="17.6" r="0.45" fill="#FFFFFF" />

        {/* Emerald Olive Leaf & Twig (Symbol of Peace / "Pura") */}
        <g>
          {/* Stem */}
          <path
            d="M42 21 C45 22 47 21 50 19"
            stroke="#059669"
            strokeWidth="0.9"
            strokeLinecap="round"
          />
          {/* Leaf 1 */}
          <path
            d="M45 21 C47 18 50 18 49 21 C48 23 46 23 45 21 Z"
            fill="url(#leadDoveEmerald)"
            stroke="#047857"
            strokeWidth="0.5"
          />
          {/* Leaf 2 */}
          <path
            d="M48 20 C51 19 53 21 51 23 C49 24 48 22 48 20 Z"
            fill="url(#leadDoveEmerald)"
            stroke="#047857"
            strokeWidth="0.5"
          />
        </g>
      </g>

      {/* 6. NEAR WING (Folded when perched, Flapping when flying) */}
      {!isFlying && !isFluttering ? (
        /* Folded Perched Wing */
        <g>
          <path
            d="M26 26 C33 26 37 31 36 38 C35 45 29 49 20 50 C18 47 19 42 22 36 C24 30 25 27 26 26 Z"
            fill="url(#leadDoveWing)"
            stroke="#0F766E"
            strokeWidth="1.2"
            strokeOpacity="0.65"
            strokeLinejoin="round"
          />
          {/* Wing Feather Quills & Scapulars */}
          <path
            d="M25 31 C29 36 28 41 26 44 M22 36 C26 40 24 44 22 47 M29 33 C33 37 32 41 30 45"
            stroke="#334155"
            strokeWidth="0.85"
            strokeOpacity="0.5"
            strokeLinecap="round"
          />
        </g>
      ) : (
        /* Flying Near Wing with Flap Animation */
        <g className="animate-dove-flap-near" style={{ transformOrigin: '32px 30px' }}>
          <path
            d="M27 29 C30 19 38 7 51 3 C49 10 43 20 37 28 C34 32 31 34 27 36 C25 34 25 31 27 29 Z"
            fill="url(#leadDoveWing)"
            stroke="#0F766E"
            strokeWidth="1.25"
            strokeOpacity="0.65"
            strokeLinejoin="round"
          />
          {/* Primary flight feather separations */}
          <path
            d="M51 3 C47 7 43 12 39 18 M47 7 C43 12 39 17 36 22 M43 12 C39 17 36 22 33 27"
            stroke="#334155"
            strokeWidth="0.9"
            strokeOpacity="0.45"
            strokeLinecap="round"
          />
        </g>
      )}
    </svg>
  );
};

/* ==========================================================================
   COMPANION FLOCK DOVE SVG
   Graceful flying dove silhouette with wing flapping for the 5-flock formation.
   ========================================================================== */
interface CompanionDoveSvgProps {
  size: number;
  wingDelay?: string;
  opacity?: number;
}

const CompanionDoveSvg: React.FC<CompanionDoveSvgProps> = ({ size, opacity = 0.9 }) => {
  return (
    <svg
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      style={{
        opacity,
        filter:
          'drop-shadow(0 4px 10px rgba(16, 185, 129, 0.18)) drop-shadow(0 1px 3px rgba(51, 65, 85, 0.12))',
      }}
    >
      <defs>
        <linearGradient id={`flockGrad-${size}`} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#FFFFFF" />
          <stop offset="65%" stopColor="#F8FAFC" />
          <stop offset="100%" stopColor="#E2E8F0" />
        </linearGradient>
      </defs>

      {/* Far Wing */}
      <g className="animate-dove-flap-far" style={{ transformOrigin: '26px 28px' }}>
        <path
          d="M24 26 C21 16 16 7 7 3 C10 11 15 19 21 26 Z"
          fill={`url(#flockGrad-${size})`}
          stroke="#0F766E"
          strokeWidth="1"
          strokeOpacity="0.5"
        />
      </g>

      {/* Body & Tail */}
      <path
        d="M18 43 C12 46 6 50 3 53 C6 54 11 53 15 50 C18 46 22 36 26 17 C29 14 34 14 36 17 C38 19 38 23 35 26 C40 30 42 36 40 43 C37 49 31 52 25 52 C20 52 18 48 18 43 Z"
        fill={`url(#flockGrad-${size})`}
        stroke="#0F766E"
        strokeWidth="1.1"
        strokeOpacity="0.55"
      />

      {/* Beak & Eye */}
      <path d="M36 19 L42 20.5 L36 22 Z" fill="#D97706" />
      <circle cx="32" cy="18" r="1.2" fill="#1E293B" />

      {/* Near Wing */}
      <g className="animate-dove-flap-near" style={{ transformOrigin: '32px 30px' }}>
        <path
          d="M27 29 C30 19 38 7 51 3 C49 10 43 20 37 28 C34 32 31 34 27 36 Z"
          fill={`url(#flockGrad-${size})`}
          stroke="#0F766E"
          strokeWidth="1.15"
          strokeOpacity="0.6"
        />
      </g>
    </svg>
  );
};

export default FlyingDovePerch;
