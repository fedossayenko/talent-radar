import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { AiRequestLoggerService, AiRequestLogEntry } from './ai-request-logger.service';
import * as fs from 'fs/promises';
import * as path from 'path';
import { Logger } from '@nestjs/common';

// Mock fs/promises
jest.mock('fs/promises');
const mockFs = fs as jest.Mocked<typeof fs>;

describe('AiRequestLoggerService', () => {
  let service: AiRequestLoggerService;
  let configService: jest.Mocked<ConfigService>;
  let loggerSpy: jest.SpyInstance;

  const mockLogDirectory = './test-logs/ai-requests';
  const mockRequestId = 'ai_1234567890_abcdef123';

  beforeEach(async () => {
    // Reset all mocks
    jest.clearAllMocks();
    
    // Setup fs mocks with default implementations
    mockFs.mkdir.mockResolvedValue(undefined);
    mockFs.writeFile.mockResolvedValue(undefined);
    mockFs.readFile.mockResolvedValue('{}');
    mockFs.readdir.mockResolvedValue([]);
    mockFs.rmdir.mockResolvedValue(undefined);
    
    // Mock ConfigService
    const mockConfigService = {
      get: jest.fn().mockImplementation((key: string, defaultValue: any) => {
        const config = {
          'ai.requestLogging.enabled': true,
          'ai.requestLogging.logDirectory': mockLogDirectory,
          'ai.requestLogging.includeResponses': true,
          'ai.requestLogging.retentionDays': 30,
        };
        return config[key as keyof typeof config] ?? defaultValue;
      }),
    };

    // Mock Logger
    loggerSpy = jest.spyOn(Logger.prototype, 'log').mockImplementation();
    jest.spyOn(Logger.prototype, 'debug').mockImplementation();
    jest.spyOn(Logger.prototype, 'error').mockImplementation();
    jest.spyOn(Logger.prototype, 'warn').mockImplementation();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AiRequestLoggerService,
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile();

    service = module.get<AiRequestLoggerService>(AiRequestLoggerService);
    configService = module.get(ConfigService);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('Constructor and Configuration', () => {
    it('should create service with default configuration when disabled', async () => {
      configService.get
        .mockReturnValueOnce(false) // enabled
        .mockReturnValueOnce('./logs/ai-requests') // logDirectory
        .mockReturnValueOnce(true) // includeResponses
        .mockReturnValueOnce(30); // retentionDays

      const module: TestingModule = await Test.createTestingModule({
        providers: [
          AiRequestLoggerService,
          { provide: ConfigService, useValue: configService },
        ],
      }).compile();

      const testService = module.get<AiRequestLoggerService>(AiRequestLoggerService);
      
      expect(testService.isEnabled()).toBe(false);
      expect(configService.get).toHaveBeenCalledWith('ai.requestLogging.enabled', false);
    });

    it('should create service with enabled configuration and setup directory', async () => {
      configService.get
        .mockReturnValueOnce(true) // enabled
        .mockReturnValueOnce(mockLogDirectory) // logDirectory
        .mockReturnValueOnce(true) // includeResponses
        .mockReturnValueOnce(30); // retentionDays

      mockFs.mkdir.mockResolvedValue(undefined);

      const module: TestingModule = await Test.createTestingModule({
        providers: [
          AiRequestLoggerService,
          { provide: ConfigService, useValue: configService },
        ],
      }).compile();

      const testService = module.get<AiRequestLoggerService>(AiRequestLoggerService);
      
      expect(testService.isEnabled()).toBe(true);
      expect(mockFs.mkdir).toHaveBeenCalledWith(mockLogDirectory, { recursive: true });
      expect(loggerSpy).toHaveBeenCalledWith(
        expect.stringContaining('AI request logging enabled')
      );
    });

    it('should handle directory creation errors gracefully', async () => {
      configService.get
        .mockReturnValueOnce(true) // enabled
        .mockReturnValueOnce(mockLogDirectory) // logDirectory
        .mockReturnValueOnce(true) // includeResponses
        .mockReturnValueOnce(30); // retentionDays

      const error = new Error('Permission denied');
      mockFs.mkdir.mockRejectedValue(error);

      const module: TestingModule = await Test.createTestingModule({
        providers: [
          AiRequestLoggerService,
          { provide: ConfigService, useValue: configService },
        ],
      }).compile();

      // Should not throw despite directory creation failure
      expect(() => module.get<AiRequestLoggerService>(AiRequestLoggerService)).not.toThrow();
    });
  });

  describe('logRequest', () => {
    beforeEach(() => {
      configService.get
        .mockReturnValueOnce(true) // enabled
        .mockReturnValueOnce(mockLogDirectory) // logDirectory
        .mockReturnValueOnce(true) // includeResponses
        .mockReturnValueOnce(30); // retentionDays

      mockFs.mkdir.mockResolvedValue(undefined);
      mockFs.writeFile.mockResolvedValue(undefined);
    });

    it('should log request when enabled', async () => {
      const request = {
        model: 'gpt-4',
        messages: [{ role: 'user', content: 'Hello' }],
        temperature: 0.7,
        max_tokens: 100,
      };

      const requestId = await service.logRequest('OpenAI Chat', request, 'custom_id_123');

      expect(requestId).toBe('custom_id_123');
      expect(mockFs.mkdir).toHaveBeenCalled(); // For date directory
      expect(mockFs.writeFile).toHaveBeenCalledWith(
        expect.stringContaining('custom_id_123.json'),
        expect.any(String),
        'utf8'
      );

      // Verify the written content contains the expected method
      const writeCall = mockFs.writeFile.mock.calls[0];
      const writtenData = JSON.parse(writeCall[1] as string);
      expect(writtenData.method).toBe('OpenAI Chat');
    });

    it('should generate request ID when not provided', async () => {
      const request = {
        model: 'gpt-4',
        messages: [{ role: 'user', content: 'Hello' }],
      };

      const requestId = await service.logRequest('OpenAI Chat', request);

      expect(requestId).toMatch(/^ai_\d+_[a-z0-9]+$/);
      expect(mockFs.writeFile).toHaveBeenCalled();
    });

    it('should sanitize request content by limiting message length', async () => {
      const longContent = 'a'.repeat(15000);
      const request = {
        model: 'gpt-4',
        messages: [{ role: 'user', content: longContent }],
      };

      await service.logRequest('OpenAI Chat', request);

      const writeCall = mockFs.writeFile.mock.calls[0];
      const writtenData = JSON.parse(writeCall[1] as string);
      
      expect(writtenData.request.messages[0].content).toHaveLength(10000);
    });

    it('should return early when logging is disabled', async () => {
      // Create a disabled config service
      const disabledConfigService = {
        get: jest.fn().mockImplementation((key: string, defaultValue: any) => {
          const config = {
            'ai.requestLogging.enabled': false,
            'ai.requestLogging.logDirectory': mockLogDirectory,
            'ai.requestLogging.includeResponses': true,
            'ai.requestLogging.retentionDays': 30,
          };
          return config[key as keyof typeof config] ?? defaultValue;
        }),
      };

      const module: TestingModule = await Test.createTestingModule({
        providers: [
          AiRequestLoggerService,
          { provide: ConfigService, useValue: disabledConfigService },
        ],
      }).compile();

      const disabledService = module.get<AiRequestLoggerService>(AiRequestLoggerService);
      
      // Clear mocks after service creation
      jest.clearAllMocks();
      
      const request = { model: 'gpt-4', messages: [] };
      const requestId = await disabledService.logRequest('OpenAI Chat', request);

      expect(mockFs.writeFile).not.toHaveBeenCalled();
      expect(requestId).toMatch(/^ai_\d+_[a-z0-9]+$/);
    });

    it('should handle logging errors gracefully', async () => {
      const error = new Error('Disk full');
      mockFs.writeFile.mockRejectedValue(error);

      const request = { model: 'gpt-4', messages: [] };
      
      // Should not throw despite logging failure
      await expect(service.logRequest('OpenAI Chat', request)).resolves.toMatch(/^ai_\d+_[a-z0-9]+$/);
    });
  });

  describe('logResponse', () => {
    beforeEach(() => {
      configService.get
        .mockReturnValueOnce(true) // enabled
        .mockReturnValueOnce(mockLogDirectory) // logDirectory
        .mockReturnValueOnce(true) // includeResponses
        .mockReturnValueOnce(30); // retentionDays

      mockFs.mkdir.mockResolvedValue(undefined);
      mockFs.writeFile.mockResolvedValue(undefined);
    });

    it('should log successful response', async () => {
      const existingLogEntry: AiRequestLogEntry = {
        id: mockRequestId,
        timestamp: new Date().toISOString(),
        method: 'OpenAI Chat',
        request: { model: 'gpt-4', messages: [] },
      };

      mockFs.readFile.mockResolvedValue(JSON.stringify(existingLogEntry));

      const response = {
        id: 'chatcmpl-123',
        model: 'gpt-4',
        choices: [{ message: { content: 'Hello!' } }],
        usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
      };

      await service.logResponse(mockRequestId, response, 1500);

      expect(mockFs.readFile).toHaveBeenCalledWith(
        expect.stringContaining(`${mockRequestId}.json`),
        'utf8'
      );

      const writeCall = mockFs.writeFile.mock.calls[0];
      const updatedEntry = JSON.parse(writeCall[1] as string);
      
      expect(updatedEntry.response).toBeDefined();
      expect(updatedEntry.duration).toBe(1500);
      expect(updatedEntry.error).toBeUndefined();
    });

    it('should log error response', async () => {
      const existingLogEntry: AiRequestLogEntry = {
        id: mockRequestId,
        timestamp: new Date().toISOString(),
        method: 'OpenAI Chat',
        request: { model: 'gpt-4', messages: [] },
      };

      mockFs.readFile.mockResolvedValue(JSON.stringify(existingLogEntry));

      const error = new Error('API rate limit exceeded');
      error.stack = 'Error: API rate limit exceeded\n    at test';

      await service.logResponse(mockRequestId, null, 800, error);

      const writeCall = mockFs.writeFile.mock.calls[0];
      const updatedEntry = JSON.parse(writeCall[1] as string);
      
      expect(updatedEntry.error).toEqual({
        message: 'API rate limit exceeded',
        stack: 'Error: API rate limit exceeded\n    at test',
      });
      expect(updatedEntry.duration).toBe(800);
      expect(updatedEntry.response).toBeUndefined();
    });

    it('should sanitize response by limiting choice content length', async () => {
      const existingLogEntry: AiRequestLogEntry = {
        id: mockRequestId,
        timestamp: new Date().toISOString(),
        method: 'OpenAI Chat',
        request: { model: 'gpt-4', messages: [] },
      };

      mockFs.readFile.mockResolvedValue(JSON.stringify(existingLogEntry));

      const longContent = 'a'.repeat(60000);
      const response = {
        id: 'chatcmpl-123',
        model: 'gpt-4',
        choices: [{ message: { content: longContent } }],
        usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
      };

      await service.logResponse(mockRequestId, response, 1500);

      const writeCall = mockFs.writeFile.mock.calls[0];
      const updatedEntry = JSON.parse(writeCall[1] as string);
      
      expect(updatedEntry.response.choices[0].message.content).toHaveLength(50000);
    });

    it('should return early when logging is disabled', async () => {
      // Create a disabled config service
      const disabledConfigService = {
        get: jest.fn().mockImplementation((key: string, defaultValue: any) => {
          const config = {
            'ai.requestLogging.enabled': false,
            'ai.requestLogging.logDirectory': mockLogDirectory,
            'ai.requestLogging.includeResponses': true,
            'ai.requestLogging.retentionDays': 30,
          };
          return config[key as keyof typeof config] ?? defaultValue;
        }),
      };

      const module: TestingModule = await Test.createTestingModule({
        providers: [
          AiRequestLoggerService,
          { provide: ConfigService, useValue: disabledConfigService },
        ],
      }).compile();

      const disabledService = module.get<AiRequestLoggerService>(AiRequestLoggerService);
      
      // Clear mocks after service creation
      jest.clearAllMocks();
      
      await disabledService.logResponse(mockRequestId, {}, 1000);

      expect(mockFs.readFile).not.toHaveBeenCalled();
      expect(mockFs.writeFile).not.toHaveBeenCalled();
    });

    it('should return early when responses are not included', async () => {
      // Create a config service with responses disabled
      const noResponseConfigService = {
        get: jest.fn().mockImplementation((key: string, defaultValue: any) => {
          const config = {
            'ai.requestLogging.enabled': true,
            'ai.requestLogging.logDirectory': mockLogDirectory,
            'ai.requestLogging.includeResponses': false,
            'ai.requestLogging.retentionDays': 30,
          };
          return config[key as keyof typeof config] ?? defaultValue;
        }),
      };

      const module: TestingModule = await Test.createTestingModule({
        providers: [
          AiRequestLoggerService,
          { provide: ConfigService, useValue: noResponseConfigService },
        ],
      }).compile();

      const noResponseService = module.get<AiRequestLoggerService>(AiRequestLoggerService);
      
      // Clear mocks after service creation
      jest.clearAllMocks();
      
      await noResponseService.logResponse(mockRequestId, {}, 1000);

      expect(mockFs.readFile).not.toHaveBeenCalled();
      expect(mockFs.writeFile).not.toHaveBeenCalled();
    });

    it('should handle missing log entry gracefully', async () => {
      mockFs.readFile.mockResolvedValue(null);

      await service.logResponse(mockRequestId, {}, 1000);

      expect(mockFs.writeFile).not.toHaveBeenCalled();
    });

    it('should handle file read errors gracefully', async () => {
      mockFs.readFile.mockRejectedValue(new Error('File not found'));

      // Should not throw despite read error
      await expect(service.logResponse(mockRequestId, {}, 1000)).resolves.toBeUndefined();
    });
  });

  describe('cleanOldLogs', () => {
    let cleanupService: AiRequestLoggerService;

    beforeEach(async () => {
      // Create a service with 7-day retention for cleanup tests
      const cleanupConfigService = {
        get: jest.fn().mockImplementation((key: string, defaultValue: any) => {
          const config = {
            'ai.requestLogging.enabled': true,
            'ai.requestLogging.logDirectory': mockLogDirectory,
            'ai.requestLogging.includeResponses': true,
            'ai.requestLogging.retentionDays': 7,
          };
          return config[key as keyof typeof config] ?? defaultValue;
        }),
      };

      const module: TestingModule = await Test.createTestingModule({
        providers: [
          AiRequestLoggerService,
          { provide: ConfigService, useValue: cleanupConfigService },
        ],
      }).compile();

      cleanupService = module.get<AiRequestLoggerService>(AiRequestLoggerService);
      
      // Reset mocks after service creation
      jest.clearAllMocks();
      mockFs.mkdir.mockResolvedValue(undefined);
    });

    it('should clean old log directories', async () => {
      const oldDate = new Date();
      oldDate.setDate(oldDate.getDate() - 10); // Older than 7-day retention
      const recentDate = new Date();
      recentDate.setDate(recentDate.getDate() - 3); // Within 7-day retention

      const mockEntries = [
        { name: oldDate.toISOString().split('T')[0], isDirectory: () => true },
        { name: recentDate.toISOString().split('T')[0], isDirectory: () => true },
        { name: 'some-file.txt', isDirectory: () => false },
      ];

      mockFs.readdir.mockResolvedValue(mockEntries as any);
      mockFs.rmdir.mockResolvedValue(undefined);

      await cleanupService.cleanOldLogs();

      expect(mockFs.readdir).toHaveBeenCalledWith(mockLogDirectory, { withFileTypes: true });
      expect(mockFs.rmdir).toHaveBeenCalledTimes(1);
      expect(mockFs.rmdir).toHaveBeenCalledWith(
        path.join(mockLogDirectory, oldDate.toISOString().split('T')[0]),
        { recursive: true }
      );
    });

    it('should return early when logging is disabled', async () => {
      // Create a disabled config service
      const disabledConfigService = {
        get: jest.fn().mockImplementation((key: string, defaultValue: any) => {
          const config = {
            'ai.requestLogging.enabled': false,
            'ai.requestLogging.logDirectory': mockLogDirectory,
            'ai.requestLogging.includeResponses': true,
            'ai.requestLogging.retentionDays': 7,
          };
          return config[key as keyof typeof config] ?? defaultValue;
        }),
      };

      const module: TestingModule = await Test.createTestingModule({
        providers: [
          AiRequestLoggerService,
          { provide: ConfigService, useValue: disabledConfigService },
        ],
      }).compile();

      const disabledService = module.get<AiRequestLoggerService>(AiRequestLoggerService);
      
      // Clear mocks after service creation
      jest.clearAllMocks();
      
      await disabledService.cleanOldLogs();

      expect(mockFs.readdir).not.toHaveBeenCalled();
    });

    it('should handle cleanup errors gracefully', async () => {
      mockFs.readdir.mockRejectedValue(new Error('Permission denied'));

      // Should not throw despite cleanup error
      await expect(cleanupService.cleanOldLogs()).resolves.toBeUndefined();
    });
  });

  describe('Utility methods', () => {
    beforeEach(() => {
      configService.get
        .mockReturnValueOnce(true) // enabled
        .mockReturnValueOnce(mockLogDirectory) // logDirectory
        .mockReturnValueOnce(true) // includeResponses
        .mockReturnValueOnce(30); // retentionDays

      mockFs.mkdir.mockResolvedValue(undefined);
    });

    it('should return correct log directory path', () => {
      const absolutePath = service.getLogDirectoryPath();
      expect(absolutePath).toContain('test-logs/ai-requests');
      expect(path.isAbsolute(absolutePath)).toBe(true);
    });

    it('should return correct enabled status', () => {
      expect(service.isEnabled()).toBe(true);
    });
  });

  describe('File path generation', () => {
    beforeEach(() => {
      configService.get
        .mockReturnValueOnce(true) // enabled
        .mockReturnValueOnce(mockLogDirectory) // logDirectory
        .mockReturnValueOnce(true) // includeResponses
        .mockReturnValueOnce(30); // retentionDays

      mockFs.mkdir.mockResolvedValue(undefined);
      mockFs.writeFile.mockResolvedValue(undefined);
    });

    it('should generate correct file path with date directory', async () => {
      const today = new Date().toISOString().split('T')[0];
      
      await service.logRequest('OpenAI Chat', { model: 'gpt-4', messages: [] }, mockRequestId);

      expect(mockFs.writeFile).toHaveBeenCalledWith(
        path.join(mockLogDirectory, today, `${mockRequestId}.json`),
        expect.any(String),
        'utf8'
      );
    });
  });
});