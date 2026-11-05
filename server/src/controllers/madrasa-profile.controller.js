import multer from 'multer';
import * as profileService from '../services/madrasa-profile.service.js';
import { updateMadrasaProfileSchema, broadcastNoticeSchema } from '../validations/madrasa-profile.validation.js';

// Configure Multer for hero image memory storage with 5 MB hard limit
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024, // 5 MB
    files: 1,
  },
});

export const uploadHeroImageMiddleware = (req, res, next) => {
  const singleUpload = upload.single('heroImage');

  singleUpload(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({
          success: false,
          message: 'Hero background image must be smaller than 5 MB.',
        });
      }
      if (err.code === 'LIMIT_UNEXPECTED_FILE') {
        return res.status(400).json({
          success: false,
          message: "Please upload a single image file using the form field 'heroImage'.",
        });
      }
      return res.status(400).json({
        success: false,
        message: err.message || 'File upload error.',
      });
    } else if (err) {
      return res.status(400).json({
        success: false,
        message: err.message || 'File upload error.',
      });
    }

    next();
  });
};

export async function getMyProfile(req, res, next) {
  try {
    const madrasaId = req.tenant.madrasaId;
    const profile = await profileService.getTenantProfile(madrasaId);

    return res.status(200).json({
      success: true,
      data: profile
    });
  } catch (error) {
    next(error);
  }
}

export async function updateMyProfile(req, res, next) {
  try {
    const madrasaId = req.tenant.madrasaId;
    const userId = req.auth.userId;
    const validated = updateMadrasaProfileSchema.parse(req.body);

    const updated = await profileService.updateTenantProfile(madrasaId, validated, userId);

    return res.status(200).json({
      success: true,
      message: 'Madrasa portal profile updated successfully.',
      data: updated
    });
  } catch (error) {
    next(error);
  }
}

export async function generateSummary(req, res, next) {
  try {
    const madrasaId = req.tenant.madrasaId;
    const userId = req.auth.userId;

    const updated = await profileService.generateProfileSummary(madrasaId, userId);

    return res.status(200).json({
      success: true,
      message: 'Institutional summary generated successfully.',
      data: updated
    });
  } catch (error) {
    next(error);
  }
}

export async function publishProfile(req, res, next) {
  try {
    const madrasaId = req.tenant.madrasaId;
    const userId = req.auth.userId;

    const updated = await profileService.publishTenantProfile(madrasaId, userId);

    return res.status(200).json({
      success: true,
      message: 'Madrasa portal profile published successfully.',
      data: updated
    });
  } catch (error) {
    next(error);
  }
}

export async function unpublishProfile(req, res, next) {
  try {
    const madrasaId = req.tenant.madrasaId;
    const userId = req.auth.userId;

    const updated = await profileService.unpublishTenantProfile(madrasaId, userId);

    return res.status(200).json({
      success: true,
      message: 'Madrasa portal profile reverted to draft mode.',
      data: updated
    });
  } catch (error) {
    next(error);
  }
}

export async function broadcastNotice(req, res, next) {
  try {
    const madrasaId = req.tenant.madrasaId;
    const userId = req.auth.userId;
    const { noticeId } = broadcastNoticeSchema.parse(req.body);

    const result = await profileService.broadcastNoticeToGuardians(madrasaId, noticeId, userId);

    return res.status(200).json({
      success: true,
      message: `Notice broadcast queued successfully for ${result.recipientsQueued} guardian communication channels.`,
      data: result
    });
  } catch (error) {
    next(error);
  }
}

export async function getPublicMadrasaProfile(req, res, next) {
  try {
    const { slug } = req.params;
    const profile = await profileService.getPublicProfileBySlug(slug);

    return res.status(200).json({
      success: true,
      data: profile
    });
  } catch (error) {
    next(error);
  }
}

