# NATS MCP Server

MCP server enabling AI assistants to interact with [NATS](https://nats.io/) messaging.

## Prerequisites

- Node.js >= 18
- [NATS CLI](https://github.com/nats-io/natscli) in PATH

```bash
# Install NATS CLI
curl -sf https://binaries.nats.dev/nats-io/natscli/nats@latest | sh
sudo mv nats /usr/local/bin/

# Or via package manager
brew install nats-io/nats-tools/nats  # macOS
go install github.com/nats-io/natscli/nats@latest  # Go
```

## Installation

```bash
git clone https://github.com/Piotr1215/nats-mcp-server.git
cd nats-mcp-server
npm install
npm run build
```

## Configuration

Environment variable `NATS_URL` sets the server (default: `nats://localhost:4222`).

### Claude Code

Add to `~/.claude/claude.json`:

```json
{
  "mcpServers": {
    "nats": {
      "command": "node",
      "args": ["/path/to/nats-mcp-server/build/index.js"],
      "env": {
        "NATS_URL": "nats://your-server:4222"
      }
    }
  }
}
```

### Claude Desktop

Add to `~/Library/Application Support/Claude/claude_desktop_config.json` (same format).

## Tools

### nats_publish

Publish message to a subject.

```typescript
{ subject: "orders.new", message: "order data", headers?: [{key: "id", value: "123"}] }
```

### nats_subscribe

Receive messages from a subject.

```typescript
{ subject: "events.>", count?: 1, timeout?: 5000 }
```

### nats_request

Request-reply pattern.

```typescript
{ subject: "service.time", message: "now?", timeout?: 5000 }
```

## Agent Protocol

Higher-level tools for agent-to-agent communication over NATS.

### nats_agent_register

Register as an agent. Returns `agent_id` for subsequent calls.

```typescript
{ name: "researcher", description: "Finds information" }
// Returns: { agent_id: "researcher-a1b2c3d4", message: "..." }
```

### nats_agent_deregister

Unregister when shutting down.

```typescript
{ agent_id: "researcher-a1b2c3d4" }
```

### nats_agent_broadcast

Send message to all agents.

```typescript
{ agent_id: "researcher-a1b2c3d4", message: "Found the data", priority?: "normal" }
```

### nats_agent_dm

Direct message to specific agent.

```typescript
{ agent_id: "researcher-a1b2c3d4", to: "analyst-e5f6g7h8", message: "Check this" }
```

### nats_agent_check_messages

Check for incoming DMs and broadcasts.

```typescript
{ agent_id: "researcher-a1b2c3d4", timeout?: 5000 }
```

### nats_agent_heartbeat

Send alive signal with status.

```typescript
{ agent_id: "researcher-a1b2c3d4", status?: "processing data" }
```

### Protocol Subjects

```
agents.register           # Agent announcements
agents.deregister         # Agent departures
agents.heartbeat.{id}     # Heartbeats
agents.broadcast          # All-agent messages
agents.dm.{agent-id}      # Direct messages
```

## Development

```bash
npm install
npm run build
npm test
```

## License

MIT
