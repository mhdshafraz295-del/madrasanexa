import { prisma } from '../lib/prisma.js';
import { NotFoundError, BadRequestError, ForbiddenError, ConflictError } from '../utils/errors.js';

/**
 * Super Admin: Create a new multi-tenant platform poll
 */
export async function createPoll({ userId, payload }) {
  const {
    title,
    description,
    category = 'GOVERNANCE',
    targetAudience = 'ALL',
    targetMadrasaIds,
    allowMultipleChoice = false,
    isAnonymous = false,
    closesAt,
    options = [],
  } = payload;

  if (!options || options.length < 2) {
    throw new BadRequestError('A poll must have at least 2 options.');
  }
  if (options.length > 8) {
    throw new BadRequestError('A poll cannot have more than 8 options.');
  }

  // Parse closing timestamp safely
  let parsedClosesAt = null;
  if (closesAt) {
    parsedClosesAt = new Date(closesAt);
    if (isNaN(parsedClosesAt.getTime())) {
      parsedClosesAt = null;
    }
  }

  // Target madrasas validation
  let cleanTargetMadrasaIds = null;
  if (Array.isArray(targetMadrasaIds) && targetMadrasaIds.length > 0) {
    cleanTargetMadrasaIds = targetMadrasaIds;
  }

  const poll = await prisma.platformPoll.create({
    data: {
      createdByUserId: userId,
      title: title.trim(),
      description: description ? description.trim() : null,
      category,
      targetAudience,
      targetMadrasaIds: cleanTargetMadrasaIds,
      allowMultipleChoice,
      isAnonymous,
      status: 'ACTIVE',
      closesAt: parsedClosesAt,
      options: {
        create: options.map((label, index) => ({
          label: typeof label === 'string' ? label.trim() : label.label?.trim(),
          sortOrder: index,
        })),
      },
    },
    include: {
      options: {
        orderBy: { sortOrder: 'asc' },
      },
      createdByUser: {
        select: { id: true, name: true, email: true },
      },
    },
  });

  return poll;
}

/**
 * Super Admin: List all polls with full analytics and multi-tenant breakdown
 */
