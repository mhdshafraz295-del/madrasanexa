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
  stage: 'air-sway' | 'drawing-sweep';
}

export const FlyingDovePerch: React.FC = () => {
  // Flight phases: 'flock-entrance' (0s-5.8s) -> 'perched' -> 'transitioning' (between sections)
  const [phase, setPhase] = useState<'flock-entrance' | 'transitioning' | 'perched'>('flock-entrance');
  const [activeAnchor, setActiveAnchor] = useState<string>('hero');
  const [coords, setCoords] = useState<DoveCoords>({ x: -100, y: -100, visible: false });
  // Natural pose of vector dove faces LEFT:
  // facing = 1 means facing LEFT (scaleX(1))
  // facing = -1 means facing RIGHT (scaleX(-1))
  const [facing, setFacing] = useState<1 | -1>(1);
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
  const featherTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Helper to compute perch coordinate relative to a heading element's getBoundingClientRect()
  const getPerchCoordsForElement = useCallback((el: HTMLElement): { x: number; y: number } => {
    const rect = el.getBoundingClientRect();
    const isMobile = window.innerWidth < 640;
    const doveHeight = isMobile ? 50 : 64;
    // Perch right on top edge of the heading text (offset so feet touch the letter stroke)
    const targetY = rect.top - doveHeight + 10;
    const anchorId = el.getAttribute('data-dove-perch');
    // For hero, perch on "M"; for footer, perch on brand; for centered headings, perch left-center
    const targetX =
      anchorId === 'hero'
        ? rect.left + 4
        : anchorId === 'footer'
        ? rect.left + 8
        : rect.left + Math.min(24, rect.width * 0.08);
    return { x: targetX, y: targetY };
  }, []);

  // Trigger drifting 40px feather & glowing underline sweep
  const triggerFeatherUnderline = useCallback((anchorId: string, perchX: number, perchY: number) => {
    // Stage 1: Air sway downward (1.1s)
    setActiveFeather({
      id: Date.now(),
      startX: perchX + 18,
      startY: perchY + 36,
      targetAnchor: anchorId,
      stage: 'air-sway',
    });
    setShowSparkle(true);

    if (featherTimerRef.current) clearTimeout(featherTimerRef.current);

    // Stage 2: Sweep left-to-right drawing underline (1.0s)
    featherTimerRef.current = setTimeout(() => {
      setActiveFeather((prev) => (prev && prev.targetAnchor === anchorId ? { ...prev, stage: 'drawing-sweep' } : prev));
      setUnderlinedAnchor(anchorId);
      setShowSparkle(false);

      // Finish feather animation
      setTimeout(() => {
        setActiveFeather((prev) => (prev?.targetAnchor === anchorId ? null : prev));
      }, 1000);
    }, 1100);
  }, []);

  // INITIAL 5.8s FLOCK ENTRANCE IN OPEN HERO SKY (top: 150px-270px)
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
      const heroEl = document.querySelector<HTMLElement>('[data-dove-perch="hero"]');
      if (heroEl) {
        const p = getPerchCoordsForElement(heroEl);
        setCoords({ x: p.x, y: p.y, visible: true });
        prevCoordsRef.current = { x: p.x, y: p.y, visible: true };
        setUnderlinedAnchor('hero');
      }
      return;
    }

    // Lead dove start point: upper-right open hero sky (top: 180px, well below navbar and Quran marquee)
    const startX = Math.min(window.innerWidth * 0.88, window.innerWidth - 70);
    const startY = 180;
    setCoords({ x: startX, y: startY, visible: true });
    prevCoordsRef.current = { x: startX, y: startY, visible: true };
    // Flying right-to-left: natural head-left pose requires scaleX(1)
    setFacing(1);

    // Smoothly fly towards Hero H1 over 5.8s
    const flightStartTimer = setTimeout(() => {
      const heroEl = document.querySelector<HTMLElement>('[data-dove-perch="hero"]');
      if (heroEl) {
        const p = getPerchCoordsForElement(heroEl);
        setCoords({ x: p.x, y: p.y, visible: true });
        prevCoordsRef.current = { x: p.x, y: p.y, visible: true };
      }
    }, 100);

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
      if (featherTimerRef.current) clearTimeout(featherTimerRef.current);
    };
  }, [getPerchCoordsForElement, triggerFeatherUnderline]);

  // CONTINUOUS SCROLL TRACKING OVER ALL SECTION ANCHORS (HERO TO FOOTER)
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

        // Select anchor closest to window.innerHeight * 0.38
        const targetLine = window.innerHeight * 0.38;
        let bestAnchor: HTMLElement | null = null;
        let minDistance = Infinity;

        for (const el of anchors) {
          const rect = el.getBoundingClientRect();
          if (rect.top >= -80 && rect.top <= window.innerHeight) {
            const center = rect.top + rect.height / 2;
            const dist = Math.abs(center - targetLine);
            if (dist < minDistance) {
              minDistance = dist;
              bestAnchor = el;
            }
          }
        }

        // Default to hero at the top, or footer at the bottom of the page
        if (!bestAnchor) {
          if (window.scrollY < 200) {
            bestAnchor = anchors.find((a) => a.getAttribute('data-dove-perch') === 'hero') || anchors[0];
          } else if (window.innerHeight + window.scrollY >= document.body.offsetHeight - 250) {
            bestAnchor = anchors.find((a) => a.getAttribute('data-dove-perch') === 'footer') || anchors[anchors.length - 1];
          }
        }

        if (!bestAnchor) return;

        const newAnchorId = bestAnchor.getAttribute('data-dove-perch') || 'hero';
        const p = getPerchCoordsForElement(bestAnchor);

        // Section transition flight (1.1s curved glide)
        if (newAnchorId !== activeAnchorRef.current) {
          const oldX = prevCoordsRef.current.x;
          const deltaX = p.x - oldX;

          activeAnchorRef.current = newAnchorId;
          setActiveAnchor(newAnchorId);
          setPhase('transitioning');
          phaseRef.current = 'transitioning';

          // Forward-facing flight:
          // Natural SVG faces LEFT:
          // If deltaX <= 0 (moving left): scaleX(1)
          // If deltaX > 0 (moving right): scaleX(-1)
          setFacing(deltaX <= 0 ? 1 : -1);

          setCoords({ x: p.x, y: p.y, visible: true });
          prevCoordsRef.current = { x: p.x, y: p.y, visible: true };

          if (transitionTimerRef.current) clearTimeout(transitionTimerRef.current);
          transitionTimerRef.current = setTimeout(() => {
            setPhase('perched');
            phaseRef.current = 'perched';
            setFacing(1); // Perched resting pose
            triggerFeatherUnderline(newAnchorId, p.x, p.y);
          }, 1100);
        } else if (phaseRef.current === 'perched') {
          // Keep dove locked cleanly onto heading as user scrolls
          const isVisible = p.y >= -70 && p.y <= window.innerHeight + 30;
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
      {/* 1. FULL-VIEWPORT OVERLAY CONTAINER (NEVER CLIPPED) */}
      <div
        aria-hidden="true"
        className="fixed inset-0 pointer-events-none z-40 overflow-hidden"
      >
        {/* 2. COMPANION FLOCK (5 Doves gliding across hero sky at top: 160px-260px over 5.8s) */}
        {flockActive && (
          <div className="absolute inset-0 pointer-events-none overflow-hidden">
            {/* Flock Dove 1: 56px at top: 160px */}
            <div className="absolute top-[160px] left-0 w-[56px] h-[56px] animate-flock-1">
              <CompanionDoveSvg size={56} opacity={0.92} />
            </div>

            {/* Flock Dove 2: 52px at top: 210px */}
            <div className="absolute top-[210px] left-0 w-[52px] h-[52px] animate-flock-2">
              <CompanionDoveSvg size={52} opacity={0.88} />
            </div>

            {/* Flock Dove 3: 48px at top: 175px */}
            <div className="absolute top-[175px] left-0 w-[48px] h-[48px] animate-flock-3">
              <CompanionDoveSvg size={48} opacity={0.85} />
            </div>

            {/* Flock Dove 4: 54px at top: 250px */}
            <div className="absolute top-[250px] left-0 w-[54px] h-[54px] animate-flock-4">
              <CompanionDoveSvg size={54} opacity={0.88} />
            </div>

            {/* Flock Dove 5: 50px at top: 230px */}
            <div className="absolute top-[230px] left-0 w-[50px] h-[50px] animate-flock-5">
              <CompanionDoveSvg size={50} opacity={0.82} />
            </div>
          </div>
        )}

        {/* 3. PROMINENT 40px x 40px DRIFTING QUILL FEATHER (Air-Sway & Drawing Sweep) */}
        {activeFeather && (
          <div
            className={`absolute pointer-events-none z-45 ${
              activeFeather.stage === 'air-sway' ? 'animate-feather-air' : 'animate-feather-sweep'
            }`}
            style={{
              top: `${activeFeather.startY}px`,
              left: `${activeFeather.startX}px`,
            }}
          >
            <DriftingQuillFeatherSvg />
          </div>
        )}

        {/* 4. LEAD PERCHING DOVE ("PURA") WITH DETAILED MULTI-LAYER VECTOR ARTWORK */}
        {coords.visible && (
          <div
            className={`absolute transition-all duration-300 ${
              isFlying ? 'pointer-events-none' : 'pointer-events-auto cursor-pointer'
            }`}
            style={{
              top: `${coords.y}px`,
              left: `${coords.x}px`,
              transition:
                phase === 'flock-entrance'
                  ? 'top 5.8s cubic-bezier(0.25, 0.85, 0.35, 1), left 5.8s cubic-bezier(0.25, 0.85, 0.35, 1)'
                  : phase === 'transitioning'
                  ? 'top 1.1s cubic-bezier(0.25, 0.85, 0.35, 1), left 1.1s cubic-bezier(0.25, 0.85, 0.35, 1)'
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
            {/* Dynamic forward-facing orientation */}
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
                  className="pointer-events-none absolute bottom-1 left-1/2 -translate-x-1/2 w-10 h-10 rounded-full border border-emerald-400/90 bg-gradient-to-r from-emerald-400/30 via-amber-300/25 to-teal-400/30 animate-dove-sparkle z-0"
                  style={{ filter: 'blur(0.5px)' }}
                />
              )}

              {/* Ambient landing shadow glow */}
              <div
                className="pointer-events-none absolute -bottom-1 left-1/2 -translate-x-1/2 w-9 h-2.5 rounded-full bg-emerald-600/25 blur-[3px]"
                aria-hidden="true"
              />

              {/* Scaled Lead Dove SVG: 64px x 64px (Desktop) / 50px x 50px (Mobile) */}
              <div className="w-[50px] h-[50px] sm:w-[64px] sm:h-[64px] relative z-10">
                <LeadSoaringDoveSvg isFlying={isFlying} isFluttering={isFluttering} />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 5. DYNAMIC 3.5px EMERALD-GOLD UNDERLINE SYNCED WITH ACTIVE HEADING */}
      <HeadingUnderlineSync activeAnchor={underlinedAnchor} />
    </>
  );
};

