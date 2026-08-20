import axios from 'axios';

// In production (Vercel), default to the live Render backend URL if VITE_API_URL is not set
const defaultApiUrl = import.meta.env.DEV 
  ? '' 
  : (import.meta.env.VITE_API_URL || 'https://rto-ledger-system-react.onrender.com');

const api = axios.create({
  baseURL: defaultApiUrl,
  withCredentials: true, // Crucial sends/receives session cookies
  headers: {
    'Content-Type': 'application/json',
  },
});

export default api;
