import chalk, { Chalk } from "chalk";
import { formatDate, formatDistance } from "date-fns";
import { LoggingRegistry } from "./registry";
import {
  LogLevel,
  LoggerLevelTaggingOptions,
  LoggerOptions,
} from "./types";

const DEFAULT_FORMAT = "#1%##1%###1%####";
const DEFAULT_TAG_DECORATOR = "[]";
const DEFAULT_TIMESTAMP_COLOR = "#ffffff";
const DEFAULT_LOCATION_COLOR = "#808080";
const NEUTRAL_MESSAGE_COLOR = "#f5f5f5ff";

function circularReplacer() {
  const seen = new WeakSet();
  return (_key: string, value: unknown) => {
    if (typeof value === "object" && value !== null) {
      if (seen.has(value)) return "[Circular]";
      seen.add(value);
    }
    return value;
  };
}

function stringifyValue(value: unknown): string {
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  if (value === null || value === undefined) {
    return String(value);
  }
  if (typeof value === "bigint") {
    return `${value}n`;
  }
  if (typeof value === "symbol") {
    return value.toString();
  }
  try {
    return JSON.stringify(value, circularReplacer());
  } catch {
    try {
      return String(value);
    } catch {
      return "[Unserializable]";
    }
  }
}

function formatList(args: unknown[]): string {
  return args.map((item) => stringifyValue(item)).join(" ");
}

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
  [LogLevel.info]: "#f5f5f5",
  [LogLevel.debug]: "#7f8c8d",
  [LogLevel.error]: "#ce2727",
  [LogLevel.test]: "#219f21",
  [LogLevel.highlight]: "#ffff00",
  [LogLevel.warn]: "#ffc400",
  [LogLevel.task]: "#41c541",
  [LogLevel.table]: "#54a0ff",
  [LogLevel.silent]: "#545454",
  [LogLevel.quiet]: "#545454",
  [LogLevel.custom]: "#bcbcbc",
};

const LEVEL_ALIAS: Record<LogLevel, string> = {
  [LogLevel.info]: "I",
  [LogLevel.debug]: "D",
  [LogLevel.error]: "E",
  [LogLevel.test]: "TS",
  [LogLevel.highlight]: "H",
  [LogLevel.warn]: "W",
  [LogLevel.task]: "TK",
  [LogLevel.table]: "TB",
  [LogLevel.silent]: "S",
  [LogLevel.quiet]: "Q",
  [LogLevel.custom]: "C",
};

const DEFAULT_TAGS: Record<LogLevel, string> = {
  [LogLevel.info]: "INFO",
  [LogLevel.debug]: "DEBUG",
  [LogLevel.error]: "ERROR",
  [LogLevel.test]: "TEST",
  [LogLevel.highlight]: "HIGHLIGHT",
  [LogLevel.warn]: "WARNING",
  [LogLevel.task]: "TASK",
  [LogLevel.table]: "TABLE",
  [LogLevel.silent]: "SILENT",
  [LogLevel.quiet]: "QUIET",
  [LogLevel.custom]: "CUSTOM",
};

const LOGGER_OPTION_KEYS: Array<keyof LoggerOptions> = [
  "isDebug",
  "leftSymbol",
  "rightSymbol",
  "showLocation",
  "locationStackDepth",
  "colorOnlyTag",
  "forceColorLevel",
  "levelTaggingOptions",
  "levelColors",
  "tag",
  "locationPath",
  "hideTimestamp",
  "timestampFormat",
  "format",
  "tagDecorator",
  "colorOptions",
  "cellSizes",
  "enableLevelTagging",
];

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isLoggerOptionsCandidate(value: unknown): value is LoggerOptions {
  if (!isPlainObject(value)) return false;
  return LOGGER_OPTION_KEYS.some((key) => key in value);
}

function splitArgsAndOptions(
  args: unknown[],
  minArgsAfterOptions: number = 1,
): { args: unknown[]; options?: LoggerOptions } {
  if (args.length > minArgsAfterOptions) {
    const last = args[args.length - 1];
    if (isLoggerOptionsCandidate(last)) {
      return {
        args: args.slice(0, -1),
        options: last,
      };
    }
  }
  return { args };
}

function formatArguments(args: unknown[]): { message: string; raw: unknown } {
  if (args.length === 0) return { message: "", raw: "" };
  if (args.length === 1) {
    const single = args[0];
    if (typeof single === "string") {
      return { message: single, raw: single };
    }
    return { message: stringifyValue(single), raw: single };
  }
  return { message: formatList(args), raw: args };
}

