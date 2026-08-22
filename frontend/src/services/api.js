import axios from 'axios';

const api = axios.create({
  baseURL: '',
  withCredentials: true, // Sends/receives session cookies
  headers: {
    'Content-Type': 'application/json',
  },
});

export default api;

