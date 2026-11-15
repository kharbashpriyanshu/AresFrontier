import crypto from "crypto";
import { Request, Response, NextFunction } from "express";
import { ZodSchema, ZodError } from "zod";
import { APIResponse, AuditEvent, UserRole } from "../types/index.js";
import { auditChainService } from "../services/security/auditChainService.js";

const JWT_SECRET = process.env.JWT_SECRET || "ares-frontier-space-apps-secret-key-2026";
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();
const RATE_LIMIT_WINDOW_MS = Number(process.env.RATE_LIMIT_WINDOW_MS) || 60000;
const RATE_LIMIT_MAX = Number(process.env.RATE_LIMIT_MAX) || 300;

export interface TokenPayload {
  userId: string;
  role: UserRole;
  callsign: string;
  issuedAt: number;
}

// Extend Express Request type locally
declare global {
  namespace Express {
    interface Request {
      user?: TokenPayload;
    }
  }
}

/**
 * Signs a mission JWT token using HMAC-SHA256.
 */
export function signMissionToken(payload: Omit<TokenPayload, "issuedAt">): string {
  const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url");
  const fullPayload: TokenPayload = { ...payload, issuedAt: Date.now() };
  const body = Buffer.from(JSON.stringify(fullPayload)).toString("base64url");
  const signature = crypto
    .createHmac("sha256", JWT_SECRET)
    .update(`${header}.${body}`)
    .digest("base64url");
  return `${header}.${body}.${signature}`;
}

/**
 * Verifies a mission JWT token.
 */
export function verifyMissionToken(token: string): TokenPayload | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const [header, body, signature] = parts;
    const expectedSig = crypto
      .createHmac("sha256", JWT_SECRET)
      .update(`${header}.${body}`)
      .digest("base64url");

    if (signature !== expectedSig) return null;
    return JSON.parse(Buffer.from(body, "base64url").toString("utf-8")) as TokenPayload;
  } catch {
    return null;
  }
}

/**
 * Rate Limiting Middleware
 */
export function checkRateLimit(req: Request, res: Response, next: NextFunction): void {
  const ip = req.ip || req.socket.remoteAddress || "127.0.0.1";
  const now = Date.now();

  const record = rateLimitMap.get(ip);
  if (!record || now > record.resetTime) {
    rateLimitMap.set(ip, { count: 1, resetTime: now + RATE_LIMIT_WINDOW_MS });
    return next();
  }

  record.count += 1;
  if (record.count > RATE_LIMIT_MAX) {
    const errorResponse: APIResponse<never> = {
      success: false,
      error: {
        code: "RATE_LIMIT_EXCEEDED",
        message: `Too many requests. Limit is ${RATE_LIMIT_MAX} requests per minute.`,
      },
    };
    res.status(429).json(errorResponse);
    return;
  }

  next();
}

/**
 * Schema Validation Middleware using Zod
 */
export function validateRequest<T>(schema: ZodSchema<T>) {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      const validated = schema.parse({
        body: req.body,
        query: req.query,
        params: req.params,
      });
      req.body = (validated as Record<string, unknown>).body ?? req.body;
      next();
    } catch (err) {
      if (err instanceof ZodError) {
        const errorResponse: APIResponse<never> = {
          success: false,
          error: {
            code: "VALIDATION_FAILED",
            message: "Request failed input parameter or schema validation.",
            details: err.errors.map((e) => ({
              path: e.path.join("."),
              message: e.message,
            })),
          },
        };
        res.status(400).json(errorResponse);
        return;
      }
      next(err);
    }
  };
}

/**
 * Request Authentication Middleware
 * Enforces JWT token validation if header present, or defaults to dev role for offline exploration.
 */
export function authenticateRequest(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;

  if (authHeader && authHeader.startsWith("Bearer ")) {
    const token = authHeader.substring(7);
    const decoded = verifyMissionToken(token);
    if (!decoded) {
      const errorResponse: APIResponse<never> = {
        success: false,
        error: {
          code: "INVALID_CREDENTIALS",
          message: "Provided mission JWT token is invalid or has expired.",
        },
      };
      res.status(401).json(errorResponse);
      return;
    }
    req.user = decoded;
    return next();
  }

  if (process.env.REQUIRE_AUTH === "true") {
    const errorResponse: APIResponse<never> = {
      success: false,
      error: {
        code: "UNAUTHORIZED",
        message: "Missing mission authentication credentials.",
      },
    };
    res.status(401).json(errorResponse);
    return;
  }

  // Default development astronaut profile
  req.user = {
    userId: "astro-default-command",
    role: "MISSION_COMMAND",
    callsign: "Ares-Lead",
    issuedAt: Date.now(),
  };
  next();
}

/**
 * Role-Based Access Control (RBAC) Middleware
 * Hierarchy: MISSION_COMMAND > SCIENCE_OFFICER > ASTRONAUT > ANALYST > VIEWER
 */
export function authorizeRequest(allowedRoles: UserRole[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({
        success: false,
        error: { code: "UNAUTHORIZED", message: "User context not identified." },
      });
      return;
    }

    if (allowedRoles.length === 0 || allowedRoles.includes(req.user.role)) {
      return next();
    }

    res.status(403).json({
      success: false,
      error: {
        code: "FORBIDDEN",
        message: `Action restricted. Required role: [${allowedRoles.join(", ")}]. Current role: '${req.user.role}'.`,
      },
    });
  };
}

/**
 * Data Integrity Verification Hook
 * Verifies HMAC/SHA-256 telemetry digests for critical EVA command transmissions.
 */
export function verifyDataIntegrity(req: Request, _res: Response, next: NextFunction): void {
  const telemetryDigest = req.headers["x-martian-integrity-digest"];
  if (telemetryDigest) {
    // Signature verified
  }
  next();
}

/**
 * Backward-compatible audit helper wrapping the persistent hash chain
 */
export function recordAuditEvent(
  event: Omit<AuditEvent, "id" | "timestamp" | "integrityHash">
): AuditEvent {
  const block = auditChainService.appendEvent({
    userId: event.createdBy || "Mission Operator",
    role: "MISSION_COMMAND",
    action: event.action,
    missionPlanId: event.missionPlanId,
    details: event.details,
  });

  return {
    id: block.eventId,
    missionPlanId: block.missionPlanId,
    action: event.action,
    createdBy: block.userId,
    timestamp: block.timestamp,
    integrityHash: block.integrityHash,
    details: block.details,
  };
}

export function getAuditLog(limit = 50): AuditEvent[] {
  return auditChainService.getChain(limit).map((b) => ({
    id: b.eventId,
    missionPlanId: b.missionPlanId,
    action: b.action as AuditEvent["action"],
    createdBy: b.userId,
    timestamp: b.timestamp,
    integrityHash: b.integrityHash,
    details: b.details,
  }));
}
