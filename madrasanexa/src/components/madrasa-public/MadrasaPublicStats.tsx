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

export const MadrasaPublicStats: React.FC<MadrasaPublicStatsProps> = ({ stats, theme: _theme }) => {
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
      <div className="text-center max-w-3xl mx-auto mb-10 sm:mb-12 px-4">
        <div className="inline-flex items-center space-x-2 text-[11px] sm:text-xs font-bold uppercase tracking-wider text-[#0B3B2C] mb-2.5 px-3.5 py-1.5 rounded-full bg-[#FAF8F3] border border-[#C5A059]/40 shadow-2xs">
          <Sparkles className="w-3.5 h-3.5 text-[#C5A059]" />
          <span>Institution By Numbers</span>
        </div>
        <h2 className="text-2xl sm:text-4xl font-serif font-bold tracking-tight text-[#1C2826] mb-3">
          Our Living Academic Community
        </h2>
        <div className="w-16 h-1 bg-gradient-to-r from-[#0B3B2C] via-[#C5A059] to-[#0B3B2C] mx-auto rounded-full mb-3" />
        <p className="text-xs sm:text-sm md:text-base text-slate-600 leading-relaxed max-w-2xl mx-auto">
          Authentic institutional data reflecting our ongoing student enrollment and dedicated scholarly leadership.
        </p>
      </div>

      {/* Centered Stats Cards Grid with Warm Cream Surface */}
      <div className="flex flex-wrap justify-center gap-6 sm:gap-7 items-stretch">
        {statItems.map((item) => {
          const Icon = item.icon;
          const count = displayValues[item.id] ?? 0;

          return (
            <div
              key={item.id}
              className="bg-white rounded-2xl border-0 p-7 sm:p-8 flex flex-col justify-between text-center w-full sm:w-[calc(50%-1rem)] lg:w-[calc(33.333%-1rem)] max-w-sm transition-all duration-300 shadow-xs hover:shadow-xl hover:-translate-y-1.5 relative overflow-hidden group"
            >
              <div>
                <div className="w-14 h-14 mx-auto rounded-2xl flex items-center justify-center mb-5 bg-[#FAF8F3] border border-[#C5A059]/40 text-[#0B3B2C] shadow-2xs transition-transform duration-300 group-hover:scale-105">
                  <Icon className="w-7 h-7 text-[#0B3B2C]" />
                </div>

                <div className="text-4xl sm:text-5xl font-bold tracking-tight mb-2 font-mono text-[#0B3B2C]">
                  {count.toLocaleString()}
                </div>

                <div className="text-base sm:text-lg font-serif font-bold text-[#1C2826] group-hover:text-[#0B3B2C] transition-colors mb-1">
                  {item.label}
                </div>
              </div>

              <p className="text-xs sm:text-sm text-slate-600 leading-relaxed mt-3 pt-3 border-t border-[#F0ECE1]">
                {item.description}
              </p>
            </div>
          );
        })}
      </div>
    </section>
  );
};
