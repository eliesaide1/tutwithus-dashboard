import axios from 'axios';

// Empty in development (the Vite proxy handles /api). In production this is
// the API origin; Render supplies a bare hostname, so add the scheme if absent.
const apiOrigin = (import.meta.env.VITE_API_URL || '').trim().replace(/\/$/, '');
const baseURL = apiOrigin
  ? `${/^https?:\/\//.test(apiOrigin) ? apiOrigin : `https://${apiOrigin}`}/api`
  : '/api';

export const api = axios.create({ baseURL, timeout: 20000 });

export const TOKEN_KEY = 'tutwithus.token';

api.interceptors.request.use((config) => {
  const token = localStorage.getItem(TOKEN_KEY);
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (error) => {
    const status = error.response?.status;
    if (status === 401 && !error.config?.url?.includes('/auth/login')) {
      localStorage.removeItem(TOKEN_KEY);
      if (!window.location.pathname.startsWith('/login')) window.location.assign('/login');
    }
    // Normalise every failure into a single readable message for the UI.
    error.friendlyMessage =
      error.response?.data?.message ||
      (error.code === 'ERR_NETWORK' ? 'Cannot reach the server. Is the API running?' : error.message);
    error.fieldErrors = error.response?.data?.details || [];
    return Promise.reject(error);
  },
);

/** Downloads a CSV/TXT export through the authenticated client. */
export async function downloadFile(url, filename, params = {}) {
  const res = await api.get(url, { params, responseType: 'blob' });
  const href = URL.createObjectURL(res.data);
  const link = document.createElement('a');
  link.href = href;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(href);
}
