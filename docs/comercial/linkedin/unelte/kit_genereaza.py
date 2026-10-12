"""Pagina-kit a lotului curent: textele din docs/comercial/linkedin/lot-<NN>.md,
fișierele din livrare/, previzualizările din png/."""

import html
import json
import os
import re
import shutil

RAD = os.path.dirname(os.path.abspath(__file__))
KIT = os.path.join(RAD, "kit")
LOT = os.path.join(RAD, "..", "lot-02.md")
PREFIX = "L2-"

shutil.rmtree(KIT, ignore_errors=True)
os.makedirs(os.path.join(KIT, "fisiere"), exist_ok=True)
os.makedirs(os.path.join(KIT, "previzualizari"), exist_ok=True)
for f in os.listdir(os.path.join(RAD, "livrare")):
    shutil.copy(os.path.join(RAD, "livrare", f), os.path.join(KIT, "fisiere", f))
for f in os.listdir(os.path.join(RAD, "png")):
    if f.startswith(PREFIX):
        shutil.copy(os.path.join(RAD, "png", f), os.path.join(KIT, "previzualizari", f))

sursa = open(LOT).read()
sectiuni = re.split(r"\n## ", sursa)[1:]


def bloc_citat(text):
    m = re.search(r"### Textul postării\n\n((?:>.*\n?)+)", text)
    linii = [re.sub(r"^> ?", "", l) for l in m.group(1).strip("\n").split("\n")]
    paragrafe, curent = [], []
    for l in linii:
        if l.strip() == "":
            if curent:
                paragrafe.append(" ".join(curent))
                curent = []
        elif l.startswith("→") or l.startswith("1️⃣") or l.startswith("2️⃣"):
            if curent:
                paragrafe.append(" ".join(curent))
            curent = [l]
        else:
            curent.append(l.strip())
    if curent:
        paragrafe.append(" ".join(curent))
    # listele cu săgeți rămân rânduri separate, fără rând gol între ele
    iesire = []
    for p in paragrafe:
        if p.startswith("→") and iesire and iesire[-1].startswith("→"):
            iesire[-1] += "\n" + p
        else:
            iesire.append(p)
    return "\n\n".join(iesire)


def camp(text, eticheta):
    m = re.search(r"\*\*" + re.escape(eticheta) + r":\*\*\s*\n?`?([^`\n]+)`?", text)
    return m.group(1).strip() if m else ""


def avertismente(text):
    return [re.sub(r"\*\*|`", "", " ".join(m.split())).strip() for m in re.findall(r"^[⚠⧗] (.+?)(?=\n\n)", text, re.S | re.M)]


def alt_unic(text):
    m = re.search(r"\*\*Text alternativ:\*\* ([\s\S]+?)(?:\n\n|$)", text)
    return " ".join(m.group(1).split()) if m else ""


def alt_slideuri(text):
    randuri = re.findall(r"^\| (\d+)\s+\|[^|]+\|[^|]+\| (.+?) \|$", text, re.M)
    return [(int(n), a.strip()) for n, a in randuri]


POSTARI = {
    "5": {"fisier": "administrativo-t4-05-sarbatori-weekend.png", "prev": ["L2-05.png"], "tip": "imagine"},
    "6": {"fisier": "administrativo-t4-06-punti-2027.pdf", "prev": [f"L2-06-s{i}.png" for i in range(1, 9)], "titlu_doc": "Punțile din 2027", "tip": "carusel"},
    "7": {"fisier": "administrativo-t4-07-capcana-1-leu.png", "prev": ["L2-07.png"], "tip": "imagine"},
    "8": {"fisier": "administrativo-t4-08-reges-api.pdf", "prev": [f"L2-08-s{i}.png" for i in range(1, 8)], "titlu_doc": "REGES prin API: 5 canale, nu 1", "tip": "carusel"},
    "9": {"fisier": "administrativo-t4-09-concediu-noiembrie.png", "prev": ["L2-09.png"], "tip": "imagine"},
    "10": {"fisier": "administrativo-t4-10-concediu-18-luni.png", "prev": ["L2-10.png"], "tip": "imagine"},
    "11": {"fisier": "administrativo-t4-11-control-itm.pdf", "prev": [f"L2-11-s{i}.png" for i in range(1, 9)], "titlu_doc": "Control ITM: 8 documente", "tip": "carusel"},
    "12": {"fisier": "administrativo-t4-12-mituri.pdf", "prev": [f"L2-12-s{i}.png" for i in range(1, 9)], "titlu_doc": "6 lucruri care nu sunt în lege", "tip": "carusel"},
    "13": {"fisier": "administrativo-t4-13-paste-calculat.pdf", "prev": [f"L2-13-s{i}.png" for i in range(1, 8)], "titlu_doc": "Paștele, calculat", "tip": "carusel"},
    "14": {"fisier": "administrativo-t4-14-spor-noapte.png", "prev": ["L2-14.png"], "tip": "imagine"},
    "15": {"fisier": "administrativo-t4-15-ore-suplimentare.png", "prev": ["L2-15.png"], "tip": "imagine"},
    "16": {"fisier": "administrativo-t4-16-zero-randuri.pdf", "prev": [f"L2-16-s{i}.png" for i in range(1, 8)], "titlu_doc": "0 rânduri: cum se țin separat firmele", "tip": "carusel"},
    "17": {"fisier": "administrativo-t4-17-indemnizatie.png", "prev": ["L2-17.png"], "tip": "imagine"},
    "18": {"fisier": "administrativo-t4-18-zile-lucratoare-2027.png", "prev": ["L2-18.png"], "tip": "imagine"},
    "19": {"fisier": "administrativo-t4-19-doua-amenzi.png", "prev": ["L2-19.png"], "tip": "imagine"},
    "20": {"fisier": None, "prev": [], "tip": "sondaj"},
    "21": {"fisier": "administrativo-t4-21-ingrijitor.png", "prev": ["L2-21.png"], "tip": "imagine"},
    "22": {"fisier": "administrativo-t4-22-24-luni.png", "prev": ["L2-22.png"], "tip": "imagine"},
}

