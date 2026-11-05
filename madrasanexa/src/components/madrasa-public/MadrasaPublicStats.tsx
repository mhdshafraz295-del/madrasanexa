import React, { useEffect, useRef, useState } from 'react';
import { GraduationCap, Users, BookOpen, Sparkles } from 'lucide-react';
import type { PublicStatsData, MadrasaThemeTokens } from '../../services/api';

interface MadrasaPublicStatsProps {
  stats: PublicStatsData;
  theme: MadrasaThemeTokens;
}

interface StatItemConfig {
  id: string;
  label: string;
  description: string;
  value: number;
  icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
  accentColor: string;
}

export const MadrasaPublicStats: React.FC<MadrasaPublicStatsProps> = ({ stats, theme }) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [hasAnimated, setHasAnimated] = useState(false);
  const [displayValues, setDisplayValues] = useState<{ [key: string]: number }>({
    students: 0,
    staff: 0,
    teachers: 0,
  });

  const statItems: StatItemConfig[] = [
    {
      id: 'students',
      label: 'Enrolled Students',
      description: 'Active young scholars pursuing Islamic and classical education',
      value: stats.totalStudents,
      icon: GraduationCap,
      accentColor: '#85845C',
    },
    {
      id: 'staff',
      label: 'Total Staff & Mentors',
      description: 'Dedicated team providing institutional and academic care',
      value: stats.totalStaff,
      icon: Users,
      accentColor: '#A5A477',
    },
    {
      id: 'teachers',
      label: 'Scholarly Faculty',
      description: 'Ustadhs and teachers guiding hearts and transmitting sacred knowledge',
      value: stats.totalTeachers,
      icon: BookOpen,
      accentColor: '#85845C',
    },
  ];

  useEffect(() => {
    // Check reduced motion preference
    const prefersReducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (prefersReducedMotion) {
      setDisplayValues({
        students: stats.totalStudents,
        staff: stats.totalStaff,
        teachers: stats.totalTeachers,
      });
      setHasAnimated(true);
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !hasAnimated) {
          setHasAnimated(true);
          const durationMs = 1500;
          const startTime = performance.now();

          const animate = (currentTime: number) => {
            const elapsed = currentTime - startTime;
            const progress = Math.min(elapsed / durationMs, 1);
            // Ease-out cubic curve: 1 - (1 - t)^3
            const easeOut = 1 - Math.pow(1 - progress, 3);

            setDisplayValues({
              students: Math.round(easeOut * stats.totalStudents),
              staff: Math.round(easeOut * stats.totalStaff),
              teachers: Math.round(easeOut * stats.totalTeachers),
            });

            if (progress < 1) {
              requestAnimationFrame(animate);
            }
          };

          requestAnimationFrame(animate);
        }
      },
      { threshold: 0.25 }
    );

    if (containerRef.current) {
      observer.observe(containerRef.current);
    }

    return () => {
      observer.disconnect();
    };
  }, [stats, hasAnimated]);

  // If every stat is 0 or unavailable, omit gracefully without inventing placeholder figures
  const hasAnyData = stats.totalStudents > 0 || stats.totalStaff > 0 || stats.totalTeachers > 0;
  if (!hasAnyData) {
    return null;
  }

  return (
    <section
      ref={containerRef}
      className="public-section-enter scroll-mt-28"
      aria-label="Institutional Key Statistics"
    >
      <div className="text-center max-w-3xl mx-auto mb-10">
        <div className="inline-flex items-center space-x-2 text-xs font-bold uppercase tracking-wider text-[#85845C] mb-3 px-3.5 py-1 rounded-full bg-[#F5F5F1] border border-[#E5E5DF] shadow-2xs">
          <Sparkles className="w-3.5 h-3.5 text-[#85845C]" />
          <span>Institution By Numbers</span>
        </div>
        <h2
          className="text-2xl sm:text-3xl font-serif font-bold tracking-tight text-[#252525]"
          style={{ color: theme.headingColor || '#252525' }}
        >
          Our Living Academic Community
        </h2>
        <p className="mt-2 text-sm text-[#666666]">
          Authentic institutional data reflecting our ongoing student enrollment and dedicated scholarly leadership.
        </p>
      </div>

      {/* Centered Stats Cards Grid with ACJU Olive Hover */}
      <div className="flex flex-wrap justify-center gap-6 items-stretch">
        {statItems.map((item) => {
          const Icon = item.icon;
          const count = displayValues[item.id] ?? 0;

          return (
            <div
              key={item.id}
              className="acju-card group bg-white rounded-2xl border border-[#E5E5DF] p-7 flex flex-col justify-between text-center w-full sm:w-[calc(50%-1rem)] lg:w-[calc(33.333%-1rem)] max-w-sm transition-all duration-300 shadow-xs"
            >
              <div>
                <div className="acju-icon-badge w-14 h-14 mx-auto rounded-2xl flex items-center justify-center mb-5 bg-[#F5F5F1] border border-[#E5E5DF] group-hover:bg-white transition-colors duration-300">
                  <Icon className="w-7 h-7 text-[#85845C] group-hover:text-[#85845C] transition-colors" />
                </div>

                <div
                  className="text-4xl sm:text-5xl font-bold tracking-tight mb-2 font-mono text-[#85845C] group-hover:text-white transition-colors duration-300"
                >
                  {count.toLocaleString()}
                </div>

                <div className="text-base font-serif font-bold text-[#252525] mb-1 group-hover:text-white transition-colors duration-300">
                  {item.label}
                </div>
              </div>

              <p className="text-xs text-[#666666] leading-relaxed mt-3 pt-3 border-t border-[#E5E5DF] group-hover:text-white/90 group-hover:border-white/20 transition-colors duration-300">
                {item.description}
              </p>
            </div>
          );
        })}
      </div>
    </section>
  );
};
