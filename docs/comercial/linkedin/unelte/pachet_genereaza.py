"""Pachetul de publicare: un folder pe postare, cu textul, primul comentariu,
pașii de programare în LinkedIn și fișierul de urcat. Ieșirea, în pachet/,
plus arhiva pachet/Administrativo-LinkedIn.zip. PROGRAM și REZERVE se schimbă
la fiecare lot.

Textele vin din lot-NN.md; calendarul de publicare stă în PROGRAM, fiindcă
datele reale se pot abate de la cele din antetul postării (lotul 1 a pornit
vineri, 2 oct, nu marți, 29 sept)."""

import os
import re
import shutil

RAD = os.path.dirname(os.path.abspath(__file__))
IESIRE = os.path.join(RAD, "pachet")
NUME = "Administrativo-LinkedIn"
DOSAR = os.path.join(IESIRE, NUME)

# (postarea, lotul, data publicării, ora, numele folderului, fișierul din livrare/, titlul documentului)
PROGRAM = [
    ("5", "02", "luni 12 octombrie", "8:30", "01 - luni 12 oct - 8 din 17 sarbatori in weekend (imagine)",
     "administrativo-t4-05-sarbatori-weekend.png", None),
    ("6", "02", "marți 13 octombrie", "8:30", "02 - marti 13 oct - Puntile din 2027 (carusel)",
     "administrativo-t4-06-punti-2027.pdf", "Punțile din 2027"),
    ("7", "02", "miercuri 14 octombrie", "8:30", "03 - miercuri 14 oct - Capcana de 1 leu (imagine)",
     "administrativo-t4-07-capcana-1-leu.png", None),
    ("8", "02", "joi 15 octombrie", "8:30", "04 - joi 15 oct - REGES prin API (carusel)",
     "administrativo-t4-08-reges-api.pdf", "REGES prin API: 5 canale, nu 1"),
    ("9", "02", "vineri 16 octombrie", "8:30", "05 - vineri 16 oct - Concediul din noiembrie (imagine)",
     "administrativo-t4-09-concediu-noiembrie.png", None),
    ("10", "02", "luni 19 octombrie", "8:30", "06 - luni 19 oct - Concediul nu expira dupa 18 luni (imagine)",
     "administrativo-t4-10-concediu-18-luni.png", None),
    ("11", "02", "marți 20 octombrie", "8:30", "07 - marti 20 oct - Control ITM 8 documente (carusel)",
     "administrativo-t4-11-control-itm.pdf", "Control ITM: 8 documente"),
    ("12", "02", "miercuri 21 octombrie", "8:30", "08 - miercuri 21 oct - 6 mituri (carusel)",
     "administrativo-t4-12-mituri.pdf", "6 lucruri care nu sunt în lege"),
    ("13", "02", "joi 22 octombrie", "8:30", "09 - joi 22 oct - Pastele calculat (carusel)",
     "administrativo-t4-13-paste-calculat.pdf", "Paștele, calculat"),
    ("14", "02", "vineri 23 octombrie", "8:30", "10 - vineri 23 oct - Spor de noapte (imagine)",
     "administrativo-t4-14-spor-noapte.png", None),
    ("15", "02", "luni 26 octombrie", "8:30", "11 - luni 26 oct - Ore suplimentare (imagine)",
     "administrativo-t4-15-ore-suplimentare.png", None),
    ("16", "02", "marți 27 octombrie", "8:30", "12 - marti 27 oct - 0 randuri (carusel)",
     "administrativo-t4-16-zero-randuri.pdf", "0 rânduri: cum se țin separat firmele"),
    ("17", "02", "miercuri 28 octombrie", "8:30", "13 - miercuri 28 oct - Indemnizatia de concediu (imagine)",
     "administrativo-t4-17-indemnizatie.png", None),
    ("18", "02", "joi 29 octombrie", "8:30", "14 - joi 29 oct - 2027 pe luni (imagine)",
     "administrativo-t4-18-zile-lucratoare-2027.png", None),
    ("19", "02", "vineri 30 octombrie", "8:30", "15 - vineri 30 oct - Doua amenzi REGES (imagine)",
     "administrativo-t4-19-doua-amenzi.png", None),
]
# Postările fără zi: înlocuiesc una care și-a pierdut ziua sau, ca excepție,
# devin a doua postare a unei zile, la 16:00. Sondajul n-are fișier.
REZERVE = [
    ("20", "02", "Rezerva 1 - Sondaj evidenta orelor (sondaj)", None),
    ("21", "02", "Rezerva 2 - Concediul de ingrijitor (imagine)", "administrativo-t4-21-ingrijitor.png"),
    ("22", "02", "Rezerva 3 - Salariul minim 24 de luni (imagine)", "administrativo-t4-22-24-luni.png"),
]


