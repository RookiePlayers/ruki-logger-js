
export enum LogLevel {
  info = "info",
  error = "error",
  test = "test",
  highlight = "highlight",
  warn = "warn",
  task = "task",
  custom = "custom"
}

export type LoggerOptions = {
  isDebug?: boolean;
};
