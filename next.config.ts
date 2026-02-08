import { spawnSync } from "node:child_process";
import withSerwistInit from "@serwist/next";

const gitRevision = spawnSync("git", ["rev-parse", "HEAD"], {
  encoding: "utf-8",
}).stdout?.trim();
const revision = gitRevision && gitRevision.length > 0 ? gitRevision : crypto.randomUUID();

const withSerwist = withSerwistInit({
  additionalPrecacheEntries: [{ url: "/~offline", revision }],
  swSrc: "src/app/sw.ts",
  swDest: "public/sw.js",
});

export default withSerwist({
  images: {
    unoptimized: true,
  },
});
