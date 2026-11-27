import multer from 'multer';
import {
  createAnnouncementSchema,
  updateAnnouncementSchema,
  publishAnnouncementSchema,
  superAdminListQuerySchema,
  madrasaAdminListQuerySchema,
} from '../validations/announcement.validation.js';
import * as announcementService from '../services/announcement.service.js';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024, // 5 MB
    files: 1,
  },
});

export const uploadAnnouncementImageMiddleware = (req, res, next) => {
  const uploadHandler = upload.fields([
    { name: 'image', maxCount: 1 },
    { name: 'file', maxCount: 1 },
    { name: 'poster', maxCount: 1 },
  ]);

  uploadHandler(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({
          success: false,
          message: 'Announcement image must be smaller than 5 MB.',
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
        req.files['file']?.[0] ||
        req.files['poster']?.[0] ||
        null;
    }

    next();
  });
};

export async function uploadAnnouncementImage(req, res, next) {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No image file provided. Please provide an image using form field "image" or "file".',
      });
    }

    const userId = req.auth?.userId;
    const ipAddress = req.ip || req.connection?.remoteAddress;
    const userAgent = req.get('user-agent');

    const result = await announcementService.uploadAnnouncementImage(
      req.file,
      userId,
      ipAddress,
      userAgent
    );

    return res.status(201).json({
      success: true,
      message: 'Announcement image uploaded successfully.',
      data: result,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * ==========================================
 * SUPER ADMIN CONTROLLERS
 * ==========================================
 */

export async function createAnnouncement(req, res, next) {
  try {
    const validated = createAnnouncementSchema.parse(req.body);
    const userId = req.auth.userId;
    const ipAddress = req.ip || req.connection?.remoteAddress;
    const userAgent = req.get('user-agent');

    const result = await announcementService.createAnnouncement(
      validated,
      userId,
      ipAddress,
      userAgent
    );

    return res.status(201).json({
      success: true,
      message: 'Announcement draft created successfully.',
      data: result,
    });
  } catch (error) {
    next(error);
  }
}

export async function updateAnnouncement(req, res, next) {
  try {
    const validated = updateAnnouncementSchema.parse(req.body);
    const id = req.params.id;
    const userId = req.auth.userId;
    const ipAddress = req.ip || req.connection?.remoteAddress;
    const userAgent = req.get('user-agent');

    const result = await announcementService.updateAnnouncement(
      id,
      validated,
      userId,
      ipAddress,
      userAgent
    );

    return res.status(200).json({
      success: true,
      message: 'Announcement updated successfully.',
      data: result,
    });
  } catch (error) {
    next(error);
  }
}

export async function publishAnnouncement(req, res, next) {
  try {
    const validated = publishAnnouncementSchema.parse(req.body || {});
    const id = req.params.id;
    const userId = req.auth.userId;
    const ipAddress = req.ip || req.connection?.remoteAddress;
    const userAgent = req.get('user-agent');

    const result = await announcementService.publishAnnouncement(
      id,
      validated,
      userId,
      ipAddress,
      userAgent
    );

    return res.status(200).json({
      success: true,
      message: 'Announcement published successfully.',
      data: result,
    });
  } catch (error) {
    next(error);
  }
}

export async function archiveAnnouncement(req, res, next) {
  try {
    const id = req.params.id;
    const userId = req.auth.userId;
    const ipAddress = req.ip || req.connection?.remoteAddress;
    const userAgent = req.get('user-agent');

    const result = await announcementService.archiveAnnouncement(
      id,
      userId,
      ipAddress,
      userAgent
    );

    return res.status(200).json({
      success: true,
      message: 'Announcement archived successfully.',
      data: result,
    });
  } catch (error) {
    next(error);
  }
}

export async function unpublishAnnouncement(req, res, next) {
  try {
    const id = req.params.id;
    const userId = req.auth.userId;
    const ipAddress = req.ip || req.connection?.remoteAddress;
    const userAgent = req.get('user-agent');

    const result = await announcementService.unpublishAnnouncement(
      id,
      userId,
      ipAddress,
      userAgent
    );

    return res.status(200).json({
      success: true,
      message: 'Announcement unpublished and returned to draft.',
      data: result,
    });
  } catch (error) {
    next(error);
  }
}

export async function listSuperAdminAnnouncements(req, res, next) {
  try {
    const validated = superAdminListQuerySchema.parse(req.query);
    const result = await announcementService.listSuperAdminAnnouncements(validated);

    return res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
}

export async function getSuperAdminAnnouncement(req, res, next) {
  try {
    const id = req.params.id;
    const result = await announcementService.getSuperAdminAnnouncementById(id);

    return res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * ==========================================
 * MADRASA ADMIN CONTROLLERS
 * ==========================================
 */

export async function listMadrasaAnnouncements(req, res, next) {
  try {
    const validated = madrasaAdminListQuerySchema.parse(req.query);
    const madrasaId = req.tenant.madrasaId;
    const userId = req.auth.userId;

    const result = await announcementService.listMadrasaAnnouncements(
      madrasaId,
      userId,
      validated
    );

    return res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
}

export async function getMadrasaAnnouncement(req, res, next) {
  try {
    const id = req.params.id;
    const madrasaId = req.tenant.madrasaId;
    const userId = req.auth.userId;

    const result = await announcementService.getMadrasaAnnouncementById(
      id,
      madrasaId,
      userId
    );

    return res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
}

export async function markAnnouncementAsRead(req, res, next) {
  try {
    const id = req.params.id;
    const madrasaId = req.tenant.madrasaId;
    const userId = req.auth.userId;

    const result = await announcementService.markAnnouncementAsRead(
      id,
      madrasaId,
      userId
    );

    return res.status(200).json({
      success: true,
      message: 'Announcement marked as read.',
      data: result,
    });
  } catch (error) {
    next(error);
  }
}

export async function markAllAnnouncementsAsRead(req, res, next) {
  try {
    const madrasaId = req.tenant.madrasaId;
    const userId = req.auth.userId;

    const result = await announcementService.markAllAnnouncementsAsRead(
      madrasaId,
      userId
    );

    return res.status(200).json({
      success: true,
      message: 'All announcements marked as read.',
      data: result,
    });
  } catch (error) {
    next(error);
  }
}

export async function getMadrasaUnreadCount(req, res, next) {
  try {
    const madrasaId = req.tenant.madrasaId;
    const userId = req.auth.userId;

    const unreadCount = await announcementService.getMadrasaUnreadCount(madrasaId, userId);

    return res.status(200).json({
      success: true,
      data: { unreadCount },
    });
  } catch (error) {
    next(error);
  }
}

export async function getMadrasaLatestAnnouncements(req, res, next) {
  try {
    const madrasaId = req.tenant.madrasaId;
    const userId = req.auth.userId;
    const limit = Math.min(parseInt(req.query.limit, 10) || 5, 10);

    const announcements = await announcementService.getMadrasaLatestAnnouncements(
      madrasaId,
      userId,
      limit
    );

    return res.status(200).json({
      success: true,
      data: { announcements },
    });
  } catch (error) {
    next(error);
  }
}
