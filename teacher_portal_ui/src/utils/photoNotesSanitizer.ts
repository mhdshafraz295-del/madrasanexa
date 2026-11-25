/**
 * Utility to cleanly separate serialized JSON metadata (such as photoUrl, photoFileId)
 * from user-facing notes, bio, remarks, or administrative text fields.
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
      // Ignore JSON error
    }
  }

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
