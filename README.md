
# ruki-logger

A colorful, location‑aware logger for Node.js/TypeScript — inspired by your Flutter/Dart logger.

- Timestamps, level tags, and source **file:line** location
- Pretty colors via **chalk**
- Pluggable sinks via a `LoggingRegistry` (for piping logs to files, DBs, APMs, etc.)
- Tiny, framework‑agnostic API mirroring your Dart methods: `log`, `error`, `test`, `highlight`, `warn`, `info`, `task`, `custom(hex)`

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
```

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
```

## API

### `LoggerOptions`

```ts
type LoggerOptions = { isDebug?: boolean }
```
- `isDebug=true` prints using `console.*` (typical dev experience).  
- `isDebug=false` also uses `console.*` (Node has no `developer.log`), but you can use this flag in your app to toggle sinks or verbosity.

### Methods

All methods add ISO timestamp and call‑site location.

```ts
Logger.log(message: string, options?: LoggerOptions)
Logger.error(object: unknown, options?: LoggerOptions)
Logger.test(object: unknown, options?: LoggerOptions)
Logger.highlight(object: unknown, options?: LoggerOptions)
Logger.warn(object: unknown, options?: LoggerOptions)
Logger.info(object: unknown, options?: LoggerOptions)
Logger.task(object: unknown, options?: LoggerOptions)
Logger.custom(object: unknown, colorHex: string, options?: LoggerOptions)
```

### `LoggingRegistry`

Simple pub/sub for log events.

```ts
type Sink = (level: LogLevel, payload: { message: string; location: string; timestamp: string; raw: unknown }) => void;

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
