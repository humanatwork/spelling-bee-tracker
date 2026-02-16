const BASE = '/api';

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (res.status === 204) return undefined as T;
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `Request failed: ${res.status}`);
  return data;
}

export interface Day {
  id: number;
  date: string;
  letters: string[];
  center_letter: string;
  genius_achieved: boolean;
  current_stage: 'pre-pangram' | 'backfill' | 'new-discovery';
  backfill_cursor_word_id: number | null;
  created_at: string;
  updated_at: string;
  word_count?: number;
  pangram_count?: number;
}

export interface Word {
  id: number;
  day_id: number;
  word: string;
  position: number;
  stage: string;
  status: 'pending' | 'accepted' | 'rejected' | 'scratch';
  is_pangram: boolean;
  inspiration_confidence: string | null;
  chain_depth: number;
  notes: string | null;
  created_at: string;
  inspired_by_ids: number[];
  attempt_count: number;
  is_reattempt?: boolean;
}

export interface BackfillState {
  current_word: Word | null;
  cursor_index: number;
  total_pre_pangram: number;
  processed_count: number;
  is_complete: boolean;
  backfill_words: Word[];
}

export interface BackfillAdvanceResult {
  processed_word: Word;
  next_word: Word | null;
  is_complete: boolean;
}

export const api = {
  // Days
  listDays: () => request<Day[]>('/days'),
  createDay: (date: string, letters: string[]) =>
    request<Day>('/days', { method: 'POST', body: JSON.stringify({ date, letters }) }),
  getDay: (date: string) => request<Day>(`/days/${date}`),
  updateDay: (date: string, updates: Partial<Pick<Day, 'current_stage' | 'genius_achieved' | 'backfill_cursor_word_id'>>) =>
    request<Day>(`/days/${date}`, { method: 'PATCH', body: JSON.stringify(updates) }),
  deleteDay: (date: string) => request<void>(`/days/${date}`, { method: 'DELETE' }),

  // Words
  listWords: (date: string) => request<Word[]>(`/days/${date}/words`),
  addWord: (date: string, data: {
    word: string;
    stage?: string;
    status?: string;
    is_pangram?: boolean;
    after_word_id?: number;
    inspired_by?: number[];
    inspiration_confidence?: string;
    chain_depth?: number;
    notes?: string;
  }) => request<Word>(`/days/${date}/words`, { method: 'POST', body: JSON.stringify(data) }),
  updateWord: (date: string, wordId: number, updates: Partial<Word>) =>
    request<Word>(`/days/${date}/words/${wordId}`, { method: 'PATCH', body: JSON.stringify(updates) }),
  inspireWord: (date: string, sourceWordId: number, data: {
    word: string;
    status?: string;
    inspiration_confidence?: string;
    chain_depth?: number;
  }) => request<Word>(`/days/${date}/words/${sourceWordId}/inspire`, { method: 'POST', body: JSON.stringify(data) }),

  // Backfill
  getBackfillState: (date: string) => request<BackfillState>(`/days/${date}/backfill`),
  advanceBackfill: (date: string, action: 'accept' | 'reject' | 'skip') =>
    request<BackfillAdvanceResult>(`/days/${date}/backfill/advance`, { method: 'POST', body: JSON.stringify({ action }) }),
  completeBackfill: (date: string) => request<Day>(`/days/${date}/backfill/complete`, { method: 'POST' }),

  // Attractors
  getAttractors: (date: string) => request<(Word & { attempt_count: number })[]>(`/days/${date}/attractors`),

  // Export
  exportDay: (date: string) => request<any>(`/days/${date}/export`),
};
