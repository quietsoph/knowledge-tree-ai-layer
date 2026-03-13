export class LLMError extends Error {
	readonly operationName: string;
	readonly modelId: string;
	readonly correlationId: string;

	constructor(
		message: string,
		opts: {
			operationName: string;
			modelId: string;
			correlationId: string;
			cause?: unknown;
		},
	) {
		super(message, { cause: opts.cause });
		this.name = "LLMError";
		this.operationName = opts.operationName;
		this.modelId = opts.modelId;
		this.correlationId = opts.correlationId;
	}
}

export class ValidationRetryExhaustedError extends LLMError {
	constructor(opts: {
		operationName: string;
		modelId: string;
		correlationId: string;
		cause?: unknown;
	}) {
		super("Validation failed after retry", opts);
		this.name = "ValidationRetryExhaustedError";
	}
}
