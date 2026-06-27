import { open } from '@op-engineering/op-sqlite';
import { drizzle } from 'drizzle-orm/op-sqlite';
import * as schema from './schema';

const opsqlite = open({
  name: 'litnotes.sqlite',
});

export const db = drizzle(opsqlite, { schema });

export const initDb = async () => {
  // Manual FTS5 table creation
  try {
    opsqlite.execute(`
      CREATE VIRTUAL TABLE IF NOT EXISTS search_fts USING fts5(
        document_id UNINDEXED,
        page_index UNINDEXED,
        source UNINDEXED,
        card_id UNINDEXED,
        content,
        tokenize='unicode61'
      );
    `);
    console.log('FTS5 table initialized');
  } catch (error) {
    console.error('Failed to initialize FTS5 table:', error);
  }
};
