import React, { useEffect, useRef, useState } from 'react';
import JsBarcode from 'jsbarcode';
import { Barcode, AlertCircle } from 'lucide-react';

export interface StudentBarcodeProps {
  admissionNo?: string | null;
  className?: string;
  barWidth?: number;
  heightPx?: number;
}

/**
 * StudentBarcode - Standards-compliant Code128 1D Barcode Generator for CR80 Student ID Cards.
 *
 * Requirements:
 * - Encodes student admission number into ISO/IEC 15417 Code128 symbology.
 * - Supports variable-length admission numbers with automatic Code128 subset selection.
 * - Provides adequate optical quiet zones (margins) for 1D laser / CCD barcode scanners.
 * - Renders crisp vector SVG bars with high-contrast monospace human-readable text below.
 * - Handles missing, empty, or un-encodable strings gracefully without crashing.
 */
export const StudentBarcode: React.FC<StudentBarcodeProps> = ({
  admissionNo,
  className = '',
  barWidth = 1.3,
  heightPx = 24,
}) => {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [renderError, setRenderError] = useState<string | null>(null);

  const cleanAdmissionNo = (admissionNo || '').trim();

  useEffect(() => {
    if (!svgRef.current) return;

    if (!cleanAdmissionNo) {
      setRenderError('EMPTY');
      return;
    }

    try {
      JsBarcode(svgRef.current, cleanAdmissionNo, {
        format: 'CODE128',
        displayValue: false, // Custom styled monospace typography rendered below
        lineColor: '#0F172A',
        background: 'transparent',
        margin: 0,
        width: barWidth,
        height: heightPx,
        valid: (valid) => {
          if (!valid) {
            setRenderError('INVALID_CHARS');
          } else {
            setRenderError(null);
          }
        },
      });
    } catch {
      setRenderError('RENDER_FAILED');
    }
  }, [cleanAdmissionNo, barWidth, heightPx]);

  // Missing or empty admission number fallback
  if (!cleanAdmissionNo || renderError === 'EMPTY') {
    return (
      <div
        className={`flex flex-col items-center justify-center p-1 bg-stone-50 border border-dashed border-stone-300 rounded-[1.5mm] text-center select-none ${className}`}
      >
        <Barcode className="w-8 h-4 text-stone-300 stroke-[1.2]" />
        <span className="text-[1.4mm] font-semibold text-stone-400 mt-[0.5mm]">
          No Admission No
        </span>
      </div>
    );
  }

  // Encoding or invalid character error
  if (renderError) {
    return (
      <div
        className={`flex flex-col items-center justify-center p-1 bg-rose-50 border border-rose-200 rounded-[1.5mm] text-center select-none ${className}`}
      >
        <AlertCircle className="w-4 h-4 text-rose-500 mb-[0.3mm]" />
        <span className="text-[1.3mm] font-bold text-rose-700">
          Barcode Error
        </span>
        <span className="text-[1.1mm] text-rose-600/80">
          Unencodable Character
        </span>
      </div>
    );
  }

  return (
    <div className={`flex flex-col items-center justify-center select-none ${className}`}>
      {/* Crisp Vector Code128 SVG with Optical Quiet Zones */}
      <div className="w-full flex items-center justify-center px-[1.5mm] overflow-hidden">
        <svg
          ref={svgRef}
          className="max-w-full h-auto block"
          style={{ shapeRendering: 'crispEdges' }}
          aria-label={`Code128 barcode for admission number ${cleanAdmissionNo}`}
        />
      </div>

      {/* Human Readable Monospace Text with Delimiters */}
      <span className="text-[2.0mm] font-mono font-bold text-stone-900 tracking-wider mt-[0.5mm] leading-tight block">
        *{cleanAdmissionNo}*
      </span>
    </div>
  );
};

export default StudentBarcode;
