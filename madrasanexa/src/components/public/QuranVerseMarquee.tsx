// Exact Qur'anic Verse (Surah At-Talaq 65:2-3)
const QURAN_VERSE_ARABIC = 'وَمَنْ يَتَّقِ اللَّهَ يَجْعَلْ لَهُ مَخْرَجًا  وَيَرْزُقْهُ مِنْ حَيْثُ لَا يَحْتَسِبُ ۚ وَمَنْ يَتَوَكَّلْ عَلَى اللَّهِ فَهُوَ حَسْبُهُ';

export default function QuranVerseMarquee() {
  return (
    <div className="w-full pt-22 sm:pt-26 md:pt-28 pb-1 sm:pb-2 px-3 sm:px-6 md:px-8 relative z-20">
      <div className="max-w-7xl mx-auto overflow-hidden">
        {/* Pure Marquee Track - Zero Card, Zero Border, Zero Shadow, Zero Background */}
        <div className="quran-marquee-track flex items-center whitespace-nowrap py-1">
          {/* Duplicated for infinite seamless continuous loop */}
          {[1, 2, 3, 4].map((index) => (
            <div
              key={index}
              className="inline-flex items-center shrink-0 pr-16 sm:pr-24 lg:pr-32"
            >
              <span
                lang="ar"
                dir="rtl"
                className="text-xl sm:text-2xl md:text-3xl lg:text-4xl text-[#504F34] font-medium tracking-normal selection:bg-[#A5A477]/20 leading-relaxed"
                style={{
                  fontFamily: "'Amiri', 'Traditional Arabic', 'Scheherazade', 'Noto Naskh Arabic', serif",
                }}
              >
                {QURAN_VERSE_ARABIC}
              </span>
            </div>
          ))}
        </div>
      </div>

      <style>{`
        @keyframes quranMarqueeRtl {
          0% {
            transform: translateX(0%);
          }
          100% {
            transform: translateX(-50%);
          }
        }

        .quran-marquee-track {
          display: flex;
          width: max-content;
          animation: quranMarqueeRtl 35s linear infinite;
          will-change: transform;
        }

        .quran-marquee-track:hover {
          animation-play-state: paused;
        }

        @media (prefers-reduced-motion: reduce) {
          .quran-marquee-track {
            animation: none !important;
            transform: none !important;
            width: 100% !important;
            justify-content: center !important;
            white-space: normal !important;
          }
        }
      `}</style>
    </div>
  );
}