date = []
for s in sectiuni:
    antet = s.split("\n", 1)[0]
    nr = re.match(r"#(\d+)", antet).group(1)
    p = POSTARI[nr]
    ziua = re.match(r"#\d+ · (.+?) · ", antet).group(1)
    date.append({
        "nr": nr,
        "ziua": ziua,
        "antet": antet,
        "text": bloc_citat(s),
        "comentariu": camp(s, "Primul comentariu"),
        "hashtaguri": camp(s, "Hashtag-uri"),
        "avertismente": avertismente(s),
        "alt": alt_unic(s),
        "alt_slideuri": alt_slideuri(s),
        "sondaj": " ".join(m.group(1).split()) if (m := re.search(r"\*\*Sondajul\*\* (.+?)\n\n", s, re.S)) else "",
        **p,
    })

e = html.escape


def buton_copiere(id_):
    return f'<button type="button" class="btn-copiaza" data-tinta="{id_}">Copiază</button>'


def card(p):
    subiect = p["antet"].split(" · ", 2)[-1] if p["antet"].count(" · ") >= 2 else p["antet"]
    titluri = {
        "5": "2027: 8 din 17 sărbători cad în weekend",
        "6": "Punțile din 2027: 11 zile de concediu, 33 libere",
        "7": "Mărirea de 1 leu care scade netul cu 85 de lei",
        "8": "REGES prin API: 5 canale, nu 1",
        "9": "Concediul din noiembrie: 8 zile, nu 10",
        "10": "Concediul nu „expiră” după 18 luni",
        "11": "Control ITM: 8 documente, comparate",
        "12": "6 lucruri care „se știu” și nu sunt în lege",
        "13": "Paștele din 2035, calculat, nu căutat",
        "14": "Tura până la 23:00: zero spor de noapte",
        "15": "Ore suplimentare: nicio limită pe lună",
        "16": "0 rânduri: datele unei firme, la alta",
        "17": "Indemnizația de concediu: media pe 3 luni",
        "18": "2027 pe luni: 252 de zile lucrătoare",
        "19": "20.000 sau 40.000 de lei: două amenzi",
        "20": "Sondaj: cum țineți evidența orelor?",
        "21": "Concediul de îngrijitor: 5 zile pe an",
        "22": "Salariul minim, cel mult 24 de luni",
    }
    avert = "".join(f'<li>{e(a)}</li>' for a in p["avertismente"])
    avert_html = f'<ul class="avertismente">{avert}</ul>' if avert else ""
    prev = "".join(
        f'<img src="previzualizari/{f}" alt="{e(dict(p["alt_slideuri"]).get(i + 1, p["alt"]))}" loading="lazy" width="1080" height="1350">'
        for i, f in enumerate(p["prev"])
    )
    tip_eticheta = {"carusel": f'carusel · {len(p["prev"])} slide-uri · PDF', "imagine": "imagine · PNG", "sondaj": "sondaj · fără fișier"}[p["tip"]]
    cum_urci = (
        f'<p class="nota">Pe LinkedIn: <b>Adaugă un document</b>, alegi PDF-ul, iar titlul documentului e <span class="mono">„{e(p["titlu_doc"])}”</span>.</p>'
        if p["tip"] == "carusel"
        else f'<p class="nota">Pe LinkedIn: <b>Adaugă o fotografie</b>, apoi <b>Text alternativ</b> — textul de mai jos.</p>'
    )
    if p["tip"] == "sondaj":
        cum_urci = f'<div class="sondaj"><p class="eticheta">Sondajul, de completat în LinkedIn</p><p class="textbloc mic">{e(p["sondaj"])}</p></div>'
    vizual = (
        f'''<div class="derulare" tabindex="0" aria-label="Previzualizare postarea {p['nr']}">{prev}</div>
<button type="button" class="btn-descarca" data-fisier="{p['fisier']}">Descarcă {e(p['fisier'].rsplit('.', 1)[1].upper())}</button>
<p class="stare" role="status" aria-live="polite"></p>'''
        if p["fisier"]
        else ""
    )
    alt_bloc = ""
    if p["tip"] == "imagine":
        alt_bloc = f"""<div class="camp"><div class="camp-cap"><span class="eticheta">Text alternativ</span>{buton_copiere(f"alt-{p['nr']}")}</div>
<p class="textbloc mic" id="alt-{p['nr']}">{e(p["alt"])}</p></div>"""
    return f"""<article class="postare" id="p{p['nr']}">
<header class="postare-cap">
<div class="zi"><span class="mono">#{p['nr']}</span><span>{e(p['ziua'])} · 8:30</span></div>
<h2>{e(titluri[p['nr']])}</h2>
<div class="tip mono">{tip_eticheta}</div>
</header>
{avert_html}
<div class="grila">
<div class="coloana-text">
<div class="camp"><div class="camp-cap"><span class="eticheta">Textul postării</span>{buton_copiere(f"text-{p['nr']}")}</div>
<p class="textbloc" id="text-{p['nr']}">{e(p['text'])}</p></div>
<div class="camp"><div class="camp-cap"><span class="eticheta">Primul comentariu, imediat după publicare</span>{buton_copiere(f"com-{p['nr']}")}</div>
<p class="textbloc mic mono" id="com-{p['nr']}">{e(p['comentariu'])}</p></div>
<div class="camp"><div class="camp-cap"><span class="eticheta">Hashtag-uri</span>{buton_copiere(f"hash-{p['nr']}")}</div>
<p class="textbloc mic mono" id="hash-{p['nr']}">{e(p['hashtaguri'])}</p></div>
{alt_bloc}
</div>
<div class="coloana-vizual">
{vizual}
{cum_urci}
</div>
</div>
</article>"""


