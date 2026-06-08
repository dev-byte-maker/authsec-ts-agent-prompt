import express, { Request, Response } from 'express';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { loadConfigFromEnv, mountMCP } from '@authsec/sdk';
import { randomUUID } from 'crypto';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
app.use(express.json());

const sessions = new Map<string, { server: McpServer; transport: StreamableHTTPServerTransport }>();

function createMcpServer(): McpServer {
  const server = new McpServer({ name: 'ts-agent-prompt', version: '1.0.0' });

  server.tool(
    'get_agent_prompt',
    'Get a template system prompt for a given agent role',
    { role: { type: 'string', description: 'Agent role e.g. assistant, coder, reviewer' } },
    async ({ role = 'assistant' }: { role?: string }) => ({
      content: [{ type: 'text', text: `You are a helpful ${role}. Be concise, accurate, and proactive.` }],
    })
  );

  server.tool(
    'list_agent_roles',
    'List all available agent roles',
    {},
    async () => ({
      content: [{ type: 'text', text: JSON.stringify(['assistant', 'coder', 'reviewer', 'planner', 'debugger'], null, 2) }],
    })
  );

  server.tool(
    'create_agent_prompt',
    'Create a custom agent prompt from a role and instructions',
    {
      role: { type: 'string', description: 'Agent role name' },
      instructions: { type: 'string', description: 'Custom instructions for the agent' },
    },
    async ({ role, instructions }: { role: string; instructions: string }) => ({
      content: [{ type: 'text', text: `You are a ${role}. ${instructions}` }],
    })
  );

  return server;
}

async function main() {
  const cfg = loadConfigFromEnv();
  cfg.publishManifest = true;

  await mountMCP(app, { config: cfg, path: '/mcp' });

  app.post('/mcp', async (req: Request, res: Response) => {
    const sessionId = req.headers['mcp-session-id'] as string | undefined;
    let session = sessionId ? sessions.get(sessionId) : undefined;

    if (!session) {
      const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: () => randomUUID() });
      const server = createMcpServer();
      await server.connect(transport);
      const newId = transport.sessionId;
      if (newId) sessions.set(newId, { server, transport });
      session = { server, transport };
    }

    await session.transport.handleRequest(req, res, req.body);
  });

  app.get('/mcp', async (req: Request, res: Response) => {
    const sessionId = req.headers['mcp-session-id'] as string | undefined;
    const session = sessionId ? sessions.get(sessionId) : undefined;
    if (!session) {
      res.status(404).json({ error: 'Session not found' });
      return;
    }
    await session.transport.handleRequest(req, res);
  });

  app.get('/health', (_req: Request, res: Response) => {
    res.json({ status: 'ok', server: 'ts-agent-prompt' });
  });

  const port = parseInt(process.env.PORT || '8000', 10);
  app.listen(port, '0.0.0.0', () => {
    console.log(`ts-agent-prompt MCP server running on port ${port}`);
  });
}

main().catch(console.error);
