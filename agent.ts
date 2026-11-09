// It's just a while loop.
// A complete agent harness: one while loop, one if statement, three tools.
// The model runs locally in LM Studio. We talk to it with plain fetch().

import { execSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { print } from "./print.ts";

const URL = process.env.LMSTUDIO_URL ?? "http://localhost:1234/v1/messages";
const MODEL = process.env.MODEL ?? "qwen/qwen3.6-35b-a3b";
const TASK = process.argv[2] ?? "make me a hello world in TypeScript";

// Everything the agent touches lives in ./playground.
mkdirSync("playground", { recursive: true });
process.chdir("playground");

// ── The tools: three ordinary functions ─────────────────────────────────────
type Input = Record<string, string>;

const tools: Record<string, (input: Input) => string> = {
  read_file: ({ path }) => readFileSync(path, "utf8"),
  write_file: ({ path, content }) => {
    writeFileSync(path, content);
    return `wrote ${Buffer.byteLength(content)} bytes to ${path}`;
  },
  run_shell: ({ command }) =>
    execSync(command, { encoding: "utf8", stdio: "pipe", timeout: 30_000 }),
};

// ── What we tell the model about them: name, description, input schema ─────
const toolSchemas = [
  {
    name: "read_file",
    description: "Read a file from disk and return its contents.",
    input_schema: {
      type: "object",
      properties: { path: { type: "string" } },
      required: ["path"],
    },
  },
  {
    name: "write_file",
    description: "Write content to a file on disk, replacing it if it exists.",
    input_schema: {
      type: "object",
      properties: { path: { type: "string" }, content: { type: "string" } },
      required: ["path", "content"],
    },
  },
  {
    name: "run_shell",
    description: "Run a shell command and return its output.",
    input_schema: {
      type: "object",
      properties: { command: { type: "string" } },
      required: ["command"],
    },
  },
];

const system =
  "You are a coding agent. Use the tools to do the task, then check your work. " +
  "Use relative paths; you are already in the project folder. " +
  "Node runs TypeScript directly: `node file.ts`. Do not use npx, tsc, ts-node or npm install. " +
  "When the task is done, reply with a short summary.";

// ── The message list. It only ever grows. ───────────────────────────────────
const messages: any[] = [{ role: "user", content: TASK }];
print.user(TASK);
let turn = 0;

// ── The loop ────────────────────────────────────────────────────────────────
while (true) {
  // 01  Send the whole message list to the model
  print.turn(++turn, messages.length);
  const res = await fetch(URL, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ model: MODEL, max_tokens: 4096, system, tools: toolSchemas, messages }),
  });
  const reply = await res.json();

  // 02  The model replies (text and/or tool calls). Keep it.
  messages.push({ role: "assistant", content: reply.content });
  for (const block of reply.content.filter((b: any) => b.type === "text")) {
    print.text(block.text);
  }

  // 03  Check the reply for a tool call. None means the model is finished.
  const calls = reply.content.filter((b: any) => b.type === "tool_use");
  if (calls.length === 0) break;

  // 04  Run each one, append the results, go back to 01
  const results = calls.map((call: any) => {
    print.toolUse(call.name, call.input);
    let output: string;
    try {
      output = tools[call.name](call.input);
    } catch (err: any) {
      output = `error: ${err.stderr || err.message}`;
    }
    print.toolResult(output);
    return { type: "tool_result", tool_use_id: call.id, content: output };
  });
  messages.push({ role: "user", content: results });
}

print.done(messages.length);
