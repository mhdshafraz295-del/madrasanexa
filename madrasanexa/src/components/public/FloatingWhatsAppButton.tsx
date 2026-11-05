import { normalizeWhatsAppNumber } from '../../services/homepage.service';

interface FloatingWhatsAppButtonProps {
  enabled?: boolean;
  number?: string;
  defaultMessage?: string;
}

export default function FloatingWhatsAppButton({
  enabled = true,
  number = '+94 78 325 4552',
  defaultMessage = 'Assalamu Alaikum, I would like to know more about MadrasaNexa.',
}: FloatingWhatsAppButtonProps) {
  if (!enabled) return null;

  const normalizedNumber = normalizeWhatsAppNumber(number || '94783254552');
  if (!normalizedNumber) return null;

  const encodedMessage = encodeURIComponent(
    defaultMessage || 'Assalamu Alaikum, I would like to know more about MadrasaNexa.'
  );
  const waUrl = `https://wa.me/${normalizedNumber}?text=${encodedMessage}`;

  return (
    <div className="fixed bottom-4 right-4 sm:bottom-6 sm:right-6 z-40 group">
      {/* Tooltip on Desktop */}
      <div
        role="tooltip"
        className="hidden sm:block absolute right-full top-1/2 -translate-y-1/2 mr-3 px-3 py-1.5 rounded-xl bg-[#0F172A] text-white text-xs font-semibold whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none shadow-lg border border-white/10"
      >
        Chat with us on WhatsApp
        <div className="absolute top-1/2 -right-1 -translate-y-1/2 w-2 h-2 bg-[#0F172A] rotate-45" />
      </div>

      {/* Floating Solid Green WhatsApp Button */}
      <a
        href={waUrl}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Chat with us on WhatsApp"
        className="flex items-center justify-center gap-2.5 p-3 sm:px-4 sm:py-2.5 rounded-full bg-[#25D366] text-white shadow-[0_8px_24px_rgba(37,211,102,0.25)] hover:bg-[#20ba5a] hover:shadow-[0_12px_28px_rgba(37,211,102,0.35)] motion-safe:hover:-translate-y-0.5 active:translate-y-0 transition-all duration-200 focus:outline-none focus-visible:ring-4 focus-visible:ring-[#25D366]/40 cursor-pointer select-none min-w-[48px] min-h-[48px]"
      >
        {/* White WhatsApp SVG Icon */}
        <svg
          className="w-5 h-5 sm:w-5 sm:h-5 fill-current text-white shrink-0"
          viewBox="0 0 24 24"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.245 2.248 3.481 5.236 3.48 8.414-.003 6.557-5.338 11.892-11.893 11.892-1.99-.001-3.951-.5-5.688-1.448l-6.305 1.654zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884-.001 2.225.651 3.891 1.746 5.634l-.999 3.648 3.742-.981zm11.387-5.464c-.074-.124-.272-.198-.57-.347-.297-.149-1.758-.868-2.031-.967-.272-.099-.47-.149-.669.149-.198.297-.768.967-.941 1.165-.173.198-.347.223-.644.074-.297-.149-1.255-.462-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.372-.025-.521-.075-.148-.669-1.611-.916-2.206-.242-.579-.487-.501-.669-.51l-.57-.01c-.198 0-.52.074-.792.372s-1.04 1.016-1.04 2.479 1.065 2.876 1.213 3.074c.149.198 2.095 3.2 5.076 4.487.709.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.695.248-1.29.173-1.414z" />
        </svg>

        {/* Text on Desktop */}
        <span className="hidden sm:inline font-bold text-xs text-white tracking-tight">
          Chat with us
        </span>
      </a>
    </div>
  );
}