/* ==========================================================================
   HEADING UNDERLINE COMPONENT (3.5px Emerald-to-Gold Self-Drawing Underline)
   ========================================================================== */
const HeadingUnderlineSync: React.FC<{ activeAnchor: string | null }> = ({ activeAnchor }) => {
  useEffect(() => {
    if (!activeAnchor) return;
    const targetEl = document.querySelector<HTMLElement>(`[data-dove-perch="${activeAnchor}"]`);
    if (!targetEl) return;

    let lineEl = targetEl.querySelector<HTMLElement>('.dove-underlined-bar');
    if (!lineEl) {
      lineEl = document.createElement('div');
      lineEl.className =
        'dove-underlined-bar absolute -bottom-2 left-0 w-full h-[3.5px] bg-gradient-to-r from-emerald-500 via-teal-400 via-amber-400 to-emerald-500 rounded-full shadow-[0_0_12px_rgba(16,185,129,0.55)] animate-emerald-gold-line pointer-events-none z-10';
      targetEl.classList.add('relative');
      targetEl.appendChild(lineEl);
    } else {
      lineEl.classList.remove('animate-emerald-gold-line');
      void lineEl.offsetWidth; // Force reflow
      lineEl.classList.add('animate-emerald-gold-line');
    }
  }, [activeAnchor]);

  return null;
};