def sectiuni(lot):
    sursa = open(os.path.join(RAD, "..", f"lot-{lot}.md"), encoding="utf-8").read()
    return {re.match(r"#(\d+)", s).group(1): s for s in re.split(r"\n## ", sursa)[1:]}


def text_postare(s):
    m = re.search(r"### Textul postării\n\n((?:>.*\n?)+)", s)
    linii = [re.sub(r"^> ?", "", l) for l in m.group(1).strip("\n").split("\n")]
    paragrafe, curent = [], []
    for l in linii:
        if l.strip():
            curent.append(l.strip())
        elif curent:
            paragrafe.append(curent)
            curent = []
    if curent:
        paragrafe.append(curent)
    # Rândurile care încep cu o săgeată sau o cifră-emoji sunt listă: rămân pe rând propriu.
    iesire = []
    for p in paragrafe:
        bucati = []
        for l in p:
            if bucati and not re.match(r"^(→|\d️⃣)", l):
                bucati[-1] += " " + l
            else:
                bucati.append(l)
        iesire.append("\n".join(bucati))
    return "\n\n".join(iesire)


def camp(s, eticheta):
    m = re.search(rf"\*\*{eticheta}:\*\*\s*\n?`?([^`\n]+)`?", s)
    return m.group(1).strip()


def avertismente(s):
    return [re.sub(r"\s+", " ", a).replace("**", "").strip()
            for a in re.findall(r"^(⚠.*?)(?=\n\n)", s, re.S | re.M)]


def alt_imagine(s):
    m = re.search(r"\*\*Text alternativ:\*\*\s*(.+?)(?:\n\n|\Z)", s, re.S)
    return re.sub(r"\s+", " ", m.group(1)).strip()


def pasi_carusel(data, ora, titlu, fisier):
    return f"""PAȘII — {data}, ora {ora}

1. Deschide pagina de firmă ca administrator:
   https://www.linkedin.com/company/144846087/admin/
2. Apasă „Creează” → „Începe o postare”. Verifică sus că postezi ca
   ADMINISTRATIVO, nu ca tine.
3. Apasă „+” (Mai mult) → „Adaugă un document” → alege fișierul
   {fisier}
4. La „Titlul documentului” scrie:  {titlu}
   Apasă „Gata”.
5. Copiază tot din „1-text-postare.txt” (textul + hashtag-urile de la final)
   și lipește-l în căsuța postării.
6. Apasă ceasul de lângă „Publică” → data {data}, ora {ora} → „Programează”.

   Dacă după ce ai atașat PDF-ul ceasul NU mai apare, LinkedIn nu programează
   documente: salvează postarea ca ciornă și public-o tu, la {ora}.

LA PUBLICARE (în dimineața respectivă)
7. Deschide postarea publicată și scrie primul comentariu, ca ADMINISTRATIVO:
   copiază tot din „2-primul-comentariu.txt”.
   Linkul stă doar în comentariu, niciodată în postare.
8. În primele 2 ore: răspunde la fiecare comentariu, tot ca pagina.
"""


