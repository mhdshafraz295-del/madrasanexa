import React from 'react';
import type { CardPrintData } from '../../services/student-token.service';
import { IdCardFront } from './IdCardFront';
import { IdCardBack } from './IdCardBack';

export interface A4CardSheetProps {
  cards: CardPrintData[];
  sheetType: 'front' | 'back';
  mirrorColumns?: boolean;
  offsetX?: number;
  offsetY?: number;
  pageNumber?: number;
  totalPages?: number;
  madrasaName: string;
  madrasaCode?: string | null;
  logoUrl?: string | null;
  academicYear?: string;
  madrasaPhone?: string | null;
  madrasaEmail?: string | null;
  className?: string;
}

/**
 * A4CardSheet - Renders 8 CR80 Student ID Cards on a Single A4 Sheet in 2x4 Grid.
 *
 * Exact Physical Geometry (A4 210mm x 297mm):
 * - Total Card Dimensions: 85.60 mm x 53.98 mm (ISO/IEC 7810 ID-1).
 * - Horizontal Margins: 14.40 mm left & right.
 * - Vertical Margins: 34.54 mm top & bottom.
 * - Horizontal Gutter: 10.00 mm (1 central gutter between columns).
 * - Vertical Gutter: 4.00 mm (3 gutters between rows).
 * - Exterior Crop Marks: 3.00 mm hairline tick marks outside card perimeter.
 * - Duplex Column Mirroring: On back sheets, Col 1 <-> Col 2 swaps for long-edge duplex alignment.
 */
export const A4CardSheet: React.FC<A4CardSheetProps> = ({
  cards,
  sheetType,
  mirrorColumns = true,
  offsetX = 0,
  offsetY = 0,
  pageNumber = 1,
  totalPages = 1,
  madrasaName,
  madrasaCode,
  logoUrl,
  academicYear = '2025/2026',
  madrasaPhone,
  madrasaEmail,
  className = '',
}) => {
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

  // Organize cards into 4 rows of 2 cards (up to 8 cards total per sheet)
  const rows: Array<{ col0Card: CardPrintData | null; col1Card: CardPrintData | null }> = [];
  for (let r = 0; r < 4; r++) {
    const rawIndex0 = r * 2;
    const rawIndex1 = r * 2 + 1;

    const card0 = rawIndex0 < cards.length ? cards[rawIndex0] : null;
    const card1 = rawIndex1 < cards.length ? cards[rawIndex1] : null;

    if (sheetType === 'back' && mirrorColumns) {
      // Long-edge duplex horizontal mirror: Col 0 becomes card1, Col 1 becomes card0
      rows.push({
        col0Card: card1,
        col1Card: card0,
      });
    } else {
      // Standard order
      rows.push({
        col0Card: card0,
        col1Card: card1,
      });
    }
  }

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
      data-sheet-type={sheetType}
      data-sheet-page={pageNumber}
    >
      {/* Sheet Top Header Metadata Band (Outside card content area) */}
      <div
        className="absolute flex items-center justify-between text-[1.8mm] font-mono text-stone-500 border-b border-stone-200/80 pb-[1mm]"
        style={{
          position: 'absolute',
          top: '6mm',
          left: '14.4mm',
          right: '14.4mm',
          height: '8mm',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderBottom: '1px solid #e2e8f0',
          paddingBottom: '1mm',
          fontSize: '1.8mm',
          fontFamily: 'monospace',
          color: '#64748b',
          boxSizing: 'border-box',
        }}
      >
        <div className="flex items-center gap-[2mm]">
          <span className="font-bold uppercase text-[#0F172A]">{madrasaName}</span>
          <span>•</span>
          <span className="text-[#0F5A47] font-semibold">{academicYear}</span>
        </div>

        <div className="flex items-center gap-[3mm]">
          <span className="font-bold text-stone-800">
            {sheetType === 'front'
              ? 'A4 BATCH: FRONT SHEET'
              : mirrorColumns
              ? 'A4 BATCH: BACK SHEET (DUPLEX MIRRORED)'
              : 'A4 BATCH: BACK SHEET (STANDARD)'}
          </span>
          <span className="bg-stone-100 px-[1.5mm] py-[0.4mm] rounded-sm font-bold">
            PAGE {pageNumber} OF {totalPages}
          </span>
        </div>
      </div>

      {/* 2x4 Grid Rendering */}
      {rows.map((row, rowIndex) => {
        const rowY = rowPositions[rowIndex];

        return [
          { card: row.col0Card, colX: colPositions[0], colIndex: 0 },
          { card: row.col1Card, colX: colPositions[1], colIndex: 1 },
        ].map(({ card, colX, colIndex }) => {
          const slotIndex = rowIndex * 2 + colIndex;

          return (
            <div
              key={`sheet-slot-${rowIndex}-${colIndex}`}
              className="absolute"
              style={{
                left: `${colX}mm`,
                top: `${rowY}mm`,
                width: `${cardWidth}mm`,
                height: `${cardHeight}mm`,
                boxSizing: 'border-box',
              }}
            >
              {/* Corner Cutting / Crop Marks (3.0 mm ticks extending into margins/gutters) */}
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

              {/* Render Card Design or Empty Slot Placeholder */}
              {card ? (
                sheetType === 'front' ? (
                  <IdCardFront
                    student={card.student}
                    madrasaName={madrasaName}
                    madrasaCode={madrasaCode}
                    logoUrl={logoUrl}
                    academicYear={academicYear}
                    cardVersion={card.card.version}
                    issuedAt={card.card.issuedAt}
                  />
                ) : (
                  <IdCardBack
                    student={card.student}
                    madrasaName={madrasaName}
                    madrasaPhone={madrasaPhone}
                    madrasaEmail={madrasaEmail}
                    tokenHint={card.card.tokenHint}
                    rawToken={card.card.rawToken}
                  />
                )
              ) : (
                <div className="w-full h-full border border-dashed border-stone-300 rounded-[3.18mm] bg-stone-50/50 flex flex-col items-center justify-center text-stone-400 p-2 text-center">
                  <span className="text-[1.8mm] font-mono font-semibold">
                    SLOT #{slotIndex + 1}
                  </span>
                  <span className="text-[1.4mm] text-stone-400 mt-[0.5mm]">
                    Unallocated Slot
                  </span>
                </div>
              )}
            </div>
          );
        });
      })}

      {/* Sheet Bottom Footer Metadata Band */}
      <div
        className="absolute flex items-center justify-between text-[1.6mm] font-mono text-stone-500 border-t border-stone-200/80 pt-[1mm]"
        style={{
          position: 'absolute',
          bottom: '6mm',
          left: '14.4mm',
          right: '14.4mm',
          height: '8mm',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderTop: '1px solid #e2e8f0',
          paddingTop: '1mm',
          fontSize: '1.6mm',
          fontFamily: 'monospace',
          color: '#64748b',
          boxSizing: 'border-box',
        }}
      >
        <span>MadrasaNexa Gate F • ISO-7810 ID-1 • Exact 85.60 × 53.98 mm</span>
        <span className="font-semibold text-stone-700">
          Duplex Instruction: Flip on Long Edge • Print Scale: 100% (Do not fit to printable area)
        </span>
      </div>
    </div>
  );
};

export default A4CardSheet;
