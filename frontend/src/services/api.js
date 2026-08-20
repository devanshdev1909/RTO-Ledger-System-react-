import axios from 'axios';

const getBaseURL = () => {
  if (typeof window !== 'undefined') {
    const host = window.location.hostname;
    if (host === 'localhost' || host === '127.0.0.1') {
      return ''; // Use local Vite dev proxy
    }
  }
  return import.meta.env.VITE_API_URL || 'https://rto-ledger-system-react.onrender.com';
};

const api = axios.create({
  baseURL: getBaseURL(),
  withCredentials: true, // Crucial sends/receives session cookies
  headers: {
    'Content-Type': 'application/json',
  },
});

export default api;
