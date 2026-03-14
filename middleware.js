import { ipAddress } from '@vercel/edge';

export const config = {
  matcher: ['/auth/google', '/admin/:path*'],
};

// Simple in-memory rate limit (resets per cold start — acceptable for Vercel edge).
// For stricter global enforcement, replace with Vercel KV.
const rateLimits = new Map();

export default function middleware(request) {
  const ip = ipAddress(request) ?? 'unknown';
  const url = new URL(request.url);
  const key = `${ip}:${url.pathname}`;
  const now = Date.now();
  const isAdmin = url.pathname.startsWith('/admin');
  const windowMs = isAdmin ? 60 * 60 * 1000 : 60 * 1000;
  const maxRequests = isAdmin ? 5 : 10;

  const entry = rateLimits.get(key) ?? { count: 0, resetAt: now + windowMs };
  if (now > entry.resetAt) {
    entry.count = 0;
    entry.resetAt = now + windowMs;
  }
  entry.count++;
  rateLimits.set(key, entry);

  if (entry.count > maxRequests) {
    return new Response('Too Many Requests', { status: 429 });
  }
}
