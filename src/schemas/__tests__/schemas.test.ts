import { describe, expect, it } from "vitest";
import {
	ContentBlockSchema,
	GistMapSchema,
	MergePlanSchema,
	MergeResultSchema,
	ReindexResultSchema,
	RoutingMapSchema,
	TreeIndexSchema,
	TreeSchema,
} from "../index.js";

// --- Fixtures ---

const flowStepBlock = {
	type: "flow-step" as const,
	title: "CAP Theorem",
	content: "A distributed system can provide at most two of three guarantees.",
	verdict: "Choose CP or AP based on requirements.",
};

const cornellRowBlock = {
	type: "cornell-row" as const,
	cue: "What is consensus?",
	note: "Agreement among distributed nodes on a single data value.",
};

const comparisonMatrixBlock = {
	type: "comparison-matrix" as const,
	columns: ["Feature", "Raft", "Paxos"],
	rows: [
		{ cells: ["Understandability", "High", "Low"] },
		{ cells: ["Performance", "Good", "Good"] },
	],
};

const comparisonCardBlock = {
	type: "comparison-card" as const,
	title: "Leader vs Leaderless",
	items: [
		{
			label: "Leader-based",
			description: "Single coordinator, simpler but SPOF",
		},
		{
			label: "Leaderless",
			description: "All nodes equal, more fault-tolerant",
		},
	],
	verdict: "Depends on failure tolerance needs.",
};

const calloutBlock = {
	type: "callout" as const,
	style: "warning" as const,
	title: "Network partitions",
	body: "Always assume the network is unreliable.",
};

const codeBlock = {
	type: "code" as const,
	language: "python",
	code: "def heartbeat(node): pass",
	caption: "Simple heartbeat stub",
};

const foundationsSection = {
	id: "foundations-cap",
	num: "01",
	label: "CAP Theorem",
	color: "#4A90D9",
	method: "flow" as const,
	methodLabel: "Decision Flow",
	gist: "Trade-offs in distributed system guarantees",
	content: [flowStepBlock],
};

const coordinationSection = {
	id: "coordination-consensus",
	num: "02",
	label: "Consensus Protocols",
	color: "#7B68EE",
	method: "cornell" as const,
	methodLabel: "Q&A Notes",
	gist: "How distributed nodes agree on values",
	content: [cornellRowBlock],
};

const chapteredTree = {
	version: 1 as const,
	title: "Distributed Systems",
	subtitle: "Core concepts",
	structure: "chaptered" as const,
	chapters: [
		{
			id: "foundations",
			label: "Foundations",
			gist: "Core theorems and trade-offs",
			color: "#4A90D9",
			sections: [foundationsSection],
			bridges: [],
		},
		{
			id: "coordination",
			label: "Coordination",
			gist: "Consensus and leader election",
			color: "#7B68EE",
			sections: [coordinationSection],
			bridges: [],
		},
	],
	bridges: [
		{
			fromSection: "foundations-cap",
			toSection: "coordination-consensus",
			text: "CAP constraints shape which consensus protocols are viable.",
		},
	],
	crossRefs: [
		{
			fromSection: "coordination-consensus",
			toSection: "foundations-cap",
			label: "Revisit CAP trade-offs",
		},
	],
};

const flatTree = {
	version: 1 as const,
	title: "Quick Notes",
	subtitle: "Flat layout",
	structure: "flat" as const,
	sections: [foundationsSection, coordinationSection],
	bridges: [
		{
			fromSection: "foundations-cap",
			toSection: "coordination-consensus",
			text: "Linked concepts.",
		},
	],
	crossRefs: [],
};

// --- Tests ---

