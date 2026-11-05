/**
 * Centralized deterministic initials fallback generator for Madrasa institutions.
 * Used identically across:
 * - Desktop sidebar
 * - Mobile drawer
 * - Settings branding preview
 *
 * Rules:
 * - Multiple words: takes the first letter of the first 2 words (e.g., "Darul Uloom" -> "DU", "Al Hikmah" -> "AH")
 * - Single word: takes the first two letters (e.g., "Madina" -> "MA")
 * - Fallback: "MN" (MadrasaNexa)
 */
export function getMadrasaInitials(name?: string | null): string {
  if (!name || typeof name !== 'string') return 'MN';
  const clean = name.trim();
  if (!clean) return 'MN';

  const words = clean.split(/[\s-]+/).filter(Boolean);
  if (words.length >= 2) {
    return (words[0][0] + words[1][0]).toUpperCase();
  }

  if (words[0].length >= 2) {
    return words[0].slice(0, 2).toUpperCase();
  }

  return words[0][0].toUpperCase();
}