function sanitizePath(file: string, useRelative: boolean): string {
  let normalized = file;
  if (normalized.startsWith("file://")) {
    try {
      normalized = new URL(normalized).pathname;
      if (/^\/[A-Za-z]:/.test(normalized)) {
        normalized = normalized.slice(1);
      }
    } catch {
      // ignore invalid URL, keep original string
    }
  }
  if (useRelative) {
    const hasProcess =
      typeof process !== "undefined" && typeof process.cwd === "function";
    if (hasProcess) {
      try {
        const cwd = process.cwd();
        if (normalized.startsWith(cwd)) {
          normalized = normalized.slice(cwd.length);
          if (normalized.startsWith("/") || normalized.startsWith("\\")) {
            normalized = normalized.slice(1);
          }
        }
      } catch {
        // ignore cwd resolution failures, fall back to absolute path
      }
    }
  }
  return normalized;
}

function getLocationLegacy(useRelative: boolean, stackDepth: number = 6): string {
  const err = new Error();
  const stackLines = (err.stack || "").split("\n").map((line) => line.trim());
  const isLoggerFrame = (line: string) =>
    /ruki-logger/i.test(line) || /logger\.ts/.test(line);
  const isNodeInternal = (line: string) =>
    /\bnode:internal\b/.test(line) || /\binternal\//.test(line);
  const isCandidateFrame = (line: string) =>
    !isNodeInternal(line) &&
    !isLoggerFrame(line) &&
    (/\((.*):(\d+):(\d+)\)/) || line.match(/at (.*):(\d+):(\d+)/);
  const candidates = stackLines.filter((line) => isCandidateFrame(line));
  const depthIndex = Math.max(0, Math.min((stackDepth || 1) - 1, Math.max(0, candidates.length - 1)));
  const frame =
    candidates[depthIndex] ||
    stackLines.find((line) => isCandidateFrame(line)) ||
    "";
  const match =
    frame.match(/(file:\/\/[^\s)]+|https?:\/\/[^\s)]+|[^()\s]+):(\d+):\d+/) ||
    frame.match(/at ([^():\s]+):(\d+):\d+/) ||
    frame.match(/([^@]+)@[^:]+:(\d+):\d+/);
  if (match) {
    const file = sanitizePath(match[1], useRelative);
    const row = match[2];
    return `${file}:${row}`;
  }
  return "unknown";
}


function getLocationBrowserAware(useRelative: boolean, stackDepth: number = 6): string {
  const err = new Error();
  const stackLines = (err.stack || "").split("\n").map((line) => line.trim());
  const isLoggerFrame = (line: string) =>
    /ruki-logger/i.test(line) || /logger\.ts/.test(line);
  const isNodeInternal = (line: string) =>
    /\bnode:internal\b/.test(line) || /\binternal\//.test(line);
  const isConsoleFrame = (line: string) => /\bconsole\./i.test(line);

  const parseFrame = (line: string): { file: string; row: string } | null => {
    const patterns = [
      /^\s*at\s+[^(]*\((.*):(\d+):\d+\)/, // at func (file:line:col)
      /^\s*at\s+(.*):(\d+):\d+/, // at file:line:col
      /\((.*):(\d+):\d+\)/, // (file:line:col)
      /(https?:\/\/[^\s)]+|file:\/\/[^\s)]+|[^()\s]+):(\d+):\d+/, // file:line:col
      /(https?:\/\/[^\s)]+|file:\/\/[^\s)]+|[^()\s]+):(\d+)/, // missing column
    ];
    for (const pattern of patterns) {
      const match = line.match(pattern);
      if (match) {
        return { file: match[1], row: match[2] };
      }
    }
    return null;
  };

  const parsedFrames = stackLines
    .map((line) => ({ line, parsed: parseFrame(line) }))
    .filter((entry) => entry.parsed !== null);

  const usable = parsedFrames.filter(
    ({ line }) => !isLoggerFrame(line) && !isNodeInternal(line) && !isConsoleFrame(line),
  );

  const depthIndex = Math.max(
    0,
    Math.min((stackDepth || 1) - 1, Math.max(0, usable.length - 1)),
  );
  const selected =
    usable[depthIndex] ||
    usable[0] ||
    parsedFrames.find(({ line }) => !isLoggerFrame(line) && !isNodeInternal(line)) ||
    parsedFrames[0];

  if (selected?.parsed) {
    const file = sanitizePath(selected.parsed.file, useRelative);
    const row = selected.parsed.row;
    return `${file}:${row}`;
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
    levelColors: {
      ...(base?.levelColors ?? {}),
      ...(overrides?.levelColors ?? {}),
    },
    cellSizes: mergeCellSizes(base?.cellSizes, overrides?.cellSizes),
  } as LoggerOptions;
}

