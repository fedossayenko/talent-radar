import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs/promises';
import * as path from 'path';

export interface AiRequestLogEntry {
  id: string;
  timestamp: string;
  method: string;
  request: {
    model: string;
    messages: any[];
    temperature?: number;
    max_tokens?: number;
    [key: string]: any;
  };
  response?: {
    id: string;
    model: string;
    choices: any[];
    usage: {
      prompt_tokens: number;
      completion_tokens: number;
      total_tokens: number;
    };
    [key: string]: any;
  };
  duration?: number;
  error?: {
    message: string;
    stack?: string;
  };
}

@Injectable()
export class AiRequestLoggerService {
  private readonly logger = new Logger(AiRequestLoggerService.name);
  private readonly logDirectory: string;
  private readonly enabled: boolean;
  private readonly includeResponses: boolean;
  private readonly retentionDays: number;

  constructor(private readonly configService: ConfigService) {
    this.enabled = this.configService.get<boolean>('ai.requestLogging.enabled', false);
    this.logDirectory = this.configService.get<string>('ai.requestLogging.logDirectory', './logs/ai-requests');
    this.includeResponses = this.configService.get<boolean>('ai.requestLogging.includeResponses', true);
    this.retentionDays = this.configService.get<number>('ai.requestLogging.retentionDays', 30);

    if (this.enabled) {
      this.ensureLogDirectory();
      this.logger.log(`AI request logging enabled. Files will be stored in: ${path.resolve(this.logDirectory)}`);
    }
  }

  async logRequest(
    method: string,
    request: any,
    requestId: string = this.generateRequestId()
  ): Promise<string> {
    if (!this.enabled) {
      return requestId;
    }

    const logEntry: AiRequestLogEntry = {
      id: requestId,
      timestamp: new Date().toISOString(),
      method,
      request: this.sanitizeRequest(request),
    };

    try {
      await this.writeLogEntry(logEntry);
      this.logger.debug(`Logged AI request: ${method} (ID: ${requestId})`);
    } catch (error) {
      this.logger.error(`Failed to log AI request: ${error.message}`);
    }

    return requestId;
  }

  async logResponse(
    requestId: string,
    response: any,
    duration: number,
    error?: Error
  ): Promise<void> {
    if (!this.enabled || !this.includeResponses) {
      return;
    }

    try {
      const logEntry = await this.readLogEntry(requestId);
      if (!logEntry) {
        this.logger.warn(`Cannot find request log entry for ID: ${requestId}`);
        return;
      }

      logEntry.duration = duration;

      if (error) {
        logEntry.error = {
          message: error.message,
          stack: error.stack,
        };
      } else if (response) {
        logEntry.response = this.sanitizeResponse(response);
      }

      await this.writeLogEntry(logEntry);
      this.logger.debug(`Logged AI response for request ID: ${requestId}`);
    } catch (err) {
      this.logger.error(`Failed to log AI response: ${err.message}`);
    }
  }

  private generateRequestId(): string {
    return `ai_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private sanitizeRequest(request: any): any {
    // Create a sanitized copy of the request, removing sensitive data if needed
    const sanitized = { ...request };
    
    // Remove or mask any sensitive information
    if (sanitized.messages) {
      sanitized.messages = sanitized.messages.map((msg: any) => ({
        ...msg,
        content: typeof msg.content === 'string' ? msg.content.substring(0, 10000) : msg.content // Limit content length
      }));
    }

    return sanitized;
  }

  private sanitizeResponse(response: any): any {
    // Create a sanitized copy of the response
    const sanitized = { ...response };
    
    // Limit choice content length for large responses
    if (sanitized.choices) {
      sanitized.choices = sanitized.choices.map((choice: any) => ({
        ...choice,
        message: choice.message ? {
          ...choice.message,
          content: typeof choice.message.content === 'string' 
            ? choice.message.content.substring(0, 50000) 
            : choice.message.content
        } : choice.message
      }));
    }

    return sanitized;
  }

  private async ensureLogDirectory(): Promise<void> {
    try {
      await fs.mkdir(this.logDirectory, { recursive: true });
    } catch (error) {
      this.logger.error(`Failed to create log directory: ${error.message}`);
    }
  }

  private getLogFileName(requestId: string): string {
    const date = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    return path.join(this.logDirectory, `${date}`, `${requestId}.json`);
  }

  private async writeLogEntry(logEntry: AiRequestLogEntry): Promise<void> {
    const fileName = this.getLogFileName(logEntry.id);
    const dir = path.dirname(fileName);
    
    // Ensure the date directory exists
    await fs.mkdir(dir, { recursive: true });
    
    await fs.writeFile(fileName, JSON.stringify(logEntry, null, 2), 'utf8');
  }

  private async readLogEntry(requestId: string): Promise<AiRequestLogEntry | null> {
    try {
      const fileName = this.getLogFileName(requestId);
      const content = await fs.readFile(fileName, 'utf8');
      return JSON.parse(content);
    } catch (error) {
      return null;
    }
  }

  async cleanOldLogs(): Promise<void> {
    if (!this.enabled) {
      return;
    }

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - this.retentionDays);

    try {
      const entries = await fs.readdir(this.logDirectory, { withFileTypes: true });
      
      for (const entry of entries) {
        if (entry.isDirectory()) {
          const dirDate = new Date(entry.name);
          if (dirDate < cutoffDate) {
            const dirPath = path.join(this.logDirectory, entry.name);
            await fs.rmdir(dirPath, { recursive: true });
            this.logger.log(`Cleaned old AI logs directory: ${entry.name}`);
          }
        }
      }
    } catch (error) {
      this.logger.error(`Failed to clean old AI logs: ${error.message}`);
    }
  }

  getLogDirectoryPath(): string {
    return path.resolve(this.logDirectory);
  }

  isEnabled(): boolean {
    return this.enabled;
  }
}