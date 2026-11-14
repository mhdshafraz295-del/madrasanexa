import React from 'react';

export interface A4CalibrationSheetProps {
  madrasaName: string;
  offsetX?: number;
  offsetY?: number;
  className?: string;
}

/**
 * A4CalibrationSheet - Physical Duplex & Dimensional Calibration Test Sheet.
 *
 * Specifications:
 * - Paper: ISO 216 A4 Portrait (210.00 mm x 297.00 mm).
 * - Exact Margins: Horizontal 14.40 mm, Vertical 34.54 mm.
 * - Exact Gutters: Horizontal 10.00 mm, Vertical 4.00 mm.
 * - 50.0 mm reference calibration ruler with millimeter tick intervals.
 * - 8 CR80 wireframe card reference boxes (85.60 mm x 53.98 mm).
 * - Duplex long-edge vs short-edge alignment guides.
 */
export const A4CalibrationSheet: React.FC<A4CalibrationSheetProps> = ({
  madrasaName,
  offsetX = 0,
  offsetY = 0,
  className = '',
}) => {
  // Grid layout parameters
  const cardWidth = 85.6;
  const cardHeight = 53.98;
  const gutterX = 10.0;
  const gutterY = 4.0;
  const baseMarginX = 14.4;
  const baseMarginY = 34.54;

  const leftMargin = baseMarginX + offsetX;
  const topMargin = baseMarginY + offsetY;

  const colPositions = [leftMargin, leftMargin + cardWidth + gutterX];
  const rowPositions = [
    topMargin,
    topMargin + cardHeight + gutterY,
    topMargin + (cardHeight + gutterY) * 2,
    topMargin + (cardHeight + gutterY) * 3,
  ];

  return (
    <div
      className={`relative bg-white text-stone-900 overflow-hidden select-none box-border print:m-0 print:border-none ${className}`}
      style={{
        width: '210.00mm',
        height: '297.00mm',
        boxSizing: 'border-box',
        position: 'relative',
        backgroundColor: '#ffffff',
      }}
      data-sheet-type="calibration"
    >
      {/* Top Sheet Header & Institutional Watermark */}
      <div
        className="absolute inset-x-0 top-[6mm] flex flex-col items-center justify-center text-center px-[10mm]"
        style={{ height: '22mm' }}
      >
        <span className="text-[2.6mm] font-bold tracking-tight text-[#0F172A] uppercase">
          {madrasaName} • A4 ID Card Print Studio Calibration Sheet
        </span>
        <span className="text-[1.8mm] font-medium text-stone-500 mt-[0.5mm]">
          ISO/IEC 7810 ID-1 (CR80) 2×4 Grid Verification • Target Dimensions: 85.60 × 53.98 mm
        </span>

        {/* 50.0 mm Metric Calibration Ruler */}
        <div className="mt-[2mm] flex flex-col items-center">
          <div className="flex items-center gap-[2mm]">
            <span className="text-[1.8mm] font-mono font-bold text-stone-700">0mm</span>
            {/* 50mm ruler line with ticks */}
            <svg
              width="50.0mm"
              height="6.0mm"
              viewBox="0 0 50 6"
              className="overflow-visible"
              style={{ shapeRendering: 'crispEdges' }}
            >
              {/* Main horizontal baseline */}
              <line x1="0" y1="5" x2="50" y2="5" stroke="#0F172A" strokeWidth="0.3" />

              {/* End boundaries */}
              <line x1="0" y1="0" x2="0" y2="5" stroke="#0F172A" strokeWidth="0.4" />
              <line x1="50" y1="0" x2="50" y2="5" stroke="#0F172A" strokeWidth="0.4" />

              {/* 10mm Major Ticks */}
              {[10, 20, 30, 40].map((mm) => (
                <line key={`major-${mm}`} x1={mm} y1="1" x2={mm} y2="5" stroke="#0F172A" strokeWidth="0.35" />
              ))}

              {/* 5mm Medium Ticks */}
              {[5, 15, 25, 35, 45].map((mm) => (
                <line key={`med-${mm}`} x1={mm} y1="2.2" x2={mm} y2="5" stroke="#475569" strokeWidth="0.25" />
              ))}

              {/* 1mm Minor Ticks */}
              {Array.from({ length: 51 }, (_, i) => i)
                .filter((mm) => mm % 5 !== 0)
                .map((mm) => (
                  <line key={`min-${mm}`} x1={mm} y1="3.5" x2={mm} y2="5" stroke="#94A3B8" strokeWidth="0.15" />
                ))}
            </svg>
            <span className="text-[1.8mm] font-mono font-bold text-stone-700">50mm</span>
          </div>

          <span className="text-[1.5mm] text-emerald-800 font-semibold mt-[0.6mm]">
            Physical Acceptance Rule: Place metric ruler over bar. Must measure exactly 50.0 mm (±0.5 mm).
          </span>
        </div>
      </div>

      {/* Center Sheet Horizontal & Vertical Crosshairs */}
      <div
        className="absolute top-0 bottom-0 pointer-events-none opacity-20 border-l border-dashed border-stone-400"
        style={{ left: '105.00mm' }}
      />
      <div
        className="absolute left-0 right-0 pointer-events-none opacity-20 border-t border-dashed border-stone-400"
        style={{ top: '148.50mm' }}
      />

      {/* 8 Card Wireframe Reference Positions with Crop Marks */}
      {rowPositions.map((rowY, rowIndex) =>
        colPositions.map((colX, colIndex) => {
          const cardIndex = rowIndex * 2 + colIndex;
          return (
            <div
              key={`cal-card-${cardIndex}`}
              className="absolute border border-stone-800/80 rounded-[3.18mm] bg-stone-50/40 flex flex-col items-center justify-between p-[3mm]"
              style={{
                left: `${colX}mm`,
                top: `${rowY}mm`,
                width: `${cardWidth}mm`,
                height: `${cardHeight}mm`,
                boxSizing: 'border-box',
              }}
            >
              {/* Corner Crop Marks (Extending 3mm outside card boundaries into margins/gutters) */}
              {/* Top-Left */}
              <div
                className="absolute pointer-events-none"
                style={{ left: '-3.0mm', top: '-3.0mm', width: '3.0mm', height: '3.0mm' }}
              >
                <div className="absolute top-0 left-0 w-[3mm] h-[0.25mm] bg-black" />
                <div className="absolute top-0 left-0 h-[3mm] w-[0.25mm] bg-black" />
              </div>
              {/* Top-Right */}
              <div
                className="absolute pointer-events-none"
                style={{ right: '-3.0mm', top: '-3.0mm', width: '3.0mm', height: '3.0mm' }}
              >
                <div className="absolute top-0 right-0 w-[3mm] h-[0.25mm] bg-black" />
                <div className="absolute top-0 right-0 h-[3mm] w-[0.25mm] bg-black" />
              </div>
              {/* Bottom-Left */}
              <div
                className="absolute pointer-events-none"
                style={{ left: '-3.0mm', bottom: '-3.0mm', width: '3.0mm', height: '3.0mm' }}
              >
                <div className="absolute bottom-0 left-0 w-[3mm] h-[0.25mm] bg-black" />
                <div className="absolute bottom-0 left-0 h-[3mm] w-[0.25mm] bg-black" />
              </div>
              {/* Bottom-Right */}
              <div
                className="absolute pointer-events-none"
                style={{ right: '-3.0mm', bottom: '-3.0mm', width: '3.0mm', height: '3.0mm' }}
              >
                <div className="absolute bottom-0 right-0 w-[3mm] h-[0.25mm] bg-black" />
                <div className="absolute bottom-0 right-0 h-[3mm] w-[0.25mm] bg-black" />
              </div>

              {/* Wireframe Interior Reference Data */}
              <div className="w-full flex items-center justify-between text-[1.8mm] font-mono text-stone-500 pb-[1mm] border-b border-stone-300">
                <span>SLOT #{cardIndex + 1}</span>
                <span>R{rowIndex + 1} • C{colIndex + 1}</span>
                <span>CR80</span>
              </div>

              <div className="flex flex-col items-center justify-center text-center my-auto">
                <span className="text-[2.2mm] font-bold text-stone-800">
                  85.60 mm × 53.98 mm
                </span>
                <span className="text-[1.6mm] text-stone-500 font-mono mt-[0.5mm]">
                  Corner Radius: 3.18 mm (0.125 in)
                </span>
                <span className="text-[1.5mm] text-emerald-800 font-semibold mt-[0.5mm]">
                  {colIndex === 0 ? 'Col 1 (Front) ⟷ Col 2 (Back)' : 'Col 2 (Front) ⟷ Col 1 (Back)'}
                </span>
              </div>

              <div className="w-full flex items-center justify-between text-[1.5mm] text-stone-400 font-mono pt-[1mm] border-t border-stone-200">
                <span>X: {colX.toFixed(2)} mm</span>
                <span>Y: {rowY.toFixed(2)} mm</span>
              </div>
            </div>
          );
        })
      )}

      {/* Bottom Sheet Duplex Orientation Guidelines */}
      <div
        className="absolute inset-x-0 bottom-[4mm] flex flex-col items-center justify-center text-center px-[10mm]"
        style={{ height: '26mm' }}
      >
        <div className="p-2 bg-stone-100 border border-stone-300 rounded-lg max-w-[180mm] text-[1.7mm] text-stone-700 leading-normal">
          <p className="font-bold text-stone-900 mb-0.5">
            DUPLEX PRINTING ACCEPTANCE & ALIGNMENT PROTOCOL
          </p>
          <p>
            1. <strong>Printer Setting:</strong> Set Paper Size to <strong>A4</strong> and Scale to <strong>100% / Actual Size</strong>. Disable &quot;Fit to Printable Area&quot;.
          </p>
          <p>
            2. <strong>Duplex Orientation:</strong> Select <strong>&quot;Flip on Long Edge&quot;</strong> (Portrait / Book Duplex). Back sheet automatically mirrors columns (Col 1 ⟷ Col 2).
          </p>
          <p>
            3. <strong>Acceptance Tolerance:</strong> Hold printed duplex sheet up to strong light. Front and back card borders must align within <strong>&lt; 0.5 mm</strong>.
          </p>
        </div>
      </div>
    </div>
  );
};

export default A4CalibrationSheet;
