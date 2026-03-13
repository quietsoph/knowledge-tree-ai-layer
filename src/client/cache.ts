import { createHash } from "node:crypto";

interface CacheEntry {
	value: unknown;
	expiresAt: number;
}

export class ResponseCache {
	private readonly store = new Map<string, CacheEntry>();
	private readonly maxEntries: number;

	constructor(maxEntries: number = 100) {
		this.maxEntries = maxEntries;
	}

	static buildKey(systemPrompt: string, userMessage: string): string {
		return createHash("sha256")
			.update(`${systemPrompt}\n${userMessage}`)
			.digest("hex");
	}

	get(key: string): unknown | undefined {
		const entry = this.store.get(key);
		if (!entry) return undefined;
		if (Date.now() > entry.expiresAt) {
			this.store.delete(key);
			return undefined;
		}
		return entry.value;
	}

	set(key: string, value: unknown, ttlMs: number): void {
		if (this.store.size >= this.maxEntries && !this.store.has(key)) {
			const oldest = this.store.keys().next().value;
			if (oldest !== undefined) {
				this.store.delete(oldest);
			}
		}
		this.store.set(key, { value, expiresAt: Date.now() + ttlMs });
	}

	delete(key: string): void {
		this.store.delete(key);
	}
}
