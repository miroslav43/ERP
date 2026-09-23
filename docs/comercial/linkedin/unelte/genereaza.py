"""Generează planșele LinkedIn T4 — lotul 1 — din aceeași sursă în două forme:
project/<nume>.dc.html pentru pânza Claude Design și export/<nume>.html pentru
randarea locală în PNG/PDF."""

import json
import os
from datetime import datetime, timezone

RAD = os.path.dirname(os.path.abspath(__file__))
PROIECT = os.path.join(RAD, "canvas", "project")
EXPORT = os.path.join(RAD, "export")

# ── Culorile sitului (src/app/globals.css, --color-mk-*) ─────────────────────
HARTIE = "#ecefec"
CERNEALA = "#0e1c21"
SLAB = "#4a5a5e"
RIGLA = "#7b8982"
LINIATURA = "#c7cfc9"
INV = "#ecefec"
INV_SLAB = "#93a5a6"
CO = "#2f6b52"
SL = "#b4802a"
AN = "#a8443a"
USA = "#0f1e3d"
USA_TEXT = "#faf7f0"
HASURA = "repeating-linear-gradient(45deg, #93a5a6 0 1px, transparent 1px 7px)"

PILON = {"legislatie": CERNEALA, "unelte": CO, "culise": SL, "pilot": USA}

DISPLAY = "'Fira Sans Condensed', sans-serif"
MONO = "'Fira Mono', monospace"
TEXT = "'Inter', sans-serif"
FONTURI = (
    "https://fonts.googleapis.com/css2?family=Fira+Sans+Condensed:wght@400;500;600;700"
    "&family=Fira+Mono:wght@400;500&family=Inter:wght@400;500&display=swap"
)

os.makedirs(PROIECT, exist_ok=True)
os.makedirs(EXPORT, exist_ok=True)

L, H = 1080, 1350


def antet(eticheta, pilon, amenda=False, inv=False):
    culoare = INV if inv else CERNEALA
    slab = INV_SLAB if inv else SLAB
    patrat_amenda = (
        f'<span style="width: 22px; height: 22px; background: {AN}; display: inline-block;"></span>'
        if amenda
        else ""
    )
    return f"""<div style="display: flex; justify-content: space-between; align-items: center;">
<span style="font-family: {DISPLAY}; font-weight: 600; font-size: 34px; letter-spacing: 0.01em; color: {culoare};">Administrativo</span>
<span style="display: flex; align-items: center; gap: 14px; font-family: {MONO}; font-size: 28px; color: {slab};">
<span style="width: 22px; height: 22px; background: {PILON[pilon] if not inv else INV}; display: inline-block;"></span>{patrat_amenda}{eticheta}</span>
</div>"""


def banda_zile(inv=False, fond=None):
    linie = "#2a3f46" if inv else LINIATURA
    text = INV_SLAB if inv else SLAB
    fond_litera = fond if fond else (CERNEALA if inv else HARTIE)
    celule = []
    for i, z in enumerate("LMMJVSD"):
        weekend = i >= 5
        fundal = f"background: {HASURA};" if weekend else ""
        celule.append(
            f'<div style="height: 64px; display: flex; align-items: center; justify-content: center; '
            f'border-right: 1px solid {linie}; font-family: {MONO}; font-size: 26px; color: {text}; {fundal}">'
            f'<span style="background: {fond_litera}; padding: 2px 10px;">{z}</span></div>'
        )
    return (
        f'<div style="display: grid; grid-template-columns: repeat(7, minmax(0, 1fr)); '
        f'border-top: 1px solid {linie}; border-bottom: 1px solid {linie}; border-left: 1px solid {linie};">'
        + "".join(celule)
        + "</div>"
    )


def subsol(adresa, pagina, inv=False):
    culoare = INV_SLAB if inv else SLAB
    dreapta = (
        f'<span style="font-family: {MONO}; font-size: 30px; color: {culoare};">{pagina}</span>'
        if pagina
        else ""
    )
    return f"""<div style="display: flex; justify-content: space-between; align-items: center;">
<span style="font-family: {MONO}; font-size: 30px; color: {culoare};">{adresa}</span>{dreapta}
</div>"""


