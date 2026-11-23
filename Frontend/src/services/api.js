import axios from 'axios';

export const TOKEN_KEY = 'probridge_admin_token';
export const USE_MOCK = false;

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000',
  timeout: 15000,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem(TOKEN_KEY) || sessionStorage.getItem(TOKEN_KEY);
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    // Expired/invalid token -> AuthContext logs the admin out
    if (err.response?.status === 401) window.dispatchEvent(new Event('admin:unauthorized'));
    return Promise.reject(err);
  }
);

export const errorMessage = (e) =>
  e?.response?.data?.message ||
  (e?.code === 'ERR_NETWORK' ? 'Cannot reach the server. Is the backend running?' : e?.message) ||
  'Something went wrong';

export default api;
