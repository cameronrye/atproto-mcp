/**
 * Logging utility for the AT Protocol MCP Server.
 *
 * Emits human-readable, single-line-prefixed entries to stderr (stdout is
 * reserved for the MCP JSON-RPC stream). Single-line fields are sanitized to
 * prevent log forging via attacker-influenced newlines.
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
 * Logger class with leveled logging support
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
   * Strip CR/LF and other control characters from single-line log fields to
   * prevent log forging: message/component/error text can contain
   * attacker-influenced values (handles, URLs, post text), and an embedded
   * newline would otherwise let a caller inject fake log lines.
   */
  private sanitizeForLog(value: string): string {
    return (
      value
        .replace(/[\r\n]+/g, ' ')
        // Strip remaining C0 control chars (except tab) and DEL.
        // eslint-disable-next-line no-control-regex
        .replace(/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/g, '')
    );
  }

  /**
   * Format log entry for output
   */
  private formatLogEntry(entry: ILogEntry): string {
    const levelName = LogLevel[entry.level];
    const timestamp = entry.timestamp;
    const component = this.sanitizeForLog(entry.component);
    const message = this.sanitizeForLog(entry.message);

    let formatted = `[${timestamp}] ${levelName.padEnd(5)} [${component}] ${message}`;

    if (entry.data) {
      // JSON.stringify escapes newlines inside string values, so data cannot
      // inject extra log lines.
      formatted += `\n  Data: ${JSON.stringify(entry.data, null, 2)}`;
    }

    if (entry.error) {
      formatted += `\n  Error: ${this.sanitizeForLog(entry.error.message)}`;
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

    // Always write logs to stderr. This server speaks MCP over stdio, where
    // process.stdout is reserved for the JSON-RPC message stream; any log output
    // on stdout would corrupt the protocol framing and break clients. stderr is
    // safe for human-readable diagnostics at every level.
    console.error(formatted);
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
