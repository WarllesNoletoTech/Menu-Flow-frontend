const configuredApiUrl = process.env.NEXT_PUBLIC_API_URL?.trim() || 'http://localhost:3001';

export const API_BASE_URL = configuredApiUrl.replace(/\/+$/, '');

export function apiUrl(path: string) {
  return `${API_BASE_URL}/${path.replace(/^\/+/, '')}`;
}
