import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaClient } from '@prisma/client';

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

      const tables = await this.$queryRaw`
        SELECT 
          schemaname,
          tablename,
          n_tup_ins as inserts,
          n_tup_upd as updates,
          n_tup_del as deletes,
          n_live_tup as live_tuples,
          n_dead_tup as dead_tuples
        FROM pg_stat_user_tables
        ORDER BY n_live_tup DESC;
      `;

      const connections = await this.$queryRaw`
        SELECT 
          count(*) as total_connections,
          count(*) FILTER (WHERE state = 'active') as active_connections,
          count(*) FILTER (WHERE state = 'idle') as idle_connections
        FROM pg_stat_activity;
      `;

      return {
        tables,
        connections: connections[0],
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