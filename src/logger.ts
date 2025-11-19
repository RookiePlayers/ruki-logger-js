import chalk from "chalk";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { formatDate, formatDistance } from "date-fns";
import { LoggingRegistry } from "./registry";
import { LogLevel, LoggerOptions } from "./types";

const DEFAULT_FORMAT = "#1%##1%###1%####";
const DEFAULT_TAG_DECORATOR = "[]";
const DEFAULT_TIMESTAMP_COLOR = "#ffffff";
const DEFAULT_LOCATION_COLOR = "#808080";
const NEUTRAL_MESSAGE_COLOR = "#f5f5f5ff";

type FormatSegment = "timestamp" | "tag" | "message" | "location";
type FormatToken =
  | { kind: "segment"; segment: FormatSegment }
  | { kind: "spaces"; count: number };

const SEGMENT_LOOKUP: Record<number, FormatSegment> = {
  1: "timestamp",
  2: "tag",
  3: "message",
  4: "location",
};
const formatCache = new Map<string, FormatToken[]>();
const DEFAULT_FORMAT_TOKENS = parseFormatString(DEFAULT_FORMAT)!;

const LEVEL_COLORS: Record<LogLevel, string> = {
  [LogLevel.info]: "#f5f5f5ff",
  [LogLevel.error]: "#ce2727ff",
  [LogLevel.test]: "#219f21ff",
  [LogLevel.highlight]: "#ffff00",
  [LogLevel.warn]: "#ffc400ff",
  [LogLevel.task]: "#41c541ff",
  [LogLevel.quiet]: "#545454ff",
  [LogLevel.custom]: "#bcbcbcff",
};

const LEVEL_ALIAS: Record<LogLevel, string> = {
  [LogLevel.info]: "I",
  [LogLevel.error]: "E",
  [LogLevel.test]: "TS",
  [LogLevel.highlight]: "H",
  [LogLevel.warn]: "W",
  [LogLevel.task]: "TK",
  [LogLevel.quiet]: "Q",
  [LogLevel.custom]: "C",
};

const DEFAULT_TAGS: Record<LogLevel, string> = {
  [LogLevel.info]: "INFO",
  [LogLevel.error]: "ERROR",
  [LogLevel.test]: "TEST",
  [LogLevel.highlight]: "HIGHLIGHT",
  [LogLevel.warn]: "WARNING",
  [LogLevel.task]: "TASK",
  [LogLevel.quiet]: "QUIET",
  [LogLevel.custom]: "CUSTOM",
};

function getLocation(useRelative: boolean): string {
  const err = new Error();
  const stack = (err.stack || "").split("\n");
  const line = stack[4] || stack[3] || stack[2] || "";
  const m =
    line.match(/\((.*):(\d+):(\d+)\)/) || line.match(/at (.*):(\d+):(\d+)/);
  if (m) {
    let file = m[1];
    const row = m[2];
    try {
      if (file.startsWith("file://")) {
        file = fileURLToPath(file);
      }
    } catch {
      // ignore conversion failure, fall back to original file string
    }
    let displayPath = file;
    if (useRelative) {
      let relative = path.relative(process.cwd(), file);
      if (!relative || relative.startsWith("..")) {
        relative = "";
      }
      if (
        relative &&
        !relative.includes(path.sep) &&
        relative === path.basename(relative)
      ) {
        const parent = path.dirname(process.cwd());
        if (parent && parent !== process.cwd()) {
          const parentRelative = path.relative(parent, file);
          if (
            parentRelative &&
            !parentRelative.startsWith("..") &&
            parentRelative.includes(path.sep)
          ) {
            relative = parentRelative;
          }
        }
      }
      displayPath = relative || file;
    }
    return `${displayPath}:${row}`;
  }
  return "unknown";
}

function pad(
  string?: string,
  dir?: "left" | "right",
  char: string = "",
  repeat?: number,
): string {
  if (!string) return "";
  if (dir === "left") {
    return char.repeat(repeat || 1) + string;
  }
  return string + char.repeat(repeat || 1);
}

function formatTimestamp(
  format: LoggerOptions["timestampFormat"],
  lastTimestampMs?: number,
): string {
  const now = new Date();
  if (typeof format === "function") {
    return format(now);
  }
  if (format === "timeago") {
    const previous =
      typeof lastTimestampMs === "number" ? new Date(lastTimestampMs) : now;
    return formatDistance(now, previous, { addSuffix: true });
  }
  if (format === "time") {
    return formatDate(now, "HH:mm:ss");
  }
  if (format === "date") {
    return formatDate(now, "yyyy-MM-dd");
  }
  if (format === "locale") {
    return now.toLocaleString();
  }
  return now.toISOString();
}

