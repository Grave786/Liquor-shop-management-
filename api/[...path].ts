import { app } from '../server.ts';

function getPathFromQuery(req: any): string {
  const raw = req?.query?.path as unknown;
  if (Array.isArray(raw)) return raw.join('/');
  if (raw == null) return '';
  return String(raw);
}

function buildQueryString(req: any): string {
  const query = req?.query || {};
  const params = new URLSearchParams();

  for (const key of Object.keys(query)) {
    if (key === 'path') continue;
    const value = query[key];
    if (value == null) continue;
    if (Array.isArray(value)) {
      for (const item of value) params.append(key, String(item));
    } else {
      params.append(key, String(value));
    }
  }

  const qs = params.toString();
  return qs ? `?${qs}` : '';
}

export default function handler(req: any, res: any) {
  const normalized = getPathFromQuery(req).replace(/^\/+/, '');
  const base = normalized ? `/api/${normalized}` : '/api/';
  req.url = `${base}${buildQueryString(req)}`;

  return app(req, res);
}
