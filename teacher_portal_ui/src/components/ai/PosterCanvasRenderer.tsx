import { useState, useEffect, useRef } from 'react';
import { Download, Sliders, RefreshCw, Sparkles, Check } from 'lucide-react';

export interface PosterCanvasRendererProps {
  poster: {
    imageDataUrl?: string;
    backgroundDataUrl?: string;
    title?: string;
    eventTitle?: string;
    headline?: string;
    subtitle?: string;
    category?: string;
    dateText?: string;
    dateTime?: string;
    dateLine?: string;
    venue?: string;
    venueLine?: string;
    madrasaName?: string;
    bismillahLine?: string;
    language?: string;
  };
  className?: string;
}

function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number
) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + width - radius, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
  ctx.lineTo(x + width, y + height - radius);
  ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  ctx.lineTo(x + radius, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}

function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number
): number {
  const words = text.split(' ');
  let line = '';
  let currentY = y;

  for (let n = 0; n < words.length; n++) {
    const testLine = line + words[n] + ' ';
    const metrics = ctx.measureText(testLine);
    const testWidth = metrics.width;
    if (testWidth > maxWidth && n > 0) {
      ctx.fillText(line.trim(), x, currentY);
      line = words[n] + ' ';
      currentY += lineHeight;
    } else {
      line = testLine;
    }
  }
  ctx.fillText(line.trim(), x, currentY);
  return currentY;
}

function drawProceduralIslamicBackdrop(ctx: CanvasRenderingContext2D, width: number, height: number) {
  // 1. Deep Royal Emerald to Navy Gradient
  const grad = ctx.createRadialGradient(width / 2, height * 0.35, 50, width / 2, height / 2, width * 0.9);
  grad.addColorStop(0, '#064e3b');
  grad.addColorStop(0.5, '#022c22');
  grad.addColorStop(1, '#09111e');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, width, height);

  // 2. Starry Ambient Sparkles
  ctx.fillStyle = 'rgba(253, 224, 71, 0.65)';
  const starSeeds = [
    [120, 150, 2], [240, 280, 1.5], [380, 120, 2.5], [720, 140, 2],
    [860, 220, 1.5], [940, 320, 2.5], [180, 480, 1.5], [890, 520, 2],
    [320, 320, 1.5], [780, 380, 2], [540, 160, 3], [650, 260, 1.5],
  ];
  for (const [sx, sy, sr] of starSeeds) {
    ctx.beginPath();
    ctx.arc(sx, sy, sr, 0, Math.PI * 2);
    ctx.fill();
  }

  // 3. Glowing Golden Crescent Moon
  ctx.save();
  ctx.shadowColor = 'rgba(245, 158, 11, 0.7)';
  ctx.shadowBlur = 30;
  ctx.fillStyle = '#FDE047';
  ctx.beginPath();
  ctx.arc(width / 2, height * 0.28, 48, 0, Math.PI * 2);
  ctx.fill();
  // Cutout to form crescent
  ctx.shadowBlur = 0;
  ctx.fillStyle = '#064e3b';
  ctx.beginPath();
  ctx.arc(width / 2 + 18, height * 0.28 - 10, 42, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // 4. Grand Andalusian Horseshoe Archway Outline
  ctx.save();
  ctx.strokeStyle = 'rgba(245, 158, 11, 0.45)';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(110, height - 100);
  ctx.lineTo(110, height * 0.48);
  ctx.arc(width / 2, height * 0.48, width / 2 - 110, Math.PI, 0, false);
  ctx.lineTo(width - 110, height - 100);
  ctx.stroke();

  // Inner filigree arch
  ctx.strokeStyle = 'rgba(55, 198, 163, 0.35)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(135, height - 100);
  ctx.lineTo(135, height * 0.49);
  ctx.arc(width / 2, height * 0.49, width / 2 - 135, Math.PI, 0, false);
  ctx.lineTo(width - 135, height - 100);
  ctx.stroke();
  ctx.restore();

  // 5. Hanging Fanoos Lanterns
  const drawLantern = (lx: number, ly: number, lsize: number) => {
    ctx.save();
    // String
    ctx.strokeStyle = '#F59E0B';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(lx, 0);
    ctx.lineTo(lx, ly);
    ctx.stroke();

    // Lantern Glow
    const glow = ctx.createRadialGradient(lx, ly + lsize / 2, 2, lx, ly + lsize / 2, lsize * 2);
    glow.addColorStop(0, 'rgba(253, 224, 71, 0.5)');
    glow.addColorStop(1, 'transparent');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(lx, ly + lsize / 2, lsize * 2, 0, Math.PI * 2);
    ctx.fill();

    // Lantern Body
    ctx.fillStyle = '#F59E0B';
    ctx.beginPath();
    ctx.moveTo(lx, ly);
    ctx.lineTo(lx + lsize / 2, ly + lsize * 0.3);
    ctx.lineTo(lx + lsize * 0.35, ly + lsize * 0.85);
    ctx.lineTo(lx, ly + lsize);
    ctx.lineTo(lx - lsize * 0.35, ly + lsize * 0.85);
    ctx.lineTo(lx - lsize / 2, ly + lsize * 0.3);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  };

  drawLantern(220, 240, 50);
  drawLantern(width - 220, 240, 50);
}