function parseFormatString(format: string): FormatToken[] | null {
  if (!format) return null;
  if (formatCache.has(format)) {
    return formatCache.get(format)!;
  }
  const tokens: FormatToken[] = [];
  const seen: Record<FormatSegment, number> = {
    timestamp: 0,
    tag: 0,
    message: 0,
    location: 0,
  };
  let i = 0;
  let expectSegment = true;
  while (i < format.length) {
    if (expectSegment) {
      if (format[i] !== "#") return null;
      let count = 0;
      while (format[i] === "#" && count < 4) {
        count += 1;
        i += 1;
      }
      const segment = SEGMENT_LOOKUP[count];
      if (!segment) return null;
      seen[segment] += 1;
      tokens.push({ kind: "segment", segment });
      expectSegment = false;
    } else {
      let numStr = "";
      while (i < format.length && /\d/.test(format[i])) {
        numStr += format[i];
        i += 1;
      }
      if (!numStr || format[i] !== "%") return null;
      const spaces = Number.parseInt(numStr, 10);
      tokens.push({ kind: "spaces", count: spaces });
      i += 1;
      expectSegment = true;
    }
  }
  if (expectSegment) {
    return null;
  }
  const allSegmentsPresent = Object.values(seen).every((count) => count === 1);
  if (!allSegmentsPresent) {
    return null;
  }
  formatCache.set(format, tokens);
  return tokens;
}

function getFormatTokens(format?: string): FormatToken[] {
  if (!format) return DEFAULT_FORMAT_TOKENS;
  return parseFormatString(format) ?? DEFAULT_FORMAT_TOKENS;
}

function decorateTag(tag: string, decorator?: string): string {
  const value =
    decorator && decorator.length > 0 ? decorator : DEFAULT_TAG_DECORATOR;
  if (value.length === 1) {
    return `${value}${tag}${value}`;
  }
  if (value.length === 2) {
    return `${value[0]}${tag}${value[1]}`;
  }
  const midpoint = Math.floor(value.length / 2);
  const left = value.slice(0, midpoint) || value;
  let right = value.slice(midpoint);
  if (!right) {
    right = left;
  }
  return `${left}${tag}${right}`;
}

function renderFormattedLine(
  tokens: FormatToken[],
  parts: Record<FormatSegment, string>,
): string {
  let output = "";
  for (let i = 0; i < tokens.length; i += 1) {
    const token = tokens[i];
    if (token.kind === "segment") {
      output += parts[token.segment];
    } else {
      const prev = findAdjacentSegment(tokens, parts, i, -1);
      const next = findAdjacentSegment(tokens, parts, i, 1);
      if (prev && prev.trim() && next && next.trim()) {
        output += " ".repeat(Math.max(0, token.count));
      }
    }
  }
  return output;
}

function findAdjacentSegment(
  tokens: FormatToken[],
  parts: Record<FormatSegment, string>,
  startIndex: number,
  direction: -1 | 1,
): string {
  let idx = startIndex + direction;
  while (idx >= 0 && idx < tokens.length) {
    const token = tokens[idx];
    if (token.kind === "segment") {
      return parts[token.segment];
    }
    idx += direction;
  }
  return "";
}

function applyCellSizing(
  raw: string,
  sizing?: { min?: number; max?: number },
): string {
  if (!raw) return raw;
  let result = raw;
  if (sizing?.max && sizing.max > 0 && result.length > sizing.max) {
    result = result.slice(0, sizing.max);
  }
  if (sizing?.min && sizing.min > 0 && result.length < sizing.min) {
    result = result.padEnd(sizing.min, " ");
  }
  return result;
}

function mergeCellSizes(
  base?: LoggerOptions["cellSizes"],
  overrides?: LoggerOptions["cellSizes"],
) {
  if (!base && !overrides) return undefined;
  const merged: Required<LoggerOptions>["cellSizes"] = { ...(base ?? {}) };
  if (overrides) {
    for (const key of Object.keys(overrides) as Array<
      keyof NonNullable<LoggerOptions["cellSizes"]>
    >) {
      merged[key] = { ...(base?.[key] ?? {}), ...(overrides[key] ?? {}) };
    }
  }
  return merged;
}

function mergeOptionSets(
  base?: Partial<LoggerOptions>,
  overrides?: LoggerOptions | Partial<LoggerOptions>,
): LoggerOptions {
  return {
    ...(base ?? {}),
    ...(overrides ?? {}),
    colorOptions: {
      ...(base?.colorOptions ?? {}),
      ...(overrides?.colorOptions ?? {}),
    },
    cellSizes: mergeCellSizes(base?.cellSizes, overrides?.cellSizes),
  } as LoggerOptions;
}

