// Terminal output for agent.ts. Pure presentation, nothing here is part of the harness.

const color = { bold: "\x1b[1m", dim: "\x1b[2m", green: "\x1b[32m", yellow: "\x1b[33m", cyan: "\x1b[36m", reset: "\x1b[0m" };
const LABEL = 13; // width of the left-hand column
const KEY = 9; // width of an argument name
const MAX_LINES = 15;

const pad = (n: number) => " ".repeat(n);
const indent = (text: string, by: number) => text.replace(/\n/g, `\n${pad(by)}`);

// Long tool output (a 100-line fizzbuzz) gets cut so the screen stays readable.
const clip = (text: string) => {
  const lines = text.trimEnd().split("\n");
  const extra = lines.length - MAX_LINES;
  return extra > 0
    ? [...lines.slice(0, MAX_LINES), `${color.dim}… ${extra} more lines${color.reset}`].join("\n")
    : lines.join("\n");
};

const row = (label: string, style: string, text: string) =>
  console.log(`${style}${label.padEnd(LABEL)}${color.reset}${indent(text, LABEL)}`);

export const print = {
  user: (text: string) => row("user", color.bold, text),

  turn: (n: number, messageCount: number) => {
    const title = `── turn ${n} · send ${messageCount} message${messageCount === 1 ? "" : "s"} to the model `;
    console.log(`\n${color.cyan}${title.padEnd(52, "─")}${color.reset}`);
  },

  text: (text: string) => row("assistant", color.bold, text.trim()),

  // One line for the tool name, then each argument on its own line.
  toolUse: (name: string, input: Record<string, unknown>) => {
    row("tool_use", color.yellow, `${color.bold}${name}${color.reset}`);
    for (const [key, value] of Object.entries(input)) {
      const text = clip(String(value));
      console.log(`${pad(LABEL + 2)}${color.dim}${key.padEnd(KEY)}${color.reset}${indent(text, LABEL + 2 + KEY)}`);
    }
  },

  toolResult: (output: string) => row("tool_result", color.green, clip(output) || `${color.dim}(no output)${color.reset}`),

  done: (messageCount: number) =>
    console.log(`\n${color.dim}no tool call in that reply, so the loop stops. ${messageCount} messages in the list.${color.reset}`),
};