describe("TreeSchema", () => {
	it("parses a valid chaptered tree", () => {
		const result = TreeSchema.parse(chapteredTree);
		expect(result.title).toBe("Distributed Systems");
		expect(result.structure).toBe("chaptered");
		expect(result.chapters).toHaveLength(2);
		expect(result.bridges).toHaveLength(1);
		expect(result.crossRefs).toHaveLength(1);
	});

	it("parses a valid flat tree", () => {
		const result = TreeSchema.parse(flatTree);
		expect(result.title).toBe("Quick Notes");
		expect(result.structure).toBe("flat");
		expect(result.sections).toHaveLength(2);
	});

	it("rejects when version is missing", () => {
		const { version: _, ...noVersion } = chapteredTree;
		expect(() => TreeSchema.parse(noVersion)).toThrow();
	});

	it("rejects when title is missing", () => {
		const { title: _, ...noTitle } = chapteredTree;
		expect(() => TreeSchema.parse(noTitle)).toThrow();
	});
});

describe("ContentBlockSchema", () => {
	it("parses a flow-step block", () => {
		const result = ContentBlockSchema.parse(flowStepBlock);
		expect(result.type).toBe("flow-step");
	});

	it("parses a cornell-row block", () => {
		const result = ContentBlockSchema.parse(cornellRowBlock);
		expect(result.type).toBe("cornell-row");
	});

	it("parses a comparison-matrix block", () => {
		const result = ContentBlockSchema.parse(comparisonMatrixBlock);
		expect(result.type).toBe("comparison-matrix");
	});

	it("parses a comparison-card block", () => {
		const result = ContentBlockSchema.parse(comparisonCardBlock);
		expect(result.type).toBe("comparison-card");
	});

	it("parses a callout block", () => {
		const result = ContentBlockSchema.parse(calloutBlock);
		expect(result.type).toBe("callout");
	});

	it("parses a code block", () => {
		const result = ContentBlockSchema.parse(codeBlock);
		expect(result.type).toBe("code");
	});

	it("rejects an unknown type discriminator", () => {
		expect(() =>
			ContentBlockSchema.parse({ type: "unknown-block", data: "nope" }),
		).toThrow();
	});
});

describe("MergePlanSchema", () => {
	const validPlan = {
		analysis: [
			{
				note_summary: "New note about Raft",
				raw_excerpt: "Raft is a consensus algorithm...",
				action: "enrich_section" as const,
				target_section: "coordination-consensus",
				reasoning: "Adds detail to existing consensus section",
				content_type: "cornell-row",
				details: "Add a Q&A pair about Raft leader election",
			},
			{
				note_summary: "Gossip protocols overview",
				raw_excerpt: "Gossip protocols disseminate information...",
				action: "new_section" as const,
				reasoning: "No existing section covers gossip",
				content_type: "flow-step",
				details: "Create a new section on gossip-based dissemination",
			},
		],
		structural_changes: {
			new_sections: [
				{
					label: "Gossip Protocols",
					after_section: "coordination-consensus",
					method: "flow",
				},
			],
			renumbering_needed: true,
		},
	};

	it("parses a valid merge plan", () => {
		const result = MergePlanSchema.parse(validPlan);
		expect(result.analysis).toHaveLength(2);
		expect(result.structural_changes.renumbering_needed).toBe(true);
	});

	it("rejects an invalid action enum value", () => {
		const invalid = {
			...validPlan,
			analysis: [
				{
					...validPlan.analysis[0],
					action: "delete_section",
				},
			],
		};
		expect(() => MergePlanSchema.parse(invalid)).toThrow();
	});

	it("allows omitting optional confidence_notes", () => {
		const result = MergePlanSchema.parse(validPlan);
		expect(result).not.toHaveProperty("confidence_notes");
	});

	it("parses when confidence_notes is provided", () => {
		const withNotes = { ...validPlan, confidence_notes: "High confidence." };
		const result = MergePlanSchema.parse(withNotes);
		expect(result.confidence_notes).toBe("High confidence.");
	});
});

