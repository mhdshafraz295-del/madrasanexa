import multer from 'multer';
import * as executiveService from '../services/executive-member.service.js';

// Configure Multer for executive photo memory storage with 5 MB hard limit
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024, // 5 MB
    files: 1,
  },
});

export const uploadExecutivePhotoMiddleware = (req, res, next) => {
  const singleUpload = upload.single('photo');

  singleUpload(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({
          success: false,
          message: 'Executive member photo must be smaller than 5 MB.',
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

export async function uploadExecutivePhoto(req, res, next) {
  try {
    const madrasaId = req.tenant?.madrasaId || req.user?.madrasaId;
    const userId = req.auth?.userId || req.user?.id;
    const ip = req.ip || req.connection?.remoteAddress;
    const ua = req.get('user-agent');

    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "No image file provided. Please provide an image using form field 'photo'.",
      });
    }

    const result = await executiveService.uploadExecutivePhoto(
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

export async function listExecutiveMembers(req, res, next) {
  try {
    const madrasaId = req.tenant?.madrasaId || req.user?.madrasaId;
    const members = await executiveService.listExecutiveMembers(madrasaId, req.query);
    return res.status(200).json({
      success: true,
      data: members,
    });
  } catch (error) {
    next(error);
  }
}

export async function getExecutiveMemberById(req, res, next) {
  try {
    const madrasaId = req.tenant?.madrasaId || req.user?.madrasaId;
    const { id } = req.params;
    const member = await executiveService.getExecutiveMemberById(madrasaId, id);
    return res.status(200).json({
      success: true,
      data: member,
    });
  } catch (error) {
    next(error);
  }
}

export async function createExecutiveMember(req, res, next) {
  try {
    const madrasaId = req.tenant?.madrasaId || req.user?.madrasaId;
    const userId = req.auth?.userId || req.user?.id;
    const ip = req.ip || req.connection?.remoteAddress;
    const ua = req.get('user-agent');

    const created = await executiveService.createExecutiveMember(
      madrasaId,
      req.body,
      userId,
      ip,
      ua
    );

    return res.status(201).json({
      success: true,
      message: 'Executive member added successfully.',
      data: created,
    });
  } catch (error) {
    next(error);
  }
}

export async function updateExecutiveMember(req, res, next) {
  try {
    const madrasaId = req.tenant?.madrasaId || req.user?.madrasaId;
    const { id } = req.params;
    const userId = req.auth?.userId || req.user?.id;
    const ip = req.ip || req.connection?.remoteAddress;
    const ua = req.get('user-agent');

    const updated = await executiveService.updateExecutiveMember(
      madrasaId,
      id,
      req.body,
      userId,
      ip,
      ua
    );

    return res.status(200).json({
      success: true,
      message: 'Executive member updated successfully.',
      data: updated,
    });
  } catch (error) {
    next(error);
  }
}

export async function deleteExecutiveMember(req, res, next) {
  try {
    const madrasaId = req.tenant?.madrasaId || req.user?.madrasaId;
    const { id } = req.params;
    const userId = req.auth?.userId || req.user?.id;
    const ip = req.ip || req.connection?.remoteAddress;
    const ua = req.get('user-agent');

    const result = await executiveService.deleteExecutiveMember(
      madrasaId,
      id,
      userId,
      ip,
      ua
    );

    return res.status(200).json(result);
  } catch (error) {
    next(error);
  }
}
