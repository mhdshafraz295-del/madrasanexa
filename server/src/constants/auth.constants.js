/**
 * Centralized Authentication & Session Constants for MadrasaNexa Platform
 */

export const AUTH_ROLES = Object.freeze({
  SUPER_ADMIN: 'SUPER_ADMIN',
  MADRASA_ADMIN: 'MADRASA_ADMIN',
  TEACHER: 'TEACHER',
});

/**
 * Frontend browser localStorage session keys.
 * Namespacing prevents session collisions on shared terminals or local development origins.
 */
export const AUTH_STORAGE_KEYS = Object.freeze({
  ADMIN: 'madrasanexa_admin_token',
  TEACHER: 'madrasanexa_teacher_token',
  // Backward compatibility legacy fallback key
  LEGACY: 'madrasanexa_token',
});
