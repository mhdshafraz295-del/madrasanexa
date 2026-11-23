import React, { useState, useEffect, useRef, useCallback } from 'react';

interface DoveCoords {
  x: number;
  y: number;
  visible: boolean;
}

interface FeatherState {
  id: number;
  startX: number;
  startY: number;
  targetAnchor: string;
}

export const FlyingDovePerch: React.FC = () => {
  // Flight phase: 'flock-entrance' (0s-5.8s) -> 'perched' -> 'transitioning' (between sections)
  const [phase, setPhase] = useState<'flock-entrance' | 'transitioning' | 'perched'>('flock-entrance');
  const [activeAnchor, setActiveAnchor] = useState<string>('hero');
  const [coords, setCoords] = useState<DoveCoords>({ x: -100, y: -100, visible: false });
  const [facing, setFacing] = useState<1 | -1>(-1); // -1 = facing left (traveling right-to-left), 1 = facing right
  const [isFluttering, setIsFluttering] = useState(false);
  const [showSparkle, setShowSparkle] = useState(false);
  const [activeFeather, setActiveFeather] = useState<FeatherState | null>(null);
  const [underlinedAnchor, setUnderlinedAnchor] = useState<string | null>(null);
  const [flockActive, setFlockActive] = useState(true);

  const prevCoordsRef = useRef<DoveCoords>({ x: -100, y: -100, visible: false });
  const activeAnchorRef = useRef<string>('hero');
  const phaseRef = useRef<'flock-entrance' | 'transitioning' | 'perched'>('flock-entrance');
  const transitionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const flutterTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Helper to compute perch coordinate relative to a heading element's getBoundingClientRect()
  const getPerchCoordsForElement = useCallback((el: HTMLElement): { x: number; y: number } => {
    const rect = el.getBoundingClientRect();
    const isMobile = window.innerWidth < 640;
    const doveHeight = isMobile ? 44 : 54;
    // Perch right on top edge of the heading text (offset so feet touch the letter stroke)
    const targetY = rect.top - doveHeight + 8;
    // For hero, perch on "M"; for centered headings, perch on the left-center of the heading
    const targetX = rect.left + (el.getAttribute('data-dove-perch') === 'hero' ? 6 : Math.min(20, rect.width * 0.08));
    return { x: targetX, y: targetY };
  }, []);

  // Trigger drifting feather & glowing underline effect
  const triggerFeatherUnderline = useCallback((anchorId: string, perchX: number, perchY: number) => {
    setActiveFeather({
      id: Date.now(),
      startX: perchX + 16,
      startY: perchY + 32,
      targetAnchor: anchorId,
    });
    setShowSparkle(true);
    setUnderlinedAnchor(anchorId);

    setTimeout(() => {
      setShowSparkle(false);
    }, 1000);

    // Remove feather once drift animation ends (1.8s)
    setTimeout(() => {
      setActiveFeather((prev) => (prev?.targetAnchor === anchorId ? null : prev));
    }, 2000);
  }, []);

  // INITIAL 5.8s FLOCK ENTRANCE OR REDUCED MOTION
  useEffect(() => {
    phaseRef.current = 'flock-entrance';
    activeAnchorRef.current = 'hero';

    const prefersReducedMotion =
      typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (prefersReducedMotion) {
      setPhase('perched');
      phaseRef.current = 'perched';
      setFlockActive(false);
      setFacing(1);
      // Immediately place on hero
      const heroEl = document.querySelector<HTMLElement>('[data-dove-perch="hero"]');
      if (heroEl) {
        const p = getPerchCoordsForElement(heroEl);
        setCoords({ x: p.x, y: p.y, visible: true });
        prevCoordsRef.current = { x: p.x, y: p.y, visible: true };
        setUnderlinedAnchor('hero');
      }
      return;
    }

    // Set initial start position at upper-right
    const startX = Math.min(window.innerWidth * 0.88, window.innerWidth - 60);
    const startY = 30;
    setCoords({ x: startX, y: startY, visible: true });
    prevCoordsRef.current = { x: startX, y: startY, visible: true };
    setFacing(-1); // Flying right-to-left towards Hero H1

    // 100ms delay to trigger smooth CSS transition to Hero H1 over 5.8s
    const flightStartTimer = setTimeout(() => {
      const heroEl = document.querySelector<HTMLElement>('[data-dove-perch="hero"]');
      if (heroEl) {
        const p = getPerchCoordsForElement(heroEl);
        setCoords({ x: p.x, y: p.y, visible: true });
        prevCoordsRef.current = { x: p.x, y: p.y, visible: true };
      }
    }, 120);

    // At 5.8s: Touchdown on "Manage Your Madrasa Smarter."
    const touchdownTimer = setTimeout(() => {
      setPhase('perched');
      phaseRef.current = 'perched';
      setFacing(1); // Perched facing inwards toward the headline
      const heroEl = document.querySelector<HTMLElement>('[data-dove-perch="hero"]');
      if (heroEl) {
        const p = getPerchCoordsForElement(heroEl);
        setCoords({ x: p.x, y: p.y, visible: true });
        prevCoordsRef.current = { x: p.x, y: p.y, visible: true };
        triggerFeatherUnderline('hero', p.x, p.y);
      }
    }, 5800);

    // At 6.8s: Unmount companion flock overlay to free up DOM & GPU resources
    const flockTimer = setTimeout(() => {
      setFlockActive(false);
    }, 6800);

    return () => {
      clearTimeout(flightStartTimer);
      clearTimeout(touchdownTimer);
      clearTimeout(flockTimer);
    };
  }, [getPerchCoordsForElement, triggerFeatherUnderline]);

  // SCROLL & RESIZE TRACKING: Dynamic perching & section-to-section flight
  useEffect(() => {
    let rafId: number | null = null;

    const handleScrollOrResize = () => {
      if (rafId !== null) return;
      rafId = requestAnimationFrame(() => {
        rafId = null;

        // Skip during initial 5.8s entrance
        if (phaseRef.current === 'flock-entrance') return;

        const anchors = Array.from(document.querySelectorAll<HTMLElement>('[data-dove-perch]'));
        if (anchors.length === 0) return;

        // Find which heading is in the active reading viewport zone (20% to 55% from top)
        const vh = window.innerHeight;
        const targetZoneTop = vh * 0.18;
        const targetZoneBottom = vh * 0.58;

        let bestAnchor: HTMLElement | null = null;
        let minDistance = Infinity;

        for (const el of anchors) {
          const rect = el.getBoundingClientRect();
          // Check if top is within viewport
          if (rect.top >= -50 && rect.top <= vh) {
            const center = rect.top + rect.height / 2;
            const dist = Math.abs(center - (targetZoneTop + targetZoneBottom) / 2);
            if (dist < minDistance) {
              minDistance = dist;
              bestAnchor = el;
            }
          }
        }

        // Default to hero if at top of page
        if (!bestAnchor && window.scrollY < 200) {
          bestAnchor = anchors.find((a) => a.getAttribute('data-dove-perch') === 'hero') || anchors[0];
        }

        if (!bestAnchor) return;

        const newAnchorId = bestAnchor.getAttribute('data-dove-perch') || 'hero';
        const p = getPerchCoordsForElement(bestAnchor);

        // If target changed to another section
        if (newAnchorId !== activeAnchorRef.current) {
          const oldX = prevCoordsRef.current.x;
          const deltaX = p.x - oldX;

          activeAnchorRef.current = newAnchorId;
          setActiveAnchor(newAnchorId);
          setPhase('transitioning');
          phaseRef.current = 'transitioning';

          // ALWAYS point head/beak in the exact direction of travel!
          // If moving left (deltaX < 0), face left (-1); if moving right (deltaX >= 0), face right (1)
          setFacing(deltaX < -10 ? -1 : 1);

          // Fly smoothly to new section coordinates (1.4s glide)
          setCoords({ x: p.x, y: p.y, visible: true });
          prevCoordsRef.current = { x: p.x, y: p.y, visible: true };

          if (transitionTimerRef.current) clearTimeout(transitionTimerRef.current);
          transitionTimerRef.current = setTimeout(() => {
            setPhase('perched');
            phaseRef.current = 'perched';
            setFacing(1); // Perched resting pose facing inward
            triggerFeatherUnderline(newAnchorId, p.x, p.y);
          }, 1400);
        } else if (phaseRef.current === 'perched') {
          // Keep dove locked to heading as user scrolls
          const isVisible = p.y >= -60 && p.y <= vh + 20;
          setCoords({ x: p.x, y: p.y, visible: isVisible });
          prevCoordsRef.current = { x: p.x, y: p.y, visible: isVisible };
        }
      });
    };

    window.addEventListener('scroll', handleScrollOrResize, { passive: true });
    window.addEventListener('resize', handleScrollOrResize, { passive: true });

    return () => {
      window.removeEventListener('scroll', handleScrollOrResize);
      window.removeEventListener('resize', handleScrollOrResize);
      if (rafId !== null) cancelAnimationFrame(rafId);
      if (transitionTimerRef.current) clearTimeout(transitionTimerRef.current);
    };
  }, [getPerchCoordsForElement, triggerFeatherUnderline]);

  // Handle user hover/click on the perched dove
  const handleDoveInteraction = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (phase !== 'perched' || isFluttering) return;
    setIsFluttering(true);
    setShowSparkle(true);
    if (flutterTimerRef.current) clearTimeout(flutterTimerRef.current);
    flutterTimerRef.current = setTimeout(() => {
      setIsFluttering(false);
      setShowSparkle(false);
    }, 650);
  };

  const isFlying = phase === 'flock-entrance' || phase === 'transitioning';

  return (
    <>
      {/* 1. FULL-VIEWPORT OVERLAY CONTAINER (NEVER CLIPPED BY NAVBAR OR SECTIONS) */}
      <div
        aria-hidden="true"
        className="fixed inset-0 pointer-events-none z-40 overflow-hidden"
      >
        {/* 2. COMPANION FLOCK (5 Doves gliding across hero over 5.8s, forward-facing scaleX(-1)) */}
        {flockActive && (
          <div className="absolute inset-0 pointer-events-none overflow-hidden">
            {/* Flock Dove 1: 52px */}
            <div className="absolute top-2 left-0 w-[52px] h-[52px] animate-flock-1" style={{ transform: 'scaleX(-1)' }}>
              <CompanionDoveSvg size={52} opacity={0.92} />
            </div>

            {/* Flock Dove 2: 48px */}
            <div className="absolute top-10 left-0 w-[48px] h-[48px] animate-flock-2" style={{ transform: 'scaleX(-1)' }}>
              <CompanionDoveSvg size={48} opacity={0.88} />
            </div>

            {/* Flock Dove 3: 46px */}
            <div className="absolute top-3 left-0 w-[46px] h-[46px] animate-flock-3" style={{ transform: 'scaleX(-1)' }}>
              <CompanionDoveSvg size={46} opacity={0.85} />
            </div>

            {/* Flock Dove 4: 50px */}
            <div className="absolute top-16 left-0 w-[50px] h-[50px] animate-flock-4" style={{ transform: 'scaleX(-1)' }}>
              <CompanionDoveSvg size={50} opacity={0.88} />
            </div>

            {/* Flock Dove 5: 44px */}
            <div className="absolute top-8 left-0 w-[44px] h-[44px] animate-flock-5" style={{ transform: 'scaleX(-1)' }}>
              <CompanionDoveSvg size={44} opacity={0.82} />
            </div>
          </div>
        )}

        {/* 3. DRIFTING WHITE & GOLD FEATHER ANIMATION */}
        {activeFeather && (
          <div
            className="absolute pointer-events-none animate-feather-drift z-30"
            style={{
              top: `${activeFeather.startY}px`,
              left: `${activeFeather.startX}px`,
            }}
          >
            <DriftingFeatherSvg />
          </div>
        )}

        {/* 4. LEAD PERCHING DOVE ("PURA") WITH FORWARD-FACING PHYSICS */}
        {coords.visible && (
          <div
            className={`absolute transition-all duration-300 ${
              isFlying
                ? 'pointer-events-none'
                : 'pointer-events-auto cursor-pointer'
            }`}
            style={{
              top: `${coords.y}px`,
              left: `${coords.x}px`,
              transition:
                phase === 'flock-entrance'
                  ? 'top 5.8s cubic-bezier(0.25, 0.85, 0.35, 1), left 5.8s cubic-bezier(0.25, 0.85, 0.35, 1)'
                  : phase === 'transitioning'
                  ? 'top 1.4s cubic-bezier(0.25, 0.85, 0.35, 1), left 1.4s cubic-bezier(0.25, 0.85, 0.35, 1)'
                  : 'top 0.05s ease-out, left 0.05s ease-out',
              transformOrigin: 'bottom center',
            }}
            onClick={handleDoveInteraction}
            onMouseEnter={handleDoveInteraction}
            title="🕊️ Pura — Islamic Symbol of Peace, Purity & Barakah"
            role="img"
            aria-label={`Graceful White Dove perched on ${activeAnchor}`}
            data-active-perch={activeAnchor}
          >
            {/* Dynamic facing direction: scaleX(-1) when flying left, scaleX(1) when facing right */}
            <div
              className={`relative transition-transform duration-300 ${
                isFluttering
                  ? 'animate-dove-flutter'
                  : phase === 'perched'
                  ? 'animate-dove-breath'
                  : ''
              }`}
              style={{
                transform: `scaleX(${facing})`,
                transformOrigin: 'bottom center',
              }}
            >
              {/* Soft Perch Glow & Sparkle */}
              {showSparkle && (
                <div
                  className="pointer-events-none absolute bottom-1 left-1/2 -translate-x-1/2 w-9 h-9 rounded-full border border-emerald-400/90 bg-gradient-to-r from-emerald-400/30 via-amber-300/25 to-teal-400/30 animate-dove-sparkle z-0"
                  style={{ filter: 'blur(0.5px)' }}
                />
              )}

              {/* Ambient landing shadow glow */}
              <div
                className="pointer-events-none absolute -bottom-1 left-1/2 -translate-x-1/2 w-8 h-2 rounded-full bg-emerald-500/25 blur-[3px]"
                aria-hidden="true"
              />

              {/* Scaled Lead Dove SVG: 58px x 58px (Desktop) / 46px x 46px (Mobile) */}
              <div className="w-[46px] h-[46px] sm:w-[58px] sm:h-[58px] relative z-10">
                <LeadDoveSvg isFlying={isFlying} isFluttering={isFluttering} />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 5. DYNAMIC EMERALD-GOLD UNDERLINE SYNCED WITH ACTIVE PERCH */}
      <HeadingUnderlineSync activeAnchor={underlinedAnchor} />
    </>
  );
};

