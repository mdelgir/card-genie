export const serverUrl = import.meta.env.VITE_SERVER_URL?.trim().replace(/\/+$/, "") ||
  `${window.location.protocol}//${window.location.hostname}:8000`;
