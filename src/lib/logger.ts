// Minimal structured JSON logger for server-side logs.
type LogLevel = "info" | "warn" | "error";
interface LogEntry {
  level: LogLevel;
  msg: string;
  time: string;
  context?: Record<string, unknown>;
}

function emit(level: LogLevel, msg: string, context?: Record<string, unknown>) {
  const entry: LogEntry = { level, msg, time: new Date().toISOString(), ...(context ? { context } : {}) };
  const line = JSON.stringify(entry);
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.log(line);
}

export const logger = {
  info: (msg: string, context?: Record<string, unknown>) => emit("info", msg, context),
  warn: (msg: string, context?: Record<string, unknown>) => emit("warn", msg, context),
  error: (msg: string, context?: Record<string, unknown>) => emit("error", msg, context),
  debug: (msg: string, context?: Record<string, unknown>) => emit("info", msg, context),
};
