import { describe, expect, it } from "vitest";
import { analyzePrompts } from "../analyze.js";
import { initializePrompts } from "../initialize.js";
import { mergePrompts } from "../merge.js";
import { reindexPrompts } from "../reindex.js";
import { routePrompts } from "../route.js";

// --- Registry: module name, export object, sample args per version ---

type PromptVersion = {
	system: string;
	userBuilder: (...args: never[]) => string;
};

const registry: Array<{
	name: string;
	module: Record<string, PromptVersion>;
	sampleArgs: unknown[];
}> = [
	{
		name: "analyzePrompts",
		module: analyzePrompts,
		sampleArgs: ['[{"id":"sec-01","label":"TCP"}]', "TCP uses SYN handshake"],
	},
	{
		name: "initializePrompts",
		module: initializePrompts,
		sampleArgs: ["Networking", "TCP and UDP are transport protocols"],
	},
	{
		name: "mergePrompts",
		module: mergePrompts,
		sampleArgs: ['[{"id":"sec-01"}]', "[]", '{"analysis":[]}', 1],
	},
	{
		name: "reindexPrompts",
		module: reindexPrompts,
		sampleArgs: [
			'[{"id":"sec-01","type":"section","label":"CAP","content":"..."}]',
			1,
		],
	},
	{
		name: "routePrompts",
		module: routePrompts,
		sampleArgs: ['{"chapters":[{"id":"ch-1"}]}', "New notes about Raft", 1],
	},
];

// --- Structural contract tests ---

describe("structural contracts", () => {
	for (const { name, module } of registry) {
		describe(name, () => {
			for (const [versionKey, version] of Object.entries(module)) {
				describe(versionKey, () => {
					it("system is a non-empty string", () => {
						expect(typeof version.system).toBe("string");
						expect(version.system.length).toBeGreaterThan(0);
					});

					it("userBuilder is a function", () => {
						expect(typeof version.userBuilder).toBe("function");
					});
				});
			}
		});
	}

	for (const { name, module, sampleArgs } of registry) {
		for (const [versionKey, version] of Object.entries(module)) {
			it(`${name}.${versionKey}.userBuilder returns a non-empty string`, () => {
				const result = (version.userBuilder as (...args: unknown[]) => string)(
					...sampleArgs,
				);
				expect(typeof result).toBe("string");
				expect(result.length).toBeGreaterThan(0);
			});
		}
	}
});

// --- Snapshot tests ---

describe("snapshots", () => {
	it("analyzePrompts.v1.userBuilder (without routingContext)", () => {
		const result = analyzePrompts.v1.userBuilder(
			'[{"id":"sec-01","label":"TCP Basics","method":"cornell"}]',
			"TCP uses a three-way handshake: SYN, SYN-ACK, ACK.",
		);
		expect(result).toMatchSnapshot();
	});

	it("analyzePrompts.v1.userBuilder (with routingContext)", () => {
		const result = analyzePrompts.v1.userBuilder(
			'[{"id":"sec-01","label":"TCP Basics","method":"cornell"}]',
			"TCP uses a three-way handshake: SYN, SYN-ACK, ACK.",
			"Focus on networking protocol handshakes",
		);
		expect(result).toMatchSnapshot();
	});

	it("initializePrompts.v1.userBuilder", () => {
		const result = initializePrompts.v1.userBuilder(
			"Networking",
			"TCP and UDP are transport layer protocols. TCP is reliable, UDP is fast.",
		);
		expect(result).toMatchSnapshot();
	});

	it("mergePrompts.v1.userBuilder", () => {
		const result = mergePrompts.v1.userBuilder(
			'[{"id":"sec-01","label":"TCP Basics","content":[]}]',
			'[{"fromSection":"sec-01","toSection":"sec-02","text":"Flow"}]',
			'{"analysis":[{"action":"enrich_section","target_section":"sec-01"}],"structural_changes":{"new_sections":[],"renumbering_needed":false}}',
			1,
		);
		expect(result).toMatchSnapshot();
	});

	it("routePrompts.v1.userBuilder", () => {
		const result = routePrompts.v1.userBuilder(
			'{"version":1,"title":"Distributed Systems","structure":"chaptered","chapters":[{"id":"ch-1","label":"Foundations","gist":"Core theorems"}]}',
			"Raft is a consensus algorithm designed for understandability.",
			1,
		);
		expect(result).toMatchSnapshot();
	});

	it("reindexPrompts.v1.userBuilder", () => {
		const result = reindexPrompts.v1.userBuilder(
			'[{"id":"sec-01","type":"section","label":"CAP Theorem","content":"Trade-offs in distributed guarantees"}]',
			1,
		);
		expect(result).toMatchSnapshot();
	});
});