def pasi_imagine(data, ora, alt, fisier):
    cand = f"{data}, ora {ora}" if data else "data o alegi tu"
    programare = (f"6. Apasă ceasul de lângă „Publică” → data {data}, ora {ora} → „Programează”."
                  if data else "6. Apasă ceasul de lângă „Publică”, alege ziua și ora, apoi „Programează”.")
    return f"""PAȘII — {cand}

1. Deschide pagina de firmă ca administrator:
   https://www.linkedin.com/company/144846087/admin/
2. Apasă „Creează” → „Începe o postare”. Verifică sus că postezi ca
   ADMINISTRATIVO, nu ca tine.
3. Apasă iconița de imagine („Adaugă o fotografie”) → alege fișierul
   {fisier}
4. În editorul imaginii apasă „Text alternativ” și lipește:
   {alt}
   Apasă „Gata”.
5. Copiază tot din „1-text-postare.txt” (textul + hashtag-urile de la final)
   și lipește-l în căsuța postării.
{programare}

LA PUBLICARE (în dimineața respectivă)
7. Deschide postarea publicată și scrie primul comentariu, ca ADMINISTRATIVO:
   copiază tot din „2-primul-comentariu.txt”.
   Linkul stă doar în comentariu, niciodată în postare.
8. În primele 2 ore: răspunde la fiecare comentariu, tot ca pagina.
"""


def sondaj(s):
    m = re.search(r"\*\*Sondajul\*\*.*?întrebarea\s*„(.+?)” · variantele (.+?)\.\n\n", s, re.S)
    intrebare = m.group(1)
    variante = re.findall(r"„(.+?)”", m.group(2))
    return intrebare, variante


def pasi_sondaj(intrebare, variante):
    lista = "\n".join(f"   - {v}" for v in variante)
    return f"""PAȘII — data o alegi tu (rezervă)

1. Deschide pagina de firmă ca administrator:
   https://www.linkedin.com/company/144846087/admin/
2. Apasă „Creează” → „Începe o postare”. Verifică sus că postezi ca
   ADMINISTRATIVO, nu ca tine.
3. Apasă „+” (Mai mult) → „Creează un sondaj”.
4. La întrebare scrie:  {intrebare}
   Variantele, câte una pe rând:
{lista}
   Durata: 1 săptămână. Apasă „Gata”.
5. Copiază tot din „1-text-postare.txt” (textul + hashtag-urile de la final)
   și lipește-l în căsuța postării.
6. Apasă ceasul de lângă „Publică”, alege ziua și ora, apoi „Programează”.

LA PUBLICARE
7. Scrie primul comentariu, ca ADMINISTRATIVO: copiază tot din
   „2-primul-comentariu.txt”.
8. În primele 2 ore: răspunde la fiecare comentariu, tot ca pagina.
9. După o săptămână: trimite-i lui Claude rezultatul, pentru imaginea cu
   rezultatele promisă în text.
"""


def scrie(cale, text):
    with open(cale, "w", encoding="utf-8", newline="\r\n") as f:
        f.write(text.rstrip("\n") + "\n")


def folder(nume, s, fisier, pasi):
    d = os.path.join(DOSAR, nume)
    os.makedirs(d)
    scrie(os.path.join(d, "1-text-postare.txt"), text_postare(s) + "\n\n" + camp(s, "Hashtag-uri"))
    scrie(os.path.join(d, "2-primul-comentariu.txt"), camp(s, "Primul comentariu"))
    # Doar verificările de făcut înainte de publicare; notițele de redacție rămân în lot.
    av = [a for a in avertismente(s) if "înainte de publicare" in a.lower()]
    if av:
        pasi = "ÎNAINTE DE PROGRAMARE\n" + "\n".join(f"- {a}" for a in av) + "\n\n" + pasi
    scrie(os.path.join(d, "3-pasi.txt"), pasi)
    if fisier:
        shutil.copy(os.path.join(RAD, "livrare", fisier), os.path.join(d, "4-" + fisier))


