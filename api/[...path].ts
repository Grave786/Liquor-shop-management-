import { app } from '../server';

function getPathFromRequest(req: any): string {
  const raw = req?.query?.path as unknown;
  if (Array.isArray(raw)) return raw.join('/');
  if (typeof raw === 'string') return raw;

  try {
    const url = new URL(req?.url || '/', 'http://localhost');
    // If Vercel routing didn’t populate `req.query.path`, fall back to the URL pathname.
    // We expect to be mounted under `/api/*`.
    return url.pathname.replace(/^\/api\/?/, '');
  } catch {
    return '';
  }
}

function buildQueryString(req: any): string {
  try {
    const url = new URL(req?.url || '/', 'http://localhost');
    return url.search || '';
  } catch {
    return '';
  }
}

export default function handler(req: any, res: any) {
  const normalized = getPathFromRequest(req).replace(/^\/+/, '');
  const base = normalized ? `/api/${normalized}` : '/api/';
  req.url = `${base}${buildQueryString(req)}`;

  return app(req, res);
}
