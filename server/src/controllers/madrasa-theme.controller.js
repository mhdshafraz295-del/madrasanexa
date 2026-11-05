import {
  getPortalTheme,
  saveDraftTheme,
  publishTheme,
  resetThemeToDefault,
  discardDraftChanges,
} from '../services/madrasa-theme.service.js';

function getAuthContext(req) {
  const madrasaId = req.tenant?.madrasaId || req.auth?.madrasaId || req.user?.madrasaId;
  const userId = req.auth?.userId || req.user?.id || req.auth?.id;
  return { madrasaId, userId };
}

export async function getTheme(req, res, next) {
  try {
    const { madrasaId } = getAuthContext(req);
    const data = await getPortalTheme(madrasaId);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

export async function saveDraft(req, res, next) {
  try {
    const { madrasaId, userId } = getAuthContext(req);
    const data = await saveDraftTheme(madrasaId, req.body, userId);
    res.json({ success: true, message: 'Theme draft saved successfully.', data });
  } catch (err) {
    next(err);
  }
}

export async function publish(req, res, next) {
  try {
    const { madrasaId, userId } = getAuthContext(req);
    const data = await publishTheme(madrasaId, req.body?.tokens || null, userId);
    res.json({ success: true, message: 'Theme published to public portal successfully.', data });
  } catch (err) {
    next(err);
  }
}

export async function reset(req, res, next) {
  try {
    const { madrasaId, userId } = getAuthContext(req);
    const data = await resetThemeToDefault(madrasaId, userId);
    res.json({ success: true, message: 'Theme reset to default successfully.', data });
  } catch (err) {
    next(err);
  }
}

export async function discard(req, res, next) {
  try {
    const { madrasaId } = getAuthContext(req);
    const data = await discardDraftChanges(madrasaId);
    res.json({ success: true, message: 'Unsaved draft changes discarded.', data });
  } catch (err) {
    next(err);
  }
}
