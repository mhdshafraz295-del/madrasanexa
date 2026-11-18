import * as pollService from '../services/poll.service.js';
import {
  createPollSchema,
  updatePollStatusSchema,
  submitVoteSchema,
} from '../validations/poll.validation.js';

export async function createPoll(req, res, next) {
  try {
    const userId = req.auth.userId;
    const validated = createPollSchema.parse(req.body);

    const data = await pollService.createPoll({
      userId,
      payload: validated,
    });

    return res.status(201).json({
      success: true,
      message: 'Poll created successfully.',
      data,
    });
  } catch (error) {
    next(error);
  }
}

export async function listSuperAdminPolls(req, res, next) {
  try {
    const data = await pollService.listSuperAdminPolls();
    return res.status(200).json({
      success: true,
      data,
    });
  } catch (error) {
    next(error);
  }
}

export async function updatePollStatus(req, res, next) {
  try {
    const { id } = req.params;
    const validated = updatePollStatusSchema.parse(req.body);

    const data = await pollService.updatePollStatus({
      pollId: id,
      status: validated.status,
    });

    return res.status(200).json({
      success: true,
      message: 'Poll status updated.',
      data,
    });
  } catch (error) {
    next(error);
  }
}

export async function deletePoll(req, res, next) {
  try {
    const { id } = req.params;
    const data = await pollService.deletePoll({ pollId: id });

    return res.status(200).json({
      success: true,
      data,
    });
  } catch (error) {
    next(error);
  }
}

export async function getUserPolls(req, res, next) {
  try {
    const userId = req.auth.userId;
    const madrasaId = req.tenant?.madrasaId || req.auth?.madrasaId;
    const role = req.auth.role;

    const data = await pollService.getActivePollsForUser({
      userId,
      madrasaId,
      role,
    });

    return res.status(200).json({
      success: true,
      data,
    });
  } catch (error) {
    next(error);
  }
}

export async function submitVote(req, res, next) {
  try {
    const { id } = req.params;
    const validated = submitVoteSchema.parse(req.body);
    const userId = req.auth.userId;
    const madrasaId = req.tenant?.madrasaId || req.auth?.madrasaId;
    const role = req.auth.role;

    const data = await pollService.submitVote({
      pollId: id,
      userId,
      madrasaId,
      role,
      optionIds: validated.optionIds,
    });

    return res.status(200).json({
      success: true,
      message: 'Vote submitted successfully.',
      data,
    });
  } catch (error) {
    next(error);
  }
}
