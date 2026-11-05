import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc.js';
import timezone from 'dayjs/plugin/timezone.js';
import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import {
  generateAndStoreInterviewInvitationPdf,
  formatColomboDate,
  formatTime12h,
} from './interview-pdf.service.js';
import {
  sendInterviewAppointmentEmail,
  processInterviewEmailsBackground,
} from './interview-email.service.js';
import { AppError, BadRequestError, NotFoundError } from '../utils/errors.js';

dayjs.extend(utc);
dayjs.extend(timezone);

const TIMEZONE = 'Asia/Colombo';

/**
 * Converts HH:mm time string to total minutes from midnight.
 */
function timeToMinutes(timeStr) {
  if (!timeStr) return 0;
  const [h, m] = timeStr.split(':').map(Number);
  return h * 60 + m;
}

/**
 * Converts total minutes from midnight to HH:mm string.
 */
function minutesToTime(mins) {
  const h = Math.floor(mins / 60) % 24;
  const m = mins % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/**
 * Generates an official, unique Interview Invitation Reference.
 * Format: INV-{academicYear}-{5-random-digits}
 */
async function generateUniqueInvitationRef(academicYear = new Date().getFullYear()) {
  for (let attempt = 0; attempt < 10; attempt++) {
    const randomDigits = Math.floor(10000 + Math.random() * 90000);
    const candidateRef = `INV-${academicYear}-${randomDigits}`;

    const existing = await prisma.interviewAppointment.findUnique({
      where: { invitationReference: candidateRef },
      select: { id: true },
    });

    if (!existing) {
      return candidateRef;
    }
  }

  return `INV-${academicYear}-${Date.now().toString().slice(-6)}`;
}

/**
 * Retrieves eligible applicants for interview scheduling.
 *
 * First Round:
 * - Applications with status PENDING or APPROVED
 * - Not converted (convertedStudentId is null)
 * - Do NOT have an active SCHEDULED appointment for FIRST round
 *
 * Second Round:
 * - Applications with a FIRST round evaluation result of NEEDS_SECOND_INTERVIEW
 * - Not converted (convertedStudentId is null)
 * - Do NOT have an active SCHEDULED appointment for SECOND round
 *
 * @param {string} madrasaId
 * @param {object} params
 * @param {string} params.admissionPeriodId
 * @param {'FIRST'|'SECOND'} [params.interviewRound='FIRST']
 * @param {string} [params.search]
 */
export async function getEligibleApplicants(madrasaId, { admissionPeriodId, interviewRound = 'FIRST', search } = {}) {
  const where = {
    madrasaId,
    convertedStudentId: null,
    status: { in: ['PENDING', 'APPROVED'] },
  };

  if (admissionPeriodId) {
    where.admissionPeriodId = admissionPeriodId;
  }

  if (search && search.trim()) {
    const term = search.trim();
    where.OR = [
      { applicantName: { contains: term } },
      { applicationNo: { contains: term } },
      { guardianName: { contains: term } },
      { guardianPhone: { contains: term } },
      { guardianEmail: { contains: term } },
    ];
  }

  if (interviewRound === 'FIRST') {
    // Exclude applicants who currently have a SCHEDULED First Round appointment
    where.interviewAppointments = {
      none: {
        interviewRound: 'FIRST',
        status: 'SCHEDULED',
      },
    };
  } else if (interviewRound === 'SECOND') {
    // Must have completed a First Round interview with result NEEDS_SECOND_INTERVIEW
    // and must NOT have a SCHEDULED Second Round appointment
    where.AND = [
      {
        interviewAppointments: {
          some: {
            interviewRound: 'FIRST',
            evaluation: {
              result: 'NEEDS_SECOND_INTERVIEW',
            },
          },
        },
      },
      {
        interviewAppointments: {
          none: {
            interviewRound: 'SECOND',
            status: 'SCHEDULED',
          },
        },
      },
    ];
  }

  const applicants = await prisma.studentApplication.findMany({
    where,
    select: {
      id: true,
      applicationNo: true,
      applicantName: true,
      dateOfBirth: true,
      gender: true,
      guardianName: true,
      guardianRelationship: true,
      guardianPhone: true,
      guardianEmail: true,
      status: true,
      submittedAt: true,
      admissionPeriod: {
        select: {
          id: true,
          name: true,
          code: true,
          academicYear: true,
        },
      },
      appliedClass: {
        select: {
          id: true,
          name: true,
        },
      },
      interviewAppointments: {
        select: {
          id: true,
          interviewRound: true,
          status: true,
          interviewDate: true,
          startTime: true,
          endTime: true,
          evaluation: {
            select: {
              result: true,
              attendance: true,
              totalScore: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      },
    },
    orderBy: { submittedAt: 'asc' },
  });

  return applicants;
}

/**
 * Creates bulk interview schedules and appointments using Method A (same time)
 * or Method B (individual time slots).
 *
 * Executes within a database transaction with FOR UPDATE locks.
 * Dispatches PDF generation and email delivery asynchronously post-commit.
 *
 * @param {string} madrasaId
 * @param {object} payload
 * @param {string} userId
 */
export async function createBulkSchedule(madrasaId, payload, userId) {
  const {
    admissionPeriodId,
    interviewRound = 'FIRST',
    schedulingMethod,
    title,
    interviewDate,
    venue,
    defaultStartTime,
    defaultEndTime,
    slotDurationMinutes,
    instructions,
    requiredDocuments,
    applicationIds,
    slotAllocations,
  } = payload;

  // 1. Verify Admission Period
  const period = await prisma.admissionPeriod.findFirst({
    where: { id: admissionPeriodId, madrasaId },
  });
  if (!period) {
    throw new NotFoundError('Admission period not found.');
  }

  const academicYear = period.academicYear || dayjs().year();

  // 2. Prepare Slot Allocations
  // Map of applicationId -> { startTime, endTime }
  const computedSlots = new Map();

  if (schedulingMethod === 'SAME_TIME') {
    for (const appId of applicationIds) {
      computedSlots.set(appId, {
        startTime: defaultStartTime,
        endTime: defaultEndTime,
      });
    }
  } else if (schedulingMethod === 'INDIVIDUAL_SLOTS') {
    if (slotAllocations && slotAllocations.length > 0) {
      for (const slot of slotAllocations) {
        computedSlots.set(slot.applicationId, {
          startTime: slot.startTime,
          endTime: slot.endTime,
        });
      }
    } else {
      // Auto-compute consecutive non-overlapping time slots
      let currentMinutes = timeToMinutes(defaultStartTime);
      const duration = Number(slotDurationMinutes) || 15;

      for (const appId of applicationIds) {
        const start = minutesToTime(currentMinutes);
        const end = minutesToTime(currentMinutes + duration);
        computedSlots.set(appId, {
          startTime: start,
          endTime: end,
        });
        currentMinutes += duration;
      }
    }
  }

  // Generate unique references ahead of transaction
  const appReferences = new Map();
  for (const appId of applicationIds) {
    const ref = await generateUniqueInvitationRef(academicYear);
    appReferences.set(appId, ref);
  }

  // 3. Execute Scheduling Database Transaction
  const result = await prisma.$transaction(async (tx) => {
    // Acquire pessimistic lock on applicant applications
    const lockedApps = await tx.$queryRaw`
      SELECT id, applicationNo, applicantName, status, convertedStudentId
      FROM student_applications
      WHERE id IN (${Prisma.join(applicationIds)})
        AND madrasaId = ${madrasaId}
      FOR UPDATE
    `;

    if (lockedApps.length !== applicationIds.length) {
      throw new BadRequestError('One or more selected applications were not found in this Madrasa.');
    }

    // Verify applicants are not converted or rejected
    for (const app of lockedApps) {
      if (app.convertedStudentId) {
        throw new BadRequestError(`Applicant ${app.applicantName} (${app.applicationNo}) has already been converted to an enrolled student.`);
      }
      if (app.status === 'REJECTED') {
        throw new BadRequestError(`Applicant ${app.applicantName} (${app.applicationNo}) application has been rejected.`);
      }
    }

    // Verify no existing SCHEDULED appointment for the requested round
    const existingScheduled = await tx.interviewAppointment.findMany({
      where: {
        madrasaId,
        applicationId: { in: applicationIds },
        interviewRound,
        status: 'SCHEDULED',
      },
      include: {
        application: { select: { applicantName: true, applicationNo: true } },
      },
    });

    if (existingScheduled.length > 0) {
      const names = existingScheduled.map((a) => `${a.application.applicantName} (${a.application.applicationNo})`).join(', ');
      throw new BadRequestError(`Active interview already scheduled for round ${interviewRound}: ${names}`);
    }

    // Create InterviewSchedule record
    const schedule = await tx.interviewSchedule.create({
      data: {
        madrasaId,
        admissionPeriodId,
        interviewRound,
        schedulingMethod,
        title,
        interviewDate: new Date(interviewDate),
        venue,
        defaultStartTime: defaultStartTime || null,
        defaultEndTime: defaultEndTime || null,
        slotDurationMinutes: slotDurationMinutes ? Number(slotDurationMinutes) : null,
        instructions: instructions || null,
        requiredDocuments: requiredDocuments || null,
        createdByUserId: userId,
      },
    });

    // Create InterviewAppointment records
    const createdAppointments = [];
    for (const appId of applicationIds) {
      const slot = computedSlots.get(appId);
      const invitationReference = appReferences.get(appId);

      const appointment = await tx.interviewAppointment.create({
        data: {
          madrasaId,
          scheduleId: schedule.id,
          applicationId: appId,
          interviewRound,
          invitationReference,
          interviewDate: new Date(interviewDate),
          startTime: slot.startTime,
          endTime: slot.endTime,
          venue,
          status: 'SCHEDULED',
          pdfVersion: 1,
          createdByUserId: userId,
        },
      });

      createdAppointments.push(appointment);
    }

    return {
      schedule,
      appointments: createdAppointments,
    };
  });

  // 4. Post-Commit Asynchronous Processing: Generate PDFs & Send Emails
  const appointmentIds = result.appointments.map((a) => a.id);

  // Trigger background PDF generation and email dispatching
  setImmediate(async () => {
    try {
      // Step A: Pre-generate PDFs
      for (const apt of result.appointments) {
        try {
          await generateAndStoreInterviewInvitationPdf(madrasaId, apt.id);
        } catch (pdfErr) {
          console.warn(`[interview.service] Background PDF generation error for appointment ${apt.id}:`, pdfErr.message);
        }
      }

      // Step B: Dispatch emails
      await processInterviewEmailsBackground(madrasaId, appointmentIds);
    } catch (bgErr) {
      console.error('[interview.service] Post-commit background workflow error:', bgErr.message);
    }
  });

  return {
    success: true,
    schedule: result.schedule,
    appointmentsCount: result.appointments.length,
    appointmentIds,
  };
}

/**
 * Retrieves scheduled appointments with flexible multi-filter query support.
 *
 * @param {string} madrasaId
 * @param {object} query
 */
export async function getAppointments(madrasaId, query = {}) {
  const {
    admissionPeriodId,
    interviewRound,
    status,
    result,
    attendance,
    startDate,
    endDate,
    search,
    page = 1,
    limit = 20,
  } = query;

  const where = { madrasaId };

  if (admissionPeriodId) {
    where.schedule = { admissionPeriodId };
  }

  if (interviewRound) {
    where.interviewRound = interviewRound;
  }

  if (status) {
    where.status = status;
  }

  if (result) {
    where.evaluation = { result };
  }

  if (attendance) {
    if (attendance === 'UNRECORDED') {
      where.evaluation = { attendance: null };
    } else {
      where.evaluation = { attendance };
    }
  }

  if (startDate || endDate) {
    where.interviewDate = {};
    if (startDate) where.interviewDate.gte = new Date(startDate);
    if (endDate) where.interviewDate.lte = new Date(endDate);
  }

  if (search && search.trim()) {
    const term = search.trim();
    where.OR = [
      { invitationReference: { contains: term } },
      { application: { applicantName: { contains: term } } },
      { application: { applicationNo: { contains: term } } },
      { application: { guardianName: { contains: term } } },
      { application: { guardianPhone: { contains: term } } },
      { application: { guardianEmail: { contains: term } } },
    ];
  }

  const pageNum = Math.max(1, Number(page));
  const limitNum = Math.min(100, Math.max(1, Number(limit)));
  const skip = (pageNum - 1) * limitNum;

  const [total, appointments] = await Promise.all([
    prisma.interviewAppointment.count({ where }),
    prisma.interviewAppointment.findMany({
      where,
      include: {
        schedule: {
          select: {
            id: true,
            title: true,
            schedulingMethod: true,
            instructions: true,
            requiredDocuments: true,
            admissionPeriod: {
              select: {
                id: true,
                name: true,
                code: true,
                academicYear: true,
              },
            },
          },
        },
        application: {
          select: {
            id: true,
            applicationNo: true,
            applicantName: true,
            dateOfBirth: true,
            gender: true,
            guardianName: true,
            guardianRelationship: true,
            guardianPhone: true,
            guardianEmail: true,
            status: true,
            appliedClass: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
        evaluation: true,
        notifications: {
          orderBy: { createdAt: 'desc' },
          take: 3,
        },
        fileObject: {
          select: {
            id: true,
            objectKey: true,
            originalName: true,
            size: true,
          },
        },
      },
      orderBy: [
        { interviewDate: 'asc' },
        { startTime: 'asc' },
        { createdAt: 'desc' },
      ],
      skip,
      take: limitNum,
    }),
  ]);

  return {
    appointments,
    pagination: {
      total,
      page: pageNum,
      limit: limitNum,
      totalPages: Math.ceil(total / limitNum),
    },
  };
}

/**
 * Retrieves full details of a single interview appointment by ID.
 *
 * @param {string} madrasaId
 * @param {string} id
 */
export async function getAppointmentById(madrasaId, id) {
  const appointment = await prisma.interviewAppointment.findFirst({
    where: { id, madrasaId },
    include: {
      schedule: {
        include: {
          admissionPeriod: true,
          createdByUser: {
            select: { id: true, name: true, email: true },
          },
        },
      },
      application: {
        include: {
          admissionPeriod: true,
          appliedClass: true,
        },
      },
      evaluation: {
        include: {
          evaluatedByUser: {
            select: { id: true, name: true, email: true },
          },
        },
      },
      notifications: {
        orderBy: { createdAt: 'desc' },
      },
      fileObject: true,
      rescheduledFrom: true,
      rescheduledTo: true,
      createdByUser: {
        select: { id: true, name: true, email: true },
      },
    },
  });

  if (!appointment) {
    throw new NotFoundError('Interview appointment not found.');
  }

  return appointment;
}

/**
 * Reschedules an interview appointment.
 *
 * Marks current appointment as RESCHEDULED and creates a new appointment
 * record linked via rescheduledFromId with incremented pdfVersion.
 *
 * @param {string} madrasaId
 * @param {string} id
 * @param {object} payload
 * @param {string} userId
 */
export async function rescheduleAppointment(madrasaId, id, payload, userId) {
  const { interviewDate, startTime, endTime, venue, rescheduleReason } = payload;

  const currentAppointment = await prisma.interviewAppointment.findFirst({
    where: { id, madrasaId },
    include: {
      application: {
        include: { admissionPeriod: true },
      },
    },
  });

  if (!currentAppointment) {
    throw new NotFoundError('Interview appointment not found.');
  }

  if (currentAppointment.status !== 'SCHEDULED') {
    throw new BadRequestError(`Cannot reschedule appointment with status ${currentAppointment.status}.`);
  }

  const academicYear = currentAppointment.application?.admissionPeriod?.academicYear || dayjs().year();
  const newInvitationRef = await generateUniqueInvitationRef(academicYear);

  // Execute in transaction
  const newAppointment = await prisma.$transaction(async (tx) => {
    // 1. Mark existing appointment as RESCHEDULED
    await tx.interviewAppointment.update({
      where: { id: currentAppointment.id },
      data: {
        status: 'RESCHEDULED',
        rescheduleReason: rescheduleReason || 'Rescheduled by administrator.',
      },
    });

    // 2. Create replacement appointment record
    const created = await tx.interviewAppointment.create({
      data: {
        madrasaId,
        scheduleId: currentAppointment.scheduleId,
        applicationId: currentAppointment.applicationId,
        interviewRound: currentAppointment.interviewRound,
        invitationReference: newInvitationRef,
        interviewDate: new Date(interviewDate),
        startTime,
        endTime,
        venue: venue || currentAppointment.venue,
        status: 'SCHEDULED',
        rescheduledFromId: currentAppointment.id,
        rescheduleReason: rescheduleReason || null,
        pdfVersion: currentAppointment.pdfVersion + 1,
        createdByUserId: userId,
      },
    });

    return created;
  });

  // Post-commit: Generate new PDF and send email
  setImmediate(async () => {
    try {
      await generateAndStoreInterviewInvitationPdf(madrasaId, newAppointment.id);
      await sendInterviewAppointmentEmail(madrasaId, newAppointment.id, { forceRetry: true });
    } catch (err) {
      console.warn(`[interview.service] Post-reschedule background notification failed:`, err.message);
    }
  });

  return newAppointment;
}

/**
 * Cancels a scheduled interview appointment.
 *
 * @param {string} madrasaId
 * @param {string} id
 * @param {object} payload
 * @param {string} userId
 */
export async function cancelAppointment(madrasaId, id, payload, userId) {
  const { cancellationReason } = payload;

  const appointment = await prisma.interviewAppointment.findFirst({
    where: { id, madrasaId },
  });

  if (!appointment) {
    throw new NotFoundError('Interview appointment not found.');
  }

  if (appointment.status !== 'SCHEDULED') {
    throw new BadRequestError(`Only SCHEDULED appointments can be cancelled. Current status is ${appointment.status}.`);
  }

  const updated = await prisma.interviewAppointment.update({
    where: { id: appointment.id },
    data: {
      status: 'CANCELLED',
      cancellationReason,
    },
  });

  return updated;
}

/**
 * Records attendance and evaluation results for an interview appointment.
 *
 * CRITICAL RULE:
 * This method NEVER modifies the StudentApplication.status!
 * Final admission decisions and student conversions remain strictly in their
 * existing authorized workflow.
 *
 * @param {string} madrasaId
 * @param {string} id
 * @param {object} payload
 * @param {string} userId
 */
export async function evaluateAppointment(madrasaId, id, payload, userId) {
  const {
    attendance,
    quranRecitationScore,
    islamicKnowledgeScore,
    academicScore,
    conductScore,
    totalScore,
    interviewerNotes,
    recommendationNotes,
    result = 'PENDING',
  } = payload;

  const appointment = await prisma.interviewAppointment.findFirst({
    where: { id, madrasaId },
    include: { evaluation: true },
  });

  if (!appointment) {
    throw new NotFoundError('Interview appointment not found.');
  }

  if (appointment.status === 'CANCELLED') {
    throw new BadRequestError('Cannot evaluate a cancelled interview appointment.');
  }

  const evaluated = await prisma.$transaction(async (tx) => {
    // Upsert evaluation record
    const evalRecord = await tx.interviewEvaluation.upsert({
      where: { appointmentId: appointment.id },
      create: {
        madrasaId,
        appointmentId: appointment.id,
        attendance: attendance || null,
        quranRecitationScore: quranRecitationScore != null ? Number(quranRecitationScore) : null,
        islamicKnowledgeScore: islamicKnowledgeScore != null ? Number(islamicKnowledgeScore) : null,
        academicScore: academicScore != null ? Number(academicScore) : null,
        conductScore: conductScore != null ? Number(conductScore) : null,
        totalScore: totalScore != null ? Number(totalScore) : null,
        interviewerNotes: interviewerNotes || null,
        recommendationNotes: recommendationNotes || null,
        result,
        evaluatedByUserId: userId,
      },
      update: {
        attendance: attendance || null,
        quranRecitationScore: quranRecitationScore != null ? Number(quranRecitationScore) : null,
        islamicKnowledgeScore: islamicKnowledgeScore != null ? Number(islamicKnowledgeScore) : null,
        academicScore: academicScore != null ? Number(academicScore) : null,
        conductScore: conductScore != null ? Number(conductScore) : null,
        totalScore: totalScore != null ? Number(totalScore) : null,
        interviewerNotes: interviewerNotes || null,
        recommendationNotes: recommendationNotes || null,
        result,
        evaluatedByUserId: userId,
        evaluatedAt: new Date(),
      },
    });

    // Update appointment status based on attendance
    let nextStatus = appointment.status;
    if (attendance === 'ABSENT') {
      nextStatus = 'NO_SHOW';
    } else if (attendance === 'PRESENT' || result !== 'PENDING') {
      nextStatus = 'COMPLETED';
    }

    if (nextStatus !== appointment.status) {
      await tx.interviewAppointment.update({
        where: { id: appointment.id },
        data: { status: nextStatus },
      });
    }

    return evalRecord;
  });

  return evaluated;
}

/**
 * Returns aggregated Interview KPI statistics for the dashboard.
 *
 * @param {string} madrasaId
 * @param {object} [query]
 * @param {string} [query.admissionPeriodId]
 */
export async function getDashboardStats(madrasaId, { admissionPeriodId } = {}) {
  const appointmentWhere = { madrasaId };
  const evaluationWhere = { madrasaId };
  const notificationWhere = { madrasaId };

  if (admissionPeriodId) {
    appointmentWhere.schedule = { admissionPeriodId };
    evaluationWhere.appointment = { schedule: { admissionPeriodId } };
    notificationWhere.appointment = { schedule: { admissionPeriodId } };
  }

  const [
    totalAppointments,
    scheduledCount,
    completedCount,
    cancelledCount,
    rescheduledCount,
    noShowCount,
    firstRoundCount,
    secondRoundCount,
    presentCount,
    absentCount,
    passedCount,
    needsSecondCount,
    rejectedCount,
    pendingResultCount,
    emailSentCount,
    emailPendingCount,
    emailFailedCount,
    emailUncertainCount,
  ] = await Promise.all([
    prisma.interviewAppointment.count({ where: appointmentWhere }),
    prisma.interviewAppointment.count({ where: { ...appointmentWhere, status: 'SCHEDULED' } }),
    prisma.interviewAppointment.count({ where: { ...appointmentWhere, status: 'COMPLETED' } }),
    prisma.interviewAppointment.count({ where: { ...appointmentWhere, status: 'CANCELLED' } }),
    prisma.interviewAppointment.count({ where: { ...appointmentWhere, status: 'RESCHEDULED' } }),
    prisma.interviewAppointment.count({ where: { ...appointmentWhere, status: 'NO_SHOW' } }),
    prisma.interviewAppointment.count({ where: { ...appointmentWhere, interviewRound: 'FIRST' } }),
    prisma.interviewAppointment.count({ where: { ...appointmentWhere, interviewRound: 'SECOND' } }),
    prisma.interviewEvaluation.count({ where: { ...evaluationWhere, attendance: 'PRESENT' } }),
    prisma.interviewEvaluation.count({ where: { ...evaluationWhere, attendance: 'ABSENT' } }),
    prisma.interviewEvaluation.count({ where: { ...evaluationWhere, result: 'PASSED' } }),
    prisma.interviewEvaluation.count({ where: { ...evaluationWhere, result: 'NEEDS_SECOND_INTERVIEW' } }),
    prisma.interviewEvaluation.count({ where: { ...evaluationWhere, result: 'REJECTED' } }),
    prisma.interviewEvaluation.count({ where: { ...evaluationWhere, result: 'PENDING' } }),
    prisma.interviewNotification.count({ where: { ...notificationWhere, status: 'SENT' } }),
    prisma.interviewNotification.count({ where: { ...notificationWhere, status: 'PENDING' } }),
    prisma.interviewNotification.count({ where: { ...notificationWhere, status: 'FAILED' } }),
    prisma.interviewNotification.count({ where: { ...notificationWhere, status: 'UNCERTAIN' } }),
  ]);

  return {
    totalAppointments,
    statuses: {
      scheduled: scheduledCount,
      completed: completedCount,
      cancelled: cancelledCount,
      rescheduled: rescheduledCount,
      noShow: noShowCount,
    },
    rounds: {
      first: firstRoundCount,
      second: secondRoundCount,
    },
    attendance: {
      present: presentCount,
      absent: absentCount,
      unrecorded: totalAppointments - (presentCount + absentCount),
    },
    results: {
      passed: passedCount,
      needsSecondRound: needsSecondCount,
      rejected: rejectedCount,
      pending: pendingResultCount,
    },
    emails: {
      sent: emailSentCount,
      pending: emailPendingCount,
      failed: emailFailedCount,
      uncertain: emailUncertainCount,
    },
  };
}

/**
 * Returns full interview history for an applicant or period.
 *
 * @param {string} madrasaId
 * @param {string} applicationId
 */
export async function getApplicantInterviewHistory(madrasaId, applicationId) {
  const history = await prisma.interviewAppointment.findMany({
    where: { madrasaId, applicationId },
    include: {
      schedule: true,
      evaluation: {
        include: {
          evaluatedByUser: { select: { id: true, name: true } },
        },
      },
      notifications: true,
      fileObject: true,
      createdByUser: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: 'asc' },
  });

  return history;
}
