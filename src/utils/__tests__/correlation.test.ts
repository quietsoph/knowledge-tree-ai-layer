import { describe, expect, it } from "vitest";
import { generateCorrelationId } from "../correlation.js";

describe("generateCorrelationId", () => {
	it("returns a string with cor_ prefix", () => {
		const id = generateCorrelationId();
		expect(id).toMatch(/^cor_[0-9a-f-]{36}$/);
	});

	it("generates unique IDs", () => {
		const ids = new Set(
			Array.from({ length: 100 }, () => generateCorrelationId()),
		);
		expect(ids.size).toBe(100);
	});
});
