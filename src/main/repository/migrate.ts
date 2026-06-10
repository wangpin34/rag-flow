import Database from 'better-sqlite3';
import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';

/**
 * Run all pending migrations on the database
 * This is necessary for packaged apps where prisma migrate doesn't work
 */
export function runMigrations(dbPath: string): void {
  const db = new Database(dbPath);
  
  try {
    // Create migrations table if it doesn't exist
    db.exec(`
      CREATE TABLE IF NOT EXISTS _prisma_migrations (
        id TEXT PRIMARY KEY,
        checksum TEXT NOT NULL,
        finished_at DATETIME,
        migration_name TEXT NOT NULL,
        logs TEXT,
        rolled_back_at DATETIME,
        started_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        applied_steps_count INTEGER NOT NULL DEFAULT 0
      );
    `);

    // Get all migration files
    const migrationsPath = join(__dirname, '../../prisma/migrations');
    let migrationDirs: string[] = [];
    
    try {
      migrationDirs = readdirSync(migrationsPath, { withFileTypes: true })
        .filter(dirent => dirent.isDirectory())
        .map(dirent => dirent.name)
        .sort();
    } catch (error) {
      // No migrations directory, skip
      console.log('No migrations directory found');
      return;
    }

    // Get already applied migrations
    const appliedMigrations = db.prepare(
      'SELECT migration_name FROM _prisma_migrations WHERE finished_at IS NOT NULL'
    ).all() as Array<{ migration_name: string }>;
    
    const appliedSet = new Set(appliedMigrations.map(m => m.migration_name));

    // Apply pending migrations
    for (const migrationDir of migrationDirs) {
      if (appliedSet.has(migrationDir)) {
        continue; // Skip already applied migrations
      }

      const migrationFile = join(migrationsPath, migrationDir, 'migration.sql');
      
      try {
        const sql = readFileSync(migrationFile, 'utf8');
        
        // Start transaction
        db.exec('BEGIN');
        
        try {
          // Execute migration
          db.exec(sql);
          
          // Record migration
          db.prepare(`
            INSERT INTO _prisma_migrations (id, checksum, migration_name, finished_at, applied_steps_count)
            VALUES (?, ?, ?, datetime('now'), 1)
          `).run(
            migrationDir,
            '', // Checksum not needed for this implementation
            migrationDir
          );
          
          db.exec('COMMIT');
          console.log(`✓ Applied migration: ${migrationDir}`);
        } catch (error) {
          db.exec('ROLLBACK');
          throw error;
        }
      } catch (error) {
        console.error(`✗ Failed to apply migration ${migrationDir}:`, error);
        throw error;
      }
    }
  } finally {
    db.close();
  }
}
