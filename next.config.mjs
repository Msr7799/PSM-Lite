/** @format */

import createNextIntlPlugin from "next-intl/plugin";
import path from "node:path";
import { fileURLToPath } from "node:url";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/** @type {import('next').NextConfig} */
const nextConfig = {
  // reactCompiler: true, // commented out temporarily if causing issues with v15/16
  turbopack: {
    root: __dirname,
  },
};

export default withNextIntl(nextConfig);
