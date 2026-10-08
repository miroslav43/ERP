// Caruselele: planșele din export/ legate într-un PDF de 1080×1350 pe pagină,
// plus imaginile unice și bannerul copiate în livrare/. Lista caruselelor se
// schimbă la fiecare lot.
const fs = require("fs");
const path = require("path");
const { lanseaza } = require("./chromium.cjs");

const S = __dirname;
const CARUSELURI = {
  "administrativo-t4-06-punti-2027.pdf": [1, 2, 3, 4, 5, 6, 7, 8].map((i) => `L2-06-s${i}.html`),
  "administrativo-t4-08-reges-api.pdf": [1, 2, 3, 4, 5, 6, 7].map((i) => `L2-08-s${i}.html`),
  "administrativo-t4-11-control-itm.pdf": [1, 2, 3, 4, 5, 6, 7, 8].map((i) => `L2-11-s${i}.html`),
  "administrativo-t4-12-mituri.pdf": [1, 2, 3, 4, 5, 6, 7, 8].map((i) => `L2-12-s${i}.html`),
  "administrativo-t4-13-paste-calculat.pdf": [1, 2, 3, 4, 5, 6, 7].map((i) => `L2-13-s${i}.html`),
  "administrativo-t4-16-zero-randuri.pdf": [1, 2, 3, 4, 5, 6, 7].map((i) => `L2-16-s${i}.html`),
};
const UNICE = {
  "L2-05.png": "administrativo-t4-05-sarbatori-weekend.png",
  "L2-07.png": "administrativo-t4-07-capcana-1-leu.png",
  "L2-09.png": "administrativo-t4-09-concediu-noiembrie.png",
  "L2-10.png": "administrativo-t4-10-concediu-18-luni.png",
  "L2-14.png": "administrativo-t4-14-spor-noapte.png",
  "L2-15.png": "administrativo-t4-15-ore-suplimentare.png",
  "L2-17.png": "administrativo-t4-17-indemnizatie.png",
  "L2-18.png": "administrativo-t4-18-zile-lucratoare-2027.png",
  "L2-19.png": "administrativo-t4-19-doua-amenzi.png",
  "L2-21.png": "administrativo-t4-21-ingrijitor.png",
  "L2-22.png": "administrativo-t4-22-24-luni.png",
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
