# Cybersecurity & Integrity Module Interface (Person 2)

## Welcome Person 2 (Cybersecurity Engineer)

This directory is reserved for threat models, security policies, audit reports, and penetration test harnesses.

### How your work integrates into the software:
The backend architecture routes every incoming HTTP request through clean middleware extension points located at:
`backend/src/middleware/securityMiddleware.ts`

### Extension Hooks:
- `authenticateRequest()`: Session, JWT, or API key validation.
- `authorizeRequest(roles)`: Role-Based Access Control (e.g., flight controller vs. observer).
- `validateRequest(schema)`: Input sanitization, coordinate bounds checking, and payload validation.
- `checkRateLimit()`: DoS mitigation and IP/token bucket rate limiting.
- `verifyDataIntegrity()`: Cryptographic hashing and telemetry integrity checks.

### Headers & Security Posture:
- Helmet is pre-configured on Express with baseline CSP, HSTS, and X-Frame headers.
- Cross-Origin Resource Sharing (CORS) is configured via `CORS_ORIGIN` environment variable.
- Replace development bypass stubs in `backend/src/middleware/securityMiddleware.ts` with your security implementations when ready.