/* ==========================================================================
   PROMINENT 40px x 40px WHITE & GOLD QUILL FEATHER SVG
   ========================================================================== */
const DriftingQuillFeatherSvg: React.FC = () => {
  return (
    <svg
      viewBox="0 0 40 40"
      width={40}
      height={40}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="overflow-visible"
      style={{
        filter:
          'drop-shadow(0 6px 12px rgba(16, 185, 129, 0.35)) drop-shadow(0 2px 4px rgba(217, 119, 6, 0.25))',
      }}
    >
      <defs>
        <linearGradient id="featherQuillGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#FFFFFF" />
          <stop offset="45%" stopColor="#F8FAFC" />
          <stop offset="80%" stopColor="#FEF3C7" />
          <stop offset="100%" stopColor="#FDE68A" />
        </linearGradient>
        <linearGradient id="featherShaftGrad" x1="0%" y1="100%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#B45309" />
          <stop offset="50%" stopColor="#D97706" />
          <stop offset="100%" stopColor="#FCD34D" />
        </linearGradient>
      </defs>

      {/* Main Feather Vane */}
      <path
        d="M6 34 C9 26 18 13 34 5 C31 13 26 23 15 31 C12 33 9 34 6 34 Z"
        fill="url(#featherQuillGrad)"
        stroke="#0F766E"
        strokeWidth="1"
        strokeOpacity="0.65"
      />

      {/* Individual Vane Barbs / Feather Splits */}
      <path
        d="M12 26 C17 22 22 17 28 11 M15 29 C20 25 24 20 29 14 M9 23 C14 19 19 14 24 9"
        stroke="#D97706"
        strokeWidth="0.75"
        strokeOpacity="0.7"
        strokeLinecap="round"
      />

      {/* Golden Quill Shaft (Rachis) */}
      <path
        d="M4 36 C9 31 19 18 35 4"
        stroke="url(#featherShaftGrad)"
        strokeWidth="1.4"
        strokeLinecap="round"
      />

      {/* Calamus Quill Tip */}
      <path
        d="M4 36 L2 38"
        stroke="#B45309"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
};

/* ==========================================================================
   HIGH-DETAIL MULTI-LAYER SOARING WHITE DOVE SVG
   Modeled directly on the majestic soaring white dove reference image:
   - Natural Head-Left Soaring Pose
   - Articulated Wing Fingers (Primary & Secondary Feathers)
   - Warm Ivory-Taupe Shading (#ffffff -> #f5f0e6 -> #d6cbb8)
   - Crimson-Rose Eye & Textured Feet (#be123c / #d97706)
   - Fanned Articulated Tail Feathers
   - 100% Clean Vector, Zero Checkerboard / Watermarks
   ========================================================================== */
interface LeadDoveSvgProps {
  isFlying: boolean;
  isFluttering: boolean;
}

const LeadSoaringDoveSvg: React.FC<LeadDoveSvgProps> = ({ isFlying, isFluttering }) => {
  return (
    <svg
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="w-full h-full overflow-visible"
      style={{
        filter:
          'drop-shadow(0 8px 16px rgba(15, 118, 110, 0.25)) drop-shadow(0 2px 6px rgba(51, 65, 85, 0.16))',
      }}
    >
      <defs>
        {/* Ivory to Taupe Body Gradient */}
        <linearGradient id="soarBodyGrad" x1="20%" y1="20%" x2="70%" y2="90%">
          <stop offset="0%" stopColor="#FFFFFF" />
          <stop offset="50%" stopColor="#F8F6F0" />
          <stop offset="78%" stopColor="#EFE8D8" />
          <stop offset="100%" stopColor="#D8CCA8" />
        </linearGradient>

        {/* Near Wing Translucent Golden-Ivory Shading */}
        <linearGradient id="soarNearWingGrad" x1="10%" y1="10%" x2="90%" y2="90%">
          <stop offset="0%" stopColor="#FFFFFF" />
          <stop offset="40%" stopColor="#FAF7F0" />
          <stop offset="70%" stopColor="#EBDCB8" />
          <stop offset="100%" stopColor="#CFBE96" />
        </linearGradient>

        {/* Far Wing Crisp Ivory Gradient */}
        <linearGradient id="soarFarWingGrad" x1="10%" y1="10%" x2="80%" y2="100%">
          <stop offset="0%" stopColor="#FFFFFF" />
          <stop offset="55%" stopColor="#F5F1E6" />
          <stop offset="100%" stopColor="#D9CCA8" />
        </linearGradient>

        {/* Beak Gradient: Warm Amber with Crimson Base */}
        <linearGradient id="soarBeakGrad" x1="100%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#E11D48" />
          <stop offset="45%" stopColor="#F59E0B" />
          <stop offset="100%" stopColor="#D97706" />
        </linearGradient>

        {/* Crimson-Rose Feet Gradient */}
        <linearGradient id="soarFeetGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#E11D48" />
          <stop offset="60%" stopColor="#BE123C" />
          <stop offset="100%" stopColor="#881337" />
        </linearGradient>

        {/* Tail Feathers Gradient */}
        <linearGradient id="soarTailGrad" x1="30%" y1="30%" x2="90%" y2="90%">
          <stop offset="0%" stopColor="#FFFFFF" />
          <stop offset="60%" stopColor="#F6F1E3" />
          <stop offset="100%" stopColor="#D9CCA8" />
        </linearGradient>
      </defs>

      {/* ====================================================================
          1. FAR WING (Raised high in background, articulated primary fingers)
          ==================================================================== */}
      {(isFlying || isFluttering) && (
        <g className="animate-dove-flap-far" style={{ transformOrigin: '48px 45px' }}>
          {/* Main far wing shape with 7 articulated primary feather fingers */}
          <path
            d="M48 45 C44 32 38 18 36 6 C40 12 43 20 48 28 C52 14 53 10 57 14 C55 22 55 28 56 34 C60 22 64 16 68 20 C64 28 62 34 62 40 C67 30 71 26 75 30 C71 36 68 42 66 48 Z"
            fill="url(#soarFarWingGrad)"
            stroke="#0F766E"
            strokeWidth="1.1"
            strokeOpacity="0.6"
            strokeLinejoin="round"
          />
          {/* Individual feather quills */}
          <path
            d="M38 10 C41 18 45 28 48 38 M55 16 C54 24 54 32 55 40 M65 23 C62 30 60 38 60 44"
            stroke="#475569"
            strokeWidth="0.8"
            strokeOpacity="0.45"
            strokeLinecap="round"
          />
        </g>
      )}

      {/* ====================================================================
          2. FANNED ARTICULATED TAIL FEATHERS (Multi-tiered translucent spread)
          ==================================================================== */}
      <g>
        {/* Tier 1: Broad fanned tail feathers */}
        <path
          d="M58 72 C66 78 76 84 84 88 C82 89 77 90 70 85 C66 88 58 87 53 82 C55 79 57 76 58 72 Z"
          fill="url(#soarTailGrad)"
          stroke="#0F766E"
          strokeWidth="1.15"
          strokeOpacity="0.6"
          strokeLinejoin="round"
        />
        {/* Tier 2: Layered secondary tail fan */}
        <path
          d="M54 75 C62 82 72 88 78 91 C74 93 68 94 62 90 C58 92 52 90 48 84 Z"
          fill="url(#soarTailGrad)"
          stroke="#0F766E"
          strokeWidth="1.1"
          strokeOpacity="0.55"
        />
        {/* Tail feather splits and shafts */}
        <path
          d="M62 76 C70 82 78 87 82 89 M58 78 C65 84 72 89 75 92 M54 80 C60 85 66 89 68 92"
          stroke="#475569"
          strokeWidth="0.85"
          strokeOpacity="0.5"
          strokeLinecap="round"
        />
      </g>

      {/* ====================================================================
          3. SCULPTED BODY & UNDERBELLY (Smooth ivory breast & warm taupe shadow)
          ==================================================================== */}
      {/* Body mantle & breast */}
      <path
        d="M26 44 C20 48 18 52 20 54 C24 56 30 58 35 64 C42 72 50 76 58 73 C56 68 53 60 48 54 C42 46 34 42 26 44 Z"
        fill="url(#soarBodyGrad)"
        stroke="#0F766E"
        strokeWidth="1.25"
        strokeOpacity="0.65"
        strokeLinejoin="round"
      />

      {/* Head and throat curve (natural head-left pose) */}
      <path
        d="M18 52 C16 48 18 42 22 40 C26 38 30 40 32 44 C34 48 32 54 28 54 C24 54 20 54 18 52 Z"
        fill="#FFFFFF"
        stroke="#0F766E"
        strokeWidth="1.2"
        strokeOpacity="0.6"
      />

      {/* ====================================================================
          4. HEAD DETAILS: BEAK & RUBY-CRIMSON EYE
          ==================================================================== */}
      {/* Warm Amber Beak with Crimson Cere */}
      <path
        d="M17 50 L10 52 L16 54 Z"
        fill="url(#soarBeakGrad)"
        stroke="#B45309"
        strokeWidth="0.8"
        strokeLinejoin="round"
      />
      {/* Cere line */}
      <path d="M16 50 C17 51 17 53 16 54" stroke="#BE123C" strokeWidth="0.9" />

      {/* Ruby-Crimson Eye with dark pupil & white catchlight */}
      <circle cx="22" cy="45" r="2.2" fill="#BE123C" />
      <circle cx="22" cy="45" r="1.5" fill="#0F172A" />
      <circle cx="21.5" cy="44.4" r="0.55" fill="#FFFFFF" />

      {/* ====================================================================
          5. TEXTURED CRIMSON-ROSE TUCKED FEET (#be123c / #881337)
          ==================================================================== */}
      <g>
        {/* Left Foot claws */}
        <path
          d="M47 70 C46 74 47 78 49 80 M49 76 C50 79 52 81 54 81 M45 74 C45 78 46 80 47 82"
          stroke="url(#soarFeetGrad)"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {/* Right Foot claws */}
        <path
          d="M51 68 C51 72 52 76 54 78 M53 74 C55 77 57 79 59 79"
          stroke="url(#soarFeetGrad)"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </g>

      {/* ====================================================================
          6. NEAR WING (Broad Soaring Wing with Layered Flight Feathers)
          ==================================================================== */}
      {!isFlying && !isFluttering ? (
        /* Folded Perched Wing */
        <g>
          <path
            d="M32 46 C44 48 54 54 58 64 C56 70 50 74 40 70 C34 66 30 58 32 46 Z"
            fill="url(#soarNearWingGrad)"
            stroke="#0F766E"
            strokeWidth="1.25"
            strokeOpacity="0.65"
            strokeLinejoin="round"
          />
          {/* Layered secondary feather lines */}
          <path
            d="M36 50 C44 54 48 60 50 66 M34 54 C40 58 44 64 46 68 M38 52 C46 56 50 62 52 68"
            stroke="#475569"
            strokeWidth="0.9"
            strokeOpacity="0.5"
            strokeLinecap="round"
          />
        </g>
      ) : (
        /* Swept-Back Flying Near Wing (Articulated Primary & Secondary Feathers) */
        <g className="animate-dove-flap-near" style={{ transformOrigin: '40px 48px' }}>
          {/* Swept-back broad wing with 8 primary feather fingertips */}
          <path
            d="M35 48 C42 38 52 24 64 12 C62 20 60 28 66 22 C64 30 62 36 68 30 C66 38 64 44 72 38 C70 46 68 52 76 46 C74 54 72 60 80 56 C76 64 72 70 82 66 C78 72 72 76 60 74 C48 72 40 60 35 48 Z"
            fill="url(#soarNearWingGrad)"
            stroke="#0F766E"
            strokeWidth="1.3"
            strokeOpacity="0.65"
            strokeLinejoin="round"
          />

          {/* Individual Primary Quill Shafts (Golden-Taupe lines) */}
          <path
            d="M44 45 C50 34 56 22 63 13 M47 48 C52 38 58 28 65 23 M50 51 C55 42 61 34 67 31 M53 54 C58 46 63 40 71 39 M56 58 C61 52 66 48 75 47 M58 62 C63 58 68 56 79 57 M60 66 C65 64 70 63 80 67"
            stroke="#475569"
            strokeWidth="0.85"
            strokeOpacity="0.5"
            strokeLinecap="round"
          />

          {/* Greater Secondary Coverts (Layered soft feathers near base) */}
          <path
            d="M38 52 C44 50 50 52 54 58 C50 62 44 64 38 60 Z"
            fill="#FFFFFF"
            fillOpacity="0.6"
            stroke="#0F766E"
            strokeWidth="0.8"
            strokeOpacity="0.45"
          />
        </g>
      )}
    </svg>
  );
};

/* ==========================================================================
   COMPANION FLOCK DOVE SVG (48px - 56px, Forward-Facing Natural Soaring Pose)
   ========================================================================== */
interface CompanionDoveSvgProps {
  size: number;
  opacity?: number;
}

const CompanionDoveSvg: React.FC<CompanionDoveSvgProps> = ({ size, opacity = 0.9 }) => {
  return (
    <svg
      viewBox="0 0 100 100"
      width={size}
      height={size}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      style={{
        opacity,
        filter:
          'drop-shadow(0 4px 10px rgba(15, 118, 110, 0.2)) drop-shadow(0 1px 3px rgba(51, 65, 85, 0.14))',
      }}
    >
      <defs>
        <linearGradient id={`flockDoveGrad-${size}`} x1="10%" y1="10%" x2="90%" y2="90%">
          <stop offset="0%" stopColor="#FFFFFF" />
          <stop offset="60%" stopColor="#F5F1E6" />
          <stop offset="100%" stopColor="#D9CCA8" />
        </linearGradient>
      </defs>

      {/* Far Wing */}
      <g className="animate-dove-flap-far" style={{ transformOrigin: '48px 45px' }}>
        <path
          d="M48 45 C44 32 38 18 36 6 C42 16 48 28 55 35 C58 24 62 18 66 22 C62 30 60 38 62 45 Z"
          fill={`url(#flockDoveGrad-${size})`}
          stroke="#0F766E"
          strokeWidth="1.1"
          strokeOpacity="0.5"
        />
      </g>

      {/* Tail Feathers */}
      <path
        d="M58 72 C66 78 76 84 84 88 C76 89 68 88 58 80 Z"
        fill={`url(#flockDoveGrad-${size})`}
        stroke="#0F766E"
        strokeWidth="1.1"
        strokeOpacity="0.5"
      />

      {/* Body & Head */}
      <path
        d="M26 44 C20 48 18 52 20 54 C24 56 30 58 35 64 C42 72 50 76 58 73 C56 68 53 60 48 54 C42 46 34 42 26 44 Z"
        fill={`url(#flockDoveGrad-${size})`}
        stroke="#0F766E"
        strokeWidth="1.2"
        strokeOpacity="0.6"
      />

      {/* Beak & Eye */}
      <path d="M17 50 L10 52 L16 54 Z" fill="#D97706" />
      <circle cx="22" cy="45" r="1.8" fill="#BE123C" />
      <circle cx="22" cy="45" r="1.2" fill="#0F172A" />

      {/* Near Wing */}
      <g className="animate-dove-flap-near" style={{ transformOrigin: '40px 48px' }}>
        <path
          d="M35 48 C42 38 52 24 64 12 C62 20 60 28 66 22 C64 30 62 36 68 30 C66 38 64 44 72 38 C70 46 64 54 58 64 C48 68 40 58 35 48 Z"
          fill={`url(#flockDoveGrad-${size})`}
          stroke="#0F766E"
          strokeWidth="1.2"
          strokeOpacity="0.6"
        />
      </g>
    </svg>
  );
};

export default FlyingDovePerch;
