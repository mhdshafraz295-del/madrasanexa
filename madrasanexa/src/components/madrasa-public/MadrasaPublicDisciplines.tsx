import React from 'react';
import { BookOpen, GraduationCap, ShieldCheck, Sparkles, ArrowRight } from 'lucide-react';
import type { MadrasaThemeTokens } from '../../services/api';

interface MadrasaPublicDisciplinesProps {
  theme: MadrasaThemeTokens;
}

interface DisciplineCard {
  id: string;
  title: string;
  subtitle: string;
  description: string;
  imageUrl: string;
  icon: React.ComponentType<{ className?: string }>;
  linkHref: string;
  linkLabel: string;
}

const DISCIPLINES: DisciplineCard[] = [
  {
    id: 'hifz',
    title: 'Quranic Mastery & Tajweed',
    subtitle: 'Hifz al-Quran & Qira’at',
    description:
      'Rigorous memorization, precise articulation rules (Makharij), and spiritual contemplation under accredited Huffaz.',
    imageUrl: 'https://images.unsplash.com/photo-1609599006353-e629aaabfeae?auto=format&fit=crop&w=600&q=80',
    icon: BookOpen,
    linkHref: '#curriculum',
    linkLabel: 'Explore Syllabus',
  },
  {
    id: 'alim',
    title: 'Classical Islamic Sciences',
    subtitle: 'Alimiyyah Curriculum',
    description:
      'Systematic study of Hadith collections, Fiqh jurisprudence, Usul, and Tafseer transmitted through verified scholarly chains.',
    imageUrl: 'https://images.unsplash.com/photo-1532012164546-f432f2e3777a?auto=format&fit=crop&w=600&q=80',
    icon: GraduationCap,
    linkHref: '#curriculum',
    linkLabel: 'View Curriculum',
  },
  {
    id: 'tarbiyah',
    title: 'Tarbiyah & Character Formation',
    subtitle: 'Moral Adab & Leadership',
    description:
      'Cultivating prophetic character, spiritual discipline, humility, and compassionate leadership to benefit the wider society.',
    imageUrl: 'https://images.unsplash.com/photo-1544717305-2782549b5136?auto=format&fit=crop&w=600&q=80',
    icon: ShieldCheck,
    linkHref: '#about',
    linkLabel: 'Learn More',
  },
  {
    id: 'arabic',
    title: 'Arabic Linguistics & Rhetoric',
    subtitle: 'Classical Nahw & Balaghah',
    description:
      'Complete mastery of classical Arabic grammar, morphology, eloquence, and literature to comprehend divine scripture directly.',
    imageUrl: 'https://images.unsplash.com/photo-1512820790803-83ca734da794?auto=format&fit=crop&w=600&q=80',
    icon: Sparkles,
    linkHref: '#curriculum',
    linkLabel: 'Read Overview',
  },
];

export const MadrasaPublicDisciplines: React.FC<MadrasaPublicDisciplinesProps> = () => {
  const handleNavClick = (e: React.MouseEvent<HTMLAnchorElement>, href: string) => {
    e.preventDefault();
    const id = href.replace('#', '');
    const element = document.getElementById(id);
    if (element) {
      const headerOffset = 88;
      const elementPosition = element.getBoundingClientRect().top + window.pageYOffset;
      window.scrollTo({
        top: Math.max(0, elementPosition - headerOffset),
        behavior: 'smooth',
      });
      window.history.pushState(null, '', href);
    }
  };

  return (
    <section className="py-8 sm:py-12">
      {/* Section Header */}
      <div className="text-center max-w-3xl mx-auto mb-10 sm:mb-14 px-4">
        <div className="inline-flex items-center space-x-2 text-[11px] sm:text-xs font-bold uppercase tracking-wider text-[#0B3B2C] mb-2.5 px-3.5 py-1.5 rounded-full bg-[#FAF8F3] border border-[#C5A059]/40 shadow-2xs">
          <Sparkles className="w-3.5 h-3.5 text-[#C5A059]" />
          <span>Our Sacred Disciplines</span>
        </div>
        <h2 className="text-2xl sm:text-4xl font-serif font-bold tracking-tight text-[#1C2826] mb-3">
          Academic Pathways & Sacred Sciences
        </h2>
        <div className="w-16 h-1 bg-gradient-to-r from-[#0B3B2C] via-[#C5A059] to-[#0B3B2C] mx-auto rounded-full mb-3" />
        <p className="text-xs sm:text-sm md:text-base text-slate-600 leading-relaxed max-w-2xl mx-auto">
          Comprehensive, structured Islamic education combining sacred classical sciences, Quranic mastery, and recognized academic curricula.
        </p>
      </div>

      {/* 4-Column Responsive Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 sm:gap-7 items-stretch">
        {DISCIPLINES.map((item) => {
          const Icon = item.icon;

          return (
            <div
              key={item.id}
              className="bg-white rounded-2xl overflow-hidden border border-[#E5E0D5] shadow-xs hover:shadow-xl transition-all duration-300 hover:-translate-y-1.5 flex flex-col group"
            >
              {/* Photo Container */}
              <div className="relative h-44 sm:h-48 overflow-hidden bg-slate-100">
                <img
                  src={item.imageUrl}
                  alt={item.title}
                  className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                  loading="lazy"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent pointer-events-none" />

                {/* Overlapping Round Dark Green Icon Badge */}
                <div className="absolute -bottom-5 left-6 w-11 h-11 rounded-full bg-[#0B3B2C] border-2 border-white shadow-md flex items-center justify-center text-[#DFC076] transition-transform duration-300 group-hover:scale-110">
                  <Icon className="w-5 h-5 text-[#DFC076]" />
                </div>
              </div>

              {/* Card Body */}
              <div className="p-6 pt-8 flex-1 flex flex-col justify-between">
                <div>
                  <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-[#C5A059] block mb-1">
                    {item.subtitle}
                  </span>
                  <h3 className="font-serif text-lg sm:text-xl font-bold text-[#1C2826] group-hover:text-[#0B3B2C] transition-colors mb-2.5">
                    {item.title}
                  </h3>
                  <p className="text-xs sm:text-sm text-slate-600 leading-relaxed font-normal mb-5">
                    {item.description}
                  </p>
                </div>

                {/* Bottom link with arrow */}
                <a
                  href={item.linkHref}
                  onClick={(e) => handleNavClick(e, item.linkHref)}
                  className="inline-flex items-center space-x-1.5 text-xs font-bold uppercase tracking-wider text-[#0B3B2C] group-hover:text-[#C5A059] transition-colors pt-3 border-t border-[#F0ECE1]"
                >
                  <span>{item.linkLabel}</span>
                  <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-1" />
                </a>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
};
