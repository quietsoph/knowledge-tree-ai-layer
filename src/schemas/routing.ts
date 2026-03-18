import { z } from "zod/v4";

export const RoutingItemSchema = z.object({
	note_cluster: z.string().describe("Summary of the note cluster"),
	target_chapters: z
		.array(z.string())
		.describe("Chapter IDs this cluster routes to"),
	reasoning: z.string(),
});

export type RoutingItem = z.infer<typeof RoutingItemSchema>;

export const RoutingMapSchema = z.object({
	items: z.array(RoutingItemSchema),
});

export type RoutingMap = z.infer<typeof RoutingMapSchema>;
