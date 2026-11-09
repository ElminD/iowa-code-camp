// Step 2: Add something that listens.
// Tell the model a tool exists. It answers with a structured tool_use block.
// The model did not run anything. Noticing the request is our job.

const URL = process.env.LMSTUDIO_URL ?? "http://localhost:1234/v1/messages";
const MODEL = process.env.MODEL ?? "qwen/qwen3.6-35b-a3b";

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
    system: "You are a coding agent. Use the tools to do the task.",
    tools: toolSchemas,
    messages: [{ role: "user", content: "make me a hello world in TypeScript" }],
  }),
});
const reply = await res.json();

// The listener: read what came back and check for a tool call.
for (const block of reply.content) {
  if (block.type === "tool_use") console.log("tool call!", JSON.stringify(block, null, 2));
  else console.log(block.type, block.text ?? "");
}
