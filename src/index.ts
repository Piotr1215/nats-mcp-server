#!/usr/bin/env node
// PROJECT: claude-automation
// Agent communication via snd
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
} from "@modelcontextprotocol/sdk/types.js";
import { spawn } from "child_process";
import { randomBytes } from "crypto";
import { readdirSync, readFileSync, statSync } from "fs";
import { join } from "path";
import { z } from "zod";

const SND_PATH = process.env.SND_PATH || "/home/decoder/.claude/scripts/snd";

// Tool schemas
const AgentRegisterSchema = z.object({
  name: z.string(),
  description: z.string(),
});

const AgentDeregisterSchema = z.object({
  agent_id: z.string(),
});

const AgentBroadcastSchema = z.object({
  agent_id: z.string(),
  message: z.string(),
  priority: z.enum(["low", "normal", "high"]).optional().default("normal"),
});

const AgentDMSchema = z.object({
  agent_id: z.string(),
  to: z.string(),
  message: z.string(),
});

const AgentDiscoverSchema = z.object({
  include_stale: z.boolean().optional().default(false),
});

const tools: Tool[] = [
  {
    name: "agent_register",
    description: "Register as an agent. Returns unique agent_id to use in other calls.",
    inputSchema: {
      type: "object" as const,
      properties: {
        name: { type: "string" as const, description: "Agent name" },
        description: { type: "string" as const, description: "What this agent does" },
      },
      required: ["name", "description"],
    },
  },
  {
    name: "agent_deregister",
    description: "Deregister an agent when shutting down.",
    inputSchema: {
      type: "object" as const,
      properties: {
        agent_id: { type: "string" as const, description: "Your agent ID from registration" },
      },
      required: ["agent_id"],
    },
  },
  {
    name: "agent_broadcast",
    description: "Send a message to ALL other agents.",
    inputSchema: {
      type: "object" as const,
      properties: {
        agent_id: { type: "string" as const, description: "Your agent ID" },
        message: { type: "string" as const, description: "Message content" },
        priority: { type: "string" as const, enum: ["low", "normal", "high"], description: "Message priority" },
      },
      required: ["agent_id", "message"],
    },
  },
  {
    name: "agent_dm",
    description: "Send a direct message to a specific agent.",
    inputSchema: {
      type: "object" as const,
      properties: {
        agent_id: { type: "string" as const, description: "Your agent ID" },
        to: { type: "string" as const, description: "Target agent ID" },
        message: { type: "string" as const, description: "Message content" },
      },
      required: ["agent_id", "to", "message"],
    },
  },
  {
    name: "agent_discover",
    description: "Discover all active agents.",
    inputSchema: {
      type: "object" as const,
      properties: {
        include_stale: { type: "boolean" as const, description: "Include agents not seen in last 5 minutes" },
      },
    },
  },
];

interface AgentInfo {
  id: string;
  name: string;
  tmux_pane: string;
  is_stale: boolean;
}

function getActiveAgents(includeStale = false): AgentInfo[] {
  const agentDir = "/tmp";
  const staleThreshold = 5 * 60 * 1000;
  const now = Date.now();
  const agents: AgentInfo[] = [];

  try {
    const files = readdirSync(agentDir).filter(f => f.startsWith("claude_agent_") && f.endsWith(".json"));

    for (const file of files) {
      try {
        const filePath = join(agentDir, file);
        const stat = statSync(filePath);
        const content = readFileSync(filePath, "utf-8");
        const data = JSON.parse(content);

        const fileAge = now - stat.mtimeMs;
        const isStale = fileAge > staleThreshold;

        if (!includeStale && isStale) continue;

        agents.push({
          id: data.agent_id || "unknown",
          name: data.agent_name || "unknown",
          tmux_pane: data.tmux_session && data.tmux_window && data.tmux_pane
            ? `${data.tmux_session}:${data.tmux_window}.${data.tmux_pane}`
            : "",
          is_stale: isStale,
        });
      } catch {
        // Skip invalid files
      }
    }
  } catch {
    // Directory read failed
  }

  return agents;
}

