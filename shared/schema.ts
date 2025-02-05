import { pgTable, text, serial, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const scans = pgTable("scans", {
  id: serial("id").primaryKey(),
  content: text("content").notNull(),
  format: text("format").notNull(),
  pattern: text("pattern").notNull(),
  timestamp: timestamp("timestamp").defaultNow().notNull(),
});

export const insertScanSchema = createInsertSchema(scans).pick({
  content: true,
  format: true,
});

export type InsertScan = z.infer<typeof insertScanSchema>;
export type Scan = typeof scans.$inferSelect;