export async function uploadHeroImage(req, res, next) {
  try {
    const madrasaId = req.tenant.madrasaId;
    const userId = req.auth?.userId;
    const ip = req.ip || req.connection?.remoteAddress;
    const ua = req.get('user-agent');

    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "No image file provided. Please provide an image using field 'heroImage'.",
      });
    }

    const result = await profileService.uploadHeroImage(
      madrasaId,
      req.file.buffer,
      req.file.originalname,
      userId,
      ip,
      ua
    );

    return res.status(200).json(result);
  } catch (error) {
    next(error);
  }
}

export async function removeHeroImage(req, res, next) {
  try {
    const madrasaId = req.tenant.madrasaId;
    const userId = req.auth?.userId;
    const ip = req.ip || req.connection?.remoteAddress;
    const ua = req.get('user-agent');

    const result = await profileService.removeHeroImage(
      madrasaId,
      userId,
      ip,
      ua
    );

    return res.status(200).json(result);
  } catch (error) {
    next(error);
  }
}

export const uploadPosterMiddleware = (req, res, next) => {
  const singleUpload = upload.single('poster');

  singleUpload(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({
          success: false,
          message: 'Poster image must be smaller than 5 MB.',
        });
      }
      return res.status(400).json({
        success: false,
        message: err.message || 'File upload error.',
      });
    } else if (err) {
      return res.status(400).json({
        success: false,
        message: err.message || 'File upload error.',
      });
    }

    next();
  });
};

export async function uploadPoster(req, res, next) {
  try {
    const madrasaId = req.tenant.madrasaId;
    const userId = req.auth?.userId;
    const ip = req.ip || req.connection?.remoteAddress;
    const ua = req.get('user-agent');

    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "No image file provided. Please provide an image using form field 'poster'.",
      });
    }

    const result = await profileService.uploadHomepagePoster(
      madrasaId,
      req.file.buffer,
      req.file.originalname,
      userId,
      ip,
      ua
    );

    return res.status(200).json(result);
  } catch (error) {
    next(error);
  }
}

export async function removePoster(req, res, next) {
  try {
    const madrasaId = req.tenant.madrasaId;
    const { fileId } = req.params;
    const userId = req.auth?.userId;
    const ip = req.ip || req.connection?.remoteAddress;
    const ua = req.get('user-agent');

    const result = await profileService.removeHomepagePoster(
      madrasaId,
      fileId,
      userId,
      ip,
      ua
    );

    return res.status(200).json(result);
  } catch (error) {
    next(error);
  }
}

// Multer configured for multi-image album uploads (up to 5 images, 5MB each)
const uploadMulti = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024,
    files: 5,
  },
});

export const uploadEventImagesMiddleware = (req, res, next) => {
  const multiUpload = uploadMulti.array('images', 5);

  multiUpload(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({
          success: false,
          message: 'Each event image must be smaller than 5 MB.',
        });
      }
      if (err.code === 'LIMIT_UNEXPECTED_FILE' || err.code === 'LIMIT_FILE_COUNT') {
        return res.status(400).json({
          success: false,
          message: 'You can upload a maximum of 5 images per album.',
        });
      }
      return res.status(400).json({
        success: false,
        message: err.message || 'File upload error.',
      });
    } else if (err) {
      return res.status(400).json({
        success: false,
        message: err.message || 'File upload error.',
      });
    }

    next();
  });
};

export async function uploadEventImages(req, res, next) {
  try {
    const madrasaId = req.tenant.madrasaId;
    const userId = req.auth?.userId;
    const ip = req.ip || req.connection?.remoteAddress;
    const ua = req.get('user-agent');

    if (!req.files || !Array.isArray(req.files) || req.files.length === 0) {
      return res.status(400).json({
        success: false,
        message: "No image files provided. Please provide images using the form field 'images'.",
      });
    }

    const result = await profileService.uploadEventImages(
      madrasaId,
      req.files,
      userId,
      ip,
      ua
    );

    return res.status(200).json(result);
  } catch (error) {
    next(error);
  }
}
