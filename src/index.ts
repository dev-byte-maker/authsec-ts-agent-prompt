/**
 * AuthSec-protected MCP server — agent prompt management.
 *
 * Bootstrap order:
 *   1. runMcpServerWithOAuth registers tools and mounts the Express app.
 *   2. The SDK reads AUTHSEC_* env vars via loadConfigFromEnv() and enables
 *      the runtime automatically when the required vars are present.
 *   3. mountMCP (called internally) registers:
 *        GET  /.well-known/oauth-protected-resource/mcp  →  RFC 9728 metadata
 *        POST /mcp                                       →  AuthSec-gated MCP
 *   4. protectedByAuthSec wraps each tool handler; suggested_scopes are
 *      published to AuthSec on startup so admins can bind them in the UI.
 *
 * Resource URI: https://authsec-ts-agent-prompt.onrender.com/mcp
 * Metadata URL: https://authsec-ts-agent-prompt.onrender.com/.well-known/oauth-protected-resource/mcp
 */

import { runMcpServerWithOAuth } from "@authsec/sdk";
import {
  listPrompts,
  getPrompt,
  createPrompt,
  updatePrompt,
  deletePrompt,
} from "./tools/prompts.js";

const PORT = parseInt(process.env.PORT ?? "3000", 10);
const CLIENT_ID =
  process.env.AUTHSEC_CLIENT_ID ??
  process.env.AUTHSEC_RESOURCE_SERVER_ID ??
  "mcp-render-ts-agent-setup";

runMcpServerWithOAuth({
  clientId: CLIENT_ID,
  appName: "mcp-render-ts-agent-setup",
  host: "0.0.0.0",
  port: PORT,
  path: "/mcp",
  tools: [listPrompts, getPrompt, createPrompt, updatePrompt, deletePrompt],
});