def radacina(interior, fundal=HARTIE, culoare=CERNEALA, gap=56):
    return (
        f'<div style="width: {L}px; height: {H}px; box-sizing: border-box; padding: 72px; '
        f"display: flex; flex-direction: column; gap: {gap}px; background: {fundal}; color: {culoare}; "
        f'font-family: {TEXT};">{interior}</div>'
    )


def temei_celula(temei):
    return f"""<div style="border-top: 2px solid {RIGLA}; padding-top: 24px; font-family: {MONO}; font-size: 30px; color: {SLAB};">temei · {temei}</div>"""


def coperta(cifra, fraza, sub, eticheta, pilon, pagina, adresa="administrativo.ro", marime=240, amenda=False, temei=None):
    marcaj = (
        f'<div style="display: flex; align-items: center; gap: 14px; font-family: {MONO}; font-size: 30px; color: {SLAB};">'
        f'<span style="width: 24px; height: 24px; background: {AN}; display: inline-block;"></span>amendă</div>'
        if amenda
        else ""
    )
    corp = f"""<div style="flex-grow: 1; display: flex; flex-direction: column; justify-content: center; gap: 36px;">
{marcaj}<div style="font-family: {DISPLAY}; font-weight: 700; font-size: {marime}px; line-height: 0.92; letter-spacing: -0.02em;">{cifra}</div>
<div style="font-family: {DISPLAY}; font-weight: 500; font-size: 64px; line-height: 1.14; max-width: 900px;">{fraza}</div>
<div style="font-size: 38px; line-height: 1.35; color: {SLAB}; max-width: 880px;">{sub}</div>
</div>"""
    parti = [antet(eticheta, pilon), banda_zile(), corp]
    if temei:
        parti.append(temei_celula(temei))
    parti.append(subsol(adresa, pagina))
    return radacina("".join(parti))


def regula(nr, titlu, detaliu, temei, eticheta, pilon, pagina):
    corp = f"""<div style="flex-grow: 1; display: flex; flex-direction: column; justify-content: center; gap: 40px;">
<div style="font-family: {MONO}; font-size: 40px; color: {SLAB};">{nr}</div>
<div style="font-family: {DISPLAY}; font-weight: 600; font-size: 80px; line-height: 1.12; max-width: 920px;">{titlu}</div>
<div style="font-size: 40px; line-height: 1.35; color: {SLAB}; max-width: 880px;">{detaliu}</div>
</div>"""
    parti = [antet(eticheta, pilon), banda_zile(), corp]
    if temei:
        parti.append(temei_celula(temei))
    parti.append(subsol("administrativo.ro", pagina))
    return radacina("".join(parti))


def final(mesaj, adresa, buton, eticheta, pilon, pagina, fundal=CERNEALA, text=INV):
    corp = f"""<div style="flex-grow: 1; display: flex; flex-direction: column; justify-content: center; gap: 48px;">
<div style="font-family: {DISPLAY}; font-weight: 600; font-size: 92px; line-height: 1.1; max-width: 920px;">{mesaj}</div>
<div style="font-family: {MONO}; font-size: 36px; color: {INV_SLAB};">{adresa}</div>
<div style="align-self: flex-start; border: 2px solid {text}; border-radius: 6px; padding: 22px 40px; font-family: {DISPLAY}; font-weight: 600; font-size: 40px;">{buton}</div>
</div>"""
    parti = [antet(eticheta, pilon, inv=True), banda_zile(inv=True, fond=fundal), corp, subsol("administrativo.ro", pagina, inv=True)]
    return radacina("".join(parti), fundal=fundal, culoare=text)


