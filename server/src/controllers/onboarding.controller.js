import { prisma } from '../lib/prisma.js';
import { publicOnboardingRequestSchema } from '../validations/onboarding.validation.js';
import { z } from 'zod';

/**
 * Public handler to submit an institutional onboarding application.
 *
 * Invariants:
 * 1. Strictly creates a MadrasaOnboardingRequest in PENDING status.
 * 2. Never creates a User, Madrasa, or Subscription.
 * 3. Never accepts or trusts client-supplied administrative or foreign fields.
 * 4. Silently neutralizes bot spam via honeypot field.
 * 5. Prevents duplicate pending submissions for the same email or phone.
 */
export const handleSubmitOnboardingRequest = async (req, res, next) => {
  try {
    const validated = publicOnboardingRequestSchema.parse(req.body);

    // Bot honeypot trap: if filled, return 201 without saving
    if (validated.website) {
      return res.status(201).json({
        success: true,
        message: 'Your Madrasa registration request has been submitted successfully.',
      });
    }

    // Duplicate pending check
    const existingPending = await prisma.madrasaOnboardingRequest.findFirst({
      where: {
        status: 'PENDING',
        OR: [
          { email: validated.email },
          { phone: validated.phone },
        ],
      },
    });

    if (existingPending) {
      return res.status(409).json({
        success: false,
        message: 'An onboarding request is already pending for these contact details.',
      });
    }

    // Check if an institution is already active with this email
    const existingMadrasa = await prisma.madrasa.findFirst({
      where: {
        OR: [
          { email: validated.email },
          { phone: validated.phone },
        ],
      },
    });

    if (existingMadrasa) {
      return res.status(409).json({
        success: false,
        message: 'An institution is already registered with these contact details.',
      });
    }

    // Create purely an onboarding request
    const newRequest = await prisma.madrasaOnboardingRequest.create({
      data: {
        madrasaName: validated.madrasaName,
        contactName: validated.contactName,
        email: validated.email,
        phone: validated.phone,
        whatsappNumber: validated.whatsappNumber || null,
        district: validated.district || null,
        address: validated.address || null,
        expectedStudentCount: validated.expectedStudentCount || null,
        message: validated.message || null,
        status: 'PENDING',
      },
    });

    return res.status(201).json({
      success: true,
      message: 'Your Madrasa registration request has been submitted successfully.',
      data: { id: newRequest.id },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      const msg = error.issues?.[0]?.message || error.errors?.[0]?.message || 'Invalid input data.';
      return res.status(400).json({
        success: false,
        message: msg,
        errors: error.issues || error.errors,
      });
    }
    next(error);
  }
};
