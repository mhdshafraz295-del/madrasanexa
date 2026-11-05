import { loginSchema } from '../validators/auth.validator.js';
import { loginUser, getMe, changeUserPassword } from '../services/auth.service.js';
import { z } from 'zod';

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: z.string().min(10, 'New password must be at least 10 characters long'),
});

export const handleLogin = async (req, res, next) => {
  try {
    const validatedData = loginSchema.parse(req.body);
    const ip = req.ip || req.connection.remoteAddress;
    const userAgent = req.get('user-agent');

    const result = await loginUser(validatedData.email, validatedData.password, ip, userAgent);

    return res.status(200).json({
      success: true,
      message: 'Login successful',
      data: result,
    });
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({
        success: false,
        message: error.message,
      });
    }
    next(error);
  }
};

export const handleGetMe = async (req, res, next) => {
  try {
    const user = await getMe(req.auth.userId);

    return res.status(200).json({
      success: true,
      data: { user },
    });
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({
        success: false,
        message: error.message,
      });
    }
    next(error);
  }
};

export const handleChangePassword = async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = changePasswordSchema.parse(req.body);
    const ip = req.ip || req.connection.remoteAddress;
    const userAgent = req.get('user-agent');

    const result = await changeUserPassword(
      req.auth.userId,
      currentPassword,
      newPassword,
      ip,
      userAgent
    );

    return res.status(200).json(result);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        message: error.issues?.[0]?.message || error.errors?.[0]?.message || 'Validation error',
      });
    }
    if (error.statusCode) {
      return res.status(error.statusCode).json({
        success: false,
        message: error.message,
      });
    }
    next(error);
  }
};