type TableInput =
  | Array<Record<string, unknown>>
  | Array<unknown[]>;

type TableLogOptions = LoggerOptions & {
  headers?: string[];
  label?: string;
  /**
   * When true, emit to sinks only and skip console output.
   */
  silent?: boolean;
};

function normalizeTableData(
  data: TableInput,
  headers?: string[],
): {
  headers: string[];
  rows: string[][];
  objects: Record<string, unknown>[];
} {
  if (!Array.isArray(data)) {
    return { headers: headers ?? [], rows: [], objects: [] };
  }
  const isObjectArray = data.every((row) => !Array.isArray(row) && isPlainObject(row));
  if (isObjectArray) {
    const discoveredHeaders = headers && headers.length > 0
      ? headers
      : Array.from(new Set((data as Array<Record<string, unknown>>).flatMap((row) => Object.keys(row))));
    const rows = (data as Array<Record<string, unknown>>).map((row) =>
      discoveredHeaders.map((key) => stringifyValue(row[key])),
    );
    const objects = (data as Array<Record<string, unknown>>).map((row) => {
      const obj: Record<string, unknown> = {};
      for (const key of discoveredHeaders) {
        obj[key] = row[key];
      }
      return obj;
    });
    return { headers: discoveredHeaders, rows, objects };
  }

  const arrayRows = data as Array<unknown[]>;
  const widest = Math.max(
    headers?.length ?? 0,
    ...arrayRows.map((row) => (Array.isArray(row) ? row.length : 0)),
  );
  const finalHeaders =
    headers && headers.length > 0
      ? headers
      : Array.from({ length: widest }, (_v, idx) => `col_${idx + 1}`);
  const rows = arrayRows.map((row) =>
    finalHeaders.map((_h, idx) => stringifyValue(Array.isArray(row) ? row[idx] : undefined)),
  );
  const objects = arrayRows.map((row) =>
    finalHeaders.reduce<Record<string, unknown>>((acc, header, idx) => {
      acc[header] = Array.isArray(row) ? row[idx] : undefined;
      return acc;
    }, {}),
  );
  return { headers: finalHeaders, rows, objects };
}

