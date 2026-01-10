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

Direct message to specific agent via snd. Supports short ID resolution.

```typescript
{ agent_id: "researcher-a1b2c3d4", to: "analyst", message: "Check this" }
// 'to' accepts full ID (analyst-e5f6g7h8) or just the name (analyst)
```

### agent_discover

List all active agents.

```typescript
{ include_stale?: false, group?: "research" }
```

### agent_groups

List all agent groups with counts.

```typescript
{}
// Returns: [{ group_name: "default", count: 2 }, { group_name: "research", count: 1 }]
```

### channel_send

Send a message to a channel.

```typescript
{ agent_id: "researcher-a1b2c3d4", channel: "general", message: "Update: task complete" }
```

### channel_history

Get recent messages from a channel.

```typescript
{ channel: "general", limit?: 50 }
```

### channel_list

List all channels with message counts.

```typescript
{}
// Returns: [{ channel: "general", message_count: 10 }, ...]
```

### dm_history

Get DM history with another agent. Supports short ID resolution.

```typescript
{ agent_id: "researcher-a1b2c3d4", with_agent: "analyst", limit?: 50 }
// with_agent accepts full ID or just the name
```

### messages_since

Poll for new messages since a given ID (for TUI).

```typescript
{ since_id?: 0, limit?: 100 }
```

## How It Works

1. Agents register via `agent_register` - stored in DuckDB (`~/.claude/data/agents.duckdb`)
2. Broadcasts/DMs query database to find tmux panes
3. Messages sent via `snd --pane <target> <message>` and logged to DB
4. Channel and DM history persisted for later retrieval
5. Short ID resolution: use agent names instead of full IDs for convenience

## Development

```bash
npm install
npm run build
npm test
```

## License

MIT
