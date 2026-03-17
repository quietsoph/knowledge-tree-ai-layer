import { z } from "zod/v4";
import { CalloutSchema, ContentBlockSchema } from "./content-blocks.js";

export const SectionMethodSchema = z.enum([
	"flow",
	"cornell",
	"comparison",
	"structured",
]);

export type SectionMethod = z.infer<typeof SectionMethodSchema>;

export const SectionSchema = z.object({
	id: z.string(),
	num: z.string().describe("Section number like '01', '02'"),
	label: z.string(),
	color: z.string(),
	method: SectionMethodSchema,
	methodLabel: z.string(),
	gist: z.string().describe("One-liner summary used for routing"),
	content: z.array(ContentBlockSchema),
	summary: z.string().optional(),
	thinking: z.string().optional(),
	introCallout: CalloutSchema.optional(),
});

export type Section = z.infer<typeof SectionSchema>;

export const BridgeSchema = z.object({
	fromSection: z.string(),
	toSection: z.string(),
	text: z.string(),
});

export type Bridge = z.infer<typeof BridgeSchema>;

export const CrossRefSchema = z.object({
	fromSection: z.string(),
	toSection: z.string(),
	label: z.string(),
});

export type CrossRef = z.infer<typeof CrossRefSchema>;

export const ChapterSchema = z.object({
	id: z.string(),
	label: z.string(),
	gist: z.string(),
	color: z.string(),
	sections: z.array(SectionSchema),
	bridges: z.array(BridgeSchema),
});

export type Chapter = z.infer<typeof ChapterSchema>;

export const TreeSchemaV1 = z.object({
	version: z.literal(1),
	title: z.string(),
	subtitle: z.string(),
	structure: z
		.enum(["flat", "chaptered"])
		.describe("Whether the tree uses chapters or flat sections"),
	chapters: z.array(ChapterSchema).optional(),
	sections: z.array(SectionSchema).optional(),
	bridges: z.array(BridgeSchema),
	crossRefs: z.array(CrossRefSchema),
});

export const TreeSchema = z.discriminatedUnion("version", [TreeSchemaV1]);

export type Tree = z.infer<typeof TreeSchema>;

// --- Tree Index (lightweight for routing) ---

export const TreeIndexSectionSchema = z.object({
	id: z.string(),
	num: z.string(),
	label: z.string(),
	gist: z.string(),
	method: SectionMethodSchema,
	blocks: z.number(),
});

export type TreeIndexSection = z.infer<typeof TreeIndexSectionSchema>;

export const TreeIndexChapterSchema = z.object({
	id: z.string(),
	label: z.string(),
	color: z.string(),
	gist: z.string(),
	sections: z.array(TreeIndexSectionSchema),
});

export type TreeIndexChapter = z.infer<typeof TreeIndexChapterSchema>;

export const TreeIndexSchemaV1 = z.object({
	version: z.literal(1),
	title: z.string(),
	structure: z.enum(["flat", "chaptered"]),
	chapters: z.array(TreeIndexChapterSchema).optional(),
	sections: z.array(TreeIndexSectionSchema).optional(),
});

export const TreeIndexSchema = z.discriminatedUnion("version", [
	TreeIndexSchemaV1,
]);

export type TreeIndex = z.infer<typeof TreeIndexSchema>;
