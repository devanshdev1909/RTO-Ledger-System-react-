import axios from 'axios';

// Create a configured axios instance for clean API calls
const api = axios.create({
  baseURL: '', // Empty because Vite proxy handles the base path '/api'
  withCredentials: true, // Crucial sends/receives session cookies
  headers: {
    'Content-Type': 'application/json',
  },
});

export default api;
