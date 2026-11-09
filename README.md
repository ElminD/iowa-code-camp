# It's Just a While Loop

A tiny AI agent harness for the Iowa Code Camp 2026 talk. TypeScript, no framework, no SDK, no dependencies. A local model in LM Studio does the inference.

This is the live demo that sits between **slide 20 ("Running it")** and **slide 21 ("What that was")**.

## Setup

You need:

- **Node 22.18+**, which runs `.ts` files directly
- **LM Studio** with a tool-capable model loaded and the local server started

```bash
lms server start
lms load qwen/qwen3.6-35b-a3b
```

The code talks to LM Studio's Anthropic-compatible endpoint, `http://localhost:1234/v1/messages`. LM Studio speaks the same `tool_use` / `tool_result` protocol shown on slides 10 and 17, so the JSON on screen matches the JSON on the slides.

To use a different model or URL:

```bash
MODEL=some/other-model LMSTUDIO_URL=http://localhost:1234/v1/messages node agent.ts
```

Anything the agent writes goes into `./playground` (gitignored). Run `rm -rf playground` between rehearsals.

## Presenter mode (browser)

```bash
node server.ts        # or: npm run present
open http://localhost:3000
```

One page with a tab per step. Each tab shows that step's real source, with the important lines highlighted. **Run** executes the same file on your machine and streams its output into the page. The page also shows:

- a "watch for" checklist that ticks itself off as things happen (slide 20's three things, on the Loop tab)
- the files in `./playground` as the agent writes them

| Key | Does |
| --- | --- |
| `←` `→` | previous / next step |
| `1`–`4` | jump to a step |
| `Enter` / `Space` | run, or stop if it's running |
| `Esc` | stop |
| `R` | delete `./playground` and clear the output |
| `O` | wide output: the output gets the whole right side, the header shrinks, the playground panel hides. Use it for the Loop demo so every turn fits on screen |
| `T` | edit the task (Loop tab only), then `Enter` to run it |
| `+` `−` | code font size (saved between reloads) |

Tabs can be clicked too. The URL hash (`#3`) keeps your place on reload. Every tab keeps its own output, so you can flip back to an earlier step and its run is still there.

The server only listens on `127.0.0.1`. It rejects requests from other sites or hostnames, since `/api/run` ends up running shell commands.

## The build, one step at a time

Each step is a standalone file you can run. They match slides 11 to 14.

| Step | File | Slide | What it shows |
| --- | --- | --- | --- |
| 1 | `steps/1-model.ts` | 11 "Start with the model" | Text in, text out. The model *describes* a hello world, but nothing gets written to disk. |
| 2 | `steps/2-listener.ts` | 12 "Add something that listens" | We send a tool schema. The reply now contains a structured `tool_use` block. We spot it and print it. |
| 3 | `steps/3-tools.ts` | 13 "Add the tools" | We match the name and run the function. `hello.ts` actually appears. Then the program ends, and the model never finds out what happened. |
| 4 | `agent.ts` | 14 + 19 "Send the result back" | Append the result and call the model again, in a `while` loop. That's the whole harness. |

```bash
node steps/1-model.ts
node steps/2-listener.ts
node steps/3-tools.ts
node agent.ts
```

## The demo (slide 20)

```bash
node agent.ts
# or give it your own task
node agent.ts "make a fizzbuzz in TypeScript and run it"
```

Typical output:

```
user         make me a hello world in TypeScript

── turn 1 · send 1 message to the model ───────────
tool_use     write_file
               path     hello.ts
               content  console.log("Hello, World!");
tool_result  wrote 30 bytes to hello.ts

── turn 2 · send 3 messages to the model ──────────
tool_use     run_shell
               command  node hello.ts
tool_result  Hello, World!

── turn 3 · send 5 messages to the model ──────────
assistant    Created hello.ts and ran it. It prints "Hello, World!".

no tool call in that reply, so the loop stops. 6 messages in the list.
```

Each turn is one POST to the model. In turn 1 the model sends the code itself, as the `content` argument of `write_file`. In turn 2 it asks to run that file, which is a separate tool call. In turn 3 it has nothing left to ask for. The formatting lives in `print.ts`, so `agent.ts` stays about the loop.

Slide 20 lists three things to watch for. Here's where each one shows up:

1. **The tool call showing up in the model output.** The yellow `tool_use` lines.
2. **The tool result getting appended to the list.** The green `tool_result` lines. The message count in each turn header goes 1, 3, 5 and never goes down, which is slide 18's "the message list only ever grows."
3. **The model deciding it's finished and stopping.** The last reply has text and no tool call. The `if` fires and the loop breaks. *We* didn't decide when to stop. The model did.

## Walking through `agent.ts` (going into slide 21)

About a hundred lines. Read it top to bottom:

1. **Three tools** (`read_file`, `write_file`, `run_shell`). Ordinary functions in an object, looked up by name.
2. **Three schemas.** A name, a description and a JSON input schema for each tool. This is all the model knows about them.
3. **The message list.** It starts as one user message.
4. **The loop.** These are the four steps from slide 19, and each one is marked `01` to `04` in the code:
   - `01` POST the whole message list to the model
   - `02` push the assistant's reply onto the list
   - `03` `if` there's no `tool_use` block, `break`
   - `04` run each tool, push the `tool_result`s, go around again

One `while`, one `if`, three functions. Tool errors aren't fatal. They go back to the model as the result, and it usually fixes itself on the next turn. (Without the "use relative paths" line in the system prompt, Qwen will sometimes try `/home/user/hello.ts`, get `ENOENT`, and then recover on its own. That's a good thing to show if it happens live.)

## Things worth knowing before you go on stage

- **The model, not the harness, decides to use tools.** With no system prompt, Qwen often just answers in text and makes no tool call. Steps 2 to 4 all send a one-line system prompt ("You are a coding agent. Use the tools…"). That's slide 21's point: the harness is easy, and the model knowing when to ask for a tool is the part you get for free.
- **Runs differ.** Sometimes it names the file `hello-world.ts`. Without the "do not use npx, tsc…" line, Qwen reaches for `npx ts-node` and `npm install -g typescript`. Keep that line in. Every shell command has a 30-second timeout.
- **Bun isn't installed on this machine.** Slide 18 says "run it with bun". Either `brew install oven-sh/bun/bun` (then `bun agent.ts` works too), or change the slide to say `node`.
- **`run_shell` runs whatever the model asks for, with your permissions.** There's no sandbox and no confirmation. Its working directory is `./playground`, but nothing stops a command like `cd ..`. Fine for a hello world demo on your own laptop, but don't point it at anything you care about.
- **Warm the model up first.** Run `node agent.ts` once before the talk so the model is loaded and the first live run is fast (about 4 seconds on this machine).
