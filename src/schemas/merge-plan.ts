import { z } from "zod/v4";

export const AnalysisActionSchema = z.enum([
	"enrich_section",
	"new_section",
	"update_bridge",
	"add_cross_ref",
	"add_thinking",
]);

export type AnalysisAction = z.infer<typeof AnalysisActionSchema>;

export const AnalysisItemSchema = z.object({
	note_summary: z.string(),
	raw_excerpt: z.string(),
	action: AnalysisActionSchema,
	target_section: z
		.string()
		.optional()
		.describe("Target section ID; required for enrich/update actions"),
	reasoning: z.string(),
	content_type: z
		.string()
		.describe("Content block type to use, e.g. 'flow-step', 'cornell-row'"),
	details: z
		.string()
		.describe(
			"Free-form guidance for the merge operation describing proposed content",
		),
});

export type AnalysisItem = z.infer<typeof AnalysisItemSchema>;

export const NewSectionPlanSchema = z.object({
	label: z.string(),
	after_section: z
		.string()
		.nullable()
		.describe("Section ID to insert after, or null for beginning"),
	method: z.string(),
});

export type NewSectionPlan = z.infer<typeof NewSectionPlanSchema>;

export const StructuralChangesSchema = z.object({
	new_sections: z.array(NewSectionPlanSchema),
	renumbering_needed: z.boolean(),
});

export type StructuralChanges = z.infer<typeof StructuralChangesSchema>;

export const MergePlanSchema = z.object({
	analysis: z.array(AnalysisItemSchema),
	structural_changes: StructuralChangesSchema,
	confidence_notes: z.string().optional(),
});

export type MergePlan = z.infer<typeof MergePlanSchema>;
