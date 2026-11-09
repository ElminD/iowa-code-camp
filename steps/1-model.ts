// Step 1: Start with the model.
// Text in, text out. On its own it cannot touch your computer.

const URL = process.env.LMSTUDIO_URL ?? "http://localhost:1234/v1/messages";
const MODEL = process.env.MODEL ?? "qwen/qwen3.6-35b-a3b";

const res = await fetch(URL, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({
    model: MODEL,
    max_tokens: 1024,
    messages: [{ role: "user", content: "make me a hello world in TypeScript" }],
  }),
});
const reply = await res.json();

// It can only *tell* us what to do. Nothing got written to disk.
console.log(JSON.stringify(reply.content, null, 2));
