import pino from "pino";

const rootLogger = pino({
	level: process.env["LOG_LEVEL"] ?? "info",
});

export function createLogger(context: {
	operation?: string | undefined;
	correlationId?: string | undefined;
}): pino.Logger {
	return rootLogger.child(context);
}
