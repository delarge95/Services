import { defineConfig } from "astro/config";
import react from "@astrojs/react";

const isGitHubActions = process.env.GITHUB_ACTIONS === "true";

export default defineConfig({
  site: "https://delarge95.github.io",
  base: isGitHubActions ? "/Services/" : "/",
  integrations: [react()],
  devToolbar: {
    enabled: false
  },
  output: "static",
  server: {
    host: "127.0.0.1",
    port: 4321
  }
});
