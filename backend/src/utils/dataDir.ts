import path from "path";

/**
 * Canonical backend data directory (<repo>/backend/data),
 * resolved relative to this module rather than process.cwd()
 * so starting scripts from parent or sibling folders never creates stray data directories.
 */
export const CANONICAL_BACKEND_DATA_DIR = path.resolve(__dirname, "..", "..", "data");
