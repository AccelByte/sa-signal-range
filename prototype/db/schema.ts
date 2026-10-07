import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

// Only starter-grant coordination lives here. Purchases stay in AGS Orders.
export const starterGrants = sqliteTable('starter_grants', {
  key: text('key').primaryKey(),
  amount: integer('amount').notNull(),
  status: text('status', { enum: ['pending', 'complete'] }).notNull(),
});
