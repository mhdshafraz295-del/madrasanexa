import multer from 'multer';
import * as brandingService from '../services/branding.service.js';

// Configure Multer for memory storage with 5 MB hard limit
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024, // 5 MB
    files: 1,
  },
});

/**
 * Express middleware to handle single file upload with clean error translation
 */
export const uploadLogoMiddleware = (req, res, next) => {
  const singleUpload = upload.single('logo');

  singleUpload(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({
          success: false,
          message: 'Logo must be smaller than 5 MB.',
        });
      }
      if (err.code === 'LIMIT_UNEXPECTED_FILE') {
        return res.status(400).json({
          success: false,
          message: "Please upload a single image file using the form field 'logo'.",
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

/**
 * Controller: GET /api/madrasa-admin/branding
 */
export async function getBranding(req, res, next) {
  try {
    const data = await brandingService.getMadrasaBranding(req.tenant.madrasaId);
    return res.status(200).json({
      success: true,
      data,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Controller: POST /api/madrasa-admin/branding/logo
 */
export async function uploadLogo(req, res, next) {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No logo file provided. Please upload a JPG, PNG or WebP image.',
      });
    }

    const ipAddress = req.ip || req.connection?.remoteAddress || null;
    const userAgent = req.get('user-agent') || null;

    const result = await brandingService.uploadMadrasaLogo(
      req.tenant.madrasaId,
      req.file.buffer,
      req.file.originalname,
      req.auth?.userId || null,
      ipAddress,
      userAgent
    );

    return res.status(200).json(result);
  } catch (error) {
    next(error);
  }
}

/**
 * Controller: DELETE /api/madrasa-admin/branding/logo
 */
export async function removeLogo(req, res, next) {
  try {
    const ipAddress = req.ip || req.connection?.remoteAddress || null;
    const userAgent = req.get('user-agent') || null;

    const result = await brandingService.removeMadrasaLogo(
      req.tenant.madrasaId,
      req.auth?.userId || null,
      ipAddress,
      userAgent
    );

    return res.status(200).json(result);
  } catch (error) {
    next(error);
  }
}
