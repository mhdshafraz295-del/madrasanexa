/**
 * Utility to cleanly separate serialized JSON metadata (such as photoUrl, photoFileId)
 * from user-facing notes, bio, remarks, or administrative text fields.
 *
 * In legacy or imported datasets, a notes or remarks field might contain a JSON blob like:
 * {"photoUrl":"https://pub-...r2.dev/...","photoFileId":"...","notes":"Real teacher note"}
 *
 * This utility extracts the true clean human note and any embedded photo metadata,
 * preventing users from seeing raw r2.dev URLs or JSON blobs in textareas and preventing
 * string length validation failures on save.
 */

export interface ParsedNotesResult {
  cleanNotes: string;
  photoUrl?: string;
  photoFileId?: string;
}

export function parseNotesField(rawNotes?: string | null): ParsedNotesResult {
  if (!rawNotes || typeof rawNotes !== 'string') {
    return { cleanNotes: '' };
  }

  const trimmed = rawNotes.trim();

  // Quick check for JSON object envelope
  if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
    try {
      const parsed = JSON.parse(trimmed);
      if (parsed && typeof parsed === 'object') {
        const cleanNotes =
          typeof parsed.notes === 'string'
            ? parsed.notes
            : typeof parsed.remarks === 'string'
            ? parsed.remarks
            : typeof parsed.bio === 'string'
            ? parsed.bio
            : typeof parsed.text === 'string'
            ? parsed.text
            : typeof parsed.description === 'string'
            ? parsed.description
            : '';

        const photoUrl =
          typeof parsed.photoUrl === 'string'
            ? parsed.photoUrl
            : typeof parsed.url === 'string'
            ? parsed.url
            : undefined;

        const photoFileId =
          typeof parsed.photoFileId === 'string'
            ? parsed.photoFileId
            : typeof parsed.fileId === 'string'
            ? parsed.fileId
            : undefined;

        return {
          cleanNotes: cleanNotes.trim(),
          photoUrl: photoUrl?.trim() || undefined,
          photoFileId: photoFileId?.trim() || undefined,
        };
      }
    } catch {
      // Not valid JSON, proceed to regex / plain text fallback
    }
  }

  // Check if string contains an embedded JSON block or raw JSON-like pattern
  // e.g. {"photoUrl":"..."}
  const jsonMatch = trimmed.match(/\{[\s\S]*"photoUrl"[\s\S]*\}/);
  if (jsonMatch) {
    try {
      const parsed = JSON.parse(jsonMatch[0]);
      const strippedText = trimmed.replace(jsonMatch[0], '').trim();
      const innerNotes =
        typeof parsed.notes === 'string'
          ? parsed.notes
          : typeof parsed.remarks === 'string'
          ? parsed.remarks
          : '';

      const combinedNotes = (strippedText ? strippedText + '\n' : '') + innerNotes;

      return {
        cleanNotes: combinedNotes.trim(),
        photoUrl: typeof parsed.photoUrl === 'string' ? parsed.photoUrl : undefined,
        photoFileId: typeof parsed.photoFileId === 'string' ? parsed.photoFileId : undefined,
      };
    } catch {
      // Ignore parse failure
    }
  }

  return { cleanNotes: trimmed };
}