describe("TreeIndexSchema", () => {
	it("parses a valid chaptered index", () => {
		const index = {
			version: 1 as const,
			title: "Distributed Systems",
			structure: "chaptered" as const,
			chapters: [
				{
					id: "foundations",
					label: "Foundations",
					color: "#4A90D9",
					gist: "Core theorems",
					sections: [
						{
							id: "sec-01",
							num: "01",
							label: "CAP Theorem",
							gist: "Trade-offs in distributed guarantees",
							method: "flow" as const,
							blocks: 3,
						},
					],
				},
			],
		};
		const result = TreeIndexSchema.parse(index);
		expect(result.structure).toBe("chaptered");
		expect(result.chapters).toHaveLength(1);
		expect(result.chapters?.[0]?.sections).toHaveLength(1);
	});

	it("parses a valid flat index", () => {
		const index = {
			version: 1 as const,
			title: "Quick Notes",
			structure: "flat" as const,
			sections: [
				{
					id: "sec-01",
					num: "01",
					label: "Basics",
					gist: "Introduction",
					method: "structured" as const,
					blocks: 2,
				},
			],
		};
		const result = TreeIndexSchema.parse(index);
		expect(result.structure).toBe("flat");
		expect(result.sections).toHaveLength(1);
	});
});

describe("RoutingMapSchema", () => {
	it("parses a valid routing map", () => {
		const map = {
			items: [
				{
					note_cluster: "Notes about consensus algorithms",
					target_chapters: ["coordination"],
					reasoning: "These notes discuss Raft and Paxos.",
				},
				{
					note_cluster: "Notes about network partitions",
					target_chapters: ["foundations", "coordination"],
					reasoning: "Partitions relate to both CAP and consensus.",
				},
			],
		};
		const result = RoutingMapSchema.parse(map);
		expect(result.items).toHaveLength(2);
		expect(result.items[0]?.target_chapters).toContain("coordination");
	});
});

describe("MergeResultSchema", () => {
	it("parses a valid result with sections and bridges", () => {
		const result = MergeResultSchema.parse({
			sections: [foundationsSection, coordinationSection],
			bridges: [
				{
					fromSection: "foundations-cap",
					toSection: "coordination-consensus",
					text: "CAP constraints shape consensus.",
				},
			],
		});
		expect(result.sections).toHaveLength(2);
		expect(result.bridges).toHaveLength(1);
	});

	it("rejects when a section is missing required id", () => {
		const { id: _, ...noId } = foundationsSection;
		expect(() =>
			MergeResultSchema.parse({
				sections: [noId],
				bridges: [],
			}),
		).toThrow();
	});
});

describe("ReindexResultSchema", () => {
	it("parses a valid result with nested TreeIndex and split_recommendations", () => {
		const result = ReindexResultSchema.parse({
			version: 1 as const,
			index: {
				version: 1 as const,
				title: "Distributed Systems",
				structure: "chaptered" as const,
				chapters: [
					{
						id: "foundations",
						label: "Foundations",
						color: "#4A90D9",
						gist: "Core theorems",
						sections: [
							{
								id: "sec-01",
								num: "01",
								label: "CAP Theorem",
								gist: "Trade-offs",
								method: "flow" as const,
								blocks: 3,
							},
						],
					},
				],
			},
			split_recommendations: [
				{
					chapter_id: "foundations",
					reason: "Too many blocks",
					block_count: 25,
				},
			],
		});
		expect(result.index.title).toBe("Distributed Systems");
		expect(result.split_recommendations).toHaveLength(1);
	});

	it("rejects when version is missing", () => {
		expect(() =>
			ReindexResultSchema.parse({
				index: {
					version: 1 as const,
					title: "Test",
					structure: "flat" as const,
					sections: [],
				},
				split_recommendations: [],
			}),
		).toThrow();
	});
});

describe("GistMapSchema", () => {
	it("parses a valid gist map", () => {
		const result = GistMapSchema.parse({
			version: 1 as const,
			gists: [
				{ id: "sec-01", gist: "Overview of CAP theorem" },
				{ id: "sec-02", gist: "Consensus protocols" },
			],
		});
		expect(result.gists).toHaveLength(2);
	});

	it("rejects when a gist entry is missing id", () => {
		expect(() =>
			GistMapSchema.parse({
				version: 1 as const,
				gists: [{ gist: "Missing id field" }],
			}),
		).toThrow();
	});
});
