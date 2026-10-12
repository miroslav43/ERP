// export/*.html → png/*.png, câte o planșă, la dimensiunea ei.
const fs = require("fs");
const path = require("path");
const { lanseaza } = require("./chromium.cjs");

(async () => {
  const b = await lanseaza();
  fs.mkdirSync(path.join(__dirname, "png"), { recursive: true });
  for (const f of fs
    .readdirSync(path.join(__dirname, "export"))
    .filter((f) => f.endsWith(".html"))) {
    const [width, height] = f.startsWith("Banner")
      ? [1128, 191]
      : f.startsWith("Facebook")
        ? [1640, 624]
        : [1080, 1350];
    const p = await b.newPage({ viewport: { width, height } });
    await p.goto("file://" + path.join(__dirname, "export", f), { waitUntil: "networkidle" });
    await p.evaluate(() => document.fonts.ready);
    await p.screenshot({ path: path.join(__dirname, "png", f.replace(".html", ".png")) });
    await p.close();
    console.log(f);
  }
  await b.close();
})();