/* ==========================================================================
   HEADING UNDERLINE COMPONENT
   Attaches a smooth emerald-to-gold glowing underline underneath the active
   section heading whenever the dove touches down.
   ========================================================================== */
const HeadingUnderlineSync: React.FC<{ activeAnchor: string | null }> = ({ activeAnchor }) => {
  useEffect(() => {
    if (!activeAnchor) return;
    const targetEl = document.querySelector<HTMLElement>(`[data-dove-perch="${activeAnchor}"]`);
    if (!targetEl) return;

    // Check if an existing underline element already exists
    let lineEl = targetEl.querySelector<HTMLElement>('.dove-underlined-bar');
    if (!lineEl) {
      lineEl = document.createElement('div');
      lineEl.className =
        'dove-underlined-bar absolute -bottom-1.5 left-0 w-full h-[3px] bg-gradient-to-r from-emerald-500 via-teal-400 via-amber-300 to-emerald-500 rounded-full shadow-[0_0_10px_rgba(16,185,129,0.5)] animate-heading-underline pointer-events-none z-10';
      targetEl.classList.add('relative');
      targetEl.appendChild(lineEl);
    } else {
      // Re-trigger animation
      lineEl.classList.remove('animate-heading-underline');
      void lineEl.offsetWidth; // Force reflow
      lineEl.classList.add('animate-heading-underline');
    }
  }, [activeAnchor]);

  return null;
};