function renderLevelBadge(level: LogLevel): string {
  const alias = LEVEL_ALIAS[level];
  const color = LEVEL_COLORS[level];
  const chalkAny = chalk as unknown as {
    bgHex?: (hex: string) => (text: string) => string;
    hex?: (hex: string) => (text: string) => string;
  };
  if (typeof chalkAny.bgHex === "function") {
    return chalkAny.bgHex(color)(alias);
  }
  if (typeof chalkAny.hex === "function") {
    return chalkAny.hex(color)(alias);
  }
  return alias;
}

function buildLogLine(params: {
  level: LogLevel;
  baseColor: string;
  body: unknown;
  options: LoggerOptions;
  lastTimestampMs?: number;
}): { text: string; location: string; tag: string } {
  const { level, baseColor, body, options, lastTimestampMs } = params;
  const tokens = getFormatTokens(options.format);
  const useRelative = options.locationPath !== "absolute";
  const location = getLocation(useRelative);
  const hideTimestamp = options.hideTimestamp ?? true;
  const showLocation = options.showLocation ?? true;
  const tagLabel = options.tag ?? DEFAULT_TAGS[level];
  const decoratedTag = decorateTag(tagLabel, options.tagDecorator);
  const colorOverrides = options.colorOptions ?? {};
  const cellSizes = options.cellSizes ?? {};

  const timestampColor = colorOverrides.timestamp ?? DEFAULT_TIMESTAMP_COLOR;
  const tagColor = colorOverrides.tag ?? baseColor;
  const messageColor =
    colorOverrides.message ?? (options.colorOnlyTag ? NEUTRAL_MESSAGE_COLOR : baseColor);
  const locationColor = colorOverrides.location ?? DEFAULT_LOCATION_COLOR;

  const rawTimestamp = hideTimestamp
    ? ""
    : formatTimestamp(options.timestampFormat, lastTimestampMs);
  const rawTag = decoratedTag;
  const levelBadge = options.enableLevelTagging ? renderLevelBadge(level) : "";
  const rawMessage = `${levelBadge ? pad(levelBadge, "right", " ", 2) : ""}${pad(options.leftSymbol, "right", " ")}${String(body)}${pad(options.rightSymbol, "left", " ")}`;
  const rawLocation = showLocation ? `Location: ${location}` : "";

  const sizedTimestamp = applyCellSizing(rawTimestamp, cellSizes.timestamp);
  const sizedTag = applyCellSizing(rawTag, cellSizes.tag);
  const sizedMessage = applyCellSizing(rawMessage, cellSizes.message);
  const sizedLocation = applyCellSizing(rawLocation, cellSizes.location);

  const timestamp = sizedTimestamp
    ? chalk.hex(timestampColor)(sizedTimestamp)
    : "";
  const tagText = sizedTag ? chalk.hex(tagColor)(sizedTag) : "";
  const messageText = sizedMessage
    ? chalk.hex(messageColor)(sizedMessage)
    : "";
  const locationText = sizedLocation
    ? chalk.hex(locationColor)(sizedLocation)
    : "";

  const formatted = renderFormattedLine(tokens, {
    timestamp,
    tag: tagText,
    message: messageText,
    location: locationText,
  });

  return { text: formatted, location, tag: tagLabel };
}

function isoTimestamp(): string {
  return new Date().toISOString();
}

export class Logger {
  private static lastLogTimestampMs: number | undefined;
  private static globalOptions: Partial<LoggerOptions> = {};

  static configure(options: Partial<LoggerOptions>) {
    this.globalOptions = mergeOptionSets(this.globalOptions, options);
  }

  private static mergeOptions(options?: LoggerOptions): LoggerOptions {
    return mergeOptionSets(this.globalOptions, options);
  }

  static log(message: string, options?: LoggerOptions) {
    const merged = this.mergeOptions(options);
    const payload = buildLogLine({
      level: LogLevel.info,
      baseColor: LEVEL_COLORS[LogLevel.info],
      body: message,
      options: merged,
      lastTimestampMs: this.lastLogTimestampMs,
    });
    LoggingRegistry.emit(LogLevel.info, {
      message,
      location: payload.location,
      timestamp: isoTimestamp(),
      raw: message,
      level: LogLevel.info,
      tag: payload.tag,
    });
    console.log(payload.text);
    this.lastLogTimestampMs = Date.now();
  }

