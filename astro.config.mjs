import { defineConfig } from "astro/config";
import react from "@astrojs/react";

export default defineConfig({
  site: "https://services.alexwoodcock.me",
  base: "/",
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
