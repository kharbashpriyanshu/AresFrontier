import express, { Request, Response, NextFunction } from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import dotenv from "dotenv";
import { apiRouter } from "./routes/api.js";
import { APIResponse } from "./types/index.js";

dotenv.config();

export const app = express();
const port = process.env.PORT || 5000;

// Security & Middleware
app.use(helmet());
app.use(
  cors({
    origin: process.env.CORS_ORIGIN || "*",
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "x-martian-integrity-digest"],
  })
);
app.use(morgan("dev"));
app.use(express.json({ limit: "2mb" }));

// Root health & welcome endpoint
app.get("/", (_req: Request, res: Response) => {
  res.json({
    name: "Martian Map API",
    tagline: "Interplanetary Survival Guide - NASA Space Apps",
    status: "online",
    version: "1.0.0",
    docs: "/api/data/sources",
  });
});

// API Routes
app.use("/api", apiRouter);

// 404 Route Handler
app.use((req: Request, res: Response) => {
  const errorResponse: APIResponse<never> = {
    success: false,
    error: {
      code: "RESOURCE_NOT_FOUND",
      message: `The endpoint ${req.method} ${req.originalUrl} does not exist on this planetary server.`,
    },
  };
  res.status(404).json(errorResponse);
});

// Global Error Handler
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error("[Martian Map Error]", err);
  const errorResponse: APIResponse<never> = {
    success: false,
    error: {
      code: "INTERNAL_SERVER_ERROR",
      message: err.message || "An unhandled error occurred in the Martian mission engine.",
    },
  };
  res.status(500).json(errorResponse);
});

// Start server if not imported by test runner
if (process.env.NODE_ENV !== "test") {
  app.listen(port, () => {
    console.log(`🪐 Martian Map Mission Engine listening at http://localhost:${port}`);
    console.log(`📡 Ready for NASA telemetry, Science, and AI/ML evaluation.`);
  });
}
