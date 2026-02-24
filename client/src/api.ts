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
  created_at: string;
  word_count?: number;
  pangram_count?: number;
  total_points?: number;
}

export interface Word {
  id: number;
  day_id: number;
  word: string;
  position: number;
  is_pangram: boolean;
  status: 'pending' | 'accepted' | 'rejected';
  points: number | null;
  created_at: string;
}

export const api = {
  // Days
  listDays: () => request<Day[]>('/days'),
  createDay: (date: string, letters: string[]) =>
    request<Day>('/days', { method: 'POST', body: JSON.stringify({ date, letters }) }),
  getDay: (date: string) => request<Day>(`/days/${date}`),
  deleteDay: (date: string) => request<void>(`/days/${date}`, { method: 'DELETE' }),

  // Words
  listWords: (date: string) => request<Word[]>(`/days/${date}/words`),
  addWord: (date: string, data: {
    word: string;
    is_pangram?: boolean;
    after_word_id?: number;
  }) => request<Word>(`/days/${date}/words`, { method: 'POST', body: JSON.stringify(data) }),
  updateWord: (date: string, wordId: number, updates: Partial<Pick<Word, 'status' | 'is_pangram' | 'points'>>) =>
    request<Word>(`/days/${date}/words/${wordId}`, { method: 'PATCH', body: JSON.stringify(updates) }),
  deleteWord: (date: string, wordId: number) =>
    request<void>(`/days/${date}/words/${wordId}`, { method: 'DELETE' }),
};
