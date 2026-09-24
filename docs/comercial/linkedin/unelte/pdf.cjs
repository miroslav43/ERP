// Caruselele: planșele din export/ legate într-un PDF de 1080×1350 pe pagină,
// plus imaginile unice și bannerul copiate în livrare/. Lista caruselelor se
// schimbă la fiecare lot.
const fs = require("fs");
const path = require("path");
const { lanseaza } = require("./chromium.cjs");

const S = __dirname;
const CARUSELURI = {
  "administrativo-t4-01-sase-obligatii.pdf": [1, 2, 3, 4, 5, 6, 7, 8].map(
    (i) => `L1-01-s${i}.html`,
  ),
  "administrativo-t4-03-pilot-contabili.pdf": [1, 2, 3, 4, 5, 6, 7].map((i) => `L1-03-s${i}.html`),
};
const UNICE = {
  "L1-02.png": "administrativo-t4-02-diurna.png",
  "L1-04.png": "administrativo-t4-04-reges-ziua-dinainte.png",
  "Banner.png": "administrativo-banner-1128x191.png",
};

const citeste = (f) => fs.readFileSync(path.join(S, "export", f), "utf8");
const corp = (f) => citeste(f).match(/<body>([\s\S]*)<\/body>/)[1];

(async () => {
  const fonturi = citeste(Object.values(CARUSELURI)[0][0]).match(
    /<link rel="stylesheet" href="([^"]+)">/,
  )[1];
  const b = await lanseaza();
  fs.mkdirSync(path.join(S, "livrare"), { recursive: true });
  for (const [nume, slides] of Object.entries(CARUSELURI)) {
    const html =
      `<!doctype html><html lang="ro"><head><meta charset="utf-8"><link rel="stylesheet" href="${fonturi}">` +
      `<style>@page{size:1080px 1350px;margin:0}body{margin:0}.p{page-break-after:always;width:1080px;height:1350px;overflow:hidden}</style></head><body>` +
      slides.map((s) => `<div class="p">${corp(s)}</div>`).join("") +
      "</body></html>";
    const tmp = path.join(S, "livrare", nume.replace(".pdf", ".html"));
    fs.writeFileSync(tmp, html);
    const p = await b.newPage();
    await p.goto("file://" + tmp, { waitUntil: "networkidle" });
    await p.evaluate(() => document.fonts.ready);
    await p.pdf({
      path: path.join(S, "livrare", nume),
      width: "1080px",
      height: "1350px",
      printBackground: true,
      preferCSSPageSize: true,
    });
    fs.unlinkSync(tmp);
    console.log(nume);
  }
  for (const [din, spre] of Object.entries(UNICE))
    fs.copyFileSync(path.join(S, "png", din), path.join(S, "livrare", spre));
  await b.close();
})();
