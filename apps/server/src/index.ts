#!/usr/bin/env node
/**
 * interactive-edtech-mcp-server
 *
 * A single MCP server exposing:
 *  - content_*  : deep content generation from external sources (core value)
 *  - padlet_*, classroom_*, kahoot_*, wayground_*, wordwall_*, nearpod_* : platform adapters
 *  - workflow_* : end-to-end generate -> deliver -> distribute
 *
 * Transport: stdio by default (set TRANSPORT=http for Streamable HTTP).
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import express from "express";
import type { ToolDefinition } from "@interactive-edtech/mcp-shared";

import { contentTools } from "./content-tools.js";
import { workflowTools } from "./workflow-tools.js";
import { padletTools } from "@interactive-edtech/padlet";
import { googleClassroomTools } from "@interactive-edtech/google-classroom";
import { kahootTools } from "@interactive-edtech/kahoot";
import { waygroundTools } from "@interactive-edtech/wayground";
import { wordwallTools } from "@interactive-edtech/wordwall";
import { nearpodTools } from "@interactive-edtech/nearpod";

const VERSION = "0.1.0";

const allTools: ToolDefinition[] = [
  ...contentTools,
  ...padletTools,
  ...googleClassroomTools,
  ...kahootTools,
  ...waygroundTools,
  ...wordwallTools,
  ...nearpodTools,
  ...workflowTools,
];

type RegisterCallback = Parameters<McpServer["registerTool"]>[2];

function buildServer(): McpServer {
  const server = new McpServer({
    name: "interactive-edtech-mcp-server",
    version: VERSION,
  });
  for (const tool of allTools) {
    server.registerTool(
      tool.name,
      {
        title: tool.title,
        description: tool.description,
        inputSchema: tool.inputSchema.shape,
        annotations: tool.annotations,
      },
      tool.handler as unknown as RegisterCallback,
    );
  }
  return server;
}

async function runStdio(): Promise<void> {
  const server = buildServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error(
    `interactive-edtech-mcp-server v${VERSION} running on stdio (${allTools.length} tools)`,
  );
}

async function runHttp(): Promise<void> {
  const app = express();
  app.use(express.json({ limit: "8mb" }));

  app.post("/mcp", async (req, res) => {
    // Stateless: a fresh server + transport per request avoids id collisions.
    const server = buildServer();
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
      enableJsonResponse: true,
    });
    res.on("close", () => {
      transport.close();
      server.close();
    });
    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
  });

  app.get("/health", (_req, res) => {
    res.json({ status: "ok", version: VERSION, tools: allTools.length });
  });

  const port = parseInt(process.env.PORT ?? "3000", 10);
  app.listen(port, "127.0.0.1", () => {
    console.error(
      `interactive-edtech-mcp-server v${VERSION} on http://127.0.0.1:${port}/mcp (${allTools.length} tools)`,
    );
  });
}

const transport = process.env.TRANSPORT ?? "stdio";
const main = transport === "http" ? runHttp : runStdio;
main().catch((err) => {
  console.error("Fatal server error:", err);
  process.exit(1);
});