def sistem():
    swatch = lambda nume, hexa, text=CERNEALA: (
        f'<div style="display: flex; flex-direction: column; gap: 10px;">'
        f'<div style="height: 110px; background: {hexa}; border: 1px solid {LINIATURA};"></div>'
        f'<div style="font-family: {MONO}; font-size: 22px; color: {SLAB};">{nume}<br>{hexa}</div></div>'
    )
    culori = "".join(
        swatch(n, h)
        for n, h in [
            ("hârtie", HARTIE), ("cerneală", CERNEALA), ("text slab", SLAB), ("riglă", RIGLA),
            ("verde CO", CO), ("ocru SL", SL), ("roșu AN", AN), ("ușa", USA),
        ]
    )
    piloni = "".join(
        f'<div style="display: flex; align-items: center; gap: 16px; font-size: 30px;">'
        f'<span style="width: 26px; height: 26px; background: {c}; display: inline-block;"></span>{n}</div>'
        for n, c in [
            ("Legislație", CERNEALA), ("Unelte", CO), ("Culise", SL), ("Produs și pilot", USA), ("amendă (marcaj)", AN),
        ]
    )
    interior = f"""{antet("sistem · T4", "legislatie")}
<div style="font-family: {DISPLAY}; font-weight: 700; font-size: 88px; line-height: 1;">Foaia + cifra</div>
<div style="font-size: 32px; line-height: 1.4; color: {SLAB}; max-width: 900px;">Culorile, fonturile și hașura sunt cele ale sitului. Culorile legendei sunt marcaje, niciodată text.</div>
<div style="display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 24px;">{culori}</div>
<div style="display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 24px; border-top: 2px solid {RIGLA}; padding-top: 28px;">
<div style="font-family: {DISPLAY}; font-weight: 700; font-size: 72px;">240</div>
<div style="font-family: {MONO}; font-size: 30px; align-self: center;">art. 119 C.m.</div>
<div style="font-size: 30px; align-self: center;">Text curent, Inter</div>
</div>
<div style="display: flex; flex-direction: column; gap: 14px;">{piloni}</div>
{banda_zile()}"""
    return radacina(interior, gap=40)


def banner():
    linie = LINIATURA
    celule = []
    culori_zi = ["", "", "#d2ddd6", "#d2ddd6", "", HASURA, HASURA, "", "#e4dfd1", "", "", "", HASURA, HASURA]
    for c in culori_zi:
        fundal = f"background: {c};" if c else ""
        celule.append(f'<div style="border-right: 1px solid {linie}; {fundal}"></div>')
    grila = (
        f'<div style="position: absolute; left: 0; top: 0; width: 1128px; height: 191px; display: grid; '
        f"grid-template-columns: repeat(14, minmax(0, 1fr)); border-left: 1px solid {linie}; opacity: 0.55;\">"
        + "".join(celule)
        + "</div>"
    )
    return f"""<div style="width: 1128px; height: 191px; position: relative; overflow: hidden; background: {HARTIE}; color: {CERNEALA}; font-family: {TEXT};">
{grila}
<div style="position: absolute; right: 56px; top: 0; height: 191px; display: flex; flex-direction: column; justify-content: center; align-items: flex-end; gap: 10px;">
<div style="font-family: {DISPLAY}; font-weight: 700; font-size: 56px; line-height: 1; background: {HARTIE}; padding: 4px 12px;">Administrativo</div>
<div style="font-family: {MONO}; font-size: 22px; color: {SLAB}; background: {HARTIE}; padding: 4px 12px;">pontaj · concedii · REGES-Online · pentru firmele mici</div>
</div>
</div>"""


# ── Planșele lotului 1 ───────────────────────────────────────────────────────
PLANSE = {}

PLANSE["Main.dc.html"] = ("Sistemul vizual", sistem(), L, H)
PLANSE["Banner.dc.html"] = ("Banner pagină 1128×191", banner(), 1128, 191)

