import * as Sentry from '@sentry/react-native';

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogConfig {
  enableRemote?: boolean;
  remoteUrl?: string;
  isDevelopment?: boolean;
  sentryDsn?: string;
}

class LoggerService {
  private config: LogConfig;
  private isDevelopment: boolean;

  constructor(config: LogConfig = {}) {
    this.config = config;
    this.isDevelopment = config.isDevelopment ?? __DEV__;
  }

  private formatLog(level: LogLevel, message: string, data?: any): string {
    const timestamp = new Date().toISOString();
    const dataStr = data ? ` | ${JSON.stringify(data)}` : '';
    return `[${timestamp}] [${level.toUpperCase()}] ${message}${dataStr}`;
  }

  private shouldLog(level: LogLevel): boolean {
    if (!this.isDevelopment && level === 'debug') {
      return false;
    }
    return true;
  }

  private async sendToRemote(level: LogLevel, formattedLog: string, data?: any): Promise<void> {
    // Send to Sentry if it's an error or warning
    if (level === 'error') {
      Sentry.captureException(data instanceof Error ? data : new Error(formattedLog));
    } else if (level === 'warn') {
      Sentry.captureMessage(formattedLog, 'warning');
    }

    if (!this.config.enableRemote || !this.config.remoteUrl) return;

    try {
      await fetch(this.config.remoteUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ level, log: formattedLog, timestamp: new Date().toISOString() }),
      });
    } catch (error) {
      console.error('Failed to send log to remote service:', error);
    }
  }

  debug(message: string, data?: any): void {
    if (!this.shouldLog('debug')) return;
    const formatted = this.formatLog('debug', message, data);
    console.debug(formatted);
    this.sendToRemote('debug', formatted, data);
  }

  info(message: string, data?: any): void {
    if (!this.shouldLog('info')) return;
    const formatted = this.formatLog('info', message, data);
    console.info(formatted);
    this.sendToRemote('info', formatted, data);
  }

  warn(message: string, data?: any): void {
    if (!this.shouldLog('warn')) return;
    const formatted = this.formatLog('warn', message, data);
    console.warn(formatted);
    this.sendToRemote('warn', formatted, data);
  }

  error(message: string, data?: any): void {
    if (!this.shouldLog('error')) return;
    const formatted = this.formatLog('error', message, data);
    console.error(formatted);
    this.sendToRemote('error', formatted, data);
  }

  configure(config: Partial<LogConfig>): void {
    this.config = { ...this.config, ...config };
    if (config.isDevelopment !== undefined) {
      this.isDevelopment = config.isDevelopment;
    }
  }
}

export default new LoggerService();
