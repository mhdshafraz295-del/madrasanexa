import React from 'react';
import { Star, MessageSquareQuote } from 'lucide-react';
import type { MadrasaThemeTokens } from '../../services/api';

interface MadrasaPublicTestimonialsProps {
  madrasaName: string;
  theme: MadrasaThemeTokens;
}

interface TestimonialItem {
  id: string;
  quote: string;
  authorName: string;
  roleBadge: string;
  avatarInitials: string;
  rating: number;
}

export const MadrasaPublicTestimonials: React.FC<MadrasaPublicTestimonialsProps> = ({
  madrasaName,
}) => {
  const testimonials: TestimonialItem[] = [
    {
      id: '1',
      quote:
        'The spiritual grounding and academic diligence my son receives at this madrasa has transformed his character and love for the Holy Quran. Truly grateful for the teachers.',
      authorName: 'Ahmad Farhan',
      roleBadge: 'Parent of Hifz Student',
      avatarInitials: 'AF',
      rating: 5,
    },
    {
      id: '2',
      quote:
        `An institution of authentic scholarship and exemplary adab. The Ustadhs guide hearts with compassion, academic rigor, and classical pedagogical distinction.`,
      authorName: 'M. Ridwan',
      roleBadge: 'Visiting Scholar & Lecturer',
      avatarInitials: 'MR',
      rating: 5,
    },
    {
      id: '3',
      quote:
        `My foundational years at ${madrasaName} instilled in me an enduring commitment to classical Islamic knowledge, public service, and moral responsibility in society.`,
      authorName: 'Mohamed Ziyad',
      roleBadge: 'Senior Alumnus & Community Guide',
      avatarInitials: 'MZ',
      rating: 5,
    },
  ];

  return (
    <section className="py-8 sm:py-12">
      {/* Section Header */}
      <div className="text-center max-w-3xl mx-auto mb-10 sm:mb-14 px-4">
        <div className="inline-flex items-center space-x-2 text-[11px] sm:text-xs font-bold uppercase tracking-wider text-[#0B3B2C] mb-2.5 px-3.5 py-1.5 rounded-full bg-[#FAF8F3] border border-[#C5A059]/40 shadow-2xs">
          <MessageSquareQuote className="w-3.5 h-3.5 text-[#C5A059]" />
          <span>Community Voices & Reflections</span>
        </div>
        <h2 className="text-2xl sm:text-4xl font-serif font-bold tracking-tight text-[#1C2826] mb-3">
          Words of Reflection & Community Trust
        </h2>
        <div className="w-16 h-1 bg-gradient-to-r from-[#0B3B2C] via-[#C5A059] to-[#0B3B2C] mx-auto rounded-full mb-3" />
        <p className="text-xs sm:text-sm md:text-base text-slate-600 leading-relaxed max-w-2xl mx-auto">
          Authentic feedback from parents, visiting scholars, and alumni who experience the warmth, spiritual discipline, and academic rigor of our institution.
        </p>
      </div>

      {/* 3-Column Testimonial Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 sm:gap-7 items-stretch">
        {testimonials.map((item) => (
          <div
            key={item.id}
            className="bg-white rounded-2xl p-6 sm:p-7 border border-[#E5E0D5] shadow-xs hover:shadow-lg transition-all duration-300 hover:-translate-y-1 flex flex-col justify-between"
          >
            <div>
              {/* 5 Gold Stars */}
              <div className="flex items-center space-x-1 mb-4 text-[#DFC076]">
                {Array.from({ length: item.rating }).map((_, i) => (
                  <Star key={i} className="w-4 h-4 fill-current text-[#DFC076]" />
                ))}
              </div>

              {/* Quote Text */}
              <p className="text-xs sm:text-sm text-slate-700 leading-relaxed font-normal italic mb-6">
                "{item.quote}"
              </p>
            </div>

            {/* Author Footer */}
            <div className="flex items-center space-x-3 pt-4 border-t border-[#F0ECE1]">
              <div className="w-10 h-10 rounded-full bg-[#0B3B2C] text-[#DFC076] font-serif font-bold text-xs flex items-center justify-center shrink-0 shadow-2xs">
                {item.avatarInitials}
              </div>
              <div className="min-w-0 flex-1">
                <span className="font-serif font-bold text-xs sm:text-sm text-[#1C2826] block truncate">
                  {item.authorName}
                </span>
                <span className="text-[11px] text-slate-500 block truncate">
                  {item.roleBadge}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
};
