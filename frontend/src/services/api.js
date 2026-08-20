import axios from 'axios';

const PRODUCTION_API_URL = 'https://rto-ledger-system-react.onrender.com';

const isLocalhost = () => {
  if (typeof window !== 'undefined') {
    const host = window.location.hostname;
    return host === 'localhost' || host === '127.0.0.1';
  }
  return false;
};

const api = axios.create({
  baseURL: isLocalhost() ? '' : PRODUCTION_API_URL,
  withCredentials: true, // Crucial sends/receives session cookies
  headers: {
    'Content-Type': 'application/json',
  },
});

// Interceptor to guarantee production backend URL is prepended for deployed builds
api.interceptors.request.use(
  (config) => {
    if (!isLocalhost()) {
      if (config.url && !config.url.startsWith('http')) {
        const cleanPath = config.url.startsWith('/') ? config.url : '/' + config.url;
        config.url = `${PRODUCTION_API_URL}${cleanPath}`;
      }
    }
    return config;
  },
  (error) => Promise.reject(error)
);

export default api;
