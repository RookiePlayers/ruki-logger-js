
import { Logger, LoggingRegistry } from "../src";

const unsubscribe = LoggingRegistry.addSink(() => {
  // Example sink: mirror payload to stdout in JSON
  // In production, send to your APM or DB here
  // console.log("[sink]", JSON.stringify({ level, ...payload }));
});

Logger.info("Booting up...");
Logger.warn("Potential issue...");
Logger.error(new Error("Something went wrong"));
Logger.task("Build assets");
Logger.highlight("Pay attention to this");
Logger.test("A test log line");
Logger.custom("Purple rain", "#9b59b6");

unsubscribe();
Logger.info("Sink removed");
