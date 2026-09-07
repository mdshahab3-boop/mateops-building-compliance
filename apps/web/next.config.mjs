import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Trace the standalone output from the monorepo root so pnpm-linked workspace
  // deps are included in the Docker runtime image.
  outputFileTracingRoot: join(__dirname, "../../"),
  // Compile the workspace TS packages instead of expecting pre-built output.
  transpilePackages: [
    "@scip/db",
    "@scip/auth",
    "@scip/types",
    "@scip/validation",
    "@scip/config",
  ],
  experimental: {
    // Native / node-only deps must not be bundled by the server compiler.
    serverComponentsExternalPackages: [
      "pg",
      "pdf-lib",
      "qrcode",
      "@aws-sdk/client-s3",
      "@aws-sdk/s3-request-presigner",
    ],
  },
  output: "standalone",
  webpack: (config) => {
    // The @scip/* workspace packages are TypeScript with NodeNext-style ".js"
    // import specifiers. Tell webpack to resolve those to the ".ts" sources.
    config.resolve.extensionAlias = {
      ".js": [".ts", ".tsx", ".js"],
      ".mjs": [".mts", ".mjs"],
    };
    return config;
  },
};

export default nextConfig;
