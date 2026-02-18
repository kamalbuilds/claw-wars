import express from "express";
import cors from "cors";
import http from "node:http";
import { config } from "./config.js";
import { router } from "./api/routes.js";
import { createWebSocketServer, getConnectedClients } from "./ws/server.js";
import { gameManager } from "./game/GameManager.js";
import { logger } from "./utils/logger.js";
import { initDb, closeDb } from "./persistence/db.js";

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Request logging
app.use((req, _res, next) => {
  if (req.path !== "/api/health") {
    logger.debug(`${req.method} ${req.path}`);
  }
  next();
});

// Mount API routes
app.use(router);

// 404 handler
app.use((_req, res) => {
  res.status(404).json({ error: "Not found" });
});

// Error handler
app.use(
  (
    err: Error,
    _req: express.Request,
    res: express.Response,
    _next: express.NextFunction
  ) => {
    logger.error("Unhandled error", err);
    res.status(500).json({ error: "Internal server error" });
  }
);

// Create HTTP server (shared for Express + WebSocket)
const server = http.createServer(app);

// Attach WebSocket server
const wss = createWebSocketServer(server);

// Initialize database and start server
async function start(): Promise<void> {
  // Initialize PostgreSQL (graceful — falls back to memory-only if unavailable)
  await initDb();
  await gameManager.initialize();

  server.listen(config.server.port, () => {
    logger.info(`Claw Wars Engine started`);
    logger.info(`  HTTP API: http://localhost:${config.server.port}`);
    logger.info(`  WebSocket: ws://localhost:${config.server.port}`);
    logger.info(`  Monad RPC: ${config.monad.rpcUrl}`);
    logger.info(`  Chain ID: ${config.monad.chainId}`);

    if (config.database.url) {
      logger.info("  Database: PostgreSQL connected");
    } else {
      logger.warn("  Database: Not configured (memory-only mode)");
    }

    if (config.contracts.game) {
      logger.info(`  Game Contract: ${config.contracts.game}`);
    } else {
      logger.warn("  Game contract not configured (off-chain mode)");
    }

    if (config.contracts.betting) {
      logger.info(`  Betting Contract: ${config.contracts.betting}`);
    }

    if (config.contracts.leaderboard) {
      logger.info(`  Leaderboard Contract: ${config.contracts.leaderboard}`);
    }

    if (config.moltbook.apiKey) {
      logger.info("  Moltbook: Connected");
    } else {
      logger.warn("  Moltbook: Not configured");
    }
  });
}

start().catch((err) => {
  logger.error("Failed to start engine", err);
  process.exit(1);
});

// Graceful shutdown
const shutdown = async () => {
  logger.info("Shutting down...");

  wss.close(() => {
    logger.info("WebSocket server closed");
  });

  server.close(async () => {
    await closeDb();
    logger.info("HTTP server closed");
    process.exit(0);
  });

  // Force exit after 10 seconds
  setTimeout(() => {
    logger.error("Forced shutdown after timeout");
    process.exit(1);
  }, 10000);
};

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

export { app, server };
