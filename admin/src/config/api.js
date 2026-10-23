// Set VITE_API_URL in .env (and .env.production) — e.g.
//   VITE_API_URL=https://api.pucnomination.ng
// Falling back to localhost only smooths local dev; never ships to prod
// with this fallback silently in effect (requiredEnvVars check on the
// backend catches the equivalent mistake there).
export const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";

export const API = {
  submitNomination: `${API_BASE_URL}/api/responses`,
  login: `${API_BASE_URL}/api/auth/login`,
  me: `${API_BASE_URL}/api/auth/me`,
  adminSubmissions: `${API_BASE_URL}/api/admin/submissions`,
  adminStats: `${API_BASE_URL}/api/admin/stats/overview`,
  adminUpdates: (since) => `${API_BASE_URL}/api/admin/updates?since=${encodeURIComponent(since)}`,
  adminExport: (format) => `${API_BASE_URL}/api/admin/export?format=${format}`,
  lgas: `${API_BASE_URL}/api/locations/lgas`,
  wards: (lga) => `${API_BASE_URL}/api/locations/wards?lga=${encodeURIComponent(lga)}`,
  pollingUnits: (lga, ward) =>
    `${API_BASE_URL}/api/locations/polling-units?lga=${encodeURIComponent(lga)}&ward=${encodeURIComponent(ward)}`,
};