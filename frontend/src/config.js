// Central configuration for API and Socket.IO server resolution
const getBackendUrl = () => {
  // 1. Explicitly configured Environment Variable takes top priority
  if (import.meta.env.VITE_BACKEND_URL) {
    return import.meta.env.VITE_BACKEND_URL;
  }

  // 2. Dynamic host detection (allows mobile phones & other computers on the same network to connect seamlessly)
  if (typeof window !== 'undefined' && window.location) {
    const hostname = window.location.hostname;
    const protocol = window.location.protocol;
    
    // If accessing from another PC or mobile on local network (e.g. 192.168.x.x)
    if (hostname !== 'localhost' && hostname !== '127.0.0.1') {
      return `${protocol}//${hostname}:3001`;
    }
  }

  // 3. Fallback to default local backend server port
  return 'http://localhost:3001';
};

export const BACKEND_URL = getBackendUrl();
