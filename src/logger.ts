import chalk from "chalk";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { LoggingRegistry } from "./registry";
import { LogLevel, LoggerOptions } from "./types";
import { formatDate, formatDistance } from "date-fns";

function getLocation(useRelative: boolean): string {
  const err = new Error();
  const stack = (err.stack || "").split("\n");
  // Node stacks: [0]Error, [1]at getLocation, [2]at Caller (...)
  const line = stack[4] || stack[3] || stack[2] || "";
  const m = line.match(/\((.*):(\d+):(\d+)\)/) || line.match(/at (.*):(\d+):(\d+)/);
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
      if (relative && !relative.includes(path.sep) && relative === path.basename(relative)) {
        const parent = path.dirname(process.cwd());
        if (parent && parent !== process.cwd()) {
          const parentRelative = path.relative(parent, file);
          if (parentRelative && !parentRelative.startsWith("..") && parentRelative.includes(path.sep)) {
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

function ts(): string {
  return new Date().toISOString();
}

function formatTimestamp(format: LoggerOptions["timestampFormat"], lastTimestampMs?: number): string {
  const now = new Date();
  if (typeof format === "function") {
    return format(now);
  }
  if (format === "timeago") {
    const previous = typeof lastTimestampMs === "number" ? new Date(lastTimestampMs) : now;
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

function toMessage(prefix: string, body: unknown, color: string, options: LoggerOptions = {showLocation: true}, lastTimestampMs?: number): { text: string; location: string; raw: unknown } {
  const useRelative = options?.locationPath !== "absolute";
  const location = getLocation(useRelative);
  const hideTimestamp = options?.hideTimestamp ?? true;
  const timestampPart = hideTimestamp ? "" : `${formatTimestamp(options?.timestampFormat, lastTimestampMs)} `;
  const bodyText = `${pad(options?.leftSymbol, "right", " ")}${String(body)}${pad(options?.rightSymbol, "left", " ")}`;
  const base = `${timestampPart}${prefix}: ${bodyText}`;
  const prefixColored = `${timestampPart}${chalk.hex(color)(prefix)}: ${bodyText}`;
  const colored = options?.colorOnlyTag ? prefixColored : chalk.hex(color)(`${base}`);
  const showLocation = options?.showLocation ?? true;
  const msg = `${colored}${showLocation ? " " + chalk.gray(`Location: ${location}`) : ""}`;
  return { text: msg, location, raw: body };
}

function pad(string?: string, dir?: "left" | "right", char: string = "", repeat?: number): string {
  if(!string) return "";
  if(dir === "left") {
    return (char.repeat(repeat || 1))+string;
  }
  return string+char.repeat(repeat || 1);
}
export class Logger {
  private static lastLogTimestampMs: number | undefined;
  static log(message: string, options?: LoggerOptions) {
    const payload = toMessage(`[${options?.tag || "INFO"}]`, message, "#bcbcbcff", options, this.lastLogTimestampMs);
    LoggingRegistry.emit(LogLevel.info, { message, location: payload.location, timestamp: ts(), raw: message, level: LogLevel.info });
    console.log(payload.text);
    this.lastLogTimestampMs = Date.now();
  }

  static error(object: unknown, options?: LoggerOptions) {
    const m = toMessage(`[${options?.tag || "ERROR"}]`, object, "#ce2727ff", options, this.lastLogTimestampMs);
    LoggingRegistry.emit(LogLevel.error, { message: String(object), location: m.location, timestamp: ts(), raw: object, level: LogLevel.error });
    console.error(m.text);
    this.lastLogTimestampMs = Date.now();
  }

  static test(object: unknown, options?: LoggerOptions) {
    const m = toMessage(`[${options?.tag || "TEST"}]`, object, "#219f21ff", options, this.lastLogTimestampMs);
    LoggingRegistry.emit(LogLevel.test, { message: String(object), location: m.location, timestamp: ts(), raw: object, level: LogLevel.test });
    console.log(m.text);
    this.lastLogTimestampMs = Date.now();
  }

  static highlight(object: unknown, options?: LoggerOptions) {
    const m = toMessage(`[${options?.tag || "HIGHLIGHT"}]`, object, "#ffff00", options, this.lastLogTimestampMs);
    LoggingRegistry.emit(LogLevel.highlight, { message: String(object), location: m.location, timestamp: ts(), raw: object, level: LogLevel.highlight });
    console.log(m.text);
    this.lastLogTimestampMs = Date.now();
  }

  static warn(object: unknown, options?: LoggerOptions) {
    const m = toMessage(`[${options?.tag || "WARNING"}]`, object, "#ffc400ff", options, this.lastLogTimestampMs);
    LoggingRegistry.emit(LogLevel.warn, { message: String(object), location: m.location, timestamp: ts(), raw: object, level: LogLevel.warn });
    console.warn(m.text);
    this.lastLogTimestampMs = Date.now();
  }

  static info(object: unknown, options?: LoggerOptions) {
    const m = toMessage(`[${options?.tag || "INFO"}]`, object, "#f5f5f5ff", options, this.lastLogTimestampMs);
    LoggingRegistry.emit(LogLevel.info, { message: String(object), location: m.location, timestamp: ts(), raw: object, level: LogLevel.info });
    console.log(m.text);
    this.lastLogTimestampMs = Date.now();
  }

  static quiet(object: unknown, options?: LoggerOptions) {
    const m = toMessage(`[${options?.tag || "QUIET"}]`, object, "#545454ff", options, this.lastLogTimestampMs);
    console.log(m.text);
    this.lastLogTimestampMs = Date.now();
  }

  static task(object: unknown, options?: LoggerOptions) {
    const m = toMessage(`[${options?.tag || "TASK"}]`, `${String(object)}`, "#41c541ff", { rightSymbol: "✔", ...options }, this.lastLogTimestampMs);
    LoggingRegistry.emit(LogLevel.task, { message: String(object), location: m.location, timestamp: ts(), raw: object, level: LogLevel.task });
    console.log(m.text);
    this.lastLogTimestampMs = Date.now();
  }

  static custom(object: unknown, colorHex: string, options?: LoggerOptions) {
    const m = toMessage(`[${options?.tag || "CUSTOM"}]`, object, colorHex, options, this.lastLogTimestampMs);
    LoggingRegistry.emit(LogLevel.custom, { message: String(object), location: m.location, timestamp: ts(), raw: object, level: LogLevel.custom });
    console.log(m.text);
    this.lastLogTimestampMs = Date.now();
  }
}