shutil.rmtree(IESIRE, ignore_errors=True)
os.makedirs(DOSAR)
loturi = {}
for nr, lot, data, ora, nume, fisier, titlu in PROGRAM:
    s = loturi.setdefault(lot, sectiuni(lot))[nr]
    pasi = (pasi_carusel(data, ora, titlu, "4-" + fisier) if fisier.endswith(".pdf")
            else pasi_imagine(data, ora, alt_imagine(s), "4-" + fisier))
    folder(nume, s, fisier, pasi)

for nr, lot, nume, fisier in REZERVE:
    s = loturi.setdefault(lot, sectiuni(lot))[nr]
    pasi = pasi_sondaj(*sondaj(s)) if fisier is None else pasi_imagine(None, None, alt_imagine(s), "4-" + fisier)
    folder(nume, s, fisier, pasi)

calendar = "\n".join(f"  {data:<20} {ora:>5}   {nume}" for _, _, data, ora, nume, _, _ in PROGRAM)
scrie(os.path.join(DOSAR, "CITESTE-MA.txt"), f"""ADMINISTRATIVO — POSTĂRILE DE PE LINKEDIN

Pagina: https://www.linkedin.com/company/144846087/

CALENDARUL
{calendar}

Ritmul: o postare pe zi lucrătoare, la 8:30. Seria e făcută pentru reach:
fiecare postare are o cifră de salvat sau un mit de demontat, nu o reclamă.

CE E ÎN FIECARE FOLDER
  1-text-postare.txt       textul de lipit în postare, cu hashtag-urile la final
  2-primul-comentariu.txt  linkul, de pus în primul comentariu după publicare
  3-pasi.txt               ce apeși în LinkedIn, pas cu pas
  4-...pdf / 4-...png      fișierul de urcat (PDF = carusel, PNG = imagine)
  ÎNAINTE DE PROGRAMARE    când apare în 3-pasi.txt: o verificare de făcut întâi

Cele trei foldere „Rezerva” n-au dată. Se folosesc când un slot rămâne
gol sau, ca excepție, ca a doua postare a unei zile, la 16:00 (cel puțin
7 ore după prima: două postări apropiate își iau reach-ul una alteia).
Sondajul (Rezerva 1) n-are fișier: se face direct în LinkedIn.

ÎN FIECARE ZI (10 minute)
  3–5 comentarii utile, ca pagina, la postările contabililor și ale
  oamenilor de HR.

VINEREA (5 minute)
  Pentru postările vechi de 7 zile: afișări, reacții, comentarii,
  redistribuiri, salvări și urmăritorii noi ai paginii. Le trimiți lui
  Claude, care ajustează lotul următor după ce a mers.
""")

arhiva = shutil.make_archive(os.path.join(IESIRE, NUME), "zip", IESIRE, NUME)
for radacina, _, fisiere in sorted(os.walk(DOSAR)):
    for f in sorted(fisiere):
        print(os.path.relpath(os.path.join(radacina, f), IESIRE))
print(arhiva, os.path.getsize(arhiva), "octeți")

# Pagina de descărcare: arhiva e inclusă în pagină ca base64, ca să nu depindă
# de tipurile de fișiere acceptate alături de pagină.
import base64
import html