export default function PosterCanvasRenderer({ poster, className = '' }: PosterCanvasRendererProps) {
  const [aspectRatio, setAspectRatio] = useState<'portrait' | 'square'>('portrait');
  const [headline, setHeadline] = useState(
    poster.headline || poster.eventTitle || poster.title || 'ISLAMIC CEREMONY & EVENT'
  );
  const [subtitle, setSubtitle] = useState(
    poster.subtitle || 'Sacred Reflections, Qur\'anic Recitation & Community Blessings'
  );
  const [category, setCategory] = useState(poster.category || 'Special Madrasa Event');
  const [madrasaName, setMadrasaName] = useState(poster.madrasaName || 'MadrasaNexa Islamic Academy');
  const [dateTime, setDateTime] = useState(poster.dateLine || poster.dateTime || poster.dateText || '');
  const [venue, setVenue] = useState(poster.venueLine || poster.venue || poster.madrasaName || 'Madrasa Main Auditorium Hall');
  const [bismillah, setBismillah] = useState(poster.bismillahLine || 'بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ');
  const [showEditor, setShowEditor] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [downloadSuccess, setDownloadSuccess] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const renderCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = 1080;
    const height = aspectRatio === 'portrait' ? 1350 : 1080;
    canvas.width = width;
    canvas.height = height;

    const drawForegroundContent = () => {
      // 1. Soft Dark Vignette Overlay for Readability
      const gradient = ctx.createLinearGradient(0, 0, 0, height);
      gradient.addColorStop(0, 'rgba(15, 23, 42, 0.75)');
      gradient.addColorStop(0.25, 'rgba(15, 23, 42, 0.52)');
      gradient.addColorStop(0.72, 'rgba(15, 23, 42, 0.52)');
      gradient.addColorStop(1, 'rgba(15, 23, 42, 0.92)');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, width, height);

      // 2. Ornate Double Islamic Gold / Emerald Border
      ctx.strokeStyle = '#37C6A3';
      ctx.lineWidth = 6;
      ctx.strokeRect(36, 36, width - 72, height - 72);

      ctx.strokeStyle = '#F59E0B';
      ctx.lineWidth = 2;
      ctx.strokeRect(48, 48, width - 96, height - 96);

      // Corner rosettes
      const drawRosette = (cx: number, cy: number) => {
        ctx.fillStyle = '#F59E0B';
        ctx.beginPath();
        ctx.arc(cx, cy, 7, 0, Math.PI * 2);
        ctx.fill();
      };
      drawRosette(58, 58);
      drawRosette(width - 58, 58);
      drawRosette(58, height - 58);
      drawRosette(width - 58, height - 58);

      // 3. Bismillah Header (Luminous Gold / Ivory)
      ctx.textAlign = 'center';
      ctx.fillStyle = '#FDE047';
      ctx.shadowColor = 'rgba(0, 0, 0, 0.9)';
      ctx.shadowBlur = 14;
      ctx.font = 'bold 36px "Traditional Arabic", "Amiri", "Scheherazade New", serif, sans-serif';
      ctx.fillText(bismillah, width / 2, 110);

      // 4. Madrasa Name Pill Banner
      ctx.shadowBlur = 0;
      const madrasaUpper = (madrasaName || 'MADRASANEXA ACADEMY').toUpperCase();
      ctx.font = 'bold 22px system-ui, -apple-system, sans-serif';
      const madrasaWidth = Math.min(width - 160, ctx.measureText(madrasaUpper).width + 60);
      const pillY = 145;
      const pillH = 46;

      ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
      drawRoundedRect(ctx, (width - madrasaWidth) / 2, pillY, madrasaWidth, pillH, 23);
      ctx.fill();
      ctx.strokeStyle = 'rgba(55, 198, 163, 0.85)';
      ctx.lineWidth = 2;
      ctx.stroke();

      ctx.fillStyle = '#37C6A3';
      ctx.fillText(madrasaUpper, width / 2, pillY + 30);

      // 5. Category Pill Badge
      const catUpper = (category || 'ISLAMIC CEREMONY').toUpperCase();
      ctx.font = 'bold 17px system-ui, -apple-system, sans-serif';
      const catWidth = Math.min(width - 200, ctx.measureText(catUpper).width + 40);
      const catY = 215;
      ctx.fillStyle = 'rgba(245, 158, 11, 0.25)';
      drawRoundedRect(ctx, (width - catWidth) / 2, catY, catWidth, 34, 17);
      ctx.fill();
      ctx.strokeStyle = '#F59E0B';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      ctx.fillStyle = '#FDE047';
      ctx.fillText(catUpper, width / 2, catY + 23);

      // 6. Bold Headline Centerpiece (Luminous Ivory/Gold)
      const titleY = aspectRatio === 'portrait' ? 430 : 370;
      ctx.shadowColor = 'rgba(0, 0, 0, 0.98)';
      ctx.shadowBlur = 20;
      ctx.fillStyle = '#FFFFFF';

      let titleFontSize = 62;
      if (headline.length > 55) titleFontSize = 44;
      else if (headline.length > 32) titleFontSize = 52;
      ctx.font = `bold ${titleFontSize}px system-ui, -apple-system, "Segoe UI", Roboto, sans-serif`;

      const titleBottomY = wrapText(ctx, headline, width / 2, titleY, width - 180, titleFontSize + 20);

      // 7. Subtitle / Tagline
      ctx.shadowBlur = 8;
      ctx.fillStyle = '#E2E8F0';
      ctx.font = '500 24px system-ui, -apple-system, sans-serif';
      const subtitleY = titleBottomY + 45;
      wrapText(ctx, subtitle, width / 2, subtitleY, width - 200, 34);

      // 8. Decorative Divider Line under Subtitle
      ctx.shadowBlur = 0;
      const dividerY = subtitleY + 40;
      const gradLine = ctx.createLinearGradient(width / 2 - 180, dividerY, width / 2 + 180, dividerY);
      gradLine.addColorStop(0, 'transparent');
      gradLine.addColorStop(0.5, '#37C6A3');
      gradLine.addColorStop(1, 'transparent');
      ctx.strokeStyle = gradLine;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(width / 2 - 180, dividerY);
      ctx.lineTo(width / 2 + 180, dividerY);
      ctx.stroke();

      // 9. Date & Venue Badges (Only rendered if present — no fake dates)
      const hasDate = Boolean(dateTime && dateTime.trim().length > 0);
      const hasVenue = Boolean(venue && venue.trim().length > 0);

      if (hasDate || hasVenue) {
        const badgeStartY = aspectRatio === 'portrait' ? height - 250 : height - 200;

        if (hasDate) {
          const dateTextContent = `📅  ${dateTime.trim()}`;
          ctx.font = 'bold 23px system-ui, -apple-system, sans-serif';
          const dateW = Math.min(width - 140, ctx.measureText(dateTextContent).width + 60);
          const dateH = 52;
          ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
          drawRoundedRect(ctx, (width - dateW) / 2, badgeStartY, dateW, dateH, 26);
          ctx.fill();
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
          ctx.lineWidth = 1.5;
          ctx.stroke();

          ctx.fillStyle = '#FFFFFF';
          ctx.fillText(dateTextContent, width / 2, badgeStartY + 35);
        }

        if (hasVenue) {
          const venueY = hasDate ? badgeStartY + 66 : badgeStartY + 10;
          const venueTextContent = `📍  ${venue.trim()}`;
          ctx.font = 'bold 21px system-ui, -apple-system, sans-serif';
          const venueW = Math.min(width - 140, ctx.measureText(venueTextContent).width + 60);
          const venueH = 48;
          ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
          drawRoundedRect(ctx, (width - venueW) / 2, venueY, venueW, venueH, 24);
          ctx.fill();
          ctx.strokeStyle = 'rgba(55, 198, 163, 0.75)';
          ctx.lineWidth = 1.5;
          ctx.stroke();

          ctx.fillStyle = '#37C6A3';
          ctx.fillText(venueTextContent, width / 2, venueY + 32);
        }
      }

      // 10. Institutional Watermark
      ctx.font = '14px system-ui, -apple-system, sans-serif';
      ctx.fillStyle = 'rgba(255, 255, 255, 0.45)';
      ctx.fillText('MADRASANEXA SMART AI POSTER STUDIO', width / 2, height - 56);

      setPreviewUrl(canvas.toDataURL('image/png'));
    };

    const imgSrc = poster.backgroundDataUrl || poster.imageDataUrl;
    if (imgSrc) {
      const bgImg = new Image();
      bgImg.crossOrigin = 'anonymous';
      bgImg.onload = () => {
        const scale = Math.max(width / bgImg.width, height / bgImg.height);
        const x = (width - bgImg.width * scale) / 2;
        const y = (height - bgImg.height * scale) / 2;
        ctx.drawImage(bgImg, x, y, bgImg.width * scale, bgImg.height * scale);
        drawForegroundContent();
      };
      bgImg.onerror = () => {
        // Fallback to rich procedural Islamic artwork if image fails to load
        drawProceduralIslamicBackdrop(ctx, width, height);
        drawForegroundContent();
      };
      bgImg.src = imgSrc;
    } else {
      // Fallback to rich procedural Islamic artwork
      drawProceduralIslamicBackdrop(ctx, width, height);
      drawForegroundContent();
    }
  };

  useEffect(() => {
    renderCanvas();
  }, [aspectRatio, headline, subtitle, category, madrasaName, dateTime, venue, bismillah]);

  const handleDownload = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const link = document.createElement('a');
    const safeTitle = headline.trim().replace(/[^a-zA-Z0-9_\u0600-\u06FF\u0B80-\u0BFF]/g, '_');
    link.download = `${safeTitle || 'Islamic_Event'}_poster.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
    setDownloadSuccess(true);
    setTimeout(() => setDownloadSuccess(false), 2500);
  };

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Hidden Offscreen High-Res Canvas */}
      <canvas ref={canvasRef} className="hidden" />

      {/* Main Composite Image Display (Sleek Rounded Card) */}
      <div className="relative rounded-2xl overflow-hidden shadow-2xl border border-slate-700 bg-slate-950 max-w-md mx-auto group">
        {previewUrl ? (
          <img
            src={previewUrl}
            alt={headline}
            className="w-full h-auto object-contain transition-transform duration-300 group-hover:scale-[1.01]"
          />
        ) : (
          <div className="aspect-[4/5] flex items-center justify-center text-slate-400">
            <RefreshCw className="w-8 h-8 animate-spin text-[#37C6A3]" />
          </div>
        )}

        {/* Floating Format Badge */}
        <div className="absolute top-3 right-3 px-2.5 py-1 rounded-full bg-slate-900/80 backdrop-blur-md border border-slate-700 text-[10px] font-bold text-white flex items-center gap-1">
          <Sparkles className="w-3 h-3 text-[#37C6A3]" />
          <span>{aspectRatio === 'portrait' ? 'Portrait (4:5)' : 'Square (1:1)'}</span>
        </div>
      </div>

      {/* Clean Gemini-Style Action Buttons */}
      <div className="flex items-center justify-center gap-2 flex-wrap">
        <button
          type="button"
          onClick={handleDownload}
          className="px-4 py-2 min-h-[40px] rounded-xl bg-[#0F172A] hover:bg-[#1E293B] text-white text-xs font-bold transition flex items-center gap-2 cursor-pointer shadow-md border border-emerald-500/30"
        >
          {downloadSuccess ? (
            <Check className="w-4 h-4 text-[#37C6A3]" />
          ) : (
            <Download className="w-4 h-4 text-[#37C6A3]" />
          )}
          <span>{downloadSuccess ? 'Downloaded!' : 'Download HD Poster'}</span>
        </button>

        <button
          type="button"
          onClick={() => setAspectRatio(aspectRatio === 'portrait' ? 'square' : 'portrait')}
          className="px-3.5 py-2 min-h-[40px] rounded-xl bg-white hover:bg-slate-50 text-[#0F172A] text-xs font-semibold border border-[#E7E9EE] transition flex items-center gap-1.5 cursor-pointer shadow-xs"
        >
          <span>📐 {aspectRatio === 'portrait' ? '1:1 Square' : '4:5 Portrait'}</span>
        </button>

        <button
          type="button"
          onClick={() => setShowEditor(!showEditor)}
          className={`px-3.5 py-2 min-h-[40px] rounded-xl text-xs font-semibold border transition flex items-center gap-1.5 cursor-pointer shadow-xs ${
            showEditor
              ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
              : 'bg-white hover:bg-slate-50 text-[#0F172A] border-[#E7E9EE]'
          }`}
        >
          <Sliders className="w-3.5 h-3.5 text-[#37C6A3]" />
          <span>{showEditor ? 'Hide Text Editor' : '✏️ Edit Text'}</span>
        </button>
      </div>

      {/* Collapsed Optional Live Typography Editor */}
      {showEditor && (
        <div className="bg-[#F7F6F1] rounded-2xl p-4 sm:p-5 border border-[#E7E9EE] text-left space-y-3 animate-fade-in max-w-xl mx-auto">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-bold text-[#0F172A]">Live Typography Customizer</h4>
            <span className="text-[10px] text-[#7C8A9A]">Instant client-side re-render</span>
          </div>

          <div className="space-y-2.5 text-xs">
            <div>
              <label className="block text-[11px] font-bold text-[#0F172A] mb-1">Bismillah Line</label>
              <input
                type="text"
                value={bismillah}
                onChange={(e) => setBismillah(e.target.value)}
                className="w-full h-9 px-3 text-xs rounded-lg border border-[#E7E9EE] bg-white focus:outline-hidden focus:border-[#37C6A3]"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-[#0F172A] mb-1">Headline Title</label>
              <input
                type="text"
                value={headline}
                onChange={(e) => setHeadline(e.target.value)}
                className="w-full h-9 px-3 text-xs rounded-lg border border-[#E7E9EE] bg-white focus:outline-hidden focus:border-[#37C6A3]"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-[#0F172A] mb-1">Event Subtitle / Tagline</label>
              <input
                type="text"
                value={subtitle}
                onChange={(e) => setSubtitle(e.target.value)}
                className="w-full h-9 px-3 text-xs rounded-lg border border-[#E7E9EE] bg-white focus:outline-hidden focus:border-[#37C6A3]"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <div>
                <label className="block text-[11px] font-bold text-[#0F172A] mb-1">Category</label>
                <input
                  type="text"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full h-9 px-3 text-xs rounded-lg border border-[#E7E9EE] bg-white focus:outline-hidden focus:border-[#37C6A3]"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-[#0F172A] mb-1">Madrasa Name</label>
                <input
                  type="text"
                  value={madrasaName}
                  onChange={(e) => setMadrasaName(e.target.value)}
                  className="w-full h-9 px-3 text-xs rounded-lg border border-[#E7E9EE] bg-white focus:outline-hidden focus:border-[#37C6A3]"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <div>
                <label className="block text-[11px] font-bold text-[#0F172A] mb-1">Date & Time (Optional)</label>
                <input
                  type="text"
                  value={dateTime}
                  placeholder="Leave empty if not applicable"
                  onChange={(e) => setDateTime(e.target.value)}
                  className="w-full h-9 px-3 text-xs rounded-lg border border-[#E7E9EE] bg-white focus:outline-hidden focus:border-[#37C6A3]"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-[#0F172A] mb-1">Venue (Optional)</label>
                <input
                  type="text"
                  value={venue}
                  onChange={(e) => setVenue(e.target.value)}
                  className="w-full h-9 px-3 text-xs rounded-lg border border-[#E7E9EE] bg-white focus:outline-hidden focus:border-[#37C6A3]"
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
