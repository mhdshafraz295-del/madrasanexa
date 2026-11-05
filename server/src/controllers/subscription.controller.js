import { getSubscriptionSummary } from '../services/subscription.service.js';

/**
 * Retrieves the current Madrasa's subscription summary.
 *
 * Accessible even when subscription is EXPIRED, SUSPENDED, or CANCELLED,
 * allowing the frontend workspace and restricted screens to display accurate status.
 */
export const getMySubscription = async (req, res, next) => {
  try {
    const summary = await getSubscriptionSummary(req.tenant.madrasaId, new Date());

    return res.status(200).json({
      success: true,
      data: summary,
    });
  } catch (error) {
    next(error);
  }
};