e = html.escape
zip64 = base64.b64encode(open(arhiva, "rb").read()).decode("ascii")
randuri = "".join(
    f'<tr><td class="mono">{e(data)}</td><td class="mono">{e(ora)}</td>'
    f'<td>{e(nume.split(" - ", 2)[2])}</td></tr>'
    for _, _, data, ora, nume, _, _ in PROGRAM
)
pagina = f"""<title>Pachetul LinkedIn</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Fira+Sans+Condensed:wght@600;700&amp;family=Fira+Mono:wght@400;500&amp;family=Fira+Sans:wght@400;500&amp;display=swap">
<style>
/* O coloană îngustă: calendarul, butonul, apoi ce e în arhivă. */
:root {{
  --fond: #ecefec; --suprafata: #f4f6f4; --text: #0e1c21; --slab: #4a5a5e;
  --linie: #c7cfc9; --usa: #0f1e3d; --usa-text: #faf7f0; --ok: #2f6b52; --avert: #856020;
  --display: 'Fira Sans Condensed', 'Arial Narrow', sans-serif;
  --mono: 'Fira Mono', ui-monospace, Menlo, monospace;
  --corp: 'Fira Sans', system-ui, sans-serif;
}}
@media (prefers-color-scheme: dark) {{
  :root:not([data-theme="light"]) {{
    color-scheme: dark;
    --fond: #0e1c21; --suprafata: #132a30; --text: #ecefec; --slab: #93a5a6;
    --linie: #2a3f46; --usa: #c9d4ee; --usa-text: #0e1c21; --ok: #5fa383; --avert: #d9a650;
  }}
}}
:root[data-theme="dark"] {{
  color-scheme: dark;
  --fond: #0e1c21; --suprafata: #132a30; --text: #ecefec; --slab: #93a5a6;
  --linie: #2a3f46; --usa: #c9d4ee; --usa-text: #0e1c21; --ok: #5fa383; --avert: #d9a650;
}}
body {{ background: var(--fond); color: var(--text); font-family: var(--corp); font-size: 15px; line-height: 1.55; padding-inline: 16px; padding-block: 32px 64px; }}
.pagina {{ max-width: 720px; margin: 0 auto; display: flex; flex-direction: column; gap: 28px; }}
.mono {{ font-family: var(--mono); }}
.eticheta {{ font-family: var(--mono); font-size: 12px; letter-spacing: 0.06em; text-transform: uppercase; color: var(--slab); margin: 0; }}
h1, h2 {{ font-family: var(--display); text-wrap: balance; margin: 0; }}
h1 {{ font-size: clamp(28px, 6vw, 40px); line-height: 1.12; }}
h2 {{ font-size: 20px; line-height: 1.2; }}
p {{ margin: 0; max-width: 65ch; }}
.antet {{ display: flex; flex-direction: column; gap: 10px; }}
.antet p {{ color: var(--slab); }}
.tabel {{ overflow-x: auto; }}
table {{ width: 100%; border-collapse: collapse; font-variant-numeric: tabular-nums; }}
th, td {{ text-align: left; padding: 10px 12px 10px 0; border-bottom: 1px solid var(--linie); vertical-align: top; }}
th {{ font-family: var(--mono); font-size: 12px; font-weight: 500; letter-spacing: 0.06em; text-transform: uppercase; color: var(--slab); }}
td.mono {{ white-space: nowrap; font-size: 14px; }}
.descarca {{ display: flex; flex-direction: column; gap: 10px; align-items: flex-start; padding: 20px; background: var(--suprafata); border: 1px solid var(--linie); border-radius: 6px; }}
button {{ font: 600 16px/1 var(--corp); background: var(--usa); color: var(--usa-text); border: 0; border-radius: 4px; padding: 14px 20px; min-height: 48px; cursor: pointer; }}
button:focus-visible {{ outline: 3px solid var(--ok); outline-offset: 2px; }}
.stare {{ font-size: 14px; color: var(--slab); min-height: 1.4em; }}
ul, ol {{ margin: 0; padding-left: 20px; display: flex; flex-direction: column; gap: 6px; }}
.continut {{ display: flex; flex-direction: column; gap: 12px; }}
.nota {{ font-size: 14px; color: var(--slab); border-left: 3px solid var(--avert); padding-left: 12px; }}
</style>

<main class="pagina">
<header class="antet">
<p class="eticheta">Administrativo · LinkedIn · lotul 2 · seria de reach</p>
<h1>15 postări, una pe zi, gata de programat</h1>
<p>Un folder pentru fiecare postare. În el găsești textul, linkul pentru primul comentariu, pașii din LinkedIn și fișierul de urcat.</p>
</header>

<section class="continut" aria-labelledby="cal">
<h2 id="cal">Calendarul</h2>
<div class="tabel"><table>
<thead><tr><th scope="col">Ziua</th><th scope="col">Ora</th><th scope="col">Postarea</th></tr></thead>
<tbody>{randuri}</tbody>
</table></div>
<p class="nota">Plus trei rezerve fără dată (un sondaj și două imagini). Le folosești când un slot rămâne gol sau, ca excepție, ca a doua postare a zilei, la 16:00.</p>
</section>

<section class="descarca" aria-labelledby="desc">
<h2 id="desc">Arhiva</h2>
<p class="mono" style="font-size:14px">{NUME}.zip · {os.path.getsize(arhiva) // 1024} KB</p>
<button type="button" id="btn-zip" hidden>Descarcă pachetul</button>
<p class="stare" id="stare" role="status" aria-live="polite">Se pregătește descărcarea…</p>
</section>

<section class="continut" aria-labelledby="ce">
<h2 id="ce">Ce e în fiecare folder</h2>
<ul>
<li><span class="mono">1-text-postare.txt</span>: textul de lipit în postare, cu hashtag-urile la final</li>
<li><span class="mono">2-primul-comentariu.txt</span>: linkul, pe care îl pui în primul comentariu după publicare</li>
<li><span class="mono">3-pasi.txt</span>: ce apeși în LinkedIn, pas cu pas</li>
<li><span class="mono">4-….pdf</span> sau <span class="mono">4-….png</span>: fișierul de urcat. PDF-ul e caruselul, PNG-ul e imaginea.</li>
</ul>
<p>Începe cu <span class="mono">CITESTE-MA.txt</span>. Unde <span class="mono">3-pasi.txt</span> are „ÎNAINTE DE PROGRAMARE”, verifică întâi acel lucru.</p>
</section>
</main>

<script>
(function () {{
  var ZIP = "{zip64}";
  var btn = document.getElementById("btn-zip");
  var stare = document.getElementById("stare");
  var pornit = window.claude && window.claude.use ? window.claude.use("downloads") : Promise.resolve(null);
  pornit.then(function (downloads) {{
    if (!downloads) {{
      stare.textContent = "Descărcarea nu e disponibilă aici. Deschide pagina pe claude.ai.";
      return;
    }}
    btn.hidden = false;
    stare.textContent = "";
    btn.addEventListener("click", function () {{
      var bin = atob(ZIP), octeti = new Uint8Array(bin.length);
      for (var i = 0; i < bin.length; i++) octeti[i] = bin.charCodeAt(i);
      var blob = new Blob([octeti], {{ type: "application/zip" }});
      stare.textContent = "Confirmă salvarea în fereastra care apare.";
      downloads.save({{ filename: "{NUME}.zip", data: blob }}).then(function () {{
        stare.textContent = "Salvat: {NUME}.zip. Dezarhivează-l și începe cu CITESTE-MA.txt.";
      }}, function (err) {{
        var cod = err && err.code;
        stare.textContent = cod === "declined" ? "Ai refuzat salvarea. Apasă din nou când vrei." :
          cod === "rate_limited" ? "O altă salvare așteaptă confirmarea." :
          "Arhiva nu s-a putut salva (" + (cod || "eroare") + ").";
      }});
    }});
  }});
}})();
</script>
"""
open(os.path.join(IESIRE, "pachet-linkedin.html"), "w", encoding="utf-8").write(pagina)
print(os.path.join(IESIRE, "pachet-linkedin.html"))
