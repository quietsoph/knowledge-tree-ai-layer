import { z } from "zod/v4";

export const RoutingItemSchema = z.object({
	note_cluster: z.string().describe("Summary of the note cluster"),
	target_chapters: z
		.array(z.string())
		.describe("Chapter IDs this cluster routes to"),
	reasoning: z.string(),
});

export type RoutingItem = z.infer<typeof RoutingItemSchema>;

export const RoutingMapSchemaV1 = z.object({
	version: z.literal(1),
	items: z.array(RoutingItemSchema),
});

export const RoutingMapSchema = z.discriminatedUnion("version", [
	RoutingMapSchemaV1,
]);

export type RoutingMap = z.infer<typeof RoutingMapSchema>;
