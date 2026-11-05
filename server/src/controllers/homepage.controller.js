import multer from 'multer';
import * as homepageService from '../services/homepage.service.js';
import { ALLOWED_HOMEPAGE_SECTIONS } from '../validations/homepage.validation.js';
import { BadRequestError } from '../utils/errors.js';

// Configure Multer for in-memory processing (Max 5 MB per file, max 8 files)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024, // 5 MB
    files: 8,
  },
});

export const uploadHomepageImagesMiddleware = (req, res, next) => {
  const uploadHandler = upload.fields([
    { name: 'images', maxCount: 8 },
    { name: 'image', maxCount: 8 },
    { name: 'files', maxCount: 8 },
    { name: 'file', maxCount: 8 },
  ]);

  uploadHandler(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({
          success: false,
          message: 'Each image must be smaller than 5 MB.',
        });
      }
      if (err.code === 'LIMIT_FILE_COUNT') {
        return res.status(400).json({
          success: false,
          message: 'Cannot upload more than 8 images at once.',
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

    const collected = [];
    if (req.files) {
      for (const field of ['images', 'image', 'files', 'file']) {
        if (Array.isArray(req.files[field])) {
          collected.push(...req.files[field]);
        }
      }
    } else if (req.file) {
      collected.push(req.file);
    }

    req.uploadedFiles = collected;
    next();
  });
};

/**
 * Super Admin: POST /api/super-admin/website-content/homepage/images
 */
export async function uploadHomepageImages(req, res, next) {
  try {
    const currentUser = req.auth || req.user;
    const ipAddress = req.ip || req.connection?.remoteAddress || null;
    const userAgent = req.get('user-agent') || null;

    const files = req.uploadedFiles;
    const rawSection = String(req.body?.section || req.query?.section || 'hero').trim();
    if (!ALLOWED_HOMEPAGE_SECTIONS.includes(rawSection)) {
      throw new BadRequestError('Invalid homepage section identifier. Allowed: ' + ALLOWED_HOMEPAGE_SECTIONS.join(', '));
    }

    const data = await homepageService.uploadHomepageImages(files, currentUser, {
      ipAddress,
      userAgent,
      section: rawSection,
    });

    return res.status(201).json({
      success: true,
      message: 'Images uploaded successfully.',
      data,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Super Admin: DELETE /api/super-admin/website-content/homepage/images/:fileId
 */
export async function removeHomepageImage(req, res, next) {
  try {
    const currentUser = req.auth || req.user;
    const { fileId } = req.params;

    const data = await homepageService.removeHomepageImage(fileId, currentUser);
    return res.status(200).json({
      success: true,
      data,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Public: GET /api/public/homepage
 */
export async function getPublicHomepage(req, res, next) {
  try {
    const data = await homepageService.getPublicHomepage();
    return res.status(200).json({
      success: true,
      data,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Super Admin: GET /api/super-admin/website-content/homepage
 */
export async function getAdminDraft(req, res, next) {
  try {
    const data = await homepageService.getAdminHomepageDraft();
    return res.status(200).json({
      success: true,
      data,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Super Admin: PUT /api/super-admin/website-content/homepage
 */
export async function updateAdminDraft(req, res, next) {
  try {
    const currentUser = req.auth || req.user;
    const data = await homepageService.updateHomepageDraft(req.body, currentUser);
    return res.status(200).json({
      success: true,
      message: 'Homepage draft saved successfully.',
      data,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Super Admin: POST /api/super-admin/website-content/homepage/publish
 */
export async function publishHomepage(req, res, next) {
  try {
    const currentUser = req.auth || req.user;
    const ipAddress = req.ip || req.connection?.remoteAddress || null;
    const userAgent = req.get('user-agent') || null;

    const data = await homepageService.publishHomepage(currentUser, { ipAddress, userAgent });
    return res.status(200).json({
      success: true,
      message: 'Homepage content published successfully.',
      data,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Super Admin: POST /api/super-admin/website-content/homepage/unpublish
 */
export async function unpublishHomepage(req, res, next) {
  try {
    const currentUser = req.auth || req.user;
    const ipAddress = req.ip || req.connection?.remoteAddress || null;
    const userAgent = req.get('user-agent') || null;

    const data = await homepageService.unpublishHomepage(currentUser, { ipAddress, userAgent });
    return res.status(200).json({
      success: true,
      message: 'Homepage content unpublished successfully.',
      data,
    });
  } catch (err) {
    next(err);
  }
}