  static error(object: unknown, options?: LoggerOptions) {
    const merged = this.mergeOptions(options);
    const payload = buildLogLine({
      level: LogLevel.error,
      baseColor: LEVEL_COLORS[LogLevel.error],
      body: object,
      options: merged,
      lastTimestampMs: this.lastLogTimestampMs,
    });
    LoggingRegistry.emit(LogLevel.error, {
      message: String(object),
      location: payload.location,
      timestamp: isoTimestamp(),
      raw: object,
      level: LogLevel.error,
      tag: payload.tag,
    });
    console.error(payload.text);
    this.lastLogTimestampMs = Date.now();
  }

  static test(object: unknown, options?: LoggerOptions) {
    const merged = this.mergeOptions(options);
    const payload = buildLogLine({
      level: LogLevel.test,
      baseColor: LEVEL_COLORS[LogLevel.test],
      body: object,
      options: merged,
      lastTimestampMs: this.lastLogTimestampMs,
    });
    LoggingRegistry.emit(LogLevel.test, {
      message: String(object),
      location: payload.location,
      timestamp: isoTimestamp(),
      raw: object,
      level: LogLevel.test,
      tag: payload.tag,
    });
    console.log(payload.text);
    this.lastLogTimestampMs = Date.now();
  }

  static highlight(object: unknown, options?: LoggerOptions) {
    const merged = this.mergeOptions(options);
    const payload = buildLogLine({
      level: LogLevel.highlight,
      baseColor: LEVEL_COLORS[LogLevel.highlight],
      body: object,
      options: merged,
      lastTimestampMs: this.lastLogTimestampMs,
    });
    LoggingRegistry.emit(LogLevel.highlight, {
      message: String(object),
      location: payload.location,
      timestamp: isoTimestamp(),
      raw: object,
      level: LogLevel.highlight,
      tag: payload.tag,
    });
    console.log(payload.text);
    this.lastLogTimestampMs = Date.now();
  }

  static warn(object: unknown, options?: LoggerOptions) {
    const merged = this.mergeOptions(options);
    const payload = buildLogLine({
      level: LogLevel.warn,
      baseColor: LEVEL_COLORS[LogLevel.warn],
      body: object,
      options: merged,
      lastTimestampMs: this.lastLogTimestampMs,
    });
    LoggingRegistry.emit(LogLevel.warn, {
      message: String(object),
      location: payload.location,
      timestamp: isoTimestamp(),
      raw: object,
      level: LogLevel.warn,
      tag: payload.tag,
    });
    console.warn(payload.text);
    this.lastLogTimestampMs = Date.now();
  }

  static info(object: unknown, options?: LoggerOptions) {
    const merged = this.mergeOptions(options);
    const payload = buildLogLine({
      level: LogLevel.info,
      baseColor: LEVEL_COLORS[LogLevel.info],
      body: object,
      options: merged,
      lastTimestampMs: this.lastLogTimestampMs,
    });
    LoggingRegistry.emit(LogLevel.info, {
      message: String(object),
      location: payload.location,
      timestamp: isoTimestamp(),
      raw: object,
      level: LogLevel.info,
      tag: payload.tag,
    });
    console.log(payload.text);
    this.lastLogTimestampMs = Date.now();
  }

  static quiet(object: unknown, options?: LoggerOptions) {
    const merged = this.mergeOptions(options);
    const payload = buildLogLine({
      level: LogLevel.quiet,
      baseColor: LEVEL_COLORS[LogLevel.quiet],
      body: object,
      options: merged,
      lastTimestampMs: this.lastLogTimestampMs,
    });
    console.log(payload.text);
    this.lastLogTimestampMs = Date.now();
  }

  static task(object: unknown, options?: LoggerOptions) {
    const merged = this.mergeOptions({ rightSymbol: "✔", ...options });
    const payload = buildLogLine({
      level: LogLevel.task,
      baseColor: LEVEL_COLORS[LogLevel.task],
      body: String(object),
      options: merged,
      lastTimestampMs: this.lastLogTimestampMs,
    });
    LoggingRegistry.emit(LogLevel.task, {
      message: String(object),
      location: payload.location,
      timestamp: isoTimestamp(),
      raw: object,
      level: LogLevel.task,
      tag: payload.tag,
    });
    console.log(payload.text);
    this.lastLogTimestampMs = Date.now();
  }

  static custom(object: unknown, colorHex: string, options?: LoggerOptions) {
    const merged = this.mergeOptions(options);
    const payload = buildLogLine({
      level: LogLevel.custom,
      baseColor: colorHex,
      body: object,
      options: merged,
      lastTimestampMs: this.lastLogTimestampMs,
    });
    LoggingRegistry.emit(LogLevel.custom, {
      message: String(object),
      location: payload.location,
      timestamp: isoTimestamp(),
      raw: object,
      level: LogLevel.custom,
      tag: payload.tag,
    });
    console.log(payload.text);
    this.lastLogTimestampMs = Date.now();
  }
}
