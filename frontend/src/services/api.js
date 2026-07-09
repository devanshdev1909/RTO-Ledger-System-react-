import axios from 'axios';

// In production (Vercel), VITE_API_URL = your Render backend URL
// In local dev, it's empty so the Vite proxy in vite.config.js handles it
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '',
  withCredentials: true, // Crucial sends/receives session cookies
  headers: {
    'Content-Type': 'application/json',
  },
});

export default api;
