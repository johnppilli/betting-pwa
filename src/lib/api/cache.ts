const PREFIX = 'odds-cache:';

interface Entry<T> {
	data: T;
	ts: number;
}

export function getCached<T>(key: string, ttlMs: number): T | null {
	try {
		const raw = localStorage.getItem(PREFIX + key);
		if (!raw) return null;
		const entry = JSON.parse(raw) as Entry<T>;
		if (Date.now() - entry.ts > ttlMs) return null;
		return entry.data;
	} catch {
		return null;
	}
}

export function setCached<T>(key: string, data: T): void {
	try {
		const entry: Entry<T> = { data, ts: Date.now() };
		localStorage.setItem(PREFIX + key, JSON.stringify(entry));
	} catch {
		// localStorage may be full or disabled — silently skip
	}
}

export function cacheAge(key: string): number | null {
	try {
		const raw = localStorage.getItem(PREFIX + key);
		if (!raw) return null;
		const entry = JSON.parse(raw) as { ts: number };
		return Date.now() - entry.ts;
	} catch {
		return null;
	}
}
