export const successResponse = (res, message, data = null, statusCode = 200) => {
  const payload = {
    success: true,
    message,
    ...(data !== null ? { data } : {}),
  };
  return res.status(statusCode).json(payload);
};

export const errorResponse = (res, message, statusCode = 500, errors = null) => {
  const payload = {
    success: false,
    message,
    ...(errors !== null ? { errors } : {}),
  };
  return res.status(statusCode).json(payload);
};
