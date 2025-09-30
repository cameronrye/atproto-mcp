/**
 * Structured logging utility for the AT Protocol MCP Server
 */

export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
}

export interface ILogEntry {
  timestamp: string;
  level: LogLevel;
  component: string;
  message: string;
  data?: unknown;
  error?: Error;
}

/**
 * Logger class with structured logging support
 */
export class Logger {
  private component: string;
  private logLevel: LogLevel;

  constructor(component: string, logLevel: LogLevel = LogLevel.INFO) {
    this.component = component;
    this.logLevel = this.getLogLevelFromEnv() ?? logLevel;
  }

  /**
   * Get log level from environment variable
   */
  private getLogLevelFromEnv(): LogLevel | null {
    const envLevel = process.env['LOG_LEVEL']?.toUpperCase();
    switch (envLevel) {
      case 'DEBUG':
        return LogLevel.DEBUG;
      case 'INFO':
        return LogLevel.INFO;
      case 'WARN':
        return LogLevel.WARN;
      case 'ERROR':
        return LogLevel.ERROR;
      default:
        return null;
    }
  }

  /**
   * Create a log entry
   */
  private createLogEntry(
    level: LogLevel,
    message: string,
    data?: unknown,
    error?: Error
  ): ILogEntry {
    const entry: ILogEntry = {
      timestamp: new Date().toISOString(),
      level,
      component: this.component,
      message,
    };

    if (data !== undefined) {
      entry.data = data;
    }

    if (error !== undefined) {
      entry.error = error;
    }

    return entry;
  }

  /**
   * Format log entry for output
   */
  private formatLogEntry(entry: ILogEntry): string {
    const levelName = LogLevel[entry.level];
    const timestamp = entry.timestamp;
    const component = entry.component;
    const message = entry.message;

    let formatted = `[${timestamp}] ${levelName.padEnd(5)} [${component}] ${message}`;

    if (entry.data) {
      formatted += `\n  Data: ${JSON.stringify(entry.data, null, 2)}`;
    }

    if (entry.error) {
      formatted += `\n  Error: ${entry.error.message}`;
      if (entry.error.stack) {
        formatted += `\n  Stack: ${entry.error.stack}`;
      }
    }

    return formatted;
  }

  /**
   * Log a message at the specified level
   */
  private log(level: LogLevel, message: string, data?: unknown, error?: Error): void {
    if (level < this.logLevel) {
      return;
    }

    const entry = this.createLogEntry(level, message, data, error);
    const formatted = this.formatLogEntry(entry);

    // Output to appropriate stream
    if (level >= LogLevel.ERROR) {
      console.error(formatted);
    } else {
      console.log(formatted);
    }
  }

  /**
   * Log debug message
   */
  public debug(message: string, data?: unknown): void {
    this.log(LogLevel.DEBUG, message, data);
  }

  /**
   * Log info message
   */
  public info(message: string, data?: unknown): void {
    this.log(LogLevel.INFO, message, data);
  }

  /**
   * Log warning message
   */
  public warn(message: string, data?: unknown, error?: Error): void {
    this.log(LogLevel.WARN, message, data, error);
  }

  /**
   * Log error message
   */
  public error(message: string, error?: Error | unknown, data?: unknown): void {
    const errorObj = error instanceof Error ? error : new Error(String(error));
    this.log(LogLevel.ERROR, message, data, errorObj);
  }

  /**
   * Create a child logger with additional context
   */
  public child(childComponent: string): Logger {
    return new Logger(`${this.component}:${childComponent}`, this.logLevel);
  }

  /**
   * Set log level
   */
  public setLogLevel(level: LogLevel): void {
    this.logLevel = level;
  }

  /**
   * Get current log level
   */
  public getLogLevel(): LogLevel {
    return this.logLevel;
  }
}

/**
 * Default logger instance
 */
export const logger = new Logger('AtpMcp');
