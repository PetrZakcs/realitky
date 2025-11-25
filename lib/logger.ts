type LogMeta = Record<string, unknown> | undefined;

const format = (level: string, message: string, meta?: LogMeta) => {
  const time = new Date().toISOString();
  const details = meta ? ` ${JSON.stringify(meta)}` : "";
  return `[${time}] [${level}] ${message}${details}`;
};

export const logger = {
  info: (message: string, meta?: LogMeta) => {
    console.info(format("INFO", message, meta));
  },
  warn: (message: string, meta?: LogMeta) => {
    console.warn(format("WARN", message, meta));
  },
  error: (message: string, meta?: LogMeta) => {
    console.error(format("ERROR", message, meta));
  }
};