E1, P1 = "ghid · obligații", "legislatie"
reguli_1 = [
    ("01", "Contractul în REGES, cel târziu în ziua dinainte.", "Nu în ziua în care omul vine la lucru.", "HG 295/2025"),
    ("02", "Evidența orelor, zilnic, pentru fiecare om.", "Cu ora de început și ora de sfârșit.", "art. 119 alin. (1) Codul muncii"),
    ("03", "Foile de prezență și statele de plată.", "La control se compară între ele. Neconcordanțele sunt ce se caută.", "control ITM, documentele cerute"),
    ("04", "Dosarele de personal.", "Cu contractele și toate actele adiționale.", "control ITM, documentele cerute"),
    ("05", "Regulamentul intern.", "E printre documentele cerute la un control de fond.", "control ITM, documentele cerute"),
    ("06", "Programarea concediilor pe anul următor.", "Până la sfârșitul anului. Nu „când se poate”.", "art. 148 alin. (1) Codul muncii"),
]
PLANSE["L1-01-s1.dc.html"] = ("#1 · 1/8", coperta("6", "lucruri pe care o firmă cu angajați trebuie să le aibă la zi.", "Oricând, nu doar la control.", E1, P1, "1/8 →"), L, H)
for i, (nr, t, d, tm) in enumerate(reguli_1, start=2):
    PLANSE[f"L1-01-s{i}.dc.html"] = (f"#1 · {i}/8", regula(nr, t, d, tm, E1, P1, f"{i}/8 →"), L, H)
PLANSE["L1-01-s8.dc.html"] = ("#1 · 8/8", final("Le luăm pe rând, marțea și joia.", "administrativo.ro/ghid/control-itm", "Urmărește pagina", E1, P1, "8/8"), L, H)

PLANSE["L1-02.dc.html"] = (
    "#2 · diurna",
    coperta(
        "57,50 lei", "nu e scris în nicio lege.",
        "E o înmulțire: 2,5 × 23 lei, nivelul din HG 714/2018. Când se schimbă cei 23 de lei, plafonul se mută singur.",
        "ghid · diurnă", "legislatie", "", marime=200,
        temei="art. 76 alin. (2) lit. k) Codul fiscal",
    ),
    L, H,
)

E3, P3 = "pilot · contabili", "pilot"
PLANSE["L1-03-s1.dc.html"] = ("#3 · 1/7", coperta("10 cabinete", "gratuit pentru firmele lor până pe 31 martie 2027.", "Înscrieri până pe 15 noiembrie 2026.", E3, P3, "1/7 →", marime=190), L, H)
PLANSE["L1-03-s2.dc.html"] = ("#3 · 2/7", regula("Pentru cine", "Contabilii care țin evidența de personal pentru mai multe firme.", "Aduceți una până la trei firme-client.", None, E3, P3, "2/7 →"), L, H)
PLANSE["L1-03-s3.dc.html"] = ("#3 · 3/7", regula("Ce primiți", "Nucleul, gratuit, până pe 31 martie 2027.", "Pontaj, concedii, REGES-Online, SSM, portalul angajatului. Punerea în funcțiune o facem noi.", None, E3, P3, "3/7 →"), L, H)
PLANSE["L1-03-s4.dc.html"] = ("#3 · 4/7", regula("Ce cerem", "30 de minute pe lună.", "Și acordul să descriem, fără nume, cum a mers: domeniul, județul, numărul de oameni.", None, E3, P3, "4/7 →"), L, H)
PLANSE["L1-03-s5.dc.html"] = ("#3 · 5/7", coperta("20%", "din abonamentul fiecărei firme aduse, timp de 6 luni.", "De la prima lună plătită. Prețul de după e deja pe site.", E3, P3, "5/7 →"), L, H)
PLANSE["L1-03-s6.dc.html"] = ("#3 · 6/7", regula("Cum vă înscrieți", "Formularul de demonstrație, apoi 20 de minute împreună.", "Alegem firmele potrivite: cu angajați, cu pontaj lunar și cu un administrator de acord.", "înscrieri până pe 15 noiembrie 2026", E3, P3, "6/7 →"), L, H)
PLANSE["L1-03-s7.dc.html"] = ("#3 · 7/7", final("10 cabinete · 20% timp de 6 luni.", "administrativo.ro/pentru-contabili", "Vreau în pilot", E3, P3, "7/7", fundal=USA, text=USA_TEXT), L, H)

