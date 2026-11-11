// Central configuration for API and Socket.IO server resolution
const getBackendUrl = () => {
  // 1. Explicitly configured Environment Variable takes top priority
  if (import.meta.env.VITE_BACKEND_URL) {
    return import.meta.env.VITE_BACKEND_URL;
  }

  if (typeof window !== 'undefined' && window.location) {
    const { hostname, protocol, port, origin } = window.location;

    // 2. Production or Cloud Deployment (e.g. Render, Railway, VPS, Cloudflare Tunnel):
    // If we are not running on the Vite dev port (5173), frontend and backend are served from the same domain
    if (port !== '5173') {
      return origin;
    }

    // 3. Local Development: If accessing Vite (5173) from another PC or mobile on local network (e.g. 192.168.x.x)
    if (hostname !== 'localhost' && hostname !== '127.0.0.1') {
      return `${protocol}//${hostname}:3000`;
    }
  }

  // 4. Default local development backend
  return 'http://localhost:3000';
};

export const BACKEND_URL = getBackendUrl();
