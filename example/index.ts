
import { formatDate } from "date-fns";
import { Logger, LoggingRegistry, LogLevel } from "../src/index.ts";
import { promises as fs } from "fs";

Logger.configure({
  hideTimestamp: false,
  timestampFormat: "iso",
  format: "#2%##2%####2%###",
  tagDecorator: "[]",
  colorOptions: {
    timestamp: "#cce8e8ff",
    location: "#505a5bff",
  },
  cellSizes: {
    timestamp: { min: 26 },
    tag: { min: 12 },
    message: { min: 40, max: 100 },
    location: { min: 32 },
  },
});

const saveTofile = async (filename: string, data: string) => {
    try {
      await fs.writeFile(filename, data, { encoding: "utf8", flag: "a"});
    } catch (error) {
      console.error(`Failed to write to file ${filename}:`, error);
    }
}
const unsubscribe = LoggingRegistry.addSink((level, payload) => {
  // Example sink: mirror payload to stdout in JSON
  // In production, send to your APM or DB here
  // console.log("[sink]", JSON.stringify({ level, ...payload }));
  if(level === LogLevel.error) {
    saveTofile("error_logs.txt", `${payload.timestamp} [${level.toUpperCase()}] ${payload.message} Location: ${payload.location}\n`);
  }else if (level === LogLevel.warn) {
    saveTofile("warn_logs.txt", `${payload.timestamp} [${level.toUpperCase()}] ${payload.message} Location: ${payload.location}\n`);
  }else if (level === LogLevel.info) {
    saveTofile("info_logs.txt", `${payload.timestamp} [${level.toUpperCase()}] ${payload.message} Location: ${payload.location}\n`);
  }else if (level === LogLevel.test) {
    saveTofile("test_logs.txt", `${payload.timestamp} [${level.toUpperCase()}] ${payload.message} Location: ${payload.location}\n`);
  }else if (level === LogLevel.highlight) {
    saveTofile("highlight_logs.txt", `${payload.timestamp} [${level.toUpperCase()}] ${payload.message} Location: ${payload.location}\n`);
  }else if (level === LogLevel.task) {
    saveTofile("task_logs.txt", `${payload.timestamp} [${level.toUpperCase()}] ${payload.message} Location: ${payload.location}\n`);
  }else{
    saveTofile("custom_logs.txt", `${payload.timestamp} [${level.toUpperCase()}] ${payload.message} Location: ${payload.location}\n`);
  }
});


Logger.info("Hello from ruki-logger");
Logger.warn("Careful!");
Logger.error(new Error("Boom"));
Logger.task("Build completed");
Logger.highlight("Important");
Logger.test("Only during tests? up to you!");
Logger.custom("Any hex color works", "#9b59b6");

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
    timestampFormat: (now: Date) => formatDate(now, "HH:mm:ss 'on' MMMM do, yyyy"),
    colorOnlyTag: true,
  }
);

// 6. Custom formatter string (message after location)
Logger.info("Formatter demo", {
  format: "#4%##2%####4%###",
  hideTimestamp: false,
});

// 7. Per-call decorator & color overrides
Logger.warn("Decorated tag warning", {
  tagDecorator: "{}{}",
  colorOptions: {
    tag: "#ff6b6b",
    message: "#ffeaa7",
  },
  hideTimestamp: false,
});

// 8. Fixed-width columns for every segment
Logger.info("Aligned columns", {
  hideTimestamp: false,
  cellSizes: {
    timestamp: { min: 25 },
    tag: { min: 10 },
    message: { min: 24, max: 40 },
    location: { min: 28 },
  },
});
 Logger.info("User payload", { id: 42, name: "Jane" }, { tag: "API" });
unsubscribe();
Logger.info("Sink removed");