/* ==========================================================================
   DRIFTING FEATHER SVG (White & Gold delicate feather)
   ========================================================================== */
const DriftingFeatherSvg: React.FC = () => {
  return (
    <svg
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="w-7 h-7 overflow-visible"
      style={{
        filter: 'drop-shadow(0 4px 8px rgba(16, 185, 129, 0.25)) drop-shadow(0 1px 3px rgba(217, 119, 6, 0.2))',
      }}
    >
      <defs>
        <linearGradient id="featherGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#FFFFFF" />
          <stop offset="60%" stopColor="#F8FAFC" />
          <stop offset="100%" stopColor="#FEF3C7" />
        </linearGradient>
      </defs>
      {/* Delicate Feather Vane */}
      <path
        d="M6 26 C8 20 14 10 26 4 C24 10 20 18 12 24 C10 26 8 26 6 26 Z"
        fill="url(#featherGrad)"
        stroke="#0F766E"
        strokeWidth="0.8"
        strokeOpacity="0.6"
      />
      {/* Vane Feather Splits */}
      <path
        d="M10 20 C14 17 18 13 22 8 M12 23 C16 19 19 15 22 11"
        stroke="#D97706"
        strokeWidth="0.6"
        strokeOpacity="0.65"
        strokeLinecap="round"
      />
      {/* Golden Quill Shaft */}
      <path
        d="M4 28 C8 24 16 14 27 3"
        stroke="#D97706"
        strokeWidth="1"
        strokeLinecap="round"
      />
    </svg>
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
        /* Flying Near Wing with 0.55s Flap Animation */
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
