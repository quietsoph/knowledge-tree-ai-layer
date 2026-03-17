import { z } from "zod/v4";

export const FlowStepSchema = z.object({
	type: z.literal("flow-step"),
	title: z.string(),
	content: z.string(),
	verdict: z.string(),
	limitation: z.string().optional(),
});

export type FlowStep = z.infer<typeof FlowStepSchema>;

export const CornellRowSchema = z.object({
	type: z.literal("cornell-row"),
	cue: z.string().describe("Left column question or keyword"),
	note: z.string().describe("Right column answer or explanation"),
});

export type CornellRow = z.infer<typeof CornellRowSchema>;

export const ComparisonMatrixSchema = z.object({
	type: z.literal("comparison-matrix"),
	columns: z
		.array(z.string())
		.describe("Column headers including the item column"),
	rows: z.array(z.object({ cells: z.array(z.string()) })),
});

export type ComparisonMatrix = z.infer<typeof ComparisonMatrixSchema>;

export const ComparisonCardSchema = z.object({
	type: z.literal("comparison-card"),
	title: z.string(),
	items: z.array(z.object({ label: z.string(), description: z.string() })),
	verdict: z.string().optional(),
});

export type ComparisonCard = z.infer<typeof ComparisonCardSchema>;

export const CalloutSchema = z.object({
	type: z.literal("callout"),
	style: z.enum(["info", "warning", "tip", "important", "example"]),
	title: z.string().optional(),
	body: z.string(),
});

export type Callout = z.infer<typeof CalloutSchema>;

export const CodeBlockSchema = z.object({
	type: z.literal("code"),
	language: z.string(),
	code: z.string(),
	caption: z.string().optional(),
});

export type CodeBlock = z.infer<typeof CodeBlockSchema>;

export const ContentBlockSchema = z.discriminatedUnion("type", [
	FlowStepSchema,
	CornellRowSchema,
	ComparisonMatrixSchema,
	ComparisonCardSchema,
	CalloutSchema,
	CodeBlockSchema,
]);

export type ContentBlock = z.infer<typeof ContentBlockSchema>;
