
export enum LogLevel {
  info = "info",
  debug = "debug",
  error = "error",
  test = "test",
  highlight = "highlight",
  warn = "warn",
  task = "task",
  table = "table",
  silent = "silent",
  quiet = "quiet",
  custom = "custom"
}

export type LoggerColorOptions = {
  timestamp?: string;
  tag?: string;
  message?: string;
  location?: string;
};

export type LoggerCellSizing = {
  min?: number;
  max?: number;
};

export type LoggerCellSizeOptions = Partial<
  Record<"timestamp" | "tag" | "message" | "location", LoggerCellSizing>
>;

export type LoggerLevelTaggingConfig = {
  tag?: string;
  color?: string;
  bgColor?: string;
};

export type LoggerLevelTaggingOptions = Partial<
  Record<LogLevel, LoggerLevelTaggingConfig>
>;

export type LoggerLevelColorOptions = Partial<Record<LogLevel, string>>;

export type LoggerOptions = {
  isDebug?: boolean;
  leftSymbol?: string;
  rightSymbol?: string;
  showLocation?: boolean;
  colorOnlyTag?: boolean;
  /**
   * Force-enable or disable ANSI colors. Accepts chalk levels 0-3 or true/false (true = 3).
   */
  forceColorLevel?: 0 | 1 | 2 | 3 | boolean;
  /**
   * Customize per-level tag label and colors when level tagging is enabled.
   */
  levelTaggingOptions?: LoggerLevelTaggingOptions;
  /**
   * Override the default color used for each log level (hex string).
   */
  levelColors?: LoggerLevelColorOptions;
  tag?: string;
  /**
   * Controls how file paths appear in the location suffix.
   * Defaults to "relative".
   */
  locationPath?: "relative" | "absolute";
  /**
   * Which stack frame to use for the reported location (1 = immediate caller). Defaults to 1.
   */
  locationStackDepth?: number;
  /**
   * When true, omit the timestamp from the log line. Defaults to true.
   */
  hideTimestamp?: boolean;
  /**
   * Format used when timestamps are shown. Defaults to "iso".
   */
  timestampFormat?: "iso" | "locale" | "time" | "date" | "timeago" | ((timestamp: Date) => string);
  /**
   * Defines the order of timestamp/tag/message/location using the pattern
   * placeholders described in the README.
   */
  format?: string;
  /**
   * Characters used to wrap the tag. Defaults to [].
   */
  tagDecorator?: string;
  /**
   * Override colors for specific segments of the log line.
   */
  colorOptions?: LoggerColorOptions;
  /**
   * Control min/max widths for each segment to keep logs evenly spaced.
 */
  cellSizes?: LoggerCellSizeOptions;
  enableLevelTagging?: boolean;
  /**
   * Choose which stack parser to use for the location segment.
   * "default" mirrors the original behavior; "browserAware" is more tolerant of RN/Chrome stacks.
   */
  locationResolver?: "default" | "browserAware";
};
