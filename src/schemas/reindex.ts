import { z } from "zod/v4";
import { TreeIndexSchemaV1 } from "./tree.js";

export const GistEntrySchema = z.object({
	id: z.string(),
	gist: z.string(),
});

export type GistEntry = z.infer<typeof GistEntrySchema>;

export const GistMapSchemaV1 = z.object({
	version: z.literal(1),
	gists: z.array(GistEntrySchema),
});

export const GistMapSchema = z.discriminatedUnion("version", [GistMapSchemaV1]);

export type GistMap = z.infer<typeof GistMapSchema>;

export const SplitRecommendationSchema = z.object({
	chapter_id: z.string(),
	reason: z.string(),
	block_count: z.number(),
});

export type SplitRecommendation = z.infer<typeof SplitRecommendationSchema>;

export const ReindexResultSchemaV1 = z.object({
	version: z.literal(1),
	index: TreeIndexSchemaV1,
	split_recommendations: z.array(SplitRecommendationSchema),
});

export const ReindexResultSchema = z.discriminatedUnion("version", [
	ReindexResultSchemaV1,
]);

export type ReindexResult = z.infer<typeof ReindexResultSchema>;
