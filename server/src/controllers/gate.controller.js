import {
  gateScanSchema,
  gateEventQuerySchema,
  gateSettingsUpdateSchema,
} from '../validations/gate.validation.js';
import * as gateEventService from '../services/gate-event.service.js';

/**
 * POST /api/gate/scan
 * Operator scan card at school gate (ENTRY or EXIT).
 */
export async function scanGateCard(req, res, next) {
  try {
    const madrasaId = req.tenant.madrasaId;
    const userId = req.auth.userId;
    const validated = gateScanSchema.parse(req.body);

    const result = await gateEventService.processGateScan({
      madrasaId,
      userId,
      token: validated.token,
      eventType: validated.eventType,
      idempotencyKey: validated.idempotencyKey,
    });

    const statusCode = result.idempotentReplay ? 200 : 201;
    return res.status(statusCode).json({
      success: true,
      message: result.idempotentReplay
        ? 'Idempotent request replayed successfully.'
        : `Student gate ${validated.eventType.toLowerCase()} recorded successfully.`,
      data: result,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/gate/events
 * Lists paginated gate movement and email status events for the authenticated tenant.
 */
export async function listGateEvents(req, res, next) {
  try {
    const madrasaId = req.tenant.madrasaId;
    const validated = gateEventQuerySchema.parse(req.query);

    const data = await gateEventService.getGateEvents({
      madrasaId,
      query: validated,
    });

    return res.status(200).json({
      success: true,
      data,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/gate/settings
 * Retrieves gate settings for the authenticated tenant.
 */
export async function getGateSettings(req, res, next) {
  try {
    const madrasaId = req.tenant.madrasaId;
    const data = await gateEventService.getGateSettings(madrasaId);

    return res.status(200).json({
      success: true,
      data,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * PATCH /api/gate/settings
 * Updates gate settings (Admin privileges required).
 */
export async function updateGateSettings(req, res, next) {
  try {
    const madrasaId = req.tenant.madrasaId;
    const userId = req.auth.userId;
    const validated = gateSettingsUpdateSchema.parse(req.body);

    const data = await gateEventService.updateGateSettings({
      madrasaId,
      userId,
      data: validated,
    });

    return res.status(200).json({
      success: true,
      message: 'Gate settings updated successfully.',
      data,
    });
  } catch (error) {
    next(error);
  }
}
