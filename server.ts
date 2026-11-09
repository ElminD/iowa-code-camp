// Presenter UI for the talk. Serves web/index.html and runs the step files
// for real, streaming their output to the browser.
//
//   node server.ts   then open http://localhost:3000

import { spawn } from "node:child_process";
import { existsSync, readdirSync, readFileSync, rmSync, statSync } from "node:fs";
import { createServer } from "node:http";
import { join } from "node:path";

const ROOT = import.meta.dirname;
const PORT = Number(process.env.PORT ?? 3000);
const PLAYGROUND = join(ROOT, "playground");

// The only files the UI is allowed to show or run.
const STEPS: Record<string, string> = {
  "1": "steps/1-model.ts",
  "2": "steps/2-listener.ts",
  "3": "steps/3-tools.ts",
  "4": "agent.ts",
};

const json = (res: any, body: unknown) => {
  res.writeHead(200, { "content-type": "application/json" });
  res.end(JSON.stringify(body));
};

const server = createServer((req, res) => {
  const url = new URL(req.url ?? "/", `http://${req.headers.host}`);
  const [, api, action, id] = url.pathname.split("/");
  const step = Object.hasOwn(STEPS, id) ? STEPS[id] : undefined;

  // The run endpoint executes shell commands. Only answer this page, on this machine.
  const site = req.headers["sec-fetch-site"];
  const local = req.headers.host === `localhost:${PORT}` || req.headers.host === `127.0.0.1:${PORT}`;
  if (!local || (site && site !== "same-origin" && site !== "none")) {
    return res.writeHead(403).end("forbidden");
  }

  if (url.pathname === "/") {
    res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
    return res.end(readFileSync(join(ROOT, "web/index.html")));
  }

  if (api === "api" && action === "source" && step) {
    return json(res, { file: step, source: readFileSync(join(ROOT, step), "utf8") });
  }

  // Server-sent events: one message per chunk of stdout/stderr, then "exit".
  if (api === "api" && action === "run" && step) {
    res.writeHead(200, { "content-type": "text/event-stream", "cache-control": "no-cache" });
    const send = (data: object) => res.write(`data: ${JSON.stringify(data)}\n\n`);
    const task = url.searchParams.get("task");
    const args = [step, ...(task ? [task] : [])];
    const child = spawn(process.execPath, args, { cwd: ROOT, env: process.env });
    child.stdout.on("data", (chunk) => send({ type: "out", text: chunk.toString() }));
    child.stderr.on("data", (chunk) => send({ type: "err", text: chunk.toString() }));
    child.on("close", (code) => {
      send({ type: "exit", code });
      res.end();
    });
    res.on("close", () => child.kill());
    return;
  }

  if (api === "api" && action === "playground") {
    const files = existsSync(PLAYGROUND)
      ? readdirSync(PLAYGROUND)
          .filter((name) => statSync(join(PLAYGROUND, name)).isFile())
          .map((name) => ({ name, content: readFileSync(join(PLAYGROUND, name), "utf8").slice(0, 4000) }))
      : [];
    return json(res, files);
  }

  if (api === "api" && action === "reset" && req.method === "POST") {
    rmSync(PLAYGROUND, { recursive: true, force: true });
    return json(res, { ok: true });
  }

  res.writeHead(404).end("not found");
});

server.listen(PORT, "127.0.0.1", () => {
  console.log(`presenter ready on http://localhost:${PORT}`);
});
