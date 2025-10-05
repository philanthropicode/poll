// src/lib/urls.js
export const buildAuthRedirect = (to = "/") =>
  `/auth?redirect=${encodeURIComponent(to)}`;
