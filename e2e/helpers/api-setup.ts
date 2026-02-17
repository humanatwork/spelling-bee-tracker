/**
 * Direct API calls to set up test preconditions, bypassing the UI.
 * This avoids slow UI interactions when we just need data in place.
 */

const API_BASE = 'http://localhost:3141/api';

async function apiRequest(path: string, options?: RequestInit): Promise<any> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (res.status === 204) return undefined;
  const data = await res.json();
  if (!res.ok) throw new Error(`API ${res.status}: ${data.error}`);
  return data;
}

export async function createDay(date: string, letters: string[]): Promise<any> {
  return apiRequest('/days', {
    method: 'POST',
    body: JSON.stringify({ date, letters }),
  });
}

export async function addWord(date: string, word: string, options?: Record<string, any>): Promise<any> {
  return apiRequest(`/days/${date}/words`, {
    method: 'POST',
    body: JSON.stringify({ word, ...options }),
  });
}

export async function updateDay(date: string, updates: Record<string, any>): Promise<any> {
  return apiRequest(`/days/${date}`, {
    method: 'PATCH',
    body: JSON.stringify(updates),
  });
}

export async function deleteDay(date: string): Promise<void> {
  await apiRequest(`/days/${date}`, { method: 'DELETE' });
}

export async function listDays(): Promise<any[]> {
  return apiRequest('/days');
}

export async function completeBackfill(date: string): Promise<any> {
  return apiRequest(`/days/${date}/backfill/complete`, { method: 'POST' });
}

export async function advanceBackfill(date: string, action: string): Promise<any> {
  return apiRequest(`/days/${date}/backfill/advance`, {
    method: 'POST',
    body: JSON.stringify({ action }),
  });
}

/** Clean up all days (useful in beforeEach) */
export async function cleanupAllDays(): Promise<void> {
  const days = await listDays();
  for (const day of days) {
    await deleteDay(day.date);
  }
}

/** Create a day and add pre-pangram words, ready for backfill */
export async function setupDayInBackfill(
  date: string,
  letters: string[],
  words: string[],
  pangram: string
): Promise<any> {
  await createDay(date, letters);
  for (const w of words) {
    await addWord(date, w);
  }
  await addWord(date, pangram, { is_pangram: true });
  await updateDay(date, { current_stage: 'backfill' });
  return apiRequest(`/days/${date}`);
}

/** Create a day in new-discovery stage (with pre-pangram words processed) */
export async function setupDayInNewDiscovery(
  date: string,
  letters: string[],
  prePangramWords: string[],
  pangram: string
): Promise<any> {
  await setupDayInBackfill(date, letters, prePangramWords, pangram);
  // Process all words through backfill
  for (let i = 0; i < prePangramWords.length + 1; i++) {
    try {
      await advanceBackfill(date, 'accept');
    } catch {
      break; // All done
    }
  }
  await completeBackfill(date);
  return apiRequest(`/days/${date}`);
}
