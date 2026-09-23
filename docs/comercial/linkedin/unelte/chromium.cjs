// Chromium-ul headless din cache-ul Playwright și playwright-core din pnpm —
// combinația care merge pe mașina asta fără instalări (memoria
// erp-verificare-vizuala-headless).
const fs = require("fs");
const os = require("os");
const path = require("path");

const cache = path.join(os.homedir(), ".cache", "ms-playwright");
const shell = fs
  .readdirSync(cache)
  .filter((d) => d.startsWith("chromium_headless_shell-"))
  .sort()
  .pop();
const executablePath = path.join(cache, shell, "chrome-linux", "headless_shell");

const pnpm = path.join(__dirname, "../../../../node_modules/.pnpm");
const core = fs
  .readdirSync(pnpm)
  .filter((d) => d.startsWith("playwright-core@"))
  .sort()
  .pop();
const { chromium } = require(path.join(pnpm, core, "node_modules", "playwright-core"));

module.exports = { lanseaza: () => chromium.launch({ executablePath }) };
