import { app } from '../server';

function getPathFromUrl(req: any): string | null {
  try {
    const url = new URL(req.url || '/', 'http://localhost');
    return url.searchParams.get('path');
  } catch {
    return null;
  }
}

export default function handler(req: any, res: any) {
  const rawPath = (req?.query?.path ?? getPathFromUrl(req)) as unknown;
  const pathPart = Array.isArray(rawPath) ? rawPath.join('/') : (rawPath ? String(rawPath) : '');
  const normalized = pathPart.replace(/^\/+/, '');

  req.url = `/api/${normalized}`.replace(/\/+$/, normalized ? '' : '/');
  return app(req, res);
}
