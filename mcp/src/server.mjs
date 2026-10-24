#!/usr/bin/env node
/**
 * SIGMA MCP server (stdio).
 *
 *   node mcp/src/server.mjs                     # talks to the deployed API
 *   SIGMA_API_BASE_URL=http://localhost:3000/api/v1 node mcp/src/server.mjs
 *
 * Exposes the read-only SIGMA API as MCP tools (see tools.mjs). Logs go to
 * stderr only: stdout carries the MCP protocol.
 */
import { pathToFileURL } from "node:url";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { baseUrlFromEnv, SigmaApiError, sigmaGet } from "./api.mjs";
import { formatResult, TOOLS } from "./tools.mjs";

export function createServer({ baseUrl = baseUrlFromEnv(), fetchImpl = fetch } = {}) {
  const server = new McpServer({ name: "sigma", version: "0.1.0" });
  for (const tool of TOOLS) {
    server.registerTool(
      tool.name,
      {
        title: tool.title,
        description: tool.description,
        inputSchema: tool.input,
        annotations: { readOnlyHint: true, openWorldHint: true, idempotentHint: true },
      },
      async (args = {}) => {
        try {
          const envelope = await sigmaGet(baseUrl, tool.path, args, { fetchImpl });
          return { content: [{ type: "text", text: formatResult(tool, envelope) }] };
        } catch (error) {
          const e = error instanceof SigmaApiError ? error : new SigmaApiError("internal_error", 0, String(error));
          const details = e.details ? `\nDetails: ${JSON.stringify(e.details)}` : "";
          return { isError: true, content: [{ type: "text", text: `SIGMA API error (${e.code}, HTTP ${e.status}): ${e.message}${details}` }] };
        }
      },
    );
  }
  return server;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  const server = createServer();
  await server.connect(new StdioServerTransport());
  console.error(`sigma-mcp: ready (API ${baseUrlFromEnv()})`);
}