PLANSE["L1-04.dc.html"] = (
    "#4 · REGES",
    coperta(
        "20.000 lei", "pe persoană, dacă contractul ajunge în REGES în ziua în care omul începe.",
        "Termenul e ziua dinainte. Plafonul amenzii: 200.000 lei.",
        "ghid · REGES", "legislatie", "", marime=190, amenda=True, temei="HG 295/2025",
    ),
    L, H,
)


def dc_html(titlu, radacina_html, w, h):
    return f"""<!doctype html>
<html lang="ro">
<head>
<meta charset="utf-8">
<title>{titlu}</title>
<script src="./support.js"></script>
</head>
<body>
<x-dc>
<helmet>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="stylesheet" href="{FONTURI.replace('&', '&amp;')}">
<style>
body{{margin:0;font-family:'Inter',sans-serif;background:{HARTIE}}}
</style>
</helmet>
{radacina_html}
</x-dc>
<script type="text/x-dc" data-dc-script data-props='{{"$preview":{{"width":{w},"height":{h}}}}}'>
class Component extends DCLogic {{
renderVals() {{
return {{}};
}}
}}
</script>
</body>
</html>
"""


def html_export(titlu, radacina_html):
    return f"""<!doctype html>
<html lang="ro"><head><meta charset="utf-8"><title>{titlu}</title>
<link rel="stylesheet" href="{FONTURI.replace('&', '&amp;')}">
<style>body{{margin:0}}</style></head>
<body>{radacina_html}</body></html>
"""


# ── Așezarea pe pânză ────────────────────────────────────────────────────────
boards, order, notes = {}, [], {}
PAS_X, PAS_Y = L + 80, H + 420


def aseaza(nume, x, y, pagina):
    titlu, rad, w, h = PLANSE[nume]
    boards[nume] = {"x": x, "y": y, "w": w, "h": h, "title": titlu, "page": pagina}
    order.append(nume)


aseaza("Main.dc.html", 0, 0, "sistem")
aseaza("Banner.dc.html", L + 80, 0, "sistem")
randuri = [
    ("r1", "#1 · marți 29 sept · 6 obligații", [f"L1-01-s{i}.dc.html" for i in range(1, 9)]),
    ("r2", "#2 · joi 1 oct · diurna", ["L1-02.dc.html"]),
    ("r3", "#3 · marți 6 oct · lansarea pilotului", [f"L1-03-s{i}.dc.html" for i in range(1, 8)]),
    ("r4", "#4 · joi 8 oct · REGES, ziua dinainte", ["L1-04.dc.html"]),
]
for r, (cheie, titlu, nume) in enumerate(randuri):
    y = r * PAS_Y
    for i, n in enumerate(nume):
        aseaza(n, i * PAS_X, y, "lot1")
    notes[cheie] = {"x": 0, "y": y - 260, "text": titlu, "kind": "title1", "maxW": max(len(nume), 3) * PAS_X - 80, "page": "lot1"}

canvas = {
    "v": 3,
    "createdOnFiles": {"v": 1, "at": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")},
    "title": "LinkedIn T4 — Administrativo",
    "launch": {"view": "canvas", "page": "lot1"},
    "pages": [{"id": "lot1", "name": "Lotul 1"}, {"id": "sistem", "name": "Sistem și banner"}],
    "boards": boards,
    "order": order,
    "notes": notes,
    "designSystems": [],
}

for nume, (titlu, rad, w, h) in PLANSE.items():
    with open(os.path.join(PROIECT, nume), "w") as f:
        f.write(dc_html(titlu, rad, w, h))
    with open(os.path.join(EXPORT, nume.replace(".dc.html", ".html")), "w") as f:
        f.write(html_export(titlu, rad))
with open(os.path.join(PROIECT, "canvas.json"), "w") as f:
    json.dump(canvas, f, ensure_ascii=False, indent=1)
print(len(PLANSE), "planșe")
