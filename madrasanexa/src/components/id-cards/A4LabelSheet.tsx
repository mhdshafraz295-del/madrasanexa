import React from 'react';
import type { CardPrintData } from '../../services/student-token.service';
import {
  StudentCredentialLabel,
  type LabelStyle,
  type CredentialMode,
  type CuttingGuideStyle,
} from './StudentCredentialLabel';

export interface A4LabelSheetProps {
  cards: CardPrintData[];
  columns?: number;
  rows?: number;
  labelWidth?: number;
  labelHeight?: number;
  gapX?: number;
  gapY?: number;
  marginX?: number;
  marginY?: number;
  style?: LabelStyle;
  credentialMode?: CredentialMode;
  cuttingGuide?: CuttingGuideStyle;
  showCuttingGuides?: boolean;
  madrasaName?: string;
  showAdmissionNo?: boolean;
  showInstitution?: boolean;
  pageNumber?: number;
  totalPages?: number;
  className?: string;
}

/**
 * A4LabelSheet - Renders a full A4 sheet (210mm x 297mm) containing an intelligent
 * grid of individual student credential labels with precise physical dimensions.
 *
 * Physical Geometry:
 * - Page Dimensions: Exact A4 (210.00 mm x 297.00 mm).
 * - Margin & Grid calculations ensure zero clipping and zero overlapping labels.
 * - Exterior metadata header/footer bands for print identification and alignment.
 */
export const A4LabelSheet: React.FC<A4LabelSheetProps> = ({
  cards,
  columns = 3,
  rows = 5,
  labelWidth = 58,
  labelHeight = 44,
  gapX = 6,
  gapY = 6,
  marginX = 12,
  marginY = 16,
  style = 'professional',
  credentialMode = 'qr_only',
  cuttingGuide = 'dotted',
  showCuttingGuides = true,
  madrasaName = 'Madrasa Portal',
  showAdmissionNo = true,
  showInstitution = true,
  pageNumber = 1,
  totalPages = 1,
  className = '',
}) => {
  // Build grid positions for all rows and columns
  const gridSlots: Array<{
    colIndex: number;
    rowIndex: number;
    posX: number;
    posY: number;
    card: CardPrintData | null;
  }> = [];

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < columns; c++) {
      const slotIndex = r * columns + c;
      const card = slotIndex < cards.length ? cards[slotIndex] : null;
      const posX = marginX + c * (labelWidth + gapX);
      const posY = marginY + r * (labelHeight + gapY);

      gridSlots.push({
        colIndex: c,
        rowIndex: r,
        posX,
        posY,
        card,
      });
    }
  }

  const effectiveCuttingGuide: CuttingGuideStyle = showCuttingGuides ? cuttingGuide : 'none';

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
      data-sheet-page={pageNumber}
      data-total-pages={totalPages}
    >
      {/* ==================================================== */}
      {/* 1. Header Metadata Band (Top 8mm outside label area) */}
      {/* ==================================================== */}
      <div
        className="absolute inset-x-0 top-[4mm] flex items-center justify-between px-[12mm] text-[1.8mm] font-mono text-stone-400 border-b border-stone-200/80 pb-[0.8mm]"
        style={{ height: '7mm' }}
      >
        <div className="flex items-center gap-[2mm]">
          <span className="font-bold uppercase text-[#0F172A]">{madrasaName}</span>
          <span>•</span>
          <span className="text-[#0F5A47] font-semibold">
            STUDENT CREDENTIAL LABELS ({credentialMode.toUpperCase().replace(/_/g, ' ')})
          </span>
        </div>

        <div className="flex items-center gap-[3mm]">
          <span>
            {columns}×{rows} Grid · {labelWidth}×{labelHeight} mm
          </span>
          <span className="bg-stone-100 px-[1.5mm] py-[0.4mm] rounded-sm font-bold text-stone-800">
            PAGE {pageNumber} OF {totalPages}
          </span>
        </div>
      </div>

      {/* ==================================================== */}
      {/* 2. Intelligent Grid Rendering of Labels */}
      {/* ==================================================== */}
      {gridSlots.map((slot, idx) => {
        if (!slot.card) {
          // Unused slot at the end of the last page
          return null;
        }

        return (
          <div
            key={`label-slot-${slot.rowIndex}-${slot.colIndex}-${idx}`}
            className="absolute"
            style={{
              left: `${slot.posX}mm`,
              top: `${slot.posY}mm`,
              width: `${labelWidth}mm`,
              height: `${labelHeight}mm`,
              boxSizing: 'border-box',
            }}
          >
            <StudentCredentialLabel
              card={slot.card}
              style={style}
              credentialMode={credentialMode}
              cuttingGuide={effectiveCuttingGuide}
              widthMm={labelWidth}
              heightMm={labelHeight}
              madrasaName={madrasaName}
              showAdmissionNo={showAdmissionNo}
              showInstitution={showInstitution}
            />
          </div>
        );
      })}

      {/* ==================================================== */}
      {/* 3. Footer Metadata Band (Bottom 8mm outside label area) */}
      {/* ==================================================== */}
      <div
        className="absolute inset-x-0 bottom-[4mm] flex items-center justify-between px-[12mm] text-[1.6mm] font-mono text-stone-400 border-t border-stone-200/80 pt-[0.8mm]"
        style={{ height: '7mm' }}
      >
        <span>MadrasaNexa Credential Studio · ISO Standard A4 (210 × 297 mm)</span>
        <span className="font-semibold text-stone-600">
          Print Scale: 100% / Actual Size (Disable &quot;Fit to Printable Area&quot;) · Cut along lines
        </span>
      </div>
    </div>
  );
};

export default A4LabelSheet;