export async function listSuperAdminPolls() {
  const [allPolls, allMadrasas] = await Promise.all([
    prisma.platformPoll.findMany({
      include: {
        createdByUser: {
          select: { id: true, name: true, email: true },
        },
        options: {
          orderBy: { sortOrder: 'asc' },
          include: {
            votes: true,
          },
        },
        votes: {
          include: {
            madrasa: {
              select: { id: true, name: true, code: true },
            },
            user: {
              select: { id: true, name: true, email: true },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.madrasa.findMany({
      where: { status: 'ACTIVE' },
      select: { id: true, name: true, code: true },
    }),
  ]);

  let totalVotesCast = 0;
  const allParticipatingMadrasas = new Set();

  const formattedPolls = allPolls.map((poll) => {
    const totalVotes = poll.votes.length;
    totalVotesCast += totalVotes;

    // Unique voters
    const uniqueVoterIds = new Set(poll.votes.map((v) => v.userId));
    const totalVotersCount = uniqueVoterIds.size;

    // Participating madrasas
    const madrasaParticipationMap = new Map();
    let adminVotesCount = 0;
    let teacherVotesCount = 0;

    for (const vote of poll.votes) {
      allParticipatingMadrasas.add(vote.madrasaId);

      if (vote.voterRole === 'MADRASA_ADMIN') {
        adminVotesCount++;
      } else if (vote.voterRole === 'TEACHER') {
        teacherVotesCount++;
      }

      if (!madrasaParticipationMap.has(vote.madrasaId)) {
        madrasaParticipationMap.set(vote.madrasaId, {
          madrasaId: vote.madrasaId,
          madrasaName: vote.madrasa?.name || 'Institution',
          madrasaCode: vote.madrasa?.code || 'INST',
          adminVotes: 0,
          teacherVotes: 0,
          totalVotes: 0,
        });
      }

      const mEntry = madrasaParticipationMap.get(vote.madrasaId);
      mEntry.totalVotes++;
      if (vote.voterRole === 'MADRASA_ADMIN') mEntry.adminVotes++;
      if (vote.voterRole === 'TEACHER') mEntry.teacherVotes++;
    }

    const participatingMadrasas = Array.from(madrasaParticipationMap.values());

    // Option-by-option statistics
    const optionsWithStats = poll.options.map((opt) => {
      const voteCount = opt.votes.length;
      const percentage = totalVotes > 0 ? Math.round((voteCount / totalVotes) * 100) : 0;
      return {
        id: opt.id,
        label: opt.label,
        sortOrder: opt.sortOrder,
        voteCount,
        percentage,
      };
    });

    const isExpired = poll.closesAt ? new Date(poll.closesAt) < new Date() : false;
    const computedStatus = isExpired ? 'CLOSED' : poll.status;

    return {
      id: poll.id,
      title: poll.title,
      description: poll.description,
      category: poll.category,
      targetAudience: poll.targetAudience,
      targetMadrasaIds: poll.targetMadrasaIds,
      allowMultipleChoice: poll.allowMultipleChoice,
      isAnonymous: poll.isAnonymous,
      status: computedStatus,
      closesAt: poll.closesAt ? poll.closesAt.toISOString() : null,
      createdAt: poll.createdAt.toISOString(),
      updatedAt: poll.updatedAt.toISOString(),
      createdByName: poll.createdByUser?.name || 'Super Admin',
      options: optionsWithStats,
      stats: {
        totalVotes,
        totalVotersCount,
        participatingMadrasasCount: participatingMadrasas.length,
        adminVotesCount,
        teacherVotesCount,
        participatingMadrasas,
      },
    };
  });

  const activePolls = formattedPolls.filter((p) => p.status === 'ACTIVE').length;

  return {
    kpis: {
      totalPolls: formattedPolls.length,
      activePolls,
      totalVotesCast,
      participatingMadrasasCount: allParticipatingMadrasas.size,
      totalActiveMadrasas: allMadrasas.length,
    },
    allMadrasas,
    polls: formattedPolls,
  };
}

/**
 * Super Admin: Toggle or set poll status (ACTIVE | CLOSED)
 */
export async function updatePollStatus({ pollId, status }) {
  const poll = await prisma.platformPoll.findUnique({
    where: { id: pollId },
  });

  if (!poll) {
    throw new NotFoundError('Poll not found.');
  }

  const updated = await prisma.platformPoll.update({
    where: { id: pollId },
    data: { status },
  });

  return updated;
}

/**
 * Super Admin: Delete a poll
 */
export async function deletePoll({ pollId }) {
  const poll = await prisma.platformPoll.findUnique({
    where: { id: pollId },
  });

  if (!poll) {
    throw new NotFoundError('Poll not found.');
  }

  await prisma.platformPoll.delete({
    where: { id: pollId },
  });

  return {
    success: true,
    message: 'Poll and associated responses deleted successfully.',
  };
}

/**
 * Madrasa Admin & Teacher: Fetch active and eligible polls with live percentages and user vote status
 */
export async function getActivePollsForUser({ userId, madrasaId, role }) {
  // Fetch polls targeting this role and tenant
  const polls = await prisma.platformPoll.findMany({
    where: {
      status: 'ACTIVE',
      OR: [
        { targetAudience: 'ALL' },
        { targetAudience: role === 'MADRASA_ADMIN' ? 'MADRASA_ADMINS' : 'TEACHERS' },
      ],
    },
    include: {
      options: {
        orderBy: { sortOrder: 'asc' },
        include: {
          votes: true,
        },
      },
      votes: {
        where: { userId },
        select: { optionId: true },
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  const now = new Date();

  // Filter polls that target this madrasa
  const eligiblePolls = polls.filter((p) => {
    // If closesAt is past, exclude or mark closed
    if (p.closesAt && new Date(p.closesAt) < now) {
      return false;
    }
    // If targetMadrasaIds is specified, madrasaId must match
    if (Array.isArray(p.targetMadrasaIds) && p.targetMadrasaIds.length > 0) {
      return p.targetMadrasaIds.includes(madrasaId);
    }
    return true;
  });

  return eligiblePolls.map((poll) => {
    // Calculate total votes across all options
    let totalVotes = 0;
    for (const opt of poll.options) {
      totalVotes += opt.votes.length;
    }

    const userSelectedOptionIds = poll.votes.map((v) => v.optionId);
    const hasVoted = userSelectedOptionIds.length > 0;

    const options = poll.options.map((opt) => {
      const voteCount = opt.votes.length;
      const percentage = totalVotes > 0 ? Math.round((voteCount / totalVotes) * 100) : 0;
      return {
        id: opt.id,
        label: opt.label,
        sortOrder: opt.sortOrder,
        voteCount,
        percentage,
        isUserChoice: userSelectedOptionIds.includes(opt.id),
      };
    });

    return {
      id: poll.id,
      title: poll.title,
      description: poll.description,
      category: poll.category,
      targetAudience: poll.targetAudience,
      allowMultipleChoice: poll.allowMultipleChoice,
      isAnonymous: poll.isAnonymous,
      status: poll.status,
      closesAt: poll.closesAt ? poll.closesAt.toISOString() : null,
      createdAt: poll.createdAt.toISOString(),
      hasVoted,
      userSelectedOptionIds,
      totalVotes,
      options,
    };
  });
}

/**
 * Madrasa Admin & Teacher: Cast vote in an active poll
 */
export async function submitVote({ pollId, userId, madrasaId, role, optionIds }) {
  if (!Array.isArray(optionIds) || optionIds.length === 0) {
    throw new BadRequestError('Please select at least one option to vote.');
  }

  const poll = await prisma.platformPoll.findUnique({
    where: { id: pollId },
    include: {
      options: true,
    },
  });

  if (!poll) {
    throw new NotFoundError('Poll not found.');
  }

  if (poll.status !== 'ACTIVE') {
    throw new BadRequestError('This poll is closed and no longer accepting votes.');
  }

  if (poll.closesAt && new Date(poll.closesAt) < new Date()) {
    throw new BadRequestError('This poll expired on ' + poll.closesAt.toLocaleDateString());
  }

  // Audience role verification
  if (poll.targetAudience === 'MADRASA_ADMINS' && role !== 'MADRASA_ADMIN') {
    throw new ForbiddenError('This poll is open to Madrasa Administrators only.');
  }
  if (poll.targetAudience === 'TEACHERS' && role !== 'TEACHER') {
    throw new ForbiddenError('This poll is open to Teachers & Ustadhs only.');
  }

  // Tenant targeting verification
  if (Array.isArray(poll.targetMadrasaIds) && poll.targetMadrasaIds.length > 0) {
    if (!poll.targetMadrasaIds.includes(madrasaId)) {
      throw new ForbiddenError('Your institution is not in the designated target audience for this poll.');
    }
  }

  // Multiple choice restriction
  if (!poll.allowMultipleChoice && optionIds.length > 1) {
    throw new BadRequestError('This poll only allows choosing a single option.');
  }

  // Option existence verification
  const validOptionIds = new Set(poll.options.map((o) => o.id));
  for (const optId of optionIds) {
    if (!validOptionIds.has(optId)) {
      throw new BadRequestError('Invalid option selected.');
    }
  }

  // Check if user already voted in this poll
  const priorVote = await prisma.platformPollVote.findFirst({
    where: { pollId, userId },
  });

  if (priorVote) {
    throw new ConflictError('You have already submitted your response to this poll.');
  }

  // Persist votes in database
  await prisma.$transaction(
    optionIds.map((optId) =>
      prisma.platformPollVote.create({
        data: {
          pollId,
          optionId: optId,
          userId,
          madrasaId,
          voterRole: role,
        },
      })
    )
  );

  // Return updated poll data with latest counts and percentages
  const updatedPolls = await getActivePollsForUser({ userId, madrasaId, role });
  const updatedPoll = updatedPolls.find((p) => p.id === pollId);

  return updatedPoll || {
    success: true,
    message: 'Your vote has been recorded successfully.',
  };
}
