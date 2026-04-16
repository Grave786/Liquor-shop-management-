const getApiBase = () => {
  const rawBase = String(import.meta.env.VITE_API_URL || '').trim();
  return rawBase ? rawBase.replace(/\/+$/, '') : '';
};

export const apiUrl = (endpoint: string) => {
  const value = String(endpoint || '').trim();
  if (!value) return value;
  if (/^https?:\/\//i.test(value)) return value;

  const base = getApiBase();
  if (!base) return value;

  if (value.startsWith('/')) return `${base}${value}`;
  return `${base}/${value}`;
};

export const apiFetch = async (endpoint: string, options: RequestInit = {}) => {
  const token = localStorage.getItem('token');
  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(options.headers || {}),
  };

  const response = await fetch(apiUrl(endpoint), { ...options, headers });

  if (response.status === 401) {
    localStorage.removeItem('token');
    window.location.href = '/login';
    throw new Error('Unauthorized');
  }

  return response;
};
