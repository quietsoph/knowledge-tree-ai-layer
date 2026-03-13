import { describe, expect, it } from "vitest";
import { ResponseCache } from "../cache.js";

describe("ResponseCache", () => {
	it("returns undefined on cache miss", () => {
		const cache = new ResponseCache();
		expect(cache.get("nonexistent")).toBeUndefined();
	});

	it("stores and retrieves a value", () => {
		const cache = new ResponseCache();
		cache.set("key1", { data: "hello" }, 10_000);
		expect(cache.get("key1")).toEqual({ data: "hello" });
	});

	it("returns undefined for expired entries", async () => {
		const cache = new ResponseCache();
		cache.set("key1", "value", 50);
		await new Promise((r) => setTimeout(r, 60));
		expect(cache.get("key1")).toBeUndefined();
	});

	it("builds deterministic cache keys", () => {
		const key1 = ResponseCache.buildKey("system", "user");
		const key2 = ResponseCache.buildKey("system", "user");
		expect(key1).toBe(key2);
		expect(key1).toMatch(/^[0-9a-f]{64}$/);
	});

	it("builds different keys for different inputs", () => {
		const key1 = ResponseCache.buildKey("system-a", "user");
		const key2 = ResponseCache.buildKey("system-b", "user");
		expect(key1).not.toBe(key2);
	});

	it("evicts oldest entry when exceeding maxEntries", () => {
		const cache = new ResponseCache(3);
		cache.set("a", 1, 10_000);
		cache.set("b", 2, 10_000);
		cache.set("c", 3, 10_000);
		cache.set("d", 4, 10_000); // should evict "a"

		expect(cache.get("a")).toBeUndefined();
		expect(cache.get("b")).toBe(2);
		expect(cache.get("c")).toBe(3);
		expect(cache.get("d")).toBe(4);
	});

	it("does not evict when updating an existing key", () => {
		const cache = new ResponseCache(2);
		cache.set("a", 1, 10_000);
		cache.set("b", 2, 10_000);
		cache.set("a", 99, 10_000); // update, not new entry

		expect(cache.get("a")).toBe(99);
		expect(cache.get("b")).toBe(2);
	});

	it("deletes an entry", () => {
		const cache = new ResponseCache();
		cache.set("key1", "value", 10_000);
		cache.delete("key1");
		expect(cache.get("key1")).toBeUndefined();
	});
});
