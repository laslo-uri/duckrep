import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = resolve(__dirname, '..');
const vercel = JSON.parse(readFileSync(resolve(root, 'vercel.json'), 'utf8')) as {
  headers: { source: string; headers: { key: string; value: string }[] }[];
};
const headers = new Map(
  (vercel.headers.find((rule) => rule.source === '/(.*)')?.headers ?? []).map(({ key, value }) => [key, value]),
);
const csp = headers.get('Content-Security-Policy') ?? '';
const scriptSrc = csp.split(';').find((part) => part.trim().startsWith('script-src')) ?? '';

describe('production headers (vercel.json)', () => {
  it('allows the inline theme script in index.html by its hash and no other inline script', () => {
    const html = readFileSync(resolve(root, 'index.html'), 'utf8');
    const inline = [...html.matchAll(/<script>(.*?)<\/script>/gs)].map((match) => match[1]);
    expect(inline).toHaveLength(1);
    const hash = createHash('sha256').update(inline[0]).digest('base64');
    expect(scriptSrc).toContain(`'sha256-${hash}'`);
    expect(scriptSrc).not.toContain("'unsafe-inline'");
  });

  it('never allows eval (sql.js needs only wasm)', () => {
    expect(csp).not.toContain("'unsafe-eval'");
    expect(scriptSrc).toContain("'wasm-unsafe-eval'");
  });

  it('cannot be framed and sends the other security headers', () => {
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain("base-uri 'self'");
    expect(headers.get('X-Frame-Options')).toBe('DENY');
    expect(headers.get('X-Content-Type-Options')).toBe('nosniff');
    expect(headers.get('Referrer-Policy')).toBeTruthy();
    expect(headers.get('Permissions-Policy')).toBeTruthy();
    expect(headers.get('Strict-Transport-Security')).toContain('max-age=');
  });
});
