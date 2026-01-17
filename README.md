# Dokploy Logs MCP Server

MCP server for reading Docker container logs via SSH. Works with any server that has Docker installed and SSH access configured.

## Features

- **list-containers** - List all Docker containers on a remote server
- **get-container-logs** - Get logs from a specific container
- **get-container-stats** - Get CPU/memory usage statistics
- **inspect-container** - Get detailed container information
- **docker-compose-logs** - Get logs from Docker Compose projects
- **test-connection** - Test SSH connectivity

## Prerequisites

1. **SSH access** configured in `~/.ssh/config` to your server(s)
2. **Bun** runtime installed
3. **Docker** installed on the remote server

### SSH Config Example

```ssh-config
# ~/.ssh/config
Host dokploy
  HostName 1.2.3.4
  User root
  IdentityFile ~/.ssh/my_key
```

## Installation

```bash
cd /path/to/dokploy-logs-mcp
bun install
```

## Claude Code Configuration

Add to your `~/.claude.json`:

```json
{
  "mcpServers": {
    "dokploy-logs": {
      "command": "bun",
      "args": ["run", "/path/to/dokploy-logs-mcp/src/index.ts"],
      "env": {
        "SSH_HOST": "dokploy"
      }
    }
  }
}
```

### Environment Variables

| Variable   | Description                           | Default   |
| ---------- | ------------------------------------- | --------- |
| `SSH_HOST` | Default SSH host from `~/.ssh/config` | `dokploy` |

## Usage Examples

Once configured, Claude Code can use these tools:

### List containers

```
"Show me all running containers on dokploy"
→ mcp__dokploy-logs__list-containers
```

### Get logs

```
"Show me the last 50 lines of logs for my-app"
→ mcp__dokploy-logs__get-container-logs(container="my-app-abc123", tail=50)
```

### Get logs from last hour

```
"Show me logs from the last hour for the web app"
→ mcp__dokploy-logs__get-container-logs(container="web", since="1h")
```

### Container stats

```
"What's the memory usage of all containers?"
→ mcp__dokploy-logs__get-container-stats
```

### Multiple servers

```
"Show containers on the production server"
→ mcp__dokploy-logs__list-containers(host="production")
```

## Available Tools

### test-connection

Test SSH connection to a server.

| Parameter | Type   | Required | Description                       |
| --------- | ------ | -------- | --------------------------------- |
| host      | string | No       | SSH host alias (default: dokploy) |

### list-containers

List Docker containers on the remote server.

| Parameter | Type    | Required | Description                   |
| --------- | ------- | -------- | ----------------------------- |
| host      | string  | No       | SSH host alias                |
| all       | boolean | No       | Include stopped containers    |
| filter    | string  | No       | Filter by name (grep pattern) |

### get-container-logs

Get logs from a Docker container.

| Parameter  | Type    | Required | Description                     |
| ---------- | ------- | -------- | ------------------------------- |
| host       | string  | No       | SSH host alias                  |
| container  | string  | **Yes**  | Container name or ID            |
| tail       | number  | No       | Lines from end (default: 100)   |
| since      | string  | No       | Time filter (e.g., "1h", "30m") |
| timestamps | boolean | No       | Show timestamps (default: true) |

### get-container-stats

Get resource usage statistics.

| Parameter | Type   | Required | Description                   |
| --------- | ------ | -------- | ----------------------------- |
| host      | string | No       | SSH host alias                |
| container | string | No       | Specific container (optional) |

### inspect-container

Get detailed container information.

| Parameter | Type   | Required | Description          |
| --------- | ------ | -------- | -------------------- |
| host      | string | No       | SSH host alias       |
| container | string | **Yes**  | Container name or ID |

### docker-compose-logs

Get logs from Docker Compose projects.

| Parameter | Type   | Required | Description                   |
| --------- | ------ | -------- | ----------------------------- |
| host      | string | No       | SSH host alias                |
| project   | string | **Yes**  | Compose project name          |
| service   | string | No       | Specific service              |
| tail      | number | No       | Lines from end (default: 100) |

## Development

```bash
# Run in development mode with hot reload
bun run dev

# Run normally
bun run start
```

## License

MIT
