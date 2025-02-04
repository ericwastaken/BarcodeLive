import { scans, type Scan, type InsertScan } from "@shared/schema";

export interface IStorage {
  createScan(scan: InsertScan): Promise<Scan>;
  getRecentScans(limit: number): Promise<Scan[]>;
}

export class MemStorage implements IStorage {
  private scans: Map<number, Scan>;
  private currentId: number;

  constructor() {
    this.scans = new Map();
    this.currentId = 1;
  }

  async createScan(insertScan: InsertScan): Promise<Scan> {
    const id = this.currentId++;
    const scan: Scan = {
      ...insertScan,
      id,
      timestamp: new Date(),
    };
    this.scans.set(id, scan);
    return scan;
  }

  async getRecentScans(limit: number): Promise<Scan[]> {
    return Array.from(this.scans.values())
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, limit);
  }
}

export const storage = new MemStorage();
