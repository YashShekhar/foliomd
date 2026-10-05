import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig(({ command, isPreview }) => {
  const development = command === "serve" && !isPreview;
  const policy = [
    "default-src 'none'",
    `script-src 'self'${development ? " 'unsafe-inline'" : ""}`,
    "style-src 'self' 'unsafe-inline'",
    "font-src 'self'",
    "img-src blob: data:",
    "worker-src 'self'",
    // Only Vite's local development connection needs network access.
    development
      ? "connect-src 'self' ws://127.0.0.1:* ws://localhost:*"
      : "connect-src 'none'",
    "object-src 'none'",
    "frame-src 'none'",
    "base-uri 'none'",
    "form-action 'none'",
  ].join("; ");
  const headers = {
    "Content-Security-Policy": policy,
    "Referrer-Policy": "no-referrer",
    "X-Content-Type-Options": "nosniff",
  };
  return {
    plugins: [
      react(),
      {
        name: "foliomd-browser-only-policy",
        transformIndexHtml: {
          order: "post" as const,
          handler: () => [
            {
              tag: "meta",
              attrs: {
                "http-equiv": "Content-Security-Policy",
                content: policy,
              },
              injectTo: "head-prepend" as const,
            },
          ],
        },
      },
    ],
    server: { headers },
    preview: { headers },
    test: { include: ["src/**/*.test.ts"] },
  };
});
