
import { LogLevel } from "./types";

export type LogPayload = {
  message: string;
  location: string;
  timestamp: string;
  raw: unknown;
  level: LogLevel;
};

type Sink = (level: LogLevel, payload: LogPayload) => void;

class _LoggingRegistry {
  private sinks = new Set<Sink>();

  addSink(sink: Sink): () => void {
    this.sinks.add(sink);
    return () => this.removeSink(sink);
  }

  removeSink(sink: Sink) {
    this.sinks.delete(sink);
  }

  emit(level: LogLevel, payload: LogPayload) {
    for (const sink of this.sinks) {
      try { sink(level, payload); } catch { /* swallow sink errors */ }
    }
  }
}

export const LoggingRegistry = new _LoggingRegistry();
export type { Sink };
