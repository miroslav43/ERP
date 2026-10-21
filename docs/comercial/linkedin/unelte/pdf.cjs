// Caruselele: planșele din export/ legate într-un PDF de 1080×1350 pe pagină,
// plus imaginile unice și bannerul copiate în livrare/. Lista caruselelor se
// schimbă la fiecare lot.
const fs = require("fs");
const path = require("path");
const { lanseaza } = require("./chromium.cjs");

const S = __dirname;
// Lotul 3 n-are carusele: cinci imagini unice, câte una pe unealtă.
const CARUSELURI = {};
const UNICE = {
  "L3-23.png": "administrativo-t4-23-programare-concedii.png",
  "L3-24.png": "administrativo-t4-24-cerere-demisie.png",
  "L3-25.png": "administrativo-t4-25-calculator-zile-lucratoare.png",
  "L3-26.png": "administrativo-t4-26-adeverinta-salariat.png",
  "L3-27.png": "administrativo-t4-27-cerere-concediu-de-odihna.png",
};

const citeste = (f) => fs.readFileSync(path.join(S, "export", f), "utf8");
const corp = (f) => citeste(f).match(/<body>([\s\S]*)<\/body>/)[1];

(async () => {
  const b = await lanseaza();
  // livrare/ ține doar lotul curent: kit_genereaza.py copiază tot ce e aici în kit.
  fs.rmSync(path.join(S, "livrare"), { recursive: true, force: true });
  fs.mkdirSync(path.join(S, "livrare"), { recursive: true });
  for (const [nume, slides] of Object.entries(CARUSELURI)) {
    const fonturi = citeste(slides[0]).match(/<link rel="stylesheet" href="([^"]+)">/)[1];
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
