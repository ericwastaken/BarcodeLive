import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertScanSchema } from "@shared/schema";

export function registerRoutes(app: Express): Server {
  app.post("/api/scans", async (req, res) => {
    const result = insertScanSchema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({ error: "Invalid scan data" });
    }

    const scan = await storage.createScan(result.data);
    res.json(scan);
  });

  app.get("/api/scans/recent", async (req, res) => {
    const limit = Number(req.query.limit) || 10;
    const scans = await storage.getRecentScans(limit);
    res.json(scans);
  });

  app.post("/api/scans/clear", async (_req, res) => {
    await storage.clearScans();
    res.json({ message: "Scans cleared successfully" });
  });

  const httpServer = createServer(app);
  return httpServer;
}