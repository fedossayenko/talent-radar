import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaClient, Prisma } from '@prisma/client';

// Types for database statistics queries
interface TableStatsRow {
  schemaname: string;
  tablename: string;
  inserts: bigint;
  updates: bigint;
  deletes: bigint;
  live_tuples: bigint;
  dead_tuples: bigint;
}

interface ConnectionStatsRow {
  total_connections: bigint;
  active_connections: bigint;
  idle_connections: bigint;
}

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  constructor(private configService: ConfigService) {
    const databaseUrl = configService.get<string>('database.url');
    const logging = configService.get<boolean>('database.logging');
    
    super({
      datasources: {
        db: {
          url: databaseUrl,
        },
      },
      log: logging ? ['query', 'info', 'warn', 'error'] : ['warn', 'error'],
      errorFormat: 'pretty',
    });
  }

  async onModuleInit() {
    try {
      await this.$connect();
      this.logger.log('✅ Database connected successfully');
    } catch (error) {
      this.logger.error('❌ Failed to connect to database:', error);
      throw error;
    }
  }

  async onModuleDestroy() {
    try {
      await this.$disconnect();
      this.logger.log('🔌 Database disconnected');
    } catch (error) {
      this.logger.error('❌ Failed to disconnect from database:', error);
    }
  }

  /**
   * Health check for database connection
   */
  async healthCheck(): Promise<boolean> {
    try {
      await this.$queryRaw`SELECT 1`;
      return true;
    } catch (error) {
      this.logger.error('Database health check failed:', error);
      return false;
    }
  }

  /**
   * Get database statistics
   */
  async getStats() {
    try {
      // Detect database provider from connection string
      const databaseUrl = process.env.DATABASE_URL || '';
      const isSqlite = databaseUrl.includes('file:') || databaseUrl.includes('.db');
      
      if (isSqlite) {
        // SQLite simplified stats
        return {
          tables: [],
          connections: [{ total_connections: 1, active_connections: 1, idle_connections: 0 }],
          database_size: [{ size: '0 MB' }]
        };
      }

      const tables = await this.$queryRaw<TableStatsRow[]>(Prisma.sql`
        SELECT 
          schemaname,
          relname as tablename,
          n_tup_ins as inserts,
          n_tup_upd as updates,
          n_tup_del as deletes,
          n_live_tup as live_tuples,
          n_dead_tup as dead_tuples
        FROM pg_stat_user_tables
        ORDER BY n_live_tup DESC;
      `);

      const connections = await this.$queryRaw<ConnectionStatsRow[]>(Prisma.sql`
        SELECT 
          count(*) as total_connections,
          count(*) FILTER (WHERE state = 'active') as active_connections,
          count(*) FILTER (WHERE state = 'idle') as idle_connections
        FROM pg_stat_activity;
      `);

      // Convert BigInt values to strings for JSON serialization
      const sanitizedTables = tables.map(table => ({
        ...table,
        inserts: table.inserts?.toString(),
        updates: table.updates?.toString(),
        deletes: table.deletes?.toString(),
        live_tuples: table.live_tuples?.toString(),
        dead_tuples: table.dead_tuples?.toString(),
      }));

      const sanitizedConnections = {
        ...connections[0],
        total_connections: connections[0].total_connections?.toString(),
        active_connections: connections[0].active_connections?.toString(),
        idle_connections: connections[0].idle_connections?.toString(),
      };

      return {
        tables: sanitizedTables,
        connections: sanitizedConnections,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error('Failed to get database stats:', error);
      throw error;
    }
  }

  /**
   * Execute raw SQL with logging - Uses parameterized queries for security
   * @deprecated Use $queryRaw with template literals instead for better type safety
   */
  async executeRaw(sql: string, params?: any[]): Promise<any> {
    // Block obviously dangerous SQL patterns
    const dangerousPatterns = [
      /;\s*(drop|delete|truncate|alter|create|insert|update)\s+/i,
      /union\s+(all\s+)?select/i,
      /--[^\r\n]*/,
      /\/\*[\s\S]*?\*\//
    ];

    for (const pattern of dangerousPatterns) {
      if (pattern.test(sql)) {
        this.logger.warn(`Potentially malicious SQL query blocked: ${sql}`);
        throw new Error('Malicious query blocked');
      }
    }

    try {
      this.logger.debug(`Executing raw SQL: ${sql}`, { params });
      // Note: Still using $queryRawUnsafe but with validation - should migrate to $queryRaw template literals
      return await this.$queryRawUnsafe(sql, ...(params || []));
    } catch (error) {
      this.logger.error(`Raw SQL execution failed: ${sql}`, error);
      throw error;
    }
  }
}