async function runSnd(pane: string, message: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const proc = spawn(SND_PATH, ["--pane", pane, message], {
      stdio: ["pipe", "pipe", "pipe"],
    });

    proc.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`snd failed with code ${code}`));
    });

    proc.on("error", reject);
  });
}

function generateAgentId(name: string): string {
  const suffix = randomBytes(4).toString("hex");
  return `${name}-${suffix}`;
}

async function agentRegister(args: z.infer<typeof AgentRegisterSchema>): Promise<string> {
  const agentId = generateAgentId(args.name);
  return JSON.stringify({ agent_id: agentId, message: "Registered. Use this agent_id for all subsequent calls." });
}

async function agentDeregister(_args: z.infer<typeof AgentDeregisterSchema>): Promise<string> {
  return "Deregistered";
}

async function agentBroadcast(args: z.infer<typeof AgentBroadcastSchema>): Promise<string> {
  const agents = getActiveAgents();
  const senderName = args.agent_id.split("-")[0];
  const targets = agents.filter(a => a.id !== args.agent_id && a.tmux_pane);

  if (targets.length === 0) {
    return "No other agents to broadcast to";
  }

  const formattedMsg = `[${senderName}] ${args.message}`;
  const results: string[] = [];

  for (const target of targets) {
    try {
      await runSnd(target.tmux_pane, formattedMsg);
      results.push(`✓ ${target.name}`);
    } catch (err) {
      results.push(`✗ ${target.name}: ${err}`);
    }
  }

  return `Broadcast sent to ${targets.length} agent(s):\n${results.join("\n")}`;
}

async function agentDM(args: z.infer<typeof AgentDMSchema>): Promise<string> {
  const agents = getActiveAgents();
  const senderName = args.agent_id.split("-")[0];
  const target = agents.find(a => a.id === args.to);

  if (!target) return `Agent ${args.to} not found`;
  if (!target.tmux_pane) return `Agent ${args.to} has no tmux pane`;

  const formattedMsg = `[DM from ${senderName}] ${args.message}`;

  try {
    await runSnd(target.tmux_pane, formattedMsg);
    return `DM sent to ${target.name}`;
  } catch (err) {
    return `Failed to send DM: ${err}`;
  }
}

async function agentDiscover(args: z.infer<typeof AgentDiscoverSchema>): Promise<string> {
  const agents = getActiveAgents(args.include_stale);

  if (agents.length === 0) return "No agents currently registered.";

  const lines = agents.map(a =>
    `- ${a.name} (${a.id}): ${a.is_stale ? "stale" : "active"} | pane: ${a.tmux_pane || "unknown"}`
  );

  return `Active agents (${agents.length}):\n${lines.join("\n")}`;
}

const server = new Server(
  { name: "agents-mcp-server", version: "1.0.0" },
  { capabilities: { tools: {} } }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools }));

server.setRequestHandler(CallToolRequestSchema, async (req) => {
  const { name, arguments: args } = req.params;

  try {
    let result: string;

    switch (name) {
      case "agent_register":
        result = await agentRegister(AgentRegisterSchema.parse(args));
        break;
      case "agent_deregister":
        result = await agentDeregister(AgentDeregisterSchema.parse(args));
        break;
      case "agent_broadcast":
        result = await agentBroadcast(AgentBroadcastSchema.parse(args));
        break;
      case "agent_dm":
        result = await agentDM(AgentDMSchema.parse(args));
        break;
      case "agent_discover":
        result = await agentDiscover(AgentDiscoverSchema.parse(args));
        break;
      default:
        throw new Error(`Unknown tool: ${name}`);
    }

    return { content: [{ type: "text" as const, text: result }] };
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    return { content: [{ type: "text" as const, text: `Error: ${msg}` }], isError: true };
  }
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Agents MCP Server running");
}

main().catch(console.error);
