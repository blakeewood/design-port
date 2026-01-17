#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import {
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import * as fs from "fs";
import * as crypto from "crypto";
import type { ReadResourceRequest } from "@modelcontextprotocol/sdk/types.js";

/**
 * Generate a consistent hash for a project path
 * Used to create project-specific temp file paths
 */
function hashProjectPath(projectPath: string): string {
  return crypto
    .createHash("md5")
    .update(projectPath || "/tmp")
    .digest("hex")
    .substring(0, 8);
}

/**
 * Get the path to the context file for the current project
 */
function getContextFilePath(projectPath?: string): string {
  const hash = hashProjectPath(projectPath || "");
  return `/tmp/design-port-context-${hash}.txt`;
}

/**
 * Read and parse the context file
 * Returns the raw content or a default message if not found
 */
function readContextFile(projectPath?: string): string {
  const filePath = getContextFilePath(projectPath);

  try {
    if (fs.existsSync(filePath)) {
      const content = fs.readFileSync(filePath, "utf-8");

      // Check for stale context (> 1 hour old)
      const stats = fs.statSync(filePath);
      const ageMs = Date.now() - stats.mtimeMs;
      const staleAfterMs = 60 * 60 * 1000; // 1 hour

      if (ageMs > staleAfterMs) {
        return `No elements currently staged.\n(Previous context expired at ${new Date(stats.mtime).toISOString()})`;
      }

      return content;
    }
  } catch (error) {
    console.error(`Error reading context file: ${error}`);
  }

  return "No elements currently staged.";
}

/**
 * Initialize and run the MCP server
 */
async function main() {
  const server = new Server({
    name: "design-port-mcp",
    version: "0.1.0",
  });

  // Handle resource listing
  server.setRequestHandler(ListResourcesRequestSchema, async () => {
    return {
      resources: [
        {
          uri: "design-port://staged-selections",
          name: "Staged Selections",
          description:
            "Currently staged elements in the DesignPort browser with rich context (dimensions, box model, styles, etc.)",
          mimeType: "text/plain",
        },
      ],
    };
  });

  // Handle resource reading
  server.setRequestHandler(
    ReadResourceRequestSchema,
    async (request: ReadResourceRequest) => {
      const { uri } = request;

      if (uri === "design-port://staged-selections") {
        const projectPath = process.env["DESIGN_PORT_PROJECT"] || "";
        const content = readContextFile(projectPath);

        return {
          contents: [
            {
              uri,
              mimeType: "text/plain",
              text: content,
            },
          ],
        };
      }

      throw new Error(`Unknown resource: ${uri}`);
    }
  );

  // Start the server with stdio transport
  const transport = new StdioServerTransport();
  await server.connect(transport);

  console.error("DesignPort MCP Server running on stdio transport");
}

main().catch(console.error);
