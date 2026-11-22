import { useState, useEffect, useRef } from 'react';
import { Download, Sliders, RefreshCw, Sparkles } from 'lucide-react';

export interface PosterCanvasRendererProps {
  poster: {
    imageDataUrl: string;
    backgroundDataUrl?: string;
    title: string;
    eventTitle?: string;
    category?: string;
    dateText?: string;
    dateTime?: string;
    venue?: string;
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

export default function PosterCanvasRenderer({ poster, className = '' }: PosterCanvasRendererProps) {
  const [aspectRatio, setAspectRatio] = useState<'portrait' | 'square'>('portrait');
  const [title, setTitle] = useState(poster.eventTitle || poster.title || 'Islamic Ceremony & Event');
  const [category, setCategory] = useState(poster.category || 'Special Madrasa Event');
  const [madrasaName, setMadrasaName] = useState(poster.madrasaName || 'MadrasaNexa Islamic Institute');
  const [dateTime, setDateTime] = useState(poster.dateTime || poster.dateText || 'Friday, 15th Ramadan • 8:00 AM');
  const [venue, setVenue] = useState(poster.venue || 'Madrasa Main Auditorium Hall');
  const [bismillah, setBismillah] = useState(poster.bismillahLine || 'بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ');
  const [showEditor, setShowEditor] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

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

    const bgImg = new Image();
    bgImg.crossOrigin = 'anonymous';

    bgImg.onload = () => {
      // 1. Draw Background Image scaling to cover canvas
      const scale = Math.max(width / bgImg.width, height / bgImg.height);
      const x = (width - bgImg.width * scale) / 2;
      const y = (height - bgImg.height * scale) / 2;
      ctx.drawImage(bgImg, x, y, bgImg.width * scale, bgImg.height * scale);

      // 2. Soft Dark Vignette Overlay for Readability
      const gradient = ctx.createLinearGradient(0, 0, 0, height);
      gradient.addColorStop(0, 'rgba(15, 23, 42, 0.72)');
      gradient.addColorStop(0.25, 'rgba(15, 23, 42, 0.48)');
      gradient.addColorStop(0.75, 'rgba(15, 23, 42, 0.48)');
      gradient.addColorStop(1, 'rgba(15, 23, 42, 0.88)');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, width, height);

      // 3. Ornate Double Islamic Gold / Emerald Border
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

      // 4. Bismillah Header
      ctx.textAlign = 'center';
      ctx.fillStyle = '#FDE047';
      ctx.shadowColor = 'rgba(0, 0, 0, 0.85)';
      ctx.shadowBlur = 12;
      ctx.font = 'bold 36px "Traditional Arabic", "Amiri", "Scheherazade New", serif, sans-serif';
      ctx.fillText(bismillah, width / 2, 110);

      // 5. Madrasa Name Pill Banner
      ctx.shadowBlur = 0;
      const madrasaUpper = (madrasaName || 'MADRASANEXA ACADEMY').toUpperCase();
      ctx.font = 'bold 22px system-ui, -apple-system, sans-serif';
      const madrasaWidth = Math.min(width - 160, ctx.measureText(madrasaUpper).width + 60);
      const pillY = 145;
      const pillH = 46;

      ctx.fillStyle = 'rgba(15, 23, 42, 0.8)';
      drawRoundedRect(ctx, (width - madrasaWidth) / 2, pillY, madrasaWidth, pillH, 23);
      ctx.fill();
      ctx.strokeStyle = 'rgba(55, 198, 163, 0.85)';
      ctx.lineWidth = 2;
      ctx.stroke();

      ctx.fillStyle = '#37C6A3';
      ctx.fillText(madrasaUpper, width / 2, pillY + 30);

      // 6. Category Pill Badge
      const catUpper = (category || 'ISLAMIC CEREMONY').toUpperCase();
      ctx.font = 'bold 17px system-ui, -apple-system, sans-serif';
      const catWidth = Math.min(width - 200, ctx.measureText(catUpper).width + 40);
      const catY = 215;
      ctx.fillStyle = 'rgba(245, 158, 11, 0.22)';
      drawRoundedRect(ctx, (width - catWidth) / 2, catY, catWidth, 34, 17);
      ctx.fill();
      ctx.strokeStyle = '#F59E0B';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      ctx.fillStyle = '#FDE047';
      ctx.fillText(catUpper, width / 2, catY + 23);

      // 7. Event Title (Crisp, High-Resolution Typographic Centerpiece)
      const titleY = aspectRatio === 'portrait' ? 440 : 380;
      ctx.shadowColor = 'rgba(0, 0, 0, 0.95)';
      ctx.shadowBlur = 18;
      ctx.fillStyle = '#FFFFFF';

      let titleFontSize = 60;
      if (title.length > 55) titleFontSize = 44;
      else if (title.length > 32) titleFontSize = 52;
      ctx.font = `bold ${titleFontSize}px system-ui, -apple-system, "Segoe UI", Roboto, sans-serif`;

      const titleBottomY = wrapText(ctx, title, width / 2, titleY, width - 180, titleFontSize + 20);

      // 8. Decorative Divider Line under Title
      ctx.shadowBlur = 0;
      const dividerY = titleBottomY + 36;
      const gradLine = ctx.createLinearGradient(width / 2 - 160, dividerY, width / 2 + 160, dividerY);
      gradLine.addColorStop(0, 'transparent');
      gradLine.addColorStop(0.5, '#37C6A3');
      gradLine.addColorStop(1, 'transparent');
      ctx.strokeStyle = gradLine;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(width / 2 - 160, dividerY);
      ctx.lineTo(width / 2 + 160, dividerY);
      ctx.stroke();

      // 9. Date & Time + Venue Bottom Badges
      const badgeStartY = aspectRatio === 'portrait' ? height - 260 : height - 200;

      if (dateTime) {
        const dateTextContent = `📅  ${dateTime}`;
        ctx.font = 'bold 24px system-ui, -apple-system, sans-serif';
        const dateW = Math.min(width - 140, ctx.measureText(dateTextContent).width + 60);
        const dateH = 54;
        ctx.fillStyle = 'rgba(15, 23, 42, 0.88)';
        drawRoundedRect(ctx, (width - dateW) / 2, badgeStartY, dateW, dateH, 27);
        ctx.fill();
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)';
        ctx.lineWidth = 1.5;
        ctx.stroke();

        ctx.fillStyle = '#FFFFFF';
        ctx.fillText(dateTextContent, width / 2, badgeStartY + 36);
      }

      if (venue) {
        const venueY = badgeStartY + 70;
        const venueTextContent = `📍  ${venue}`;
        ctx.font = 'bold 21px system-ui, -apple-system, sans-serif';
        const venueW = Math.min(width - 140, ctx.measureText(venueTextContent).width + 60);
        const venueH = 48;
        ctx.fillStyle = 'rgba(15, 23, 42, 0.88)';
        drawRoundedRect(ctx, (width - venueW) / 2, venueY, venueW, venueH, 24);
        ctx.fill();
        ctx.strokeStyle = 'rgba(55, 198, 163, 0.7)';
        ctx.lineWidth = 1.5;
        ctx.stroke();

        ctx.fillStyle = '#37C6A3';
        ctx.fillText(venueTextContent, width / 2, venueY + 32);
      }

      // 10. Watermark
      ctx.font = '15px system-ui, -apple-system, sans-serif';
      ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
      ctx.fillText('MADRASANEXA SMART AI POSTER STUDIO', width / 2, height - 58);

      setPreviewUrl(canvas.toDataURL('image/png'));
    };

