/**
 * Shared test helpers for all test files.
 * Pattern: HTTP requests against a running server, assert() with descriptive messages.
 */

const PORT = process.env.PORT || '3141';
export const BASE = `http://localhost:${PORT}/api`;

export async function request(path: string, options?: RequestInit): Promise<any> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (res.status === 204) return null;
  const data: any = await res.json();
  if (!res.ok) throw new Error(`${res.status}: ${data.error}`);
  return data;
}

export async function requestRaw(path: string, options?: RequestInit): Promise<{ status: number; data: any }> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  let data: any;
  const text = await res.text();
  try {
    data = JSON.parse(text);
  } catch {
    data = text || null;
  }
  return { status: res.status, data };
}

export function assert(condition: boolean, msg: string) {
  if (!condition) {
    console.error(`FAIL: ${msg}`);
    process.exit(1);
  }
  console.log(`  OK: ${msg}`);
}
