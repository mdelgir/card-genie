export const serverUrl = import.meta.env.VITE_SERVER_URL ??
  `${window.location.protocol}//${window.location.hostname}:8000`;
