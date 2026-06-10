import { PrismaClient } from '@prisma/client';
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';
import { app } from 'electron';
import { join } from 'path';
import { runMigrations } from './migrate';

class PrismaService {
  private client: PrismaClient | null = null;

  private getDatabasePath(): string {
    if (app.isPackaged) {
      return join(app.getPath('userData'), 'data.db');
    }
    return join(__dirname, '../../../dev.db');
  }

  get db(): PrismaClient {
    if (!this.client) {
      throw new Error('PrismaService not initialized. Call connect() first.');
    }
    return this.client;
  }

  async connect(): Promise<void> {
    if (this.client) return;
    
    const dbPath = this.getDatabasePath();
    console.log('Database path:', dbPath);
    
    // Run migrations first
    runMigrations(dbPath);
    
    // Create Prisma adapter
    const adapter = new PrismaBetterSqlite3({
      url: `file:${dbPath}`
    });
    
    // Create Prisma client
    this.client = new PrismaClient({ adapter });
    await this.client.$connect();
    
    console.log('✓ Database connected');
  }

  async disconnect(): Promise<void> {
    if (this.client) {
      await this.client.$disconnect();
      this.client = null;
      console.log('✓ Database disconnected');
    }
  }
}

export const prismaService = new PrismaService();
