import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import { mcpPlugin } from "@lovable.dev/mcp-js/stacks/tanstack/vite";

const isWindows = process.platform === "win32";

export default defineConfig({
  tanstackStart: { server: { entry: "server" } },
  vite: { plugins: isWindows ? [] : [mcpPlugin()] },
});
