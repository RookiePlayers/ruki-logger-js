import { LoggingRegistry, LogPayload } from "./registry";
import { LogLevel } from "./types";
import { format, startOfDay } from "date-fns";
import { Logger } from "./logger";

type FsPromises = typeof import("node:fs/promises");
const FS_MODULE_ID = "node:fs/promises";

let cachedFs: FsPromises | null = null;
let fsInitialized = false;
async function getFs(): Promise<FsPromises | null> {
    if (fsInitialized) return cachedFs;
    fsInitialized = true;
    try {
        cachedFs = await import(/* @vite-ignore */ FS_MODULE_ID);
    } catch {
        cachedFs = null;
    }
    return cachedFs;
}

export abstract class LoggerSinkConfig {
    abstract name: string;
    abstract unsubscribe: (() => void) | null;
    abstract saveAsErrorLogs(payload: LogPayload): Promise<boolean>;
    abstract saveAsInfoLogs(payload: LogPayload): Promise<boolean>;
    abstract saveToWarningLogs(payload: LogPayload): Promise<boolean>;
    abstract saveAsGeneralLogs(payload: LogPayload): Promise<boolean>;
    abstract saveAsTableLogs(payload: LogPayload): Promise<boolean>;
    async saveAs(payload: LogPayload): Promise<boolean> {
        switch (payload.level) {
            case LogLevel.error:
                return this.saveAsErrorLogs(payload);
            case LogLevel.info:
                return this.saveAsInfoLogs(payload);
            case LogLevel.warn:
                return this.saveToWarningLogs(payload);
            case LogLevel.table:
                return this.saveAsTableLogs(payload);
            default:
                return this.saveAsGeneralLogs(payload);
        }
    }
    registerSink() {
        this.unsubscribe = LoggingRegistry.addSink(async (_level, payload) => {
            await this.saveAs(payload);
        });
    };
    unregisterSink() {
        if (this.unsubscribe) {
            this.unsubscribe();
            this.unsubscribe = null;
        }
    }
}
type LogFilePathConfig = {
    [key in LogLevel]: string;
};
export class FileSyncLoggerConfig extends LoggerSinkConfig {
    name = 'DEFAULT_CONCRETE_LOGGER_CONFIG';
    unsubscribe: (() => void) | null = null;
    private logFilePath: Partial<LogFilePathConfig>;
    constructor(logFilePath?: Partial<LogFilePathConfig>) {
        super();
        this.logFilePath = logFilePath || {
            error: 'errors',
            info: 'info',
            warn: 'warnings',
            test: 'general',
            highlight: 'general',
            task: 'general',
            table: 'tables',
            silent: 'general',
            quiet: 'general',
            custom: 'general'
        };
    }
    private saveTofile = async (filename: string, data: string) => {
        const fs = await getFs();
        if (!fs) {
            Logger.warn("File sink unavailable: fs not supported in this environment");
            return false;
        }
        try {
            await fs.writeFile(`logs/${filename}`, data, { encoding: 'utf8', flag: 'a' });
        } catch (error) {
            // if the file doesn't exist, create it
            if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
                await fs.mkdir(`logs/${filename.split('/')[0]}`, { recursive: true });
                await fs.writeFile(`logs/${filename}`, data, { encoding: 'utf8', flag: 'a' });
            } else {
                Logger.warn(`Failed to write logs to file: ${(error as Error).message}`);
                return false;
            }
        }
        return true;
    };

    private getLogFileNameByDate = () => {
        const date = new Date();
        return `${format(startOfDay(date), 'yyyy_MM_dd')}.log`;
    };

    async saveAsErrorLogs(log: LogPayload): Promise<boolean> {
        const str = `${log.timestamp} [${log.level}|${log.tag}]${log.message} Location:${log.location}\n`;
        await this.saveTofile(
            this.logFilePath.error ?? 
            `errors/${this.getLogFileNameByDate()}`, str);
        return true;
    }

    async saveAsInfoLogs(log: LogPayload): Promise<boolean> {
        const str = `${log.timestamp} [${log.level}|${log.tag}]${log.message} Location:${log.location}\n`;
        await this.saveTofile(
            this.logFilePath.info ?? 
            `info/${this.getLogFileNameByDate()}`, str);
        return true;
    }

    async saveToWarningLogs(log: LogPayload): Promise<boolean> {
        const str = `${log.timestamp} [${log.level}|${log.tag}]${log.message} Location:${log.location}\n`;
        await this.saveTofile(
            this.logFilePath.warn ?? 
            `warnings/${this.getLogFileNameByDate()}`, str);
        return true;
    }

    async saveAsTableLogs(log: LogPayload): Promise<boolean> {
        const csvFile = `${this.logFilePath.table ?? 'tables'}/${this.getLogFileNameByDate().replace('.log', '.csv')}`;
        const csv = log.message.endsWith("\n") ? log.message : `${log.message}\n`;
        await this.saveTofile(csvFile, csv);
        return true;
    }

    async saveAsGeneralLogs(log: LogPayload): Promise<boolean> {
        const str = `${log.timestamp} [${log.level}|${log.tag}]${log.message} Location:${log.location}\n`;
        await this.saveTofile(
            this.logFilePath.custom ?? this.logFilePath.test ?? this.logFilePath.highlight ?? this.logFilePath.task ?? this.logFilePath.table ?? this.logFilePath.silent ?? this.logFilePath.quiet ??
            `general/${this.getLogFileNameByDate()}`, str);
        return true;
    }

    async saveAs(payload: LogPayload): Promise<boolean> {
        switch (payload.level) {
            case LogLevel.error:
                return this.saveAsErrorLogs(payload);
            case LogLevel.info:
                return this.saveAsInfoLogs(payload);
            case LogLevel.warn:
                return this.saveToWarningLogs(payload);
            case LogLevel.table:
                return this.saveAsTableLogs(payload);
            default:
                return this.saveAsGeneralLogs(payload);
        }
    }

    registerSink() {
        this.unsubscribe = LoggingRegistry.addSink((level, payload) => {
            void this.saveAs(payload);
        });
    }

    unregisterSink() {
        if (this.unsubscribe) {
            this.unsubscribe();
            this.unsubscribe = null;
        }
    }
}
