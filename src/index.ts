#!/usr/bin/env bun

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { sshExec, testConnection } from "./ssh.js";

// Default SSH host from environment or fallback
const DEFAULT_SSH_HOST = process.env.SSH_HOST || "dokploy";

// Tool definitions
const TOOLS = [
  {
    name: "test-connection",
    description: "Test SSH connection to a server",
    inputSchema: {
      type: "object" as const,
      properties: {
        host: {
          type: "string",
          description: "SSH host (from ~/.ssh/config) to connect to. Default: dokploy",
        },
      },
    },
  },
  {
    name: "list-containers",
    description: "List all Docker containers on the remote server",
    inputSchema: {
      type: "object" as const,
      properties: {
        host: {
          type: "string",
          description: "SSH host (from ~/.ssh/config). Default: dokploy",
        },
        all: {
          type: "boolean",
          description: "Show all containers (including stopped). Default: false",
        },
        filter: {
          type: "string",
          description: "Filter containers by name (grep pattern)",
        },
      },
    },
  },
  {
    name: "get-container-logs",
    description: "Get logs from a Docker container",
    inputSchema: {
      type: "object" as const,
      properties: {
        host: {
          type: "string",
          description: "SSH host (from ~/.ssh/config). Default: dokploy",
        },
        container: {
          type: "string",
          description: "Container name or ID (required)",
        },
        tail: {
          type: "number",
          description: "Number of lines to show from the end. Default: 100",
        },
        since: {
          type: "string",
          description: "Show logs since timestamp (e.g., '1h', '30m', '2024-01-01')",
        },
        timestamps: {
          type: "boolean",
          description: "Show timestamps. Default: true",
        },
      },
      required: ["container"],
    },
  },
  {
    name: "get-container-stats",
    description: "Get resource usage statistics for containers",
    inputSchema: {
      type: "object" as const,
      properties: {
        host: {
          type: "string",
          description: "SSH host (from ~/.ssh/config). Default: dokploy",
        },
        container: {
          type: "string",
          description: "Container name or ID (optional, shows all if not specified)",
        },
      },
    },
  },
  {
    name: "inspect-container",
    description: "Get detailed information about a container",
    inputSchema: {
      type: "object" as const,
      properties: {
        host: {
          type: "string",
          description: "SSH host (from ~/.ssh/config). Default: dokploy",
        },
        container: {
          type: "string",
          description: "Container name or ID (required)",
        },
      },
      required: ["container"],
    },
  },
  {
    name: "docker-compose-logs",
    description: "Get logs from a Docker Compose service",
    inputSchema: {
      type: "object" as const,
      properties: {
        host: {
          type: "string",
          description: "SSH host (from ~/.ssh/config). Default: dokploy",
        },
        project: {
          type: "string",
          description: "Compose project name (required)",
        },
        service: {
          type: "string",
          description: "Service name (optional, shows all services if not specified)",
        },
        tail: {
          type: "number",
          description: "Number of lines to show from the end. Default: 100",
        },
      },
      required: ["project"],
    },
  },
];

// Create server
const server = new Server(
  {
    name: "dokploy-logs-mcp",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// Handle list tools request
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return { tools: TOOLS };
});

// Handle tool calls
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  const host = (args?.host as string) || DEFAULT_SSH_HOST;

  try {
    switch (name) {
      case "test-connection": {
        const success = await testConnection(host);
        return {
          content: [
            {
              type: "text",
              text: success
                ? `✓ Successfully connected to ${host}`
                : `✗ Failed to connect to ${host}. Check your SSH config.`,
            },
          ],
        };
      }

      case "list-containers": {
        const showAll = args?.all ? "-a" : "";
        const format = '--format "table {{.Names}}\\t{{.Status}}\\t{{.Image}}"';
        let command = `docker ps ${showAll} ${format}`;

        if (args?.filter) {
          command += ` | grep -E "NAMES|${args.filter}"`;
        }

        const result = await sshExec(command, { host });

        if (result.exitCode !== 0) {
          throw new Error(result.stderr || "Failed to list containers");
        }

        return {
          content: [{ type: "text", text: result.stdout }],
        };
      }

      case "get-container-logs": {
        const container = args?.container as string;
        if (!container) {
          throw new Error("Container name is required");
        }

        const tail = args?.tail ?? 100;
        const timestamps = args?.timestamps !== false ? "-t" : "";
        const since = args?.since ? `--since ${args.since}` : "";

        const command = `docker logs ${container} --tail ${tail} ${timestamps} ${since} 2>&1`;
        const result = await sshExec(command, { host, timeout: 60000 });

        if (result.exitCode !== 0 && !result.stdout) {
          throw new Error(result.stderr || result.stdout || "Failed to get container logs");
        }

        return {
          content: [{ type: "text", text: result.stdout || result.stderr }],
        };
      }

      case "get-container-stats": {
        const container = args?.container as string || "";
        const format = '--format "table {{.Name}}\\t{{.CPUPerc}}\\t{{.MemUsage}}\\t{{.NetIO}}"';
        const command = `docker stats --no-stream ${format} ${container}`;

        const result = await sshExec(command, { host });

        if (result.exitCode !== 0) {
          throw new Error(result.stderr || "Failed to get container stats");
        }

        return {
          content: [{ type: "text", text: result.stdout }],
        };
      }

      case "inspect-container": {
        const container = args?.container as string;
        if (!container) {
          throw new Error("Container name is required");
        }

        const command = `docker inspect ${container} --format '{{json .}}'`;
        const result = await sshExec(command, { host });

        if (result.exitCode !== 0) {
          throw new Error(result.stderr || "Failed to inspect container");
        }

        // Parse and format JSON for readability
        try {
          const data = JSON.parse(result.stdout);
          const summary = {
            Name: data.Name,
            State: data.State,
            Image: data.Config?.Image,
            Created: data.Created,
            Ports: data.NetworkSettings?.Ports,
            Env: data.Config?.Env,
            Mounts: data.Mounts,
          };
          return {
            content: [{ type: "text", text: JSON.stringify(summary, null, 2) }],
          };
        } catch {
          return {
            content: [{ type: "text", text: result.stdout }],
          };
        }
      }

      case "docker-compose-logs": {
        const project = args?.project as string;
        if (!project) {
          throw new Error("Project name is required");
        }

        const service = args?.service || "";
        const tail = args?.tail ?? 100;

        const command = `docker compose -p ${project} logs --tail ${tail} ${service} 2>&1`;
        const result = await sshExec(command, { host, timeout: 60000 });

        if (result.exitCode !== 0 && !result.stdout) {
          throw new Error(result.stderr || result.stdout || "Failed to get compose logs");
        }

        return {
          content: [{ type: "text", text: result.stdout || result.stderr }],
        };
      }

      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      content: [{ type: "text", text: `Error: ${message}` }],
      isError: true,
    };
  }
});

// Start server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Dokploy Logs MCP server running on stdio");
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