    bgImg.src = poster.backgroundDataUrl || poster.imageDataUrl;
  };

  useEffect(() => {
    renderCanvas();
  }, [aspectRatio, title, category, madrasaName, dateTime, venue, bismillah]);

  const handleDownload = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const link = document.createElement('a');
    const safeTitle = title.trim().replace(/[^a-zA-Z0-9_\u0600-\u06FF\u0B80-\u0BFF]/g, '_');
    link.download = `${safeTitle || 'Islamic_Event'}_poster.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
  };

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Hidden Offscreen High-Res Canvas */}
      <canvas ref={canvasRef} className="hidden" />

      {/* Main Composite Image Display */}
      <div className="relative rounded-2xl overflow-hidden shadow-2xl border border-slate-700 bg-slate-950 max-w-md mx-auto group">
        {previewUrl ? (
          <img
            src={previewUrl}
            alt={title}
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

      {/* Action Buttons Toolbar */}
      <div className="flex items-center justify-center gap-2 flex-wrap">
        <button
          type="button"
          onClick={handleDownload}
          className="px-4 py-2.5 min-h-[44px] rounded-xl bg-[#0F172A] hover:bg-[#1E293B] text-white text-xs font-bold transition flex items-center gap-2 cursor-pointer shadow-md border border-emerald-500/30"
        >
          <Download className="w-4 h-4 text-[#37C6A3]" />
          <span>Download High-Res PNG</span>
        </button>

        <button
          type="button"
          onClick={() => setAspectRatio(aspectRatio === 'portrait' ? 'square' : 'portrait')}
          className="px-3.5 py-2.5 min-h-[44px] rounded-xl bg-white hover:bg-slate-50 text-[#0F172A] text-xs font-semibold border border-[#E7E9EE] transition flex items-center gap-1.5 cursor-pointer shadow-xs"
        >
          <span>📐 {aspectRatio === 'portrait' ? 'Switch to Square (1:1)' : 'Switch to Portrait (4:5)'}</span>
        </button>

        <button
          type="button"
          onClick={() => setShowEditor(!showEditor)}
          className={`px-3.5 py-2.5 min-h-[44px] rounded-xl text-xs font-semibold border transition flex items-center gap-1.5 cursor-pointer shadow-xs ${
            showEditor
              ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
              : 'bg-white hover:bg-slate-50 text-[#0F172A] border-[#E7E9EE]'
          }`}
        >
          <Sliders className="w-3.5 h-3.5 text-[#37C6A3]" />
          <span>{showEditor ? 'Hide Text Editor' : '✏️ Edit Poster Text'}</span>
        </button>
      </div>

      {/* Live Interactive Text Editor Drawer */}
      {showEditor && (
        <div className="bg-[#F7F6F1] rounded-2xl p-4 sm:p-5 border border-[#E7E9EE] text-left space-y-3 animate-fade-in max-w-xl mx-auto">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-bold text-[#0F172A]">Live Typography Editor (Instant Preview)</h4>
            <span className="text-[10px] text-[#7C8A9A]">Updates canvas without re-calling AI</span>
          </div>

          <div className="space-y-2.5 text-xs">
            <div>
              <label className="block text-[11px] font-bold text-[#0F172A] mb-1">Bismillah Header</label>
              <input
                type="text"
                value={bismillah}
                onChange={(e) => setBismillah(e.target.value)}
                className="w-full h-9 px-3 text-xs rounded-lg border border-[#E7E9EE] bg-white focus:outline-hidden focus:border-[#37C6A3]"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-[#0F172A] mb-1">Event Title</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full h-9 px-3 text-xs rounded-lg border border-[#E7E9EE] bg-white focus:outline-hidden focus:border-[#37C6A3]"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <div>
                <label className="block text-[11px] font-bold text-[#0F172A] mb-1">Category / Event Type</label>
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
                <label className="block text-[11px] font-bold text-[#0F172A] mb-1">Date & Time</label>
                <input
                  type="text"
                  value={dateTime}
                  onChange={(e) => setDateTime(e.target.value)}
                  className="w-full h-9 px-3 text-xs rounded-lg border border-[#E7E9EE] bg-white focus:outline-hidden focus:border-[#37C6A3]"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-[#0F172A] mb-1">Venue</label>
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
