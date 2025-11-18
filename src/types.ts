
export enum LogLevel {
  info = "info",
  error = "error",
  test = "test",
  highlight = "highlight",
  warn = "warn",
  task = "task",
  quiet = "quiet",
  custom = "custom"
}

export type LoggerOptions = {
  isDebug?: boolean;
  leftSymbol?: string;
  rightSymbol?: string;
  showLocation?: boolean;
  colorOnlyTag?: boolean;
  tag?: string;
  /**
   * Controls how file paths appear in the location suffix.
   * Defaults to "relative".
   */
  locationPath?: "relative" | "absolute";
  /**
   * When true, omit the timestamp from the log line. Defaults to true.
   */
  hideTimestamp?: boolean;
  /**
   * Format used when timestamps are shown. Defaults to "iso".
   */
  timestampFormat?: "iso" | "locale" | "time" | "date" | "timeago" | ((timestamp: Date) => string);
};
