/**
 * Shared test helpers for all test files.
 * Pattern: HTTP requests against a running server, assert() with descriptive messages.
 */

export const BASE = 'http://localhost:3141/api';

export async function request(path: string, options?: RequestInit): Promise<any> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
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
