/* eslint-disable @typescript-eslint/no-unused-vars */

import chalk from "chalk";
import { LoggingRegistry } from "./registry";
import { LogLevel, LoggerOptions } from "./types";

function getLocation(): string {
  const err = new Error();
  const stack = (err.stack || "").split("\n");
  // Node stacks: [0]Error, [1]at getLocation, [2]at Caller (...)
  const line = stack[3] || stack[2] || "";
  const m = line.match(/\((.*):(\d+):(\d+)\)/) || line.match(/at (.*):(\d+):(\d+)/);
  if (m) {
    const file = m[1];
    const row = m[2];
    return `${file}:${row}`;
  }
  return "unknown";
}

function ts(): string {
  return new Date().toISOString();
}

function toMessage(prefix: string, body: unknown, withLocation = true): { text: string; location: string; raw: unknown } {
  const location = getLocation();
  const msg = `${ts()} ${prefix}: ${String(body)}${withLocation ? " " + chalk.gray(`Location: ${location}`) : ""}`;
  return { text: msg, location, raw: body };
}

export class Logger {
  static log(message: string, _opts?: LoggerOptions) {
    const payload = toMessage("INFO", message);
    LoggingRegistry.emit(LogLevel.info, { message, location: payload.location, timestamp: ts(), raw: message, level: LogLevel.info });
    console.log(payload.text);
  }

  static error(object: unknown, _opts?: LoggerOptions) {
    const m = toMessage(chalk.red("ERROR"), object);
    LoggingRegistry.emit(LogLevel.error, { message: String(object), location: m.location, timestamp: ts(), raw: object, level: LogLevel.error });
    console.error(m.text);
  }

  static test(object: unknown, _opts?: LoggerOptions) {
    const m = toMessage(chalk.green("TEST"), object);
    LoggingRegistry.emit(LogLevel.test, { message: String(object), location: m.location, timestamp: ts(), raw: object, level: LogLevel.test });
    console.log(m.text);
  }

  static highlight(object: unknown, _opts?: LoggerOptions) {
    const m = toMessage(chalk.yellowBright("HIGHLIGHT"), object);
    LoggingRegistry.emit(LogLevel.highlight, { message: String(object), location: m.location, timestamp: ts(), raw: object, level: LogLevel.highlight });
    console.log(m.text);
  }

  static warn(object: unknown, _opts?: LoggerOptions) {
    const m = toMessage(chalk.yellow("Warning"), object);
    LoggingRegistry.emit(LogLevel.warn, { message: String(object), location: m.location, timestamp: ts(), raw: object, level: LogLevel.warn });
    console.warn(m.text);
  }

  static info(object: unknown, _opts?: LoggerOptions) {
    const m = toMessage(chalk.gray("INFO"), object);
    LoggingRegistry.emit(LogLevel.info, { message: String(object), location: m.location, timestamp: ts(), raw: object, level: LogLevel.info });
    console.log(m.text);
  }

  static task(object: unknown, _opts?: LoggerOptions) {
    const m = toMessage(chalk.green("TASK"), `${String(object)} ✔`);
    LoggingRegistry.emit(LogLevel.task, { message: String(object), location: m.location, timestamp: ts(), raw: object, level: LogLevel.task });
    console.log(m.text);
  }

  static custom(object: unknown, colorHex: string, _opts?: LoggerOptions) {
    const m = toMessage(chalk.hex(colorHex)("CUSTOM"), object);
    LoggingRegistry.emit(LogLevel.custom, { message: String(object), location: m.location, timestamp: ts(), raw: object, level: LogLevel.custom });
    console.log(m.text);
  }
}