carduri = "\n".join(card(p) for p in date)

pagina = f"""<title>Kit LinkedIn · lotul 2</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Fira+Sans+Condensed:wght@500;600;700&amp;family=Fira+Mono:wght@400;500&amp;family=Fira+Sans:wght@400;500&amp;display=swap">
<style>
:root {{
  --fond: #ecefec; --suprafata: #f4f6f4; --text: #0e1c21; --slab: #4a5a5e;
  --linie: #c7cfc9; --rigla: #7b8982; --usa: #0f1e3d; --usa-text: #faf7f0;
  --avert: #856020; --avert-fond: #e4dfd1; --ok: #2f6b52;
  --display: 'Fira Sans Condensed', 'Arial Narrow', sans-serif;
  --mono: 'Fira Mono', ui-monospace, Menlo, monospace;
  --corp: 'Fira Sans', system-ui, sans-serif;
}}
@media (prefers-color-scheme: dark) {{
  :root:not([data-theme="light"]) {{
    color-scheme: dark;
    --fond: #0e1c21; --suprafata: #132a30; --text: #ecefec; --slab: #93a5a6;
    --linie: #2a3f46; --rigla: #586a70; --usa: #c9d4ee; --usa-text: #0e1c21;
    --avert: #d9a650; --avert-fond: #252a22; --ok: #5fa383;
  }}
}}
:root[data-theme="dark"] {{
  color-scheme: dark;
  --fond: #0e1c21; --suprafata: #132a30; --text: #ecefec; --slab: #93a5a6;
  --linie: #2a3f46; --rigla: #586a70; --usa: #c9d4ee; --usa-text: #0e1c21;
  --avert: #d9a650; --avert-fond: #252a22; --ok: #5fa383;
}}
* {{ box-sizing: border-box; }}
body {{ background: var(--fond); color: var(--text); font-family: var(--corp); font-size: 15px; line-height: 1.55; padding-inline: 16px; padding-block: 32px 64px; }}
.pagina {{ max-width: 1080px; margin: 0 auto; display: flex; flex-direction: column; gap: 40px; }}
.mono {{ font-family: var(--mono); }}
h1, h2 {{ font-family: var(--display); text-wrap: balance; margin: 0; }}
h1 {{ font-size: clamp(2rem, 5vw, 3rem); font-weight: 700; line-height: 1.05; }}
h2 {{ font-size: 1.6rem; font-weight: 600; line-height: 1.15; }}
.banda {{ display: grid; grid-template-columns: repeat(7, minmax(0, 1fr)); border: 1px solid var(--linie); border-right: 0; }}
.banda span {{ border-right: 1px solid var(--linie); text-align: center; padding: 6px 0; font-family: var(--mono); font-size: 12px; color: var(--slab); }}
.banda span.we {{ background: repeating-linear-gradient(45deg, var(--rigla) 0 1px, transparent 1px 7px); }}
.intro {{ display: flex; flex-direction: column; gap: 14px; }}
.intro p {{ margin: 0; max-width: 65ch; color: var(--slab); }}
.sondaj {{ display: flex; flex-direction: column; gap: 6px; }}
.saptamana0 {{ border-top: 2px solid var(--rigla); padding-top: 20px; display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 24px; }}
.saptamana0 ol {{ margin: 0; padding-left: 1.2em; display: flex; flex-direction: column; gap: 6px; }}
.saptamana0 img {{ width: 100%; height: auto; border: 1px solid var(--linie); display: block; }}
.postare {{ border-top: 2px solid var(--rigla); padding-top: 20px; display: flex; flex-direction: column; gap: 18px; scroll-margin-top: 16px; }}
.postare-cap {{ display: flex; flex-direction: column; gap: 6px; }}
.zi {{ display: flex; gap: 12px; align-items: baseline; font-size: 14px; color: var(--slab); }}
.zi .mono {{ color: var(--text); font-weight: 500; }}
.tip {{ font-size: 13px; color: var(--slab); }}
.avertismente {{ margin: 0; padding: 12px 16px 12px 32px; background: var(--avert-fond); color: var(--text); border-radius: 4px; display: flex; flex-direction: column; gap: 6px; font-size: 14px; }}
.avertismente li::marker {{ color: var(--avert); }}
.grila {{ display: grid; grid-template-columns: minmax(0, 7fr) minmax(0, 5fr); gap: 28px; align-items: start; }}
.coloana-text, .coloana-vizual {{ display: flex; flex-direction: column; gap: 16px; min-width: 0; }}
.camp {{ display: flex; flex-direction: column; gap: 6px; max-width: 65ch; }}
.camp-cap {{ display: flex; justify-content: space-between; align-items: center; gap: 12px; }}
.eticheta {{ font-family: var(--mono); font-size: 12px; letter-spacing: 0.04em; text-transform: uppercase; color: var(--slab); }}
.textbloc {{ margin: 0; white-space: pre-wrap; background: var(--suprafata); border: 1px solid var(--linie); border-radius: 4px; padding: 14px 16px; overflow-wrap: anywhere; }}
.textbloc.mic {{ font-size: 13px; }}
button {{ font: inherit; cursor: pointer; border-radius: 4px; }}
button:focus-visible, .derulare:focus-visible {{ outline: 2px solid var(--text); outline-offset: 2px; }}
.btn-copiaza {{ background: transparent; color: var(--text); border: 1px solid var(--rigla); padding: 6px 12px; font-size: 13px; min-height: 36px; }}
.btn-copiaza.copiat {{ border-color: var(--ok); color: var(--ok); }}
.btn-descarca {{ background: var(--usa); color: var(--usa-text); border: 0; padding: 12px 18px; font-family: var(--display); font-weight: 600; font-size: 1.05rem; min-height: 48px; align-self: flex-start; }}
.btn-descarca[hidden] {{ display: none !important; }}
.derulare {{ display: flex; gap: 10px; overflow-x: auto; scroll-snap-type: x mandatory; padding-bottom: 6px; }}
.derulare img {{ flex: 0 0 auto; width: min(100%, 320px); height: auto; scroll-snap-align: start; border: 1px solid var(--linie); }}
.stare {{ margin: 0; font-size: 13px; color: var(--slab); min-height: 1.2em; }}
.nota {{ margin: 0; font-size: 13px; color: var(--slab); }}
.cuprins {{ display: flex; flex-wrap: wrap; gap: 8px 20px; font-family: var(--mono); font-size: 13px; }}
.cuprins a {{ color: var(--text); }}
@media (max-width: 760px) {{
  .grila, .sondaj {{ display: flex; flex-direction: column; gap: 6px; }}
.saptamana0 {{ grid-template-columns: minmax(0, 1fr); }}
}}
@media (prefers-reduced-motion: reduce) {{ * {{ scroll-behavior: auto !important; }} }}
</style>

<main class="pagina">
<section class="intro">
<div class="banda" aria-hidden="true"><span>L</span><span>M</span><span>M</span><span>J</span><span>V</span><span class="we">S</span><span class="we">D</span></div>
<p class="mono">Administrativo · LinkedIn · trimestrul 4</p>
<h1>Lotul 2: seria de reach, 15 postări, 12 – 30 octombrie</h1>
<p>O postare pe zi lucrătoare, la 8:30, plus trei rezerve (#20–#22). Fiecare e făcută ca să fie salvată sau trimisă unui coleg: o cifră surprinzătoare, un calendar de folosit, un mit demontat. Pentru fiecare: textul, primul comentariu cu linkul, hashtag-urile și fișierul de urcat. Linkul merge în <b>primul comentariu</b>, nu în postare.</p>
<p>Rezervele înlocuiesc o postare care și-a pierdut ziua. Dacă vreți două postări într-o zi, a doua se pune la 16:00, la cel puțin 7 ore după prima, ca să nu-și ia reach-ul una alteia.</p>
<nav class="cuprins" aria-label="Postări">{"".join(f'<a href="#p{p["nr"]}">#{p["nr"]} · {e(p["ziua"])}</a>' for p in date)}</nav>
</section>

{carduri}
</main>

<script>
(function () {{
  function copiaza(btn) {{
    var tinta = document.getElementById(btn.getAttribute("data-tinta"));
    var text = tinta.textContent;
    function marcheaza() {{
      btn.textContent = "Copiat";
      btn.classList.add("copiat");
      setTimeout(function () {{ btn.textContent = "Copiază"; btn.classList.remove("copiat"); }}, 1800);
    }}
    function selecteaza() {{
      var r = document.createRange();
      r.selectNodeContents(tinta);
      var s = window.getSelection();
      s.removeAllRanges();
      s.addRange(r);
      btn.textContent = "Selectat — Ctrl+C";
    }}
    try {{
      navigator.clipboard.writeText(text).then(marcheaza, selecteaza);
    }} catch (e) {{ selecteaza(); }}
  }}
  document.querySelectorAll(".btn-copiaza").forEach(function (b) {{
    b.addEventListener("click", function () {{ copiaza(b); }});
  }});

  var butoane = document.querySelectorAll(".btn-descarca");
  butoane.forEach(function (b) {{ b.hidden = true; }});
  var pornit = window.claude && window.claude.use ? window.claude.use("downloads") : Promise.resolve(null);
  pornit.then(function (downloads) {{
    if (!downloads) {{
      document.querySelectorAll(".stare").forEach(function (s) {{
        s.textContent = "Descărcarea nu e disponibilă în vizualizarea asta. Deschide pagina pe claude.ai.";
      }});
      return;
    }}
    butoane.forEach(function (b) {{
      b.hidden = false;
      var stare = b.parentElement.querySelector(".stare");
      b.addEventListener("click", function () {{
        var fisier = b.getAttribute("data-fisier");
        stare.textContent = "Se pregătește…";
        fetch("fisiere/" + fisier).then(function (r) {{
          if (!r.ok) throw new Error("status " + r.status);
          return r.blob();
        }}).then(function (blob) {{
          return downloads.save({{ filename: fisier, data: blob }});
        }}).then(function () {{
          stare.textContent = "Salvat: " + fisier;
        }}, function (err) {{
          var cod = err && err.code;
          stare.textContent = cod === "declined" ? "Ai refuzat salvarea." :
            cod === "rate_limited" ? "O altă salvare așteaptă confirmarea." :
            "Fișierul nu s-a putut salva (" + (cod || "eroare") + ").";
        }});
      }});
    }});
  }});
}})();
</script>
"""

open(os.path.join(KIT, "kit-linkedin.html"), "w").write(pagina)
fisiere = {}
for d in ("fisiere", "previzualizari"):
    for f in sorted(os.listdir(os.path.join(KIT, d))):
        fisiere[f"{d}/{f}"] = f"{d}/{f}"
print(json.dumps(fisiere, ensure_ascii=False))
for p in date:
    print(p["nr"], len(p["text"]), "caractere,", len(p["avertismente"]), "avertismente,", len(p["alt_slideuri"]), "alt slide-uri")
