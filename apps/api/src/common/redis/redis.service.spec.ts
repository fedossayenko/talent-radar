import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { Logger } from '@nestjs/common';
import { RedisService } from './redis.service';
import Redis from 'ioredis';

// Mock ioredis
jest.mock('ioredis');
const MockedRedis = Redis as jest.MockedClass<typeof Redis>;

describe('RedisService', () => {
  let service: RedisService;
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  let _configService: jest.Mocked<ConfigService>;
  let mockClient: jest.Mocked<Redis>;
  let mockPublisher: jest.Mocked<Redis>;
  let mockSubscriber: jest.Mocked<Redis>;
  let loggerSpy: jest.SpyInstance;

  beforeEach(async () => {
    // Reset all mocks
    jest.clearAllMocks();

    // Mock Logger
    loggerSpy = jest.spyOn(Logger.prototype, 'log').mockImplementation();
    jest.spyOn(Logger.prototype, 'error').mockImplementation();
    jest.spyOn(Logger.prototype, 'warn').mockImplementation();

    // Create mock Redis instances
    mockClient = {
      ping: jest.fn(),
      quit: jest.fn(),
      set: jest.fn(),
      setex: jest.fn(),
      get: jest.fn(),
      del: jest.fn(),
      exists: jest.fn(),
      expire: jest.fn(),
      mget: jest.fn(),
      mset: jest.fn(),
      incr: jest.fn(),
      incrby: jest.fn(),
      lpush: jest.fn(),
      lrange: jest.fn(),
      sadd: jest.fn(),
      smembers: jest.fn(),
      info: jest.fn(),
      flushall: jest.fn(),
    } as any;

    mockPublisher = {
      ping: jest.fn(),
      quit: jest.fn(),
      publish: jest.fn(),
    } as any;

    mockSubscriber = {
      ping: jest.fn(),
      quit: jest.fn(),
      subscribe: jest.fn(),
      on: jest.fn(),
    } as any;

    // Mock ConfigService
    const mockConfigService = {
      get: jest.fn().mockImplementation((key: string) => {
        const config = {
          'redis.host': 'localhost',
          'redis.port': 6379,
          'redis.password': 'password',
          'redis.username': 'user',
          'redis.retryDelayOnFailover': 100,
          'redis.maxRetriesPerRequest': 3,
          'redis.lazyConnect': true,
          'redis.keepAlive': 30000,
          'redis.family': 4,
          'redis.db': 0,
          'redis.keyPrefix': 'test:',
        };
        return config[key as keyof typeof config];
      }),
    };

    // Mock Redis constructor to return our mocked instances
    MockedRedis
      .mockReturnValueOnce(mockClient)
      .mockReturnValueOnce(mockPublisher)
      .mockReturnValueOnce(mockSubscriber);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RedisService,
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile();

    service = module.get<RedisService>(RedisService);
    _configService = module.get(ConfigService);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('Constructor and Configuration', () => {
    it('should create Redis clients with correct configuration', () => {
      expect(MockedRedis).toHaveBeenCalledTimes(3);
      expect(MockedRedis).toHaveBeenCalledWith({
        host: 'localhost',
        port: 6379,
        password: 'password',
        username: 'user',
        retryDelayOnFailover: 100,
        maxRetriesPerRequest: 3,
        lazyConnect: true,
        keepAlive: 30000,
        family: 4,
        db: 0,
        keyPrefix: 'test:',
      });
    });
  });

  describe('Module Lifecycle', () => {
    it('should connect successfully on module init', async () => {
      mockClient.ping.mockResolvedValue('PONG');
      mockPublisher.ping.mockResolvedValue('PONG');
      mockSubscriber.ping.mockResolvedValue('PONG');

      await service.onModuleInit();

      expect(mockClient.ping).toHaveBeenCalled();
      expect(mockPublisher.ping).toHaveBeenCalled();
      expect(mockSubscriber.ping).toHaveBeenCalled();
      expect(loggerSpy).toHaveBeenCalledWith('✅ Redis connected successfully');
    });

    it('should handle connection errors during init', async () => {
      const error = new Error('Connection failed');
      mockClient.ping.mockRejectedValue(error);

      await expect(service.onModuleInit()).rejects.toThrow('Connection failed');
      expect(Logger.prototype.error).toHaveBeenCalledWith('❌ Failed to connect to Redis:', error);
    });

    it('should disconnect gracefully on module destroy', async () => {
      mockClient.quit.mockResolvedValue('OK');
      mockPublisher.quit.mockResolvedValue('OK');
      mockSubscriber.quit.mockResolvedValue('OK');

      await service.onModuleDestroy();

      expect(mockClient.quit).toHaveBeenCalled();
      expect(mockPublisher.quit).toHaveBeenCalled();
      expect(mockSubscriber.quit).toHaveBeenCalled();
      expect(loggerSpy).toHaveBeenCalledWith('🔌 Redis disconnected');
    });

    it('should handle disconnection errors', async () => {
      const error = new Error('Disconnection failed');
      mockClient.quit.mockRejectedValue(error);

      await service.onModuleDestroy();

      expect(Logger.prototype.error).toHaveBeenCalledWith('❌ Failed to disconnect from Redis:', error);
    });
  });

  describe('Client Access Methods', () => {
    it('should return the main client', () => {
      const client = service.getClient();
      expect(client).toBe(mockClient);
    });

    it('should return the publisher client', () => {
      const publisher = service.getPublisher();
      expect(publisher).toBe(mockPublisher);
    });

    it('should return the subscriber client', () => {
      const subscriber = service.getSubscriber();
      expect(subscriber).toBe(mockSubscriber);
    });
  });

  describe('Basic Key-Value Operations', () => {
    describe('set', () => {
      it('should set string value without TTL', async () => {
        mockClient.set.mockResolvedValue('OK');

        await service.set('key1', 'value1');

        expect(mockClient.set).toHaveBeenCalledWith('key1', 'value1');
        expect(mockClient.setex).not.toHaveBeenCalled();
      });

      it('should set string value with TTL', async () => {
        mockClient.setex.mockResolvedValue('OK');

        await service.set('key1', 'value1', 3600);

        expect(mockClient.setex).toHaveBeenCalledWith('key1', 3600, 'value1');
        expect(mockClient.set).not.toHaveBeenCalled();
      });

      it('should serialize object values', async () => {
        mockClient.set.mockResolvedValue('OK');
        const objectValue = { id: 1, name: 'test' };

        await service.set('key1', objectValue);

        expect(mockClient.set).toHaveBeenCalledWith('key1', JSON.stringify(objectValue));
      });
    });

    describe('get', () => {
      it('should get and parse JSON value', async () => {
        const value = { id: 1, name: 'test' };
        mockClient.get.mockResolvedValue(JSON.stringify(value));

        const result = await service.get('key1');

        expect(mockClient.get).toHaveBeenCalledWith('key1');
        expect(result).toEqual(value);
      });

      it('should return string value when JSON parsing fails', async () => {
        mockClient.get.mockResolvedValue('plain string');

        const result = await service.get('key1');

        expect(result).toBe('plain string');
      });

      it('should return null for non-existent key', async () => {
        mockClient.get.mockResolvedValue(null);

        const result = await service.get('key1');

        expect(result).toBeNull();
      });
    });

    describe('del', () => {
      it('should delete key and return count', async () => {
        mockClient.del.mockResolvedValue(1);

        const result = await service.del('key1');

        expect(mockClient.del).toHaveBeenCalledWith('key1');
        expect(result).toBe(1);
      });
    });

    describe('exists', () => {
      it('should return true when key exists', async () => {
        mockClient.exists.mockResolvedValue(1);

        const result = await service.exists('key1');

        expect(mockClient.exists).toHaveBeenCalledWith('key1');
        expect(result).toBe(true);
      });

      it('should return false when key does not exist', async () => {
        mockClient.exists.mockResolvedValue(0);

        const result = await service.exists('key1');

        expect(result).toBe(false);
      });
    });

    describe('expire', () => {
      it('should set expiration and return true on success', async () => {
        mockClient.expire.mockResolvedValue(1);

        const result = await service.expire('key1', 3600);

        expect(mockClient.expire).toHaveBeenCalledWith('key1', 3600);
        expect(result).toBe(true);
      });

      it('should return false when key does not exist', async () => {
        mockClient.expire.mockResolvedValue(0);

        const result = await service.expire('key1', 3600);

        expect(result).toBe(false);
      });
    });
  });

  describe('Batch Operations', () => {
    describe('mget', () => {
      it('should get multiple values and parse them', async () => {
        const values = [
          JSON.stringify({ id: 1 }),
          'plain string',
          null,
        ];
        mockClient.mget.mockResolvedValue(values);

        const result = await service.mget(['key1', 'key2', 'key3']);

        expect(mockClient.mget).toHaveBeenCalledWith('key1', 'key2', 'key3');
        expect(result).toEqual([{ id: 1 }, 'plain string', null]);
      });

      it('should return empty array for empty keys', async () => {
        const result = await service.mget([]);

        expect(result).toEqual([]);
        expect(mockClient.mget).not.toHaveBeenCalled();
      });
    });

    describe('mset', () => {
      it('should set multiple key-value pairs', async () => {
        mockClient.mset.mockResolvedValue('OK');
        const keyValuePairs = {
          key1: 'value1',
          key2: { id: 2, name: 'test' },
        };

        await service.mset(keyValuePairs);

        expect(mockClient.mset).toHaveBeenCalledWith(
          'key1', 'value1',
          'key2', JSON.stringify({ id: 2, name: 'test' })
        );
      });
    });
  });

  describe('Numeric Operations', () => {
    describe('incr', () => {
      it('should increment value by 1', async () => {
        mockClient.incr.mockResolvedValue(1);

        const result = await service.incr('counter');

        expect(mockClient.incr).toHaveBeenCalledWith('counter');
        expect(result).toBe(1);
      });
    });

    describe('incrby', () => {
      it('should increment value by specified amount', async () => {
        mockClient.incrby.mockResolvedValue(15);

        const result = await service.incrby('counter', 10);

        expect(mockClient.incrby).toHaveBeenCalledWith('counter', 10);
        expect(result).toBe(15);
      });
    });
  });

  describe('List Operations', () => {
    describe('lpush', () => {
      it('should push values to list and return length', async () => {
        mockClient.lpush.mockResolvedValue(3);

        const result = await service.lpush('list1', 'item1', { id: 2 });

        expect(mockClient.lpush).toHaveBeenCalledWith('list1', 'item1', JSON.stringify({ id: 2 }));
        expect(result).toBe(3);
      });
    });

    describe('lrange', () => {
      it('should get list range and parse values', async () => {
        const values = ['item1', JSON.stringify({ id: 2 }), 'item3'];
        mockClient.lrange.mockResolvedValue(values);

        const result = await service.lrange('list1', 0, -1);

        expect(mockClient.lrange).toHaveBeenCalledWith('list1', 0, -1);
        expect(result).toEqual(['item1', { id: 2 }, 'item3']);
      });
    });
  });

  describe('Set Operations', () => {
    describe('sadd', () => {
      it('should add members to set and return count', async () => {
        mockClient.sadd.mockResolvedValue(2);

        const result = await service.sadd('set1', 'member1', { id: 2 });

        expect(mockClient.sadd).toHaveBeenCalledWith('set1', 'member1', JSON.stringify({ id: 2 }));
        expect(result).toBe(2);
      });
    });

    describe('smembers', () => {
      it('should get set members and parse them', async () => {
        const members = ['member1', JSON.stringify({ id: 2 })];
        mockClient.smembers.mockResolvedValue(members);

        const result = await service.smembers('set1');

        expect(mockClient.smembers).toHaveBeenCalledWith('set1');
        expect(result).toEqual(['member1', { id: 2 }]);
      });
    });
  });

  describe('Pub/Sub Operations', () => {
    describe('publish', () => {
      it('should publish string message', async () => {
        mockPublisher.publish.mockResolvedValue(1);

        const result = await service.publish('channel1', 'message');

        expect(mockPublisher.publish).toHaveBeenCalledWith('channel1', 'message');
        expect(result).toBe(1);
      });

      it('should serialize object message', async () => {
        mockPublisher.publish.mockResolvedValue(1);
        const message = { type: 'event', data: 'test' };

        const result = await service.publish('channel1', message);

        expect(mockPublisher.publish).toHaveBeenCalledWith('channel1', JSON.stringify(message));
        expect(result).toBe(1);
      });
    });

    describe('subscribe', () => {
      it('should subscribe to channel and handle messages', async () => {
        mockSubscriber.subscribe.mockResolvedValue(1);
        const callback = jest.fn();

        await service.subscribe('channel1', callback);

        expect(mockSubscriber.subscribe).toHaveBeenCalledWith('channel1');
        expect(mockSubscriber.on).toHaveBeenCalledWith('message', expect.any(Function));

        // Simulate receiving a message
        const messageHandler = mockSubscriber.on.mock.calls[0][1];
        messageHandler('channel1', JSON.stringify({ data: 'test' }));

        expect(callback).toHaveBeenCalledWith({ data: 'test' });
      });

      it('should handle non-JSON messages', async () => {
        mockSubscriber.subscribe.mockResolvedValue(1);
        const callback = jest.fn();

        await service.subscribe('channel1', callback);

        const messageHandler = mockSubscriber.on.mock.calls[0][1];
        messageHandler('channel1', 'plain message');

        expect(callback).toHaveBeenCalledWith('plain message');
      });

      it('should only call callback for matching channel', async () => {
        mockSubscriber.subscribe.mockResolvedValue(1);
        const callback = jest.fn();

        await service.subscribe('channel1', callback);

        const messageHandler = mockSubscriber.on.mock.calls[0][1];
        messageHandler('channel2', 'message');

        expect(callback).not.toHaveBeenCalled();
      });
    });
  });

  describe('Health and Monitoring', () => {
    describe('healthCheck', () => {
      it('should return true when Redis responds with PONG', async () => {
        mockClient.ping.mockResolvedValue('PONG');

        const result = await service.healthCheck();

        expect(mockClient.ping).toHaveBeenCalled();
        expect(result).toBe(true);
      });

      it('should return false when ping fails', async () => {
        mockClient.ping.mockRejectedValue(new Error('Connection failed'));

        const result = await service.healthCheck();

        expect(result).toBe(false);
        expect(Logger.prototype.error).toHaveBeenCalledWith(
          'Redis health check failed:',
          expect.any(Error)
        );
      });
    });

    describe('getInfo', () => {
      it('should get and parse Redis info', async () => {
        const serverInfo = '# Server\r\nredis_version:6.0.0\r\nuptime_in_seconds:1000';
        const memoryInfo = '# Memory\r\nused_memory:1024\r\nused_memory_human:1K';
        const clientsInfo = '# Clients\r\nconnected_clients:10';

        mockClient.info
          .mockResolvedValueOnce(serverInfo)
          .mockResolvedValueOnce(memoryInfo)
          .mockResolvedValueOnce(clientsInfo);

        const result = await service.getInfo();

        expect(mockClient.info).toHaveBeenCalledWith();
        expect(mockClient.info).toHaveBeenCalledWith('memory');
        expect(mockClient.info).toHaveBeenCalledWith('clients');

        expect(result).toMatchObject({
          server: {
            redis_version: '6.0.0',
            uptime_in_seconds: 1000,
          },
          memory: {
            used_memory: 1024,
            used_memory_human: '1K',
          },
          clients: {
            connected_clients: 10,
          },
          timestamp: expect.any(String),
        });
      });

      it('should handle info parsing errors', async () => {
        mockClient.info.mockRejectedValue(new Error('Info failed'));

        await expect(service.getInfo()).rejects.toThrow('Info failed');
        expect(Logger.prototype.error).toHaveBeenCalledWith(
          'Failed to get Redis info:',
          expect.any(Error)
        );
      });
    });
  });

  describe('Utility Operations', () => {
    describe('flushall', () => {
      it('should clear all data and log warning', async () => {
        mockClient.flushall.mockResolvedValue('OK');

        await service.flushall();

        expect(mockClient.flushall).toHaveBeenCalled();
        expect(Logger.prototype.warn).toHaveBeenCalledWith('🗑️ Redis database cleared');
      });
    });
  });

  describe('Private Helper Methods', () => {
    it('should parse Redis info correctly', () => {
      const info = '# Server\r\nredis_version:6.0.0\r\nuptime_in_seconds:1000\r\n# Comment line\r\n:invalid_line\r\nstring_value:test';
      
      // Access private method through any cast
      const result = (service as any).parseRedisInfo(info);

      expect(result).toEqual({
        redis_version: '6.0.0',
        uptime_in_seconds: 1000,
        string_value: 'test',
      });
    });

    it('should handle numeric and string values in Redis info', () => {
      const info = 'numeric_field:123\r\nstring_field:test_string\r\nfloat_field:123.45';
      
      const result = (service as any).parseRedisInfo(info);

      expect(result).toEqual({
        numeric_field: 123,
        string_field: 'test_string',
        float_field: 123.45,
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle Redis operation errors gracefully', async () => {
      mockClient.get.mockRejectedValue(new Error('Redis operation failed'));

      await expect(service.get('key1')).rejects.toThrow('Redis operation failed');
    });

    it('should handle serialization edge cases', async () => {
      mockClient.set.mockResolvedValue('OK');

      // Test with undefined value (JSON.stringify(undefined) returns undefined)
      await service.set('key1', undefined);
      expect(mockClient.set).toHaveBeenCalledWith('key1', undefined);

      // Test with null value
      await service.set('key2', null);
      expect(mockClient.set).toHaveBeenCalledWith('key2', 'null');

      // Test with circular object (should be handled by JSON.stringify)
      const circular: any = { name: 'test' };
      circular.self = circular;
      
      expect(() => {
        JSON.stringify(circular);
      }).toThrow();
      
      // The service should handle this gracefully by letting JSON.stringify throw
      await expect(service.set('key3', circular)).rejects.toThrow();
    });
  });
});