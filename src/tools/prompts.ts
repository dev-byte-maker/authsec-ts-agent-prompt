/**
 * Agent prompt management tools.
 *
 * Scope mapping (AuthSec canonical scopes only):
 *   read operations  → mcp_render_ts_agent_setup:read  OR  mcp_render_ts_agent_setup:tools:read
 *   write operations → mcp_render_ts_agent_setup:write OR  mcp_render_ts_agent_setup:tools:write
 *
 * Access decisions are delegated entirely to AuthSec — scope strings here are
 * the "suggested_scopes" published in the manifest so admins can bind them in
 * the AuthSec UI. The runtime enforces them via the remote policy.
 */

import { protectedByAuthSec } from "@authsec/sdk";
import type { McpContent } from "@authsec/sdk";

// ---------------------------------------------------------------------------
// In-memory prompt store (replace with a database in production)
// ---------------------------------------------------------------------------

interface Prompt {
  id: string;
  name: string;
  description: string;
  content: string;
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

const store = new Map<string, Prompt>([
  [
    "default",
    {
      id: "default",
      name: "Default Agent Prompt",
      description: "A general-purpose system prompt for AI agents",
      content:
        "You are a helpful AI assistant. Be concise, accurate, and professional.",
      tags: ["general", "default"],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  ],
]);

function newId(): string {
  return Math.random().toString(36).slice(2, 10);
}

function ok(payload: unknown): McpContent[] {
  return [{ type: "text", text: JSON.stringify(payload, null, 2) }];
}

function err(message: string): McpContent[] {
  return [{ type: "text", text: JSON.stringify({ error: message }) }];
}

// ---------------------------------------------------------------------------
// Read tools
// ---------------------------------------------------------------------------

export const listPrompts = protectedByAuthSec(
  {
    toolName: "list_prompts",
    description: "List all available agent prompts",
    scopes: [
      "mcp_render_ts_agent_setup:read",
      "mcp_render_ts_agent_setup:tools:read",
    ],
    requireAll: false,
    inputSchema: {
      type: "object",
      properties: {
        tag: {
          type: "string",
          description: "Optional tag to filter prompts by",
        },
      },
    },
  },
  async (args: Record<string, unknown>) => {
    const tag = typeof args.tag === "string" ? args.tag : undefined;
    let prompts = [...store.values()];
    if (tag) {
      prompts = prompts.filter((p) => p.tags.includes(tag));
    }
    return ok({
      prompts: prompts.map(({ id, name, description, tags, updatedAt }) => ({
        id,
        name,
        description,
        tags,
        updatedAt,
      })),
      total: prompts.length,
    });
  }
);

export const getPrompt = protectedByAuthSec(
  {
    toolName: "get_prompt",
    description: "Retrieve a specific agent prompt by ID",
    scopes: [
      "mcp_render_ts_agent_setup:read",
      "mcp_render_ts_agent_setup:tools:read",
    ],
    requireAll: false,
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "string", description: "Prompt ID" },
      },
      required: ["id"],
    },
  },
  async (args: Record<string, unknown>) => {
    const id = String(args.id ?? "");
    const prompt = store.get(id);
    if (!prompt) {
      return err(`Prompt '${id}' not found`);
    }
    return ok(prompt);
  }
);

// ---------------------------------------------------------------------------
// Write tools
// ---------------------------------------------------------------------------

export const createPrompt = protectedByAuthSec(
  {
    toolName: "create_prompt",
    description: "Create a new agent prompt",
    scopes: [
      "mcp_render_ts_agent_setup:write",
      "mcp_render_ts_agent_setup:tools:write",
    ],
    requireAll: false,
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string", description: "Human-readable name" },
        description: { type: "string", description: "Short description" },
        content: { type: "string", description: "Prompt text" },
        tags: {
          type: "array",
          items: { type: "string" },
          description: "Optional tags",
        },
      },
      required: ["name", "content"],
    },
  },
  async (args: Record<string, unknown>) => {
    const name = String(args.name ?? "");
    const content = String(args.content ?? "");
    const description = typeof args.description === "string" ? args.description : "";
    const tags = Array.isArray(args.tags)
      ? (args.tags as unknown[]).filter((t): t is string => typeof t === "string")
      : [];

    if (!name || !content) {
      return err("'name' and 'content' are required");
    }

    const id = newId();
    const now = new Date().toISOString();
    const prompt: Prompt = {
      id,
      name,
      description,
      content,
      tags,
      createdAt: now,
      updatedAt: now,
    };
    store.set(id, prompt);
    return ok({ created: prompt });
  }
);

export const updatePrompt = protectedByAuthSec(
  {
    toolName: "update_prompt",
    description: "Update an existing agent prompt",
    scopes: [
      "mcp_render_ts_agent_setup:write",
      "mcp_render_ts_agent_setup:tools:write",
    ],
    requireAll: false,
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "string", description: "Prompt ID to update" },
        name: { type: "string" },
        description: { type: "string" },
        content: { type: "string" },
        tags: { type: "array", items: { type: "string" } },
      },
      required: ["id"],
    },
  },
  async (args: Record<string, unknown>) => {
    const id = String(args.id ?? "");
    const existing = store.get(id);
    if (!existing) {
      return err(`Prompt '${id}' not found`);
    }

    const updated: Prompt = {
      ...existing,
      name: typeof args.name === "string" ? args.name : existing.name,
      description:
        typeof args.description === "string"
          ? args.description
          : existing.description,
      content:
        typeof args.content === "string" ? args.content : existing.content,
      tags: Array.isArray(args.tags)
        ? (args.tags as unknown[]).filter((t): t is string => typeof t === "string")
        : existing.tags,
      updatedAt: new Date().toISOString(),
    };
    store.set(id, updated);
    return ok({ updated });
  }
);

export const deletePrompt = protectedByAuthSec(
  {
    toolName: "delete_prompt",
    description: "Delete an agent prompt",
    scopes: [
      "mcp_render_ts_agent_setup:write",
      "mcp_render_ts_agent_setup:tools:write",
    ],
    requireAll: false,
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "string", description: "Prompt ID to delete" },
      },
      required: ["id"],
    },
  },
  async (args: Record<string, unknown>) => {
    const id = String(args.id ?? "");
    if (!store.has(id)) {
      return err(`Prompt '${id}' not found`);
    }
    store.delete(id);
    return ok({ deleted: id });
  }
);
