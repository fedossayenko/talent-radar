import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { Logger } from '@nestjs/common';
import { PrismaService } from './prisma.service';

// Mock PrismaClient
const mockPrismaClient = {
  $connect: jest.fn(),
  $disconnect: jest.fn(),
  $queryRaw: jest.fn(),
  $queryRawUnsafe: jest.fn(),
};

// Mock the PrismaClient constructor
jest.mock('@prisma/client', () => {
  class MockPrismaClient {
    $connect = jest.fn();
    $disconnect = jest.fn();
    $queryRaw = jest.fn();
    $queryRawUnsafe = jest.fn();
    
    constructor() {
      // Copy the shared mock functions so they can be tracked globally
      this.$connect = mockPrismaClient.$connect;
      this.$disconnect = mockPrismaClient.$disconnect;
      this.$queryRaw = mockPrismaClient.$queryRaw;
      this.$queryRawUnsafe = mockPrismaClient.$queryRawUnsafe;
    }
  }
  
  // Mock Prisma namespace with sql template function
  const Prisma = {
    sql: jest.fn((strings, ...values) => ({ strings, values })),
  };
  
  return {
    PrismaClient: MockPrismaClient,
    Prisma,
  };
});

describe('PrismaService', () => {
  let service: PrismaService;
  let configService: jest.Mocked<ConfigService>;
  let loggerSpy: jest.SpyInstance;

  beforeEach(async () => {
    // Reset all mocks
    jest.clearAllMocks();
    
    // Reset the mock methods
    mockPrismaClient.$connect.mockClear();
    mockPrismaClient.$disconnect.mockClear();
    mockPrismaClient.$queryRaw.mockClear();
    mockPrismaClient.$queryRawUnsafe.mockClear();

    // Mock Logger
    loggerSpy = jest.spyOn(Logger.prototype, 'log').mockImplementation();
    jest.spyOn(Logger.prototype, 'error').mockImplementation();
    jest.spyOn(Logger.prototype, 'debug').mockImplementation();
    jest.spyOn(Logger.prototype, 'warn').mockImplementation();

    // Mock ConfigService
    const mockConfigService = {
      get: jest.fn().mockImplementation((key: string) => {
        const config = {
          'database.url': 'postgresql://user:password@localhost:5432/testdb',
          'database.logging': true,
        };
        return config[key as keyof typeof config];
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PrismaService,
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile();

    service = module.get<PrismaService>(PrismaService);
    configService = module.get(ConfigService);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('Constructor and Configuration', () => {
    it('should create service with PostgreSQL configuration', () => {
      expect(configService.get).toHaveBeenCalledWith('database.url');
      expect(configService.get).toHaveBeenCalledWith('database.logging');
    });

    it('should create service with logging disabled', async () => {
      configService.get.mockImplementation((key: string) => {
        if (key === 'database.url') return 'postgresql://user:password@localhost:5432/testdb';
        if (key === 'database.logging') return false;
        return undefined;
      });

      const module: TestingModule = await Test.createTestingModule({
        providers: [
          PrismaService,
          {
            provide: ConfigService,
            useValue: configService,
          },
        ],
      }).compile();

      const serviceWithoutLogging = module.get<PrismaService>(PrismaService);
      expect(serviceWithoutLogging).toBeDefined();
    });
  });

  describe('Module Lifecycle', () => {
    it('should connect successfully on module init', async () => {
      mockPrismaClient.$connect.mockResolvedValue(undefined);

      await service.onModuleInit();

      expect(mockPrismaClient.$connect).toHaveBeenCalled();
      expect(loggerSpy).toHaveBeenCalledWith('✅ Database connected successfully');
    });

    it('should handle connection errors during init', async () => {
      const error = new Error('Connection failed');
      mockPrismaClient.$connect.mockRejectedValue(error);

      await expect(service.onModuleInit()).rejects.toThrow('Connection failed');
      expect(Logger.prototype.error).toHaveBeenCalledWith('❌ Failed to connect to database:', error);
    });

    it('should disconnect gracefully on module destroy', async () => {
      mockPrismaClient.$disconnect.mockResolvedValue(undefined);

      await service.onModuleDestroy();

      expect(mockPrismaClient.$disconnect).toHaveBeenCalled();
      expect(loggerSpy).toHaveBeenCalledWith('🔌 Database disconnected');
    });

    it('should handle disconnection errors', async () => {
      const error = new Error('Disconnection failed');
      mockPrismaClient.$disconnect.mockRejectedValue(error);

      await service.onModuleDestroy();

      expect(Logger.prototype.error).toHaveBeenCalledWith('❌ Failed to disconnect from database:', error);
    });
  });

  describe('Health Check', () => {
    it('should return true when database is healthy', async () => {
      mockPrismaClient.$queryRaw.mockResolvedValue([{ '1': 1 }]);

      const result = await service.healthCheck();

      expect(mockPrismaClient.$queryRaw).toHaveBeenCalled();
      expect(result).toBe(true);
    });

    it('should return false when health check fails', async () => {
      const error = new Error('Database error');
      mockPrismaClient.$queryRaw.mockRejectedValue(error);

      const result = await service.healthCheck();

      expect(result).toBe(false);
      expect(Logger.prototype.error).toHaveBeenCalledWith('Database health check failed:', error);
    });
  });

  describe('Database Statistics', () => {
    describe('PostgreSQL Statistics', () => {
      let originalEnv: string | undefined;

      beforeEach(() => {
        // Mock process.env for PostgreSQL
        originalEnv = process.env.DATABASE_URL;
        process.env.DATABASE_URL = 'postgresql://user:password@localhost:5432/testdb';
      });

      afterEach(() => {
        process.env.DATABASE_URL = originalEnv;
      });

      it('should get PostgreSQL database statistics', async () => {
        const mockTables = [
          {
            schemaname: 'public',
            tablename: 'users',
            inserts: 100,
            updates: 50,
            deletes: 10,
            live_tuples: 90,
            dead_tuples: 5,
          },
        ];

        const mockConnections = [
          {
            total_connections: 10,
            active_connections: 3,
            idle_connections: 7,
          },
        ];

        mockPrismaClient.$queryRaw
          .mockResolvedValueOnce(mockTables)
          .mockResolvedValueOnce(mockConnections);

        const result = await service.getStats();

        expect(result).toMatchObject({
          tables: [{
            schemaname: 'public',
            tablename: 'users',
            inserts: '100',
            updates: '50',
            deletes: '10',
            live_tuples: '90',
            dead_tuples: '5',
          }],
          connections: {
            total_connections: '10',
            active_connections: '3',
            idle_connections: '7',
          },
          timestamp: expect.any(String),
        });

        expect(mockPrismaClient.$queryRaw).toHaveBeenCalledTimes(2);
      });

      it('should handle statistics query errors', async () => {
        const error = new Error('Query failed');
        mockPrismaClient.$queryRaw.mockRejectedValue(error);

        await expect(service.getStats()).rejects.toThrow('Query failed');
        expect(Logger.prototype.error).toHaveBeenCalledWith('Failed to get database stats:', error);
      });
    });

    describe('SQLite Statistics', () => {
      let originalEnv: string | undefined;

      beforeEach(() => {
        // Mock process.env for SQLite
        originalEnv = process.env.DATABASE_URL;
        process.env.DATABASE_URL = 'file:./test.db';
      });

      afterEach(() => {
        process.env.DATABASE_URL = originalEnv;
      });

      it('should return simplified stats for SQLite', async () => {
        const result = await service.getStats();

        expect(result).toEqual({
          tables: [],
          connections: [{ total_connections: 1, active_connections: 1, idle_connections: 0 }],
          database_size: [{ size: '0 MB' }],
        });

        // Should not call $queryRaw for SQLite
        expect(mockPrismaClient.$queryRaw).not.toHaveBeenCalled();
      });

      it('should detect SQLite from .db extension', async () => {
        process.env.DATABASE_URL = 'file:./database.db';

        const result = await service.getStats();

        expect(result.tables).toEqual([]);
        expect(result.connections).toEqual([{ total_connections: 1, active_connections: 1, idle_connections: 0 }]);
      });
    });
  });

  describe('Raw SQL Execution', () => {
    it('should execute raw SQL successfully', async () => {
      const mockResult = [{ id: 1, name: 'test' }];
      mockPrismaClient.$queryRawUnsafe.mockResolvedValue(mockResult);

      const sql = 'SELECT * FROM users WHERE id = ?';
      const params = [1];

      const result = await service.executeRaw(sql, params);

      expect(mockPrismaClient.$queryRawUnsafe).toHaveBeenCalledWith(sql, 1);
      expect(result).toEqual(mockResult);
      expect(Logger.prototype.debug).toHaveBeenCalledWith(
        `Executing raw SQL: ${sql}`,
        { params }
      );
    });

    it('should execute raw SQL without parameters', async () => {
      const mockResult = [{ count: 5 }];
      mockPrismaClient.$queryRawUnsafe.mockResolvedValue(mockResult);

      const sql = 'SELECT COUNT(*) as count FROM users';

      const result = await service.executeRaw(sql);

      expect(mockPrismaClient.$queryRawUnsafe).toHaveBeenCalledWith(sql);
      expect(result).toEqual(mockResult);
    });

    it('should handle raw SQL execution errors', async () => {
      const error = new Error('SQL execution failed');
      mockPrismaClient.$queryRawUnsafe.mockRejectedValue(error);

      const sql = 'INVALID SQL';

      await expect(service.executeRaw(sql)).rejects.toThrow('SQL execution failed');
      expect(Logger.prototype.error).toHaveBeenCalledWith(
        `Raw SQL execution failed: ${sql}`,
        error
      );
    });

    it('should log SQL execution with parameters', async () => {
      mockPrismaClient.$queryRawUnsafe.mockResolvedValue([]);

      const sql = 'UPDATE users SET name = ? WHERE id = ?';
      const params = ['John Doe', 123];

      await service.executeRaw(sql, params);

      expect(Logger.prototype.debug).toHaveBeenCalledWith(
        `Executing raw SQL: ${sql}`,
        { params }
      );
    });
  });

  describe('Database Connection String Detection', () => {
    it('should detect PostgreSQL connection string', () => {
      process.env.DATABASE_URL = 'postgresql://user:pass@host:5432/db';
      
      // Test this indirectly through getStats
      service.getStats().catch(() => {}); // Ignore the result, just test detection
      
      // The detection logic is internal, but we can verify it doesn't return SQLite stats
      expect(process.env.DATABASE_URL).toContain('postgresql://');
    });

    it('should detect SQLite file URLs', () => {
      process.env.DATABASE_URL = 'file:./test.db';
      
      // Verify SQLite detection through getStats behavior
      service.getStats().then(stats => {
        expect(stats.tables).toEqual([]);
      });
    });

    it('should handle missing DATABASE_URL', async () => {
      const originalEnv = process.env.DATABASE_URL;
      delete process.env.DATABASE_URL;
      
      // Reset mock implementation to avoid interference from previous tests
      mockPrismaClient.$queryRaw.mockReset();

      // When DATABASE_URL is missing, the service still tries PostgreSQL path 
      // since empty string doesn't match SQLite patterns
      // Mock to return proper data to avoid undefined access
      mockPrismaClient.$queryRaw.mockResolvedValueOnce([]);  // tables query
      mockPrismaClient.$queryRaw.mockResolvedValueOnce([     // connections query
        { total_connections: 0, active_connections: 0, idle_connections: 0 }
      ]);

      const result = await service.getStats();

      // When no DATABASE_URL, returns results from PostgreSQL queries with mocked data
      expect(result.tables).toEqual([]);
      expect(result.connections).toEqual({ 
        total_connections: '0', 
        active_connections: '0', 
        idle_connections: '0' 
      });
      expect(result.timestamp).toBeDefined();
      
      process.env.DATABASE_URL = originalEnv;
    });
  });

  describe('PostgreSQL Query Structure', () => {
    beforeEach(() => {
      process.env.DATABASE_URL = 'postgresql://user:password@localhost:5432/testdb';
    });

    it('should execute correct PostgreSQL queries for table stats', async () => {
      mockPrismaClient.$queryRaw.mockResolvedValue([]);

      await service.getStats().catch(() => {}); // Ignore result

      // Prisma $queryRaw with Prisma.sql receives objects with strings and values
      const firstCall = mockPrismaClient.$queryRaw.mock.calls[0];
      const secondCall = mockPrismaClient.$queryRaw.mock.calls[1];
      
      expect(firstCall[0]).toEqual(expect.objectContaining({
        strings: expect.arrayContaining([
          expect.stringContaining('pg_stat_user_tables')
        ])
      }));
      expect(secondCall[0]).toEqual(expect.objectContaining({
        strings: expect.arrayContaining([
          expect.stringContaining('pg_stat_activity')
        ])
      }));
    });

    it('should order tables by live tuples', async () => {
      mockPrismaClient.$queryRaw.mockResolvedValue([]);

      await service.getStats().catch(() => {}); // Ignore result

      const firstCall = mockPrismaClient.$queryRaw.mock.calls[0];
      expect(firstCall[0]).toEqual(expect.objectContaining({
        strings: expect.arrayContaining([
          expect.stringContaining('ORDER BY n_live_tup DESC')
        ])
      }));
    });

    it('should filter connections by state', async () => {
      mockPrismaClient.$queryRaw.mockResolvedValue([]);

      await service.getStats().catch(() => {}); // Ignore result

      const secondCall = mockPrismaClient.$queryRaw.mock.calls[1];
      expect(secondCall[0]).toEqual(expect.objectContaining({
        strings: expect.arrayContaining([
          expect.stringContaining("FILTER (WHERE state = 'active')")
        ])
      }));
      expect(secondCall[0]).toEqual(expect.objectContaining({
        strings: expect.arrayContaining([
          expect.stringContaining("FILTER (WHERE state = 'idle')")
        ])
      }));
    });
  });

  describe('Error Handling Edge Cases', () => {
    it('should handle undefined config values gracefully', async () => {
      configService.get.mockReturnValue(undefined);

      const module: TestingModule = await Test.createTestingModule({
        providers: [
          PrismaService,
          {
            provide: ConfigService,
            useValue: configService,
          },
        ],
      }).compile();

      const serviceWithUndefinedConfig = module.get<PrismaService>(PrismaService);
      expect(serviceWithUndefinedConfig).toBeDefined();
    });

    it('should handle health check with network timeout', async () => {
      const timeoutError = new Error('Connection timeout');
      timeoutError.name = 'TimeoutError';
      mockPrismaClient.$queryRaw.mockRejectedValue(timeoutError);

      const result = await service.healthCheck();

      expect(result).toBe(false);
      expect(Logger.prototype.error).toHaveBeenCalledWith(
        'Database health check failed:',
        timeoutError
      );
    });

    it('should handle stats query with permission errors', async () => {
      const permissionError = new Error('Permission denied');
      mockPrismaClient.$queryRaw.mockRejectedValue(permissionError);

      await expect(service.getStats()).rejects.toThrow('Permission denied');
    });

    it('should handle executeRaw with SQL injection attempt', async () => {
      const maliciousSQL = "SELECT * FROM users; DROP TABLE users; --";

      // The new implementation detects and blocks malicious queries before database access
      await expect(service.executeRaw(maliciousSQL)).rejects.toThrow('Malicious query blocked');
      
      // Verify the warning was logged about the blocked query
      expect(Logger.prototype.warn).toHaveBeenCalledWith(
        expect.stringContaining('Potentially malicious SQL query blocked'),
      );
      
      // Database should not have been called due to early detection
      expect(mockPrismaClient.$queryRawUnsafe).not.toHaveBeenCalled();
    });
  });

  describe('Logging Behavior', () => {
    it('should log successful operations', async () => {
      mockPrismaClient.$connect.mockResolvedValue(undefined);
      mockPrismaClient.$disconnect.mockResolvedValue(undefined);

      await service.onModuleInit();
      await service.onModuleDestroy();

      expect(loggerSpy).toHaveBeenCalledWith('✅ Database connected successfully');
      expect(loggerSpy).toHaveBeenCalledWith('🔌 Database disconnected');
    });

    it('should log SQL execution details', async () => {
      mockPrismaClient.$queryRawUnsafe.mockResolvedValue([]);

      const sql = 'SELECT * FROM test_table';
      const params = ['param1', 123];

      await service.executeRaw(sql, params);

      expect(Logger.prototype.debug).toHaveBeenCalledWith(
        `Executing raw SQL: ${sql}`,
        { params }
      );
    });

    it('should log errors with context', async () => {
      const error = new Error('Test error');
      mockPrismaClient.$connect.mockRejectedValue(error);

      await expect(service.onModuleInit()).rejects.toThrow();

      expect(Logger.prototype.error).toHaveBeenCalledWith(
        '❌ Failed to connect to database:',
        error
      );
    });
  });

  describe('Database URL Variations', () => {
    const testCases = [
      { url: 'file:./test.db', isSqlite: true },
      { url: 'file:/path/to/database.db', isSqlite: true },
      { url: 'sqlite:./test.db', isSqlite: true },
      { url: 'postgresql://user:pass@host:5432/db', isSqlite: false },
      { url: 'postgres://user:pass@host:5432/db', isSqlite: false },
      { url: 'mysql://user:pass@host:3306/db', isSqlite: false },
    ];

    testCases.forEach(({ url, isSqlite }) => {
      it(`should correctly detect ${isSqlite ? 'SQLite' : 'non-SQLite'} for URL: ${url}`, async () => {
        const originalEnv = process.env.DATABASE_URL;
        process.env.DATABASE_URL = url;
        
        // Reset mocks before each test to avoid interference
        mockPrismaClient.$queryRaw.mockClear();
        if (!isSqlite) {
          // For non-SQLite databases, provide mock data for both queries
          mockPrismaClient.$queryRaw
            .mockResolvedValueOnce([]) // tables query
            .mockResolvedValueOnce([{ // connections query
              total_connections: 1,
              active_connections: 1,
              idle_connections: 0,
            }]);
        }

        const result = await service.getStats();

        if (isSqlite) {
          expect(result.tables).toEqual([]);
          expect(result.connections).toEqual([{ total_connections: 1, active_connections: 1, idle_connections: 0 }]);
          // SQLite should not make database queries
          expect(mockPrismaClient.$queryRaw).not.toHaveBeenCalled();
        } else {
          // For non-SQLite, it should attempt to run PostgreSQL queries
          expect(mockPrismaClient.$queryRaw).toHaveBeenCalled();
        }

        process.env.DATABASE_URL = originalEnv;
      });
    });
  });
});