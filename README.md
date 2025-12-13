<p align="left">
  <a href="https://www.npmjs.com/package/ruki-logger">
    <img src="https://img.shields.io/npm/v/ruki-logger?color=blue&label=npm" alt="npm version" />
  </a>
  <a href="https://github.com/RookiePlayers/ruki-logger-js/actions">
    <img src="https://github.com/RookiePlayers/ruki-logger-js/actions/workflows/production.yml/badge.svg" alt="CI status" />
  </a>
  <a href="https://github.com/RookiePlayers/ruki-logger-js/blob/main/LICENSE">
    <img src="https://img.shields.io/github/license/RookiePlayers/ruki-logger-js?color=green" alt="MIT License" />
  </a>
  <a href="https://bundlephobia.com/package/ruki-logger">
    <img src="https://img.shields.io/bundlephobia/minzip/ruki-logger?label=size" alt="Bundle size" />
  </a>
  <a href="https://github.com/RookiePlayers/ruki-logger-js">
    <img src="https://img.shields.io/github/stars/RookiePlayers/ruki-logger-js?style=social" alt="GitHub stars" />
  </a>
</p>

# ruki-logger

A colorful,Configurable location‑aware logger.

- Timestamps, level tags, and source **file:line** location
- Pretty colors via **chalk**
- Pluggable sinks via a `LoggingRegistry` (for piping logs to files, DBs, APMs, etc.)
- Tiny, framework‑agnostic API mirroring your Dart methods: `log`, `error`, `test`, `highlight`, `warn`, `info`, `task`, `table`, `quiet`, `silent`, `custom(hex)`

<div style="display: inline-block">
<img width="1052" height="219" alt="image" style="padding:12px" src="https://github.com/user-attachments/assets/e58d25a4-cbbb-4d36-8aab-eb6798d79bc5" />
<img width="1187" height="255" alt="Screenshot 2025-11-18 at 17 58 25" style="padding:12px" src="https://github.com/user-attachments/assets/e0885df8-123f-413c-8ac5-8d0a0e7abe4a" />

</div>

## Install

```bash
npm i ruki-logger
# or
pnpm add ruki-logger
# or
yarn add ruki-logger
```

## Quick start

```ts
import { Logger, LoggingRegistry, LogLevel } from "ruki-logger";

// optional: subscribe to log events (for piping elsewhere)
LoggingRegistry.addSink((level, payload) => {
  // e.g., forward to Datadog, write to file, etc.
  // console.debug("[sink]", level, payload);
});

Logger.info("Hello from ruki-logger");
Logger.warn("Careful!");
Logger.error(new Error("Boom"));
Logger.task("Build completed");
Logger.highlight("Important");
Logger.test("Only during tests? up to you!");
Logger.custom("Any hex color works", "#9b59b6");
Logger.table(
  [
    { id: 1, name: "Alice", score: 92 },
    { id: 2, name: "Bob", score: 81 },
  ],
  { tag: "STATS", label: "Leaderboard", hideTimestamp: false },
);
Logger.silent("Emit to sinks without console noise");
Logger.info("User payload", { id: 42, name: "Jane" }, { tag: "API" }); // console.log-style varargs
```

`Logger.silent` will emit to all registered sinks but skip console output; `Logger.quiet` does the reverse (console only, no sinks).
`Logger.table` prints timestamp/location header followed by a console table; when `silent: true`, it only emits a CSV payload to sinks.

### Configuration examples

```ts
// 1. Default (relative file paths, timestamp hidden)
Logger.info("Server ready");

// 2. Show ISO timestamp and absolute path
Logger.warn("Disk space low", {
  hideTimestamp: false,
  timestampFormat: "iso",
  locationPath: "absolute",
});

// 3. Use locale timestamp and hide location
Logger.info("Cache warmed", {
  hideTimestamp: false,
  timestampFormat: "locale",
  showLocation: false,
});

// 4. Relative time (timeago) between logs
Logger.task("Transcoding complete", {
  hideTimestamp: false,
  timestampFormat: "timeago",
});

// 5. Custom timestamp formatter + custom tag
Logger.custom(
  "Webhook delivered",
  "#9b59b6",
  {
    tag: "WEBHOOK",
    hideTimestamp: false,
    timestampFormat: (now) => now.toUTCString(),
    colorOnlyTag: true,
  }
);

// 6. Custom formatter (location before message)
Logger.info("Formatter demo", {
  format: "#4%##2%####4%###",
  hideTimestamp: false,
});

// 7. Decorators & color overrides
Logger.warn("Decorated tag warning", {
  tagDecorator: "{}{}",
  colorOptions: {
    tag: "#ff6b6b",
    message: "#ffeaa7",
  },
  hideTimestamp: false,
});

// 8. Fixed-width columns
Logger.info("Aligned columns", {
  hideTimestamp: false,
  cellSizes: {
    timestamp: { min: 25 },
    tag: { min: 10 },
    message: { min: 24, max: 42 },
    location: { min: 28 },
  },
});

// 9. Override default colors per level
Logger.configure({
  levelColors: {
    info: "#55efc4",
    error: "#e74c3c",
  },
});

// 10. Level tagging inside message body
Logger.info("Indexed 2k docs", {
  enableLevelTagging: true,
  tag: "DB",
});

// 11. Custom level tags/colors (foreground + background)
Logger.info("Level badges your way", {
  enableLevelTagging: true,
  levelTaggingOptions: {
    info: { tag: "I", color: "#0ff", bgColor: "#111" },
    error: { tag: "ERR", bgColor: "#2b0000" }, // fg defaults to level color
  },
});

// 12. Force colors when your runtime strips ANSI (Nest CLI/PM2/CI)
Logger.configure({ forceColorLevel: true });
Logger.warn("Colors stay enabled", { forceColorLevel: 3 });
```

## API

### `LoggerOptions`

```ts
type LoggerOptions = {
  tag?: string;
  isDebug?: boolean;
  colorOnlyTag?: boolean;
  forceColorLevel?: 0 | 1 | 2 | 3 | boolean;
  leftSymbol?: string;
  rightSymbol?: string;
  showLocation?: boolean;
  locationPath?: "relative" | "absolute";
  hideTimestamp?: boolean;
  timestampFormat?:
    | "iso"
    | "locale"
    | "time"
    | "date"
    | "timeago"
    | ((timestamp: Date) => string);
  /**
   * `#`=timestamp, `##`=tag, `###`=message, `####`=location.
   * Numbers before `%` describe spaces between each segment.
   */
  format?: string;
  /** wrap the tag in these characters (default: "[]") */
  tagDecorator?: string;
  colorOptions?: {
    timestamp?: string;
    tag?: string;
    message?: string;
    location?: string;
  };
  levelColors?: Partial<Record<LogLevel, string>>;
  cellSizes?: {
    timestamp?: { min?: number; max?: number };
    tag?: { min?: number; max?: number };
    message?: { min?: number; max?: number };
    location?: { min?: number; max?: number };
  };
  enableLevelTagging?: boolean;
  levelTaggingOptions?: {
    [level in LogLevel]?: {
      tag?: string;
      color?: string;
      bgColor?: string;
    };
  };
};
```

- `hideTimestamp` defaults to `true`. Set it to `false` and pick any `timestampFormat`.
- `locationPath` can be `"relative"` or `"absolute"`, defaulting to relative paths.
- `format` lets you rearrange timestamp/tag/message/location while specifying the spaces between each segment. Invalid strings fall back to `#1%##1%###1%####`.
- `tagDecorator` wraps the tag with any characters (1 char mirrors, 2 chars become left/right, longer strings split evenly).
- `colorOptions` can override the colors of each segment (timestamp/tag/message/location). By default, tag + message use the level color, timestamp is white, and location is gray.
- `forceColorLevel` overrides Chalk's color detection (handy when Nest/PM2/CI disables ANSI colors). `true` = level 3, `false` = no colors.
- `levelTaggingOptions` customizes the level badge when `enableLevelTagging` is on (per-level tag text, foreground color, and background color).
- `levelColors` changes the default color per log level (affects tag/message defaults and level badge color when not overridden).
- `cellSizes` enforces min/max widths for each segment so multiple log lines stay aligned (e.g., pad the tag to 10 chars, trim messages at 80).
- `enableLevelTagging` adds the level alias (e.g., `APP`, `NET`) before the message content, spaced using the same padding helpers.

### Custom formats

The format string only understands two tokens:

- `#`, `##`, `###`, `####` which render **timestamp**, **tag**, **message**, and **location** respectively (each must appear once).
- `<number>%` which inserts that many spaces between two segments.

Examples:

```
#2%##4%###2%####  ->  2025-11-18T16:07:11.364Z  [WARNING]    Careful!  Location: example/index.ts:39
#4%##2%####4%###  ->  2025-11-18T16:07:11.364Z    [WARNING]  Location: example/index.ts:39    Careful!
```

If a referenced segment is hidden (e.g., timestamp or location), the surrounding spaces are automatically removed.

### Global defaults

Call `Logger.configure()` once during startup to set project-wide defaults (you can still override per call):

```ts
Logger.configure({
  hideTimestamp: false,
  format: "#2%##4%###2%####",
  tagDecorator: "<>",
  colorOptions: {
    timestamp: "#9b59b6",
    location: "#7f8c8d",
  },
  cellSizes: {
    timestamp: { min: 25 },
    tag: { min: 10 },
    message: { min: 24 },
    location: { min: 30 },
  },
  enableLevelTagging: true,
});
```

### Methods

All methods add ISO timestamp and call‑site location. Pass any number of message
arguments (just like `console.log`); if you need `LoggerOptions`, provide them as
the final argument. For `Logger.custom`, the last non-options argument is treated
as the hex color.

```ts
Logger.log(...args: unknown[])
Logger.error(...args: unknown[])
Logger.test(...args: unknown[])
Logger.highlight(...args: unknown[])
Logger.warn(...args: unknown[])
Logger.info(...args: unknown[])
Logger.task(...args: unknown[])
Logger.custom(...args: unknown[]) // last non-options arg = color hex
```

### `LoggingRegistry`

Simple pub/sub for log events.

```ts
type Sink = (level: LogLevel, payload: {
  message: string;
  location: string;
  timestamp: string;
  raw: unknown;
  tag: string | undefined;
}) => void;

LoggingRegistry.addSink(sink: Sink): () => void     // returns an unsubscribe fn
LoggingRegistry.removeSink(sink: Sink): void
LoggingRegistry.emit(level: LogLevel, payload: ...): void
```

## Example

See [`example/index.ts`](./example/index.ts). Run it with:

```bash
npm i
npm run build
node dist/example/index.js
# or directly with ts-node for dev
npx ts-node example/index.ts
```

## TypeScript config

This package ships ESM (`"type": "module"`). Node 18+ recommended.

## License

MIT
