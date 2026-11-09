// Step 3: Add the tools.
// Ordinary functions. The listener matches the name and runs the right one.
// It works once... then stops. The model never hears what happened.

import { mkdirSync, writeFileSync } from "node:fs";
import { print } from "../print.ts";

const URL = process.env.LMSTUDIO_URL ?? "http://localhost:1234/v1/messages";
const MODEL = process.env.MODEL ?? "qwen/qwen3.6-35b-a3b";

mkdirSync("playground", { recursive: true });
process.chdir("playground");

type Input = Record<string, string>;

const tools: Record<string, (input: Input) => string> = {
  write_file: ({ path, content }) => {
    writeFileSync(path, content);
    return `wrote ${Buffer.byteLength(content)} bytes to ${path}`;
  },
};

const toolSchemas = [
  {
    name: "write_file",
    description: "Write content to a file on disk, replacing it if it exists.",
    input_schema: {
      type: "object",
      properties: { path: { type: "string" }, content: { type: "string" } },
      required: ["path", "content"],
    },
  },
];

const res = await fetch(URL, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({
    model: MODEL,
    max_tokens: 1024,
    system: "You are a coding agent. Use the tools to do the task. Use relative paths.",
    tools: toolSchemas,
    messages: [{ role: "user", content: "make me a hello world in TypeScript" }],
  }),
});
const reply = await res.json();

for (const block of reply.content) {
  if (block.type === "tool_use") {
    print.toolUse(block.name, block.input);
    print.toolResult(tools[block.name](block.input));
  }
}

// Step 4 is the arrow on slide 14: append the result and call the model again.
// That's agent.ts.
