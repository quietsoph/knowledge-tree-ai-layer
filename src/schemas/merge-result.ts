import { z } from "zod/v4";
import { BridgeSchema, SectionSchema } from "./tree.js";

export const MergeResultSchema = z.object({
	sections: z.array(SectionSchema),
	bridges: z.array(BridgeSchema),
});

export type MergeResult = z.infer<typeof MergeResultSchema>;
