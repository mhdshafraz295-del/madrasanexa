import multer from 'multer';
import * as aboutUsService from '../services/about-us.service.js';
import {
  updateAboutUsDraftSchema,
  updateAboutUsTranslationDraftSchema,
} from '../validations/about-us.validation.js';

// Configure Multer for in-memory processing with a strict 5 MB limit
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024, // 5 MB
    files: 1,
  },
});

export const uploadHeroImageMiddleware = (req, res, next) => {
  const uploadHandler = upload.fields([
    { name: 'image', maxCount: 1 },
    { name: 'heroImage', maxCount: 1 },
    { name: 'hero', maxCount: 1 },
    { name: 'file', maxCount: 1 },
  ]);

  uploadHandler(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({
          success: false,
          message: 'Image must be smaller than 5 MB.',
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

    if (req.files) {
      req.file =
        req.files['image']?.[0] ||
        req.files['heroImage']?.[0] ||
        req.files['hero']?.[0] ||
        req.files['file']?.[0] ||
        null;
    }

    next();
  });
};

export const uploadStoryImageMiddleware = (req, res, next) => {
  const uploadHandler = upload.fields([
    { name: 'image', maxCount: 1 },
    { name: 'storyImage', maxCount: 1 },
    { name: 'story', maxCount: 1 },
    { name: 'file', maxCount: 1 },
  ]);

  uploadHandler(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({
          success: false,
          message: 'Image must be smaller than 5 MB.',
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

    if (req.files) {
      req.file =
        req.files['image']?.[0] ||
        req.files['storyImage']?.[0] ||
        req.files['story']?.[0] ||
        req.files['file']?.[0] ||
        null;
    }

    next();
  });
};

/**
 * Super Admin: GET /api/super-admin/about-us
 */
export async function getAdminAboutUs(req, res, next) {
  try {
    const data = await aboutUsService.getAdminAboutUs();
    return res.status(200).json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

/**
 * Super Admin: PUT /api/super-admin/about-us/draft
 */
export async function updateDraft(req, res, next) {
  try {
    const lang = (req.body?.language || req.query?.lang || 'en').toString().toLowerCase().trim();
    let validated;
    if (lang === 'ar' || lang === 'ta') {
      validated = updateAboutUsTranslationDraftSchema.parse(req.body);
    } else {
      validated = updateAboutUsDraftSchema.parse(req.body);
    }
    const ipAddress = req.ip || req.connection?.remoteAddress || null;
    const userAgent = req.get('user-agent') || null;
    const currentUser = req.auth || req.user;

    const data = await aboutUsService.updateDraft(validated, currentUser, {
      ipAddress,
      userAgent,
      language: lang,
    });

    return res.status(200).json({
      success: true,
      message: 'Draft content updated successfully.',
      data,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Super Admin: POST /api/super-admin/about-us/hero-image
 */
export async function uploadHeroImage(req, res, next) {
  try {
    if (!req.file || !req.file.buffer) {
      return res.status(400).json({
        success: false,
        message: 'No hero image file provided. Please upload a valid JPG, PNG, or WebP image.',
      });
    }

    const ipAddress = req.ip || req.connection?.remoteAddress || null;
    const userAgent = req.get('user-agent') || null;
    const altText = req.body?.altText || null;
    const currentUser = req.auth || req.user;

    const data = await aboutUsService.uploadHeroImage(
      req.file.buffer,
      req.file.originalname,
      currentUser,
      { ipAddress, userAgent, altText }
    );

    return res.status(200).json({
      success: true,
      message: 'Hero image uploaded and draft updated successfully.',
      data,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Super Admin: DELETE /api/super-admin/about-us/hero-image
 */
export async function removeHeroImage(req, res, next) {
  try {
    const ipAddress = req.ip || req.connection?.remoteAddress || null;
    const userAgent = req.get('user-agent') || null;
    const currentUser = req.auth || req.user;

    const data = await aboutUsService.removeHeroImage(currentUser, {
      ipAddress,
      userAgent,
    });

    return res.status(200).json({
      success: true,
      message: 'Draft hero image removed successfully.',
      data,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Super Admin: POST /api/super-admin/about-us/story-image
 */
export async function uploadStoryImage(req, res, next) {
  try {
    if (!req.file || !req.file.buffer) {
      return res.status(400).json({
        success: false,
        message: 'No story image file provided. Please upload a valid JPG, PNG, or WebP image.',
      });
    }

    const ipAddress = req.ip || req.connection?.remoteAddress || null;
    const userAgent = req.get('user-agent') || null;
    const altText = req.body?.altText || null;
    const currentUser = req.auth || req.user;

    const data = await aboutUsService.uploadStoryImage(
      req.file.buffer,
      req.file.originalname,
      currentUser,
      { ipAddress, userAgent, altText }
    );

    return res.status(200).json({
      success: true,
      message: 'Story image uploaded and draft updated successfully.',
      data,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Super Admin: DELETE /api/super-admin/about-us/story-image
 */
export async function removeStoryImage(req, res, next) {
  try {
    const ipAddress = req.ip || req.connection?.remoteAddress || null;
    const userAgent = req.get('user-agent') || null;
    const currentUser = req.auth || req.user;

    const data = await aboutUsService.removeStoryImage(currentUser, {
      ipAddress,
      userAgent,
    });

    return res.status(200).json({
      success: true,
      message: 'Draft story image removed successfully.',
      data,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Super Admin: POST /api/super-admin/about-us/publish
 */
export async function publishAboutUs(req, res, next) {
  try {
    const ipAddress = req.ip || req.connection?.remoteAddress || null;
    const userAgent = req.get('user-agent') || null;
    const currentUser = req.auth || req.user;

    const data = await aboutUsService.publishAboutUs(currentUser, {
      ipAddress,
      userAgent,
    });

    return res.status(200).json({
      success: true,
      message: 'About Us content published successfully.',
      data,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Super Admin: POST /api/super-admin/about-us/unpublish
 */
export async function unpublishAboutUs(req, res, next) {
  try {
    const ipAddress = req.ip || req.connection?.remoteAddress || null;
    const userAgent = req.get('user-agent') || null;
    const currentUser = req.auth || req.user;

    const data = await aboutUsService.unpublishAboutUs(currentUser, {
      ipAddress,
      userAgent,
    });

    return res.status(200).json({
      success: true,
      message: 'About Us content unpublished successfully.',
      data,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Public: GET /api/public/about-us
 */
export async function getPublicAboutUs(req, res, next) {
  try {
    const lang = req.query.lang;
    const explicitLangQuery = 'lang' in req.query;
    const result = await aboutUsService.getPublicAboutUs(lang, { explicitLangQuery });
    return res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
}
