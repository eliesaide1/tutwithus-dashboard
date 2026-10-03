import axios from 'axios';

const baseURL = import.meta.env.VITE_API_URL
  ? `${import.meta.env.VITE_API_URL.replace(/\/$/, '')}/api`
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
