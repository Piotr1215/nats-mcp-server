# Agents MCP Server

MCP server for agent-to-agent communication via snd (tmux message injection).

## Prerequisites

- Node.js >= 18
- `snd` script in PATH (from `~/.claude/scripts/snd`)

## Installation

```bash
git clone https://github.com/Piotr1215/agents-mcp-server.git
cd agents-mcp-server
npm install
npm run build
```

## Configuration

### Claude Code

Add to `~/.claude/claude.json`:

```json
{
  "mcpServers": {
    "agents": {
      "command": "node",
      "args": ["/path/to/agents-mcp-server/build/index.js"]
    }
  }
}
```

## Tools

### agent_register

Register as an agent. Returns `agent_id` for subsequent calls.

```typescript
{ name: "researcher", description: "Finds information" }
// Returns: { agent_id: "researcher-a1b2c3d4", message: "..." }
```

### agent_deregister

Unregister when shutting down.

```typescript
{ agent_id: "researcher-a1b2c3d4" }
```

### agent_broadcast

Send message to all other agents via snd.

```typescript
{ agent_id: "researcher-a1b2c3d4", message: "Found the data", priority?: "normal" }
```

### agent_dm

Direct message to specific agent via snd.

```typescript
{ agent_id: "researcher-a1b2c3d4", to: "analyst-e5f6g7h8", message: "Check this" }
```

### agent_discover

List all active agents.

```typescript
{ include_stale?: false }
```

## How It Works

1. Agents register via `agent_register` - creates tracking file in `/tmp/claude_agent_*.json`
2. Broadcasts/DMs read agent files to find tmux panes
3. Messages sent directly via `snd --pane <target> <message>`
4. No message queue - messages arrive immediately in target tmux pane

## Development

```bash
npm install
npm run build
npm test
```

## License

MIT
