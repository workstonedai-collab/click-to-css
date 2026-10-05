import { defineConfig } from "vite";
import { clickToCss } from "./src/index.js";
export default defineConfig({
  plugins: [
    clickToCss({
      pages: [
        { file: "index.html", label: "Demo / 示例", styles: ["style.css"] },
      ],
      tokenFile: "style.css",
      tokenPrefix: "--demo-",
    }),
  ],
  server: { host: "127.0.0.1" },
});
