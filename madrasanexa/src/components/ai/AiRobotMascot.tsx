import React from 'react';

export interface AiRobotMascotProps {
  variant?: 'avatar' | 'wave' | 'thinking';
  size?: number | string;
  className?: string;
  animate?: boolean;
}

export default function AiRobotMascot({
  variant = 'wave',
  size,
  className = '',
  animate = true,
}: AiRobotMascotProps) {
  const uid = React.useId().replace(/:/g, '');

  // Animation CSS classes based on prefers-reduced-motion
  const floatClass = animate ? 'animate-robot-float' : '';
  const waveClass = animate ? 'animate-robot-wave' : '';
  const thinkClass = animate ? 'animate-robot-think' : '';
  const eyeBlinkClass = animate ? 'animate-robot-blink' : '';
  const pulseClass = animate ? 'animate-robot-pulse' : '';

  const mascotKeyframes = (
    <style>{`
      @keyframes robotFloat {
        0%, 100% { transform: translateY(0px); }
        50% { transform: translateY(-4px); }
      }
      @keyframes robotWave {
        0%, 100% { transform: rotate(0deg); }
        25% { transform: rotate(-18deg); }
        75% { transform: rotate(14deg); }
      }
      @keyframes robotBlink {
        0%, 90%, 100% { transform: scaleY(1); }
        95% { transform: scaleY(0.12); }
      }
      @keyframes robotThink {
        0%, 100% { transform: rotate(0deg) translateY(0); }
        50% { transform: rotate(3deg) translateY(-3px); }
      }
      @keyframes robotHaloPulse {
        0%, 100% { transform: scale(1); opacity: 0.8; }
        50% { transform: scale(1.15); opacity: 1; filter: drop-shadow(0 0 6px rgba(55, 198, 163, 0.8)); }
      }
      .animate-robot-float {
        animation: robotFloat 3.2s ease-in-out infinite;
      }
      .animate-robot-wave {
        transform-origin: 30px 80px;
        animation: robotWave 1.8s ease-in-out infinite;
      }
      .animate-robot-blink {
        transform-box: fill-box;
        transform-origin: center;
        animation: robotBlink 3.6s ease-in-out infinite;
      }
      .animate-robot-think {
        animation: robotThink 2.8s ease-in-out infinite;
      }
      .animate-robot-pulse {
        animation: robotHaloPulse 2s ease-in-out infinite;
      }
    `}</style>
  );

  // AVATAR VARIANT (Compact Head for Circular Orb & Mini Icons)
  if (variant === 'avatar') {
    return (
      <div
        className={`inline-flex items-center justify-center relative select-none ${floatClass} ${className}`}
        style={{ width: size || '100%', height: size || '100%' }}
        aria-label="MadrasaNexa AI Robot Avatar"
      >
        {mascotKeyframes}
        <svg
          viewBox="0 0 100 100"
          className="w-full h-full overflow-visible drop-shadow-md"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            {/* Glossy White 3D Helmet Gradient */}
            <linearGradient id={`helmet-grad-${uid}`} x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#FFFFFF" />
              <stop offset="45%" stopColor="#F8FAFC" />
              <stop offset="85%" stopColor="#E2E8F0" />
              <stop offset="100%" stopColor="#CBD5E1" />
            </linearGradient>

            {/* Dark Navy Visor Gradient */}
            <linearGradient id={`visor-grad-${uid}`} x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#0B1120" />
              <stop offset="60%" stopColor="#0F172A" />
              <stop offset="100%" stopColor="#1E293B" />
            </linearGradient>

            {/* Emerald Glowing Accent Gradient */}
            <linearGradient id={`emerald-grad-${uid}`} x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#6EE7B7" />
              <stop offset="50%" stopColor="#37C6A3" />
              <stop offset="100%" stopColor="#059669" />
            </linearGradient>

            {/* Emerald Glow Filter */}
            <filter id={`glow-${uid}`} x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="1.8" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>

            {/* Soft Ambient Shadow Filter */}
            <filter id={`shadow-${uid}`} x="-10%" y="-10%" width="120%" height="120%">
              <feDropShadow dx="0" dy="3" stdDeviation="2.5" floodColor="#0F172A" floodOpacity="0.25" />
            </filter>
          </defs>

          {/* Antenna Stem */}
          <path d="M50 24 V15" stroke="#94A3B8" strokeWidth="3" strokeLinecap="round" />
          {/* Antenna Glowing Orb */}
          <circle
            cx="50"
            cy="13"
            r="5"
            fill={`url(#emerald-grad-${uid})`}
            filter={`url(#glow-${uid})`}
            className={pulseClass}
          />

          {/* Left Earphone / Earcup */}
          <rect x="13" y="44" width="8" height="24" rx="4" fill="#E2E8F0" />
          <rect x="14" y="46" width="6" height="20" rx="3" fill={`url(#emerald-grad-${uid})`} opacity="0.9" />

          {/* Right Earphone / Earcup */}
          <rect x="79" y="44" width="8" height="24" rx="4" fill="#E2E8F0" />
          <rect x="80" y="46" width="6" height="20" rx="3" fill={`url(#emerald-grad-${uid})`} opacity="0.9" />

          {/* Main 3D Helmet Base */}
          <rect
            x="18"
            y="24"
            width="64"
            height="58"
            rx="24"
            fill={`url(#helmet-grad-${uid})`}
            filter={`url(#shadow-${uid})`}
            stroke="#FFFFFF"
            strokeWidth="1.5"
          />

          {/* Helmet Top Specular Reflection Highlight */}
          <path
            d="M32 29 Q50 26 68 29"
            stroke="#FFFFFF"
            strokeWidth="2.5"
            strokeLinecap="round"
            opacity="0.8"
          />

          {/* Dark Navy Visor Face Screen */}
          <rect
            x="24"
            y="36"
            width="52"
            height="38"
            rx="14"
            fill={`url(#visor-grad-${uid})`}
            stroke="#1E293B"
            strokeWidth="1"
          />

          {/* Visor Upper Diagonal Gloss Sheen */}
          <path
            d="M26 42 Q50 38 74 42"
            stroke="#FFFFFF"
            strokeWidth="1.5"
            strokeLinecap="round"
            opacity="0.25"
          />

          {/* Glowing Emerald Eyes (Smiling Arc) */}
          <g className={eyeBlinkClass} filter={`url(#glow-${uid})`}>
            {/* Left Eye */}
            <path
              d="M37 53 Q43 45 49 53"
              stroke="#37C6A3"
              strokeWidth="3.2"
              strokeLinecap="round"
              fill="none"
            />
            {/* Right Eye */}
            <path
              d="M53 53 Q59 45 65 53"
              stroke="#37C6A3"
              strokeWidth="3.2"
              strokeLinecap="round"
              fill="none"
            />
          </g>

          {/* Cute Little Cyan/Emerald Cheek Blushes */}
          <circle cx="34" cy="62" r="2.5" fill="#37C6A3" opacity="0.35" />
          <circle cx="68" cy="62" r="2.5" fill="#37C6A3" opacity="0.35" />

          {/* Subtle Friendly Mouth / Smile Dot */}
          <circle cx="51" cy="61" r="1.5" fill="#37C6A3" opacity="0.75" />
        </svg>
      </div>
    );
  }

  // WAVING VARIANT (Full Body with Waving Right Arm - Ideal for Hero Banner)
  if (variant === 'wave') {
    return (
      <div
        className={`inline-flex items-center justify-center relative select-none ${floatClass} ${className}`}
        style={{ width: size || '100%', height: size || '100%' }}
        aria-label="MadrasaNexa AI Robot Mascot - Waving"
      >
        {mascotKeyframes}
        <svg
          viewBox="0 0 140 160"
          className="w-full h-full overflow-visible"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            <linearGradient id={`w-helmet-${uid}`} x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#FFFFFF" />
              <stop offset="50%" stopColor="#F8FAFC" />
              <stop offset="90%" stopColor="#E2E8F0" />
              <stop offset="100%" stopColor="#CBD5E1" />
            </linearGradient>

            <linearGradient id={`w-visor-${uid}`} x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#0B1120" />
              <stop offset="60%" stopColor="#0F172A" />
              <stop offset="100%" stopColor="#1E293B" />
            </linearGradient>

            <linearGradient id={`w-emerald-${uid}`} x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#6EE7B7" />
              <stop offset="50%" stopColor="#37C6A3" />
              <stop offset="100%" stopColor="#059669" />
            </linearGradient>

            <filter id={`w-glow-${uid}`} x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="2" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>

            <filter id={`w-shadow-${uid}`} x="-15%" y="-15%" width="130%" height="130%">
              <feDropShadow dx="0" dy="5" stdDeviation="4" floodColor="#0F172A" floodOpacity="0.3" />
            </filter>
          </defs>

          {/* Gentle Floating Jet Aura Ring at Base */}
          <ellipse cx="68" cy="154" rx="22" ry="4" fill="#37C6A3" opacity="0.25" className={pulseClass} />

          {/* Left Relaxed Arm */}
          <path
            d="M40 92 Q28 106 32 120"
            stroke={`url(#w-helmet-${uid})`}
            strokeWidth="9"
            strokeLinecap="round"
          />
          <circle cx="33" cy="122" r="5" fill="#E2E8F0" />

          {/* 3D Cute Rounded Torso Body */}
          <path
            d="M42 84 C42 80 50 78 68 78 C86 78 94 80 94 84 L90 128 C90 134 82 138 68 138 C54 138 46 134 46 128 Z"
            fill={`url(#w-helmet-${uid})`}
            filter={`url(#w-shadow-${uid})`}
            stroke="#FFFFFF"
            strokeWidth="1.2"
          />

          {/* Body Chest Medallion: Glowing Emerald Islamic Crescent/Gem */}
          <rect x="61" y="94" width="14" height="14" rx="4" fill="#0F172A" />
          <circle cx="68" cy="101" r="4" fill={`url(#w-emerald-${uid})`} filter={`url(#w-glow-${uid})`} />

          {/* Body Seam Line & Belt Accent */}
          <path d="M50 122 Q68 126 86 122" stroke="#CBD5E1" strokeWidth="1.5" strokeLinecap="round" />

          {/* Waving Right Arm (Raised Cheerful Wave with Keyframe Pivot) */}
          <g className={waveClass} style={{ transformOrigin: '96px 86px' }}>
            {/* Upper Arm to Forearm */}
            <path
              d="M96 86 Q112 76 114 56"
              stroke={`url(#w-helmet-${uid})`}
              strokeWidth="9"
              strokeLinecap="round"
            />
            {/* Metallic Joint Ring */}
            <circle cx="106" cy="74" r="4" fill={`url(#w-emerald-${uid})`} />
            {/* Waving Hand & Fingers */}
            <circle cx="115" cy="52" r="7" fill={`url(#w-helmet-${uid})`} stroke="#FFFFFF" strokeWidth="1" />
            <circle cx="112" cy="45" r="2.5" fill="#E2E8F0" />
            <circle cx="117" cy="44" r="2.5" fill="#E2E8F0" />
            <circle cx="122" cy="46" r="2.5" fill="#E2E8F0" />
            {/* Waving Friendly Sparkle */}
            <path
              d="M128 42 L131 45 L128 48 L125 45 Z"
              fill="#37C6A3"
              filter={`url(#w-glow-${uid})`}
              className={pulseClass}
            />
          </g>

          {/* Head Group with gentle tilt */}
          <g>
            {/* Antenna Stem */}
            <path d="M68 28 V16" stroke="#94A3B8" strokeWidth="3" strokeLinecap="round" />
            {/* Antenna Glowing Gem Orb */}
            <circle
              cx="68"
              cy="14"
              r="6"
              fill={`url(#w-emerald-${uid})`}
              filter={`url(#w-glow-${uid})`}
              className={pulseClass}
            />

            {/* Left Earphone / Earcup */}
            <rect x="29" y="44" width="8" height="24" rx="4" fill="#E2E8F0" />
            <rect x="30" y="46" width="6" height="20" rx="3" fill={`url(#w-emerald-${uid})`} opacity="0.9" />

            {/* Right Earphone / Earcup */}
            <rect x="99" y="44" width="8" height="24" rx="4" fill="#E2E8F0" />
            <rect x="100" y="46" width="6" height="20" rx="3" fill={`url(#w-emerald-${uid})`} opacity="0.9" />

            {/* Helmet Head */}
            <rect
              x="34"
              y="26"
              width="68"
              height="58"
              rx="24"
              fill={`url(#w-helmet-${uid})`}
              filter={`url(#w-shadow-${uid})`}
              stroke="#FFFFFF"
              strokeWidth="1.5"
            />

            {/* Helmet Top Specular Reflection Highlight */}
            <path
              d="M48 31 Q68 28 88 31"
              stroke="#FFFFFF"
              strokeWidth="2.5"
              strokeLinecap="round"
              opacity="0.8"
            />

            {/* Visor Face Screen */}
            <rect
              x="41"
              y="38"
              width="54"
              height="38"
              rx="14"
              fill={`url(#w-visor-${uid})`}
              stroke="#1E293B"
              strokeWidth="1"
            />

            {/* Visor Glass Sheen */}
            <path
              d="M43 43 Q68 39 93 43"
              stroke="#FFFFFF"
              strokeWidth="1.5"
              strokeLinecap="round"
              opacity="0.25"
            />

            {/* Glowing Emerald Smiling Eyes */}
            <g className={eyeBlinkClass} filter={`url(#w-glow-${uid})`}>
              <path
                d="M53 54 Q59 46 65 54"
                stroke="#37C6A3"
                strokeWidth="3.4"
                strokeLinecap="round"
                fill="none"
              />
              <path
                d="M71 54 Q77 46 83 54"
                stroke="#37C6A3"
                strokeWidth="3.4"
                strokeLinecap="round"
                fill="none"
              />
            </g>

            {/* Cute Cheek Blushes */}
            <circle cx="50" cy="63" r="2.5" fill="#37C6A3" opacity="0.35" />
            <circle cx="86" cy="63" r="2.5" fill="#37C6A3" opacity="0.35" />

            {/* Small Friendly Mouth */}
            <circle cx="68" cy="63" r="1.5" fill="#37C6A3" opacity="0.8" />
          </g>
        </svg>
      </div>
    );
  }

  // THINKING VARIANT (Hand on Chin with Sparkle/Idea Dots - Ideal for Loader)
  return (
    <div
      className={`inline-flex items-center justify-center relative select-none ${floatClass} ${className}`}
      style={{ width: size || '100%', height: size || '100%' }}
      aria-label="MadrasaNexa AI Robot Mascot - Thinking"
    >
      {mascotKeyframes}
      <svg
        viewBox="0 0 140 160"
        className="w-full h-full overflow-visible"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <linearGradient id={`t-helmet-${uid}`} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#FFFFFF" />
            <stop offset="50%" stopColor="#F8FAFC" />
            <stop offset="90%" stopColor="#E2E8F0" />
            <stop offset="100%" stopColor="#CBD5E1" />
          </linearGradient>

          <linearGradient id={`t-visor-${uid}`} x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#0B1120" />
            <stop offset="60%" stopColor="#0F172A" />
            <stop offset="100%" stopColor="#1E293B" />
          </linearGradient>

          <linearGradient id={`t-emerald-${uid}`} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#6EE7B7" />
            <stop offset="50%" stopColor="#37C6A3" />
            <stop offset="100%" stopColor="#059669" />
          </linearGradient>

          <filter id={`t-glow-${uid}`} x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="2" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>

          <filter id={`t-shadow-${uid}`} x="-15%" y="-15%" width="130%" height="130%">
            <feDropShadow dx="0" dy="5" stdDeviation="4" floodColor="#0F172A" floodOpacity="0.3" />
          </filter>
        </defs>

        {/* Floating Thinking Idea Sparkles / Particles */}
        <g className={pulseClass}>
          <circle cx="86" cy="18" r="2.5" fill="#37C6A3" filter={`url(#t-glow-${uid})`} />
          <circle cx="94" cy="11" r="3.5" fill="#6EE7B7" filter={`url(#t-glow-${uid})`} />
          <path
            d="M106 8 L108 12 L112 14 L108 16 L106 20 L104 16 L100 14 L104 12 Z"
            fill="#37C6A3"
            filter={`url(#t-glow-${uid})`}
          />
        </g>

        {/* Gentle Base Shadow */}
        <ellipse cx="68" cy="154" rx="22" ry="4" fill="#37C6A3" opacity="0.25" className={pulseClass} />

        {/* Left Resting Arm */}
        <path
          d="M40 92 Q30 106 34 118"
          stroke={`url(#t-helmet-${uid})`}
          strokeWidth="9"
          strokeLinecap="round"
        />
        <circle cx="35" cy="120" r="5" fill="#E2E8F0" />

        {/* 3D Rounded Torso */}
        <path
          d="M42 84 C42 80 50 78 68 78 C86 78 94 80 94 84 L90 128 C90 134 82 138 68 138 C54 138 46 134 46 128 Z"
          fill={`url(#t-helmet-${uid})`}
          filter={`url(#t-shadow-${uid})`}
          stroke="#FFFFFF"
          strokeWidth="1.2"
        />

        {/* Chest Medallion */}
        <rect x="61" y="94" width="14" height="14" rx="4" fill="#0F172A" />
        <circle cx="68" cy="101" r="4" fill={`url(#t-emerald-${uid})`} filter={`url(#t-glow-${uid})`} />

        {/* Right Arm: Raised Hand-to-Chin Thinking Pose */}
        <g className={thinkClass}>
          <path
            d="M96 88 Q106 98 94 112 Q84 108 78 96"
            stroke={`url(#t-helmet-${uid})`}
            strokeWidth="8.5"
            strokeLinecap="round"
            fill="none"
          />
          {/* Hand Touching Chin / Visor Bottom */}
          <circle cx="78" cy="94" r="6" fill={`url(#t-helmet-${uid})`} stroke="#FFFFFF" strokeWidth="1" />
          <circle cx="76" cy="91" r="2.5" fill="#E2E8F0" />
        </g>

        {/* Head with Curious Inquisitive Tilt */}
        <g style={{ transform: 'rotate(3deg)', transformOrigin: '68px 55px' }}>
          {/* Antenna Stem */}
          <path d="M68 28 V16" stroke="#94A3B8" strokeWidth="3" strokeLinecap="round" />
          {/* Antenna Glowing Orb */}
          <circle
            cx="68"
            cy="14"
            r="6"
            fill={`url(#t-emerald-${uid})`}
            filter={`url(#t-glow-${uid})`}
            className={pulseClass}
          />

          {/* Left Earcup */}
          <rect x="29" y="44" width="8" height="24" rx="4" fill="#E2E8F0" />
          <rect x="30" y="46" width="6" height="20" rx="3" fill={`url(#t-emerald-${uid})`} opacity="0.9" />

          {/* Right Earcup */}
          <rect x="99" y="44" width="8" height="24" rx="4" fill="#E2E8F0" />
          <rect x="100" y="46" width="6" height="20" rx="3" fill={`url(#t-emerald-${uid})`} opacity="0.9" />

          {/* Helmet Base */}
          <rect
            x="34"
            y="26"
            width="68"
            height="58"
            rx="24"
            fill={`url(#t-helmet-${uid})`}
            filter={`url(#t-shadow-${uid})`}
            stroke="#FFFFFF"
            strokeWidth="1.5"
          />

          {/* Specular Highlight */}
          <path
            d="M48 31 Q68 28 88 31"
            stroke="#FFFFFF"
            strokeWidth="2.5"
            strokeLinecap="round"
            opacity="0.8"
          />

          {/* Visor Face */}
          <rect
            x="41"
            y="38"
            width="54"
            height="38"
            rx="14"
            fill={`url(#t-visor-${uid})`}
            stroke="#1E293B"
            strokeWidth="1"
          />

          {/* Upper Glass Sheen */}
          <path
            d="M43 43 Q68 39 93 43"
            stroke="#FFFFFF"
            strokeWidth="1.5"
            strokeLinecap="round"
            opacity="0.25"
          />

          {/* Thinking Eyes: Curious, Looking Upward/Right */}
          <g filter={`url(#t-glow-${uid})`}>
            {/* Left Eye: Curved Looking Up */}
            <ellipse cx="58" cy="51" rx="4" ry="5.5" fill="#37C6A3" />
            <circle cx="59.5" cy="49" r="1.5" fill="#FFFFFF" />

            {/* Right Eye: Curved Looking Up */}
            <ellipse cx="76" cy="51" rx="4" ry="5.5" fill="#37C6A3" />
            <circle cx="77.5" cy="49" r="1.5" fill="#FFFFFF" />
          </g>

          {/* Cheerful Mouth / Inquisitive 'o' Shape */}
          <ellipse cx="67" cy="64" rx="2.5" ry="3" fill="#37C6A3" opacity="0.85" />
        </g>
      </svg>
    </div>
  );
}