function csvEscape(value: string): string {
  const needsQuote = /[",\n]/.test(value);
  if (!needsQuote) return value;
  return `"${value.replace(/"/g, '""')}"`;
}

function toCsv(headers: string[], rows: string[][]): string {
  const lines: string[] = [];
  if (headers.length > 0) {
    lines.push(headers.map(csvEscape).join(","));
  }
  for (const row of rows) {
    lines.push(row.map(csvEscape).join(","));
  }
  return lines.join("\n");
}

type ChalkAdapter = {
  bgHex?: (hex: string) => (text: string) => string;
  hex?: (hex: string) => (text: string) => string;
};

const chalkAdapter = chalk as unknown as ChalkAdapter;

function normalizeHex(hexColor?: string): string | undefined {
  if (!hexColor) return undefined;
  if (/^#([0-9a-fA-F]{8})$/.test(hexColor)) {
    return `#${hexColor.slice(1, 7)}`;
  }
  return hexColor;
}

function resolveChalkAdapter(
  forceColorLevel?: LoggerOptions["forceColorLevel"],
): ChalkAdapter {
  if (forceColorLevel === undefined || forceColorLevel === null) {
    return chalkAdapter;
  }
  let level = forceColorLevel;
  if (typeof level === "boolean") {
    level = level ? 3 : 0;
  }
  if (typeof level !== "number") {
    return chalkAdapter;
  }
  try {
    return new Chalk({ level }) as unknown as ChalkAdapter;
  } catch {
    return chalkAdapter;
  }
}

function resolveLevelColor(level: LogLevel, options: LoggerOptions): string {
  return options.levelColors?.[level] ?? LEVEL_COLORS[level];
}

function colorizeSegment(
  text: string | undefined,
  hexColor: string | undefined,
  adapter: ChalkAdapter,
): string {
  if (!text) return "";
  if (hexColor && typeof adapter.hex === "function") {
    const safeHex = normalizeHex(hexColor);
    if (!safeHex) return text;
    try {
      return adapter.hex(safeHex)(text);
    } catch {
      return text;
    }
  }
  return text;
}

function getLevelTaggingConfig(
  level: LogLevel,
  baseColor: string,
  overrides?: LoggerLevelTaggingOptions,
): { tag: string; color: string; bgColor?: string } {
  const defaults = {
    tag: LEVEL_ALIAS[level],
    color: baseColor,
    bgColor: undefined,
  };
  const levelOverride = overrides?.[level];
  if (!levelOverride) return defaults;
  return {
    tag: levelOverride.tag ?? defaults.tag,
    color: levelOverride.color ?? defaults.color,
    bgColor: levelOverride.bgColor ?? defaults.bgColor,
  };
}

function renderLevelBadge(
  level: LogLevel,
  adapter: ChalkAdapter,
  baseColor: string,
  overrides?: LoggerLevelTaggingOptions,
): string {
  const config = getLevelTaggingConfig(level, baseColor, overrides);
  const fg = normalizeHex(config.color);
  const bg = normalizeHex(config.bgColor);
  let result = config.tag;
  if (typeof adapter.bgHex === "function") {
    try {
      result = bg ? adapter.bgHex(bg)(result) : result;
    } catch {
      // fall through
    }
  }
  if (typeof adapter.hex === "function") {
    try {
      result = fg ? adapter.hex(fg)(result) : result;
    } catch {
      // fall through
    }
  }
  return result;
}

function buildLogLine(params: {
  level: LogLevel;
  message: string;
  options: LoggerOptions;
  lastTimestampMs?: number;
}): { text: string; location: string; tag: string } {
  const { level, message, options, lastTimestampMs } = params;
  const tokens = getFormatTokens(options.format);
  const useRelative = options.locationPath !== "absolute";
  const locationDepth = options.locationStackDepth;
  const resolver = options.locationResolver ?? "default";
  const location =
    resolver === "browserAware"
      ? getLocationBrowserAware(useRelative, locationDepth)
      : getLocationLegacy(useRelative, locationDepth);
  const hideTimestamp = options.hideTimestamp ?? true;
  const showLocation = options.showLocation ?? true;
  const tagLabel = options.tag ?? DEFAULT_TAGS[level];
  const decoratedTag = decorateTag(tagLabel, options.tagDecorator);
  const colorOverrides = options.colorOptions ?? {};
  const cellSizes = options.cellSizes ?? {};
  const adapter = resolveChalkAdapter(options.forceColorLevel);
  const baseColor = resolveLevelColor(level, options);

  const timestampColor = colorOverrides.timestamp ?? DEFAULT_TIMESTAMP_COLOR;
  const tagColor = colorOverrides.tag ?? baseColor;
  const messageColor =
    colorOverrides.message ?? (options.colorOnlyTag ? NEUTRAL_MESSAGE_COLOR : baseColor);
  const locationColor = colorOverrides.location ?? DEFAULT_LOCATION_COLOR;

  const rawTimestamp = hideTimestamp
    ? ""
    : formatTimestamp(options.timestampFormat, lastTimestampMs);
  const rawTag = decoratedTag;
  const levelBadge = options.enableLevelTagging
    ? renderLevelBadge(level, adapter, baseColor, options.levelTaggingOptions)
    : "";
  const rawMessage = `${levelBadge ? pad(levelBadge, "right", " ", 2) : ""}${pad(options.leftSymbol, "right", " ")}${message}${pad(options.rightSymbol, "left", " ")}`;
  const rawLocation = showLocation ? `Location: ${location}` : "";

  const sizedTimestamp = applyCellSizing(rawTimestamp, cellSizes.timestamp);
  const sizedTag = applyCellSizing(rawTag, cellSizes.tag);
  const sizedMessage = applyCellSizing(rawMessage, cellSizes.message);
  const sizedLocation = applyCellSizing(rawLocation, cellSizes.location);

  const timestamp = colorizeSegment(sizedTimestamp, timestampColor, adapter);
  const tagText = colorizeSegment(sizedTag, tagColor, adapter);
  const messageText = colorizeSegment(sizedMessage, messageColor, adapter);
  const locationText = colorizeSegment(sizedLocation, locationColor, adapter);

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

  private static logWithLevel(
    level: LogLevel,
    consoleMethod: "log" | "warn" | "error" | undefined,
    args: unknown[],
    baseOptions?: LoggerOptions,
    emitToRegistry: boolean = true,
    logToConsole: boolean = true,
  ) {
    const { args: messages, options } = splitArgsAndOptions(args);
    const mergedBase = mergeOptionSets(baseOptions, options);
    const merged = this.mergeOptions(mergedBase);
    const { message, raw } = formatArguments(messages);
    const payload = buildLogLine({
      level,
      message,
      options: merged,
      lastTimestampMs: this.lastLogTimestampMs,
    });

    if (emitToRegistry) {
      LoggingRegistry.emit(level, {
        message,
        location: payload.location,
        timestamp: isoTimestamp(),
        raw,
        level,
        tag: payload.tag,
      });
    }

    if (logToConsole && consoleMethod) {
      console[consoleMethod](payload.text);
    }
    this.lastLogTimestampMs = Date.now();
  }

  static log(message: unknown, options?: LoggerOptions): void;
  static log(...args: unknown[]): void;
  static log(...args: unknown[]): void {
    this.logWithLevel(LogLevel.info, "log", args);
  }

  static error(message: unknown, options?: LoggerOptions): void;
  static error(...args: unknown[]): void;
  static error(...args: unknown[]): void {
    this.logWithLevel(LogLevel.error, "error", args);
  }

  static test(message: unknown, options?: LoggerOptions): void;
  static test(...args: unknown[]): void;
  static test(...args: unknown[]): void {
    this.logWithLevel(LogLevel.test, "log", args);
  }

  static highlight(message: unknown, options?: LoggerOptions): void;
  static highlight(...args: unknown[]): void;
  static highlight(...args: unknown[]): void {
    this.logWithLevel(LogLevel.highlight, "log", args);
  }

  static warn(message: unknown, options?: LoggerOptions): void;
  static warn(...args: unknown[]): void;
  static warn(...args: unknown[]): void {
    this.logWithLevel(LogLevel.warn, "warn", args);
  }

  static info(message: unknown, options?: LoggerOptions): void;
  static info(...args: unknown[]): void;
  static info(...args: unknown[]): void {
    this.logWithLevel(LogLevel.info, "log", args);
  }

  static debug(message: unknown, options?: LoggerOptions): void;
  static debug(...args: unknown[]): void;
  static debug(...args: unknown[]): void {
    this.logWithLevel(LogLevel.debug, "log", args);
  }

  static silent(message: unknown, options?: LoggerOptions): void;
  static silent(...args: unknown[]): void;
  static silent(...args: unknown[]): void {
    this.logWithLevel(LogLevel.silent, "log", args, undefined, true, false);
  }

  static table(
    data: TableInput,
    options?: TableLogOptions,
  ): void {
    const merged = this.mergeOptions(
      mergeOptionSets(
        { hideTimestamp: false, showLocation: true, locationStackDepth: (options?.locationStackDepth ?? 6) -1 },
        options,
      ),
    );
    const label = options?.label ?? "TABLE";
    const payload = buildLogLine({
      level: LogLevel.table,
      message: label,
      options: merged,
      lastTimestampMs: this.lastLogTimestampMs,
    });
    const tableData = normalizeTableData(data, options?.headers);
    const csv = toCsv(tableData.headers, tableData.rows);
    LoggingRegistry.emit(LogLevel.table, {
      message: csv,
      location: payload.location,
      timestamp: isoTimestamp(),
      raw: data,
      level: LogLevel.table,
      tag: payload.tag,
    });
    if (!options?.silent) {
      console.log(payload.text);
      if (typeof console.table === "function") {
        console.table(tableData.objects);
      } else {
        console.log(csv);
      }
    }
    this.lastLogTimestampMs = Date.now();
  }

  static quiet(message: unknown, options?: LoggerOptions): void;
  static quiet(...args: unknown[]): void;
  static quiet(...args: unknown[]): void {
    this.logWithLevel(LogLevel.quiet, "log", args, undefined, false);
  }

  static task(message: unknown, options?: LoggerOptions): void;
  static task(...args: unknown[]): void;
  static task(...args: unknown[]): void {
    this.logWithLevel(
      LogLevel.task,
      "log",
      args,
      { rightSymbol: "✔" },
    );
  }

  static custom(
    message: unknown,
    colorHex: string,
    options?: LoggerOptions,
  ): void;
  static custom(...args: unknown[]): void;
  static custom(...args: unknown[]): void {
    const { options, args: payload } = splitArgsAndOptions(args, 2);
    if (payload.length === 0) {
      return;
    }
    const colorCandidate = payload[payload.length - 1];
    const resolvedColor =
      typeof colorCandidate === "string"
        ? colorCandidate
        : LEVEL_COLORS[LogLevel.custom];
    const messages = payload.slice(0, -1);
    const baseOptions = mergeOptionSets(options, {
      levelColors: { [LogLevel.custom]: resolvedColor },
    });
    this.logWithLevel(LogLevel.custom, "log", messages, baseOptions);
  }
}
