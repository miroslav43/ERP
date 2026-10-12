"""Generează planșele LinkedIn T4 — loturile 1 și 2 — din aceeași sursă în două forme:
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


# ── Șabloanele lotului 2 (seria de reach) ────────────────────────────────────
# Marcajele de calendar sunt cele din legenda foii de pontaj de pe sit: CO
# (concediu) verde, SL (sărbătoare legală) ocru, weekendul hașurat. Celula
# primește nuanța deschisă și o bară de culoare sus — culoarea rămâne marcaj,
# textul rămâne cerneală.
NUANTA = {"co": "#d2ddd6", "sl": "#e4dfd1"}
BARA = {"co": CO, "sl": SL}
LUNI_SCURT = ["ian", "feb", "mar", "apr", "mai", "iun", "iul", "aug", "sep", "oct", "nov", "dec"]


def legenda_calendar():
    def element(fundal, bara, text):
        return (
            f'<span style="display: flex; align-items: center; gap: 12px;">'
            f'<span style="width: 34px; height: 26px; background: {fundal}; border-top: {"6px solid " + bara if bara else "none"}; '
            f'border-left: 1px solid {LINIATURA}; border-right: 1px solid {LINIATURA}; border-bottom: 1px solid {LINIATURA}; box-sizing: border-box;"></span>{text}</span>'
        )

    return (
        f'<div style="display: flex; gap: 36px; font-family: {MONO}; font-size: 26px; color: {SLAB};">'
        + element(NUANTA["sl"], SL, "sărbătoare")
        + element(NUANTA["co"], CO, "concediu")
        + element(HASURA, None, "weekend")
        + "</div>"
    )


def grila_saptamani(start, sfarsit, marcaje, inaltime=124):
    """Săptămâni întregi, de luni până duminică, de la `start` la `sfarsit`
    (datetime.date, luni și duminică). `marcaje`: {date: "co" | "sl"}."""
    from datetime import timedelta

    celule, zi = [], start
    while zi <= sfarsit:
        m = marcaje.get(zi)
        weekend = zi.weekday() >= 5
        fundal = NUANTA[m] if m else (HASURA if weekend else "transparent")
        bara = f"border-top: 8px solid {BARA[m]};" if m else f"border-top: 8px solid transparent;"
        liber = bool(m) or weekend
        luna = (
            f'<span style="font-family: {MONO}; font-size: 22px; color: {SLAB}; background: {HARTIE if not m else NUANTA[m]}; padding: 0 4px;">{LUNI_SCURT[zi.month - 1]}</span>'
            if zi.day == 1 or zi == start
            else ""
        )
        greutate = 700 if liber else 400
        culoare = CERNEALA if liber else RIGLA
        celule.append(
            f'<div style="height: {inaltime}px; box-sizing: border-box; {bara} border-right: 1px solid {LINIATURA}; '
            f'border-bottom: 1px solid {LINIATURA}; background: {fundal}; padding: 10px 12px; display: flex; flex-direction: column; justify-content: space-between;">'
            f'<span style="font-family: {DISPLAY}; font-weight: {greutate}; font-size: 48px; line-height: 1; color: {culoare};">'
            f'<span style="background: {NUANTA[m] if m else (HARTIE if weekend else "transparent")}; padding: 0 4px;">{zi.day}</span></span>{luna}</div>'
        )
        zi += timedelta(days=1)
    return (
        f'<div style="display: grid; grid-template-columns: repeat(7, minmax(0, 1fr)); border-left: 1px solid {LINIATURA};">'
        + "".join(celule)
        + "</div>"
    )


def interval(nr, titlu, start, sfarsit, marcaje, eticheta, pilon, pagina, detaliu=None):
    corp = f"""<div style="display: flex; flex-direction: column; gap: 28px; padding-top: 24px;">
<div style="font-family: {MONO}; font-size: 40px; color: {SLAB};">{nr}</div>
<div style="font-family: {DISPLAY}; font-weight: 600; font-size: 76px; line-height: 1.12; max-width: 920px;">{titlu}</div>
{f'<div style="font-size: 36px; line-height: 1.35; color: {SLAB}; max-width: 900px;">{detaliu}</div>' if detaliu else ""}
</div>"""
    calendar = f'<div style="flex-grow: 1; display: flex; flex-direction: column; justify-content: center; gap: 28px;"><div>{banda_zile()}{grila_saptamani(start, sfarsit, marcaje, inaltime=168)}</div>{legenda_calendar()}</div>'
    parti = [antet(eticheta, pilon), corp, calendar, subsol("administrativo.ro", pagina)]
    return radacina("".join(parti), gap=40)


def imagine_interval(cifra, fraza, start, sfarsit, marcaje, eticheta, pilon, temei, marime=200):
    corp = f"""<div style="display: flex; flex-direction: column; gap: 20px;">
<div style="font-family: {DISPLAY}; font-weight: 700; font-size: {marime}px; line-height: 0.92; letter-spacing: -0.02em;">{cifra}</div>
<div style="font-family: {DISPLAY}; font-weight: 500; font-size: 56px; line-height: 1.14; max-width: 920px;">{fraza}</div>
</div>"""
    calendar = f'<div style="flex-grow: 1; display: flex; flex-direction: column; justify-content: center; gap: 28px;"><div>{banda_zile()}{grila_saptamani(start, sfarsit, marcaje, inaltime=168)}</div>{legenda_calendar()}</div>'
    parti = [antet(eticheta, pilon), corp, calendar, temei_celula(temei), subsol("administrativo.ro", "")]
    return radacina("".join(parti), gap=36)


def comparatie(cifra, stanga, dreapta, nota, eticheta, pilon, temei, amenda=False, marime=200):
    """`stanga`/`dreapta`: (eticheta, titlu, sub). Coloana din dreapta e cea
    care contează — cu bara de sus în roșu pentru amenzi, în cerneală altfel."""

    def coloana(et, titlu, sub, accent):
        return (
            f'<div style="border-top: {"10px solid " + accent if accent else "2px solid " + RIGLA}; padding-top: 24px; display: flex; flex-direction: column; gap: 14px;">'
            f'<div style="font-family: {MONO}; font-size: 26px; line-height: 1.3; color: {SLAB}; min-height: 68px;">{et}</div>'
            f'<div style="font-family: {DISPLAY}; font-weight: 700; font-size: {76 if cifra else 92}px; line-height: 1;">{titlu}</div>'
            f'<div style="font-size: 32px; line-height: 1.35; color: {SLAB};">{sub}</div></div>'
        )

    marcaj = (
        f'<div style="display: flex; align-items: center; gap: 14px; font-family: {MONO}; font-size: 30px; color: {SLAB};">'
        f'<span style="width: 24px; height: 24px; background: {AN}; display: inline-block;"></span>amendă</div>'
        if amenda
        else ""
    )
    accent = AN if amenda else CERNEALA
    sus = (
        f'<div style="font-family: {DISPLAY}; font-weight: 700; font-size: {marime}px; line-height: 0.92; letter-spacing: -0.02em;">{cifra}</div>'
        if cifra
        else ""
    )
    corp = f"""<div style="flex-grow: 1; display: flex; flex-direction: column; justify-content: center; gap: 48px;">
{marcaj}{sus}
<div style="display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 40px;">{coloana(*stanga, None if not amenda else accent)}{coloana(*dreapta, accent)}</div>
<div style="font-family: {DISPLAY}; font-weight: 500; font-size: 52px; line-height: 1.16; max-width: 920px;">{nota}</div>
</div>"""
    parti = [antet(eticheta, pilon, amenda=amenda), banda_zile(), corp, temei_celula(temei), subsol("administrativo.ro", "")]
    return radacina("".join(parti))


def mit(nr, se_spune, in_lege, temei, eticheta, pilon, pagina):
    corp = f"""<div style="flex-grow: 1; display: flex; flex-direction: column; justify-content: center; gap: 44px;">
<div style="font-family: {MONO}; font-size: 40px; color: {SLAB};">{nr}</div>
<div style="display: flex; flex-direction: column; gap: 16px;">
<div style="font-family: {MONO}; font-size: 28px; color: {SLAB};">se spune</div>
<div style="font-family: {DISPLAY}; font-weight: 500; font-size: 58px; line-height: 1.14; color: {SLAB}; text-decoration: line-through; text-decoration-thickness: 3px; text-decoration-color: {RIGLA};">{se_spune}</div>
</div>
<div style="border-top: 2px solid {RIGLA}; padding-top: 32px; display: flex; flex-direction: column; gap: 16px;">
<div style="font-family: {MONO}; font-size: 28px; color: {SLAB};">în lege</div>
<div style="font-family: {DISPLAY}; font-weight: 600; font-size: 70px; line-height: 1.12;">{in_lege}</div>
</div>
</div>"""
    parti = [antet(eticheta, pilon), banda_zile(), corp, temei_celula(temei), subsol("administrativo.ro", pagina)]
    return radacina("".join(parti))


def grila(titlu, celule, coloane, eticheta, pilon, pagina, cifra=None, sub=None, temei=None, evidentiate=(), inaltime=150):
    """Celule (sus, mijloc, jos) pe o grilă de foaie; `evidentiate` = indicii cu
    nuanța ocru și bara de sus (de pildă, anii în care Paștele cade pe 2 mai)."""
    html_celule = []
    for i, (sus, mijloc, jos) in enumerate(celule):
        ev = i in evidentiate
        html_celule.append(
            f'<div style="height: {inaltime}px; box-sizing: border-box; padding: 16px 18px; border-right: 1px solid {LINIATURA}; border-bottom: 1px solid {LINIATURA}; '
            f'border-top: 8px solid {SL if ev else "transparent"}; background: {NUANTA["sl"] if ev else "transparent"}; display: flex; flex-direction: column; justify-content: space-between;">'
            f'<span style="font-family: {MONO}; font-size: 26px; color: {SLAB};">{sus}</span>'
            f'<span style="font-family: {DISPLAY}; font-weight: 700; font-size: {58 if coloane <= 3 else 50}px; line-height: 1; white-space: nowrap;">{mijloc}</span>'
            f'<span style="font-family: {MONO}; font-size: 24px; color: {SLAB};">{jos}</span></div>'
        )
    tabel = (
        f'<div style="display: grid; grid-template-columns: repeat({coloane}, minmax(0, 1fr)); border-left: 1px solid {LINIATURA}; border-top: 1px solid {LINIATURA};">'
        + "".join(html_celule)
        + "</div>"
    )
    cap = (
        f'<div style="display: flex; align-items: baseline; gap: 28px;"><span style="font-family: {DISPLAY}; font-weight: 700; font-size: 200px; line-height: 0.9; letter-spacing: -0.02em;">{cifra}</span>'
        f'<span style="font-family: {DISPLAY}; font-weight: 500; font-size: 56px; line-height: 1.12;">{titlu}</span></div>'
        if cifra
        else f'<div style="font-family: {DISPLAY}; font-weight: 600; font-size: 72px; line-height: 1.12; max-width: 920px;">{titlu}</div>'
    )
    corp = f"""<div style="flex-grow: 1; display: flex; flex-direction: column; justify-content: center; gap: 36px;">
{cap}{tabel}
{f'<div style="font-size: 34px; line-height: 1.35; color: {SLAB}; max-width: 900px;">{sub}</div>' if sub else ""}
</div>"""
    parti = [antet(eticheta, pilon), corp]
    if temei:
        parti.append(temei_celula(temei))
    parti.append(subsol("administrativo.ro", pagina))
    return radacina("".join(parti), gap=40)


def ture(cifra, fraza, randuri, eticheta, pilon, temei):
    """O axă de la 14:00 la 6:00 (16 ore), cu noaptea legală 22:00–6:00
    hașurată, și câte o bară pe tură: (început, sfârșit, eticheta, cu spor)."""
    ore = list(range(14, 24)) + list(range(0, 7))
    latime = 936
    pas = latime / 16

    def x(ora):
        return ((ora - 14) % 24) * pas

    etichete = "".join(
        f'<span style="position: absolute; left: {x(o) - 30:.0f}px; width: 60px; text-align: center; font-family: {MONO}; font-size: 22px; color: {SLAB};">{o:02d}</span>'
        for o in ore[::2]
    )
    noapte = f'<div style="position: absolute; left: {x(22):.0f}px; top: 0; bottom: 0; width: {8 * pas:.0f}px; background: {HASURA}; border-left: 2px solid {RIGLA};"></div>'
    bare = []
    for i, (inceput, sfarsit, et, spor) in enumerate(randuri):
        lung = ((sfarsit - inceput) % 24) * pas
        bare.append(
            f'<div style="position: absolute; top: {24 + i * 112}px; left: {x(inceput):.0f}px; width: {lung:.0f}px; height: 64px; '
            f'background: {CERNEALA if spor else LINIATURA}; color: {INV if spor else CERNEALA}; display: flex; align-items: center; padding-left: 16px; box-sizing: border-box; '
            f'font-family: {MONO}; font-size: 26px; white-space: nowrap;">{inceput:02d}–{sfarsit:02d}</div>'
            f'<div style="position: absolute; top: {24 + i * 112 + 70}px; left: {x(inceput):.0f}px; font-family: {MONO}; font-size: 24px; color: {SLAB}; white-space: nowrap; background: {HARTIE}; padding: 0 6px;">{et}</div>'
        )
    inaltime = 44 + len(randuri) * 112
    axa = f"""<div style="position: relative; width: {latime}px; height: {inaltime}px; border-top: 1px solid {LINIATURA}; border-bottom: 1px solid {LINIATURA};">{noapte}{"".join(bare)}</div>
<div style="position: relative; width: {latime}px; height: 30px;">{etichete}</div>
<div style="display: flex; gap: 36px; font-family: {MONO}; font-size: 26px; color: {SLAB};">
<span style="display: flex; align-items: center; gap: 12px;"><span style="width: 34px; height: 26px; background: {HASURA}; border: 1px solid {LINIATURA};"></span>noapte, 22–6</span>
<span style="display: flex; align-items: center; gap: 12px;"><span style="width: 34px; height: 26px; background: {CERNEALA};"></span>cu spor</span>
<span style="display: flex; align-items: center; gap: 12px;"><span style="width: 34px; height: 26px; background: {LINIATURA};"></span>fără spor</span></div>"""
    corp = f"""<div style="display: flex; flex-direction: column; gap: 16px;">
<div style="font-family: {DISPLAY}; font-weight: 700; font-size: 200px; line-height: 0.92; letter-spacing: -0.02em;">{cifra}</div>
<div style="font-family: {DISPLAY}; font-weight: 500; font-size: 60px; line-height: 1.14; max-width: 920px;">{fraza}</div></div>"""
    parti = [antet(eticheta, pilon), corp, '<div style="flex-grow: 1;"></div>', axa, temei_celula(temei), subsol("administrativo.ro", "")]
    return radacina("".join(parti), gap=36)


def zile_weekend(cifra, fraza, zile, nota, eticheta, pilon, temei):
    """Celulele hașurate ale sărbătorilor care cad în weekend: (data, ziua)."""
    celule = "".join(
        f'<div style="height: 150px; box-sizing: border-box; padding: 16px 18px; background: {HASURA}; border-right: 1px solid {LINIATURA}; border-bottom: 1px solid {LINIATURA}; '
        f'border-top: 8px solid {SL}; display: flex; flex-direction: column; justify-content: space-between;">'
        f'<span style="font-family: {DISPLAY}; font-weight: 700; font-size: 50px; line-height: 1;"><span style="background: {HARTIE}; padding: 0 6px;">{d}</span></span>'
        f'<span style="font-family: {MONO}; font-size: 24px; color: {SLAB};"><span style="background: {HARTIE}; padding: 0 6px;">{z}</span></span></div>'
        for d, z in zile
    )
    corp = f"""<div style="flex-grow: 1; display: flex; flex-direction: column; justify-content: center; gap: 36px;">
<div style="font-family: {DISPLAY}; font-weight: 700; font-size: 220px; line-height: 0.92; letter-spacing: -0.02em;">{cifra}</div>
<div style="font-family: {DISPLAY}; font-weight: 500; font-size: 60px; line-height: 1.14; max-width: 920px;">{fraza}</div>
<div style="display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); border-left: 1px solid {LINIATURA}; border-top: 1px solid {LINIATURA};">{celule}</div>
<div style="font-size: 38px; line-height: 1.35; color: {SLAB}; max-width: 900px;">{nota}</div>
</div>"""
    parti = [antet(eticheta, pilon), corp, temei_celula(temei), subsol("administrativo.ro", "")]
    return radacina("".join(parti))


# ── Planșele lotului 2 ───────────────────────────────────────────────────────
from datetime import date, timedelta


def zile_de(inceput, sfarsit, tip):
    z, d = {}, inceput
    while d <= sfarsit:
        z[d] = tip
        d += timedelta(days=1)
    return z


LEG = "legislatie"

PLANSE["L2-05.dc.html"] = (
    "#5 · sărbători în weekend",
    zile_weekend(
        "8 din 17", "sărbători legale cad în weekend în 2027.",
        [("2 ian", "sâmbătă"), ("24 ian", "duminică"), ("1 mai", "sâmbătă"), ("2 mai", "duminică · Paștele"),
         ("20 iun", "duminică · Rusalii"), ("15 aug", "duminică"), ("25 dec", "sâmbătă"), ("26 dec", "duminică")],
        "Nu se dă o zi liberă în schimb.", "calendar · 2027", LEG, "art. 139 · art. 142 Codul muncii",
    ),
    L, H,
)

E6 = "calendar · 2027"
punti = [
    ("01", "1–10 ianuarie: 3 zile de concediu → 10 zile libere.", date(2026, 12, 28), date(2027, 1, 10),
     {date(2027, 1, 1): "sl", date(2027, 1, 2): "sl", date(2027, 1, 6): "sl", date(2027, 1, 7): "sl",
      date(2027, 1, 4): "co", date(2027, 1, 5): "co", date(2027, 1, 8): "co"}),
    ("02", "30 aprilie – 9 mai: 4 zile de concediu → 10 zile libere.", date(2027, 4, 26), date(2027, 5, 9),
     {date(2027, 4, 30): "sl", date(2027, 5, 1): "sl", date(2027, 5, 2): "sl", date(2027, 5, 3): "sl",
      **zile_de(date(2027, 5, 4), date(2027, 5, 7), "co")}),
    ("03", "29 mai – 1 iunie: o zi de concediu → 4 zile libere.", date(2027, 5, 24), date(2027, 6, 6),
     {date(2027, 5, 31): "co", date(2027, 6, 1): "sl"}),
    ("04", "27 noiembrie – 5 decembrie: 3 zile de concediu → 9 zile libere.", date(2027, 11, 22), date(2027, 12, 5),
     {date(2027, 11, 29): "co", date(2027, 11, 30): "sl", date(2027, 12, 1): "sl", date(2027, 12, 2): "co", date(2027, 12, 3): "co"}),
]
PLANSE["L2-06-s1.dc.html"] = ("#6 · 1/8", coperta("33 de zile", "libere în 2027, cu 11 zile de concediu.", "Patru punți, calculate pe calendarul legal.", E6, LEG, "1/8 →", marime=200), L, H)
for i, (nr, t, a, b, m) in enumerate(punti, start=2):
    PLANSE[f"L2-06-s{i}.dc.html"] = (f"#6 · {i}/8", interval(nr, t, a, b, m, E6, LEG, f"{i}/8 →"), L, H)
PLANSE["L2-06-s6.dc.html"] = ("#6 · 6/8", regula("Unde nu e nimic de legat", "Crăciunul, 15 august, 24 ianuarie și 1 mai cad în weekend.", "Legea nu dă o zi în schimb.", "art. 139 Codul muncii", E6, LEG, "6/8 →"), L, H)
PLANSE["L2-06-s7.dc.html"] = ("#6 · 7/8", regula("Termenul", "Programarea pe 2027 se face până pe 31 decembrie 2026.", "Plus 10 zile lucrătoare neîntrerupte, pe lângă punți.", "art. 148 alin. (1) și (5) Codul muncii", E6, LEG, "7/8 →"), L, H)
PLANSE["L2-06-s8.dc.html"] = ("#6 · 8/8", final("Salvați-l pentru decembrie.", "administrativo.ro/ghid/zile-libere", "Urmărește pagina", E6, LEG, "8/8"), L, H)

PLANSE["L2-07.dc.html"] = (
    "#7 · capcana de 1 leu",
    comparatie(
        "−85 lei",
        ("la minim", "2.699 lei", "net, din 4.325 lei brut"),
        ("cu 1 leu în plus", "2.614 lei", "net, din 4.326 lei brut"),
        "Netul revine abia la 4.480 lei brut.",
        "ghid · salariul minim", LEG, "OUG 89/2025, art. III · până pe 31.12.2026",
    ),
    L, H,
)

E8, P8 = "culise · REGES", "culise"
PLANSE["L2-08-s1.dc.html"] = ("#8 · 1/7", coperta("5 canale, nu 1", "pe care vin răspunsurile din REGES-Online.", "Ce am aflat legând un program de registru.", E8, P8, "1/7 →", marime=170), L, H)
reguli_8 = [
    ("01", "Nu există o cheie a furnizorului.", "Fiecare angajator își generează accesul din contul propriu. Întrebați: cum transmiteți în numele meu?"),
    ("02", "Răspunsurile vin pe cinci cozi.", "Statusurile, plus propunerile de detașare și de mutare, trimise și primite. Fiecare cu cursorul ei."),
    ("03", "Documentația le amestecă.", "O integrare scrisă doar după ea pierde în tăcere răspunsurile pe detașări și mutări."),
    ("04", "Unele operații din exemple nu există așa.", "Schema tehnică reală spune altceva. Le-am verificat pe rând, direct pe API."),
]
for i, (nr, t, d) in enumerate(reguli_8, start=2):
    PLANSE[f"L2-08-s{i}.dc.html"] = (f"#8 · {i}/7", regula(nr, t, d, None, E8, P8, f"{i}/7 →"), L, H)
PLANSE["L2-08-s6.dc.html"] = ("#8 · 6/7", regula("Indiferent de program", "Contractul pleacă în ziua dinainte.", "Altfel, 20.000 lei pe persoană, cu plafon de 200.000 lei.", "art. 9 alin. (1) HG 295/2025", E8, P8, "6/7 →"), L, H)
PLANSE["L2-08-s7.dc.html"] = ("#8 · 7/7", final("Automat nu înseamnă complet.", "administrativo.ro/reges-online", "Urmărește pagina", E8, P8, "7/7"), L, H)

PLANSE["L2-09.dc.html"] = (
    "#9 · concediul din noiembrie",
    imagine_interval(
        "8, nu 10", "zile de concediu pentru 23 noiembrie – 4 decembrie 2026.",
        date(2026, 11, 23), date(2026, 12, 6),
        {**zile_de(date(2026, 11, 23), date(2026, 11, 27), "co"), date(2026, 11, 30): "sl", date(2026, 12, 1): "sl",
         **zile_de(date(2026, 12, 2), date(2026, 12, 4), "co")},
        "ghid · concediu", LEG, "art. 145 alin. (3) Codul muncii",
    ),
    L, H,
)

PLANSE["L2-10.dc.html"] = (
    "#10 · 18 luni",
    coperta("18 luni", "nu înseamnă că zilele de concediu expiră.",
            "Contează dacă angajatorul a oferit efectiv concediul. Decizia ÎCCJ HP nr. 40/2026.",
            "ghid · concediu", LEG, "", marime=220, temei="art. 146 alin. (2) Codul muncii · MO 665/11.08.2026"),
    L, H,
)

E11 = "ghid · control ITM"
PLANSE["L2-11-s1.dc.html"] = ("#11 · 1/8", coperta("8", "documente cerute la un control de fond.", "Nu se citesc separat. Se compară.", E11, LEG, "1/8 →"), L, H)
reguli_11 = [
    ("Registrele", "Registrul unic de control și extrasul din REGES-Online.", None, "Legea 252/2003 · HG 295/2025"),
    ("02", "Dosarele de personal.", "Câte unul pentru fiecare salariat.", "art. 8 HG 295/2025"),
    ("03", "Contractele și actele adiționale.", "Cu o copie la locul de muncă.", "art. 16–17 Codul muncii"),
    ("04", "Evidența orelor, zilnic, cu ora de început și de sfârșit.", "De aici pornesc cele mai multe constatări.", "art. 119 alin. (1) Codul muncii"),
    ("05", "Foile de prezență și statele de plată.", "Cerute împreună cu evidența orelor, ca să fie comparate.", "art. 25 Legea 82/1991"),
    ("Regulamentul și SSM", "Regulamentul intern, contractul colectiv, fișele de aptitudini și de instruire.", None, "art. 243 C.m. · Legea 319/2006"),
]
for i, (nr, t, d, tm) in enumerate(reguli_11, start=2):
    PLANSE[f"L2-11-s{i}.dc.html"] = (f"#11 · {i}/8", regula(nr, t, d or "", tm, E11, LEG, f"{i}/8 →"), L, H)
PLANSE["L2-11-s8.dc.html"] = ("#11 · 8/8", final("Nu se citesc separat. Se compară.", "administrativo.ro/ghid/control-itm", "Urmărește pagina", E11, LEG, "8/8"), L, H)

E12 = "ghid · mituri"
PLANSE["L2-12-s1.dc.html"] = ("#12 · 1/8", coperta("6", "lucruri care „se știu” și nu sunt în Codul muncii.", "Fiecare, lângă articolul care spune altceva.", E12, LEG, "1/8 →"), L, H)
mituri = [
    ("01", "„După 5 ani de vechime ai o zi în plus.”", "Codul muncii nu dă zile pentru vechime. Grilele vin din contracte.", "art. 145 alin. (2) · art. 147 Codul muncii"),
    ("02", "„Ai voie atâtea ore suplimentare pe lună.”", "Limita e pe săptămână: 48 de ore, cu tot cu suplimentarele.", "art. 114 Codul muncii"),
    ("03", "„Concediul nefăcut se plătește la sfârșit de an.”", "În bani, numai la încetarea contractului.", "art. 146 alin. (3) Codul muncii"),
    ("04", "„Diurna se dă doar peste 5 km.”", "Pragul e din HG 714/2018, scrisă pentru sectorul public.", "art. 43–44 Codul muncii"),
    ("05", "„Sărbătoarea din weekend se recuperează.”", "Nu se dă nicio zi în schimb.", "art. 139 Codul muncii"),
    ("06", "„Ai 1,67 zile de concediu pe lună.”", "Dreptul e anual. 20 ÷ 12 e o împărțire din practică.", "art. 145 alin. (1) Codul muncii"),
]
for i, (nr, s, l, tm) in enumerate(mituri, start=2):
    PLANSE[f"L2-12-s{i}.dc.html"] = (f"#12 · {i}/8", mit(nr, s, l, tm, E12, LEG, f"{i}/8 →"), L, H)
PLANSE["L2-12-s8.dc.html"] = ("#12 · 8/8", final("Ce e în contract se negociază. Ce e în lege, nu.", "administrativo.ro/ghid", "Urmărește pagina", E12, LEG, "8/8"), L, H)

E13, P13 = "culise · calendar", "culise"
paste = [("2026", "12 apr"), ("2027", "2 mai"), ("2028", "16 apr"), ("2029", "8 apr"), ("2030", "28 apr"),
         ("2031", "13 apr"), ("2032", "2 mai"), ("2033", "24 apr"), ("2034", "9 apr"), ("2035", "29 apr")]
PLANSE["L2-13-s1.dc.html"] = ("#13 · 1/7", coperta("29 apr 2035", "Paștele ortodox. Calculat, nu căutat.", "Cum știe un program de pontaj sărbătorile din anii care vin.", E13, P13, "1/7 →", marime=170), L, H)
PLANSE["L2-13-s2.dc.html"] = (
    "#13 · 2/7",
    grila("Zece ani de Paște, dintr-o singură formulă.", [(a, d, "duminică") for a, d in paste], 5, E13, P13, "2/7 →", inaltime=180,
          temei="art. 139 alin. (1) Codul muncii"),
    L, H,
)
PLANSE["L2-13-s3.dc.html"] = ("#13 · 3/7", regula("01", "12 sărbători fixe, 5 care se mută.", "Vinerea Mare, cele două zile de Paști și cele două de Rusalii.", "art. 139 alin. (1) Codul muncii", E13, P13, "3/7 →"), L, H)
PLANSE["L2-13-s4.dc.html"] = ("#13 · 4/7", regula("02", "Formula dă data în calendarul iulian.", "Apoi se adaugă diferența față de cel gregorian: 13 zile în secolul nostru. Rusaliile vin la 7 săptămâni după.", None, E13, P13, "4/7 →"), L, H)
PLANSE["L2-13-s5.dc.html"] = ("#13 · 5/7", regula("03", "Un calcul, două locuri.", "În baza de date și în aplicație, scrise să dea aceeași dată. O zi de diferență = o cerere de concediu greșită.", None, E13, P13, "5/7 →"), L, H)
PLANSE["L2-13-s6.dc.html"] = ("#13 · 6/7", regula("04", "Alt cult, altă dată.", "În 2027: Paștele catolic pe 28 martie, cel ortodox pe 2 mai. Salariatul primește zilele cultului său.", "art. 139 alin. (2¹) Codul muncii", E13, P13, "6/7 →"), L, H)
PLANSE["L2-13-s7.dc.html"] = ("#13 · 7/7", final("Foaia de pontaj de pe site folosește același calcul.", "administrativo.ro/unelte/foaie-de-pontaj", "Urmărește pagina", E13, P13, "7/7"), L, H)

PLANSE["L2-14.dc.html"] = (
    "#14 · spor de noapte",
    ture("23:00", "o oră de noapte, zero spor.",
         [(14, 22, "0 ore de noapte", False), (15, 23, "1 oră · fără spor", False), (17, 1, "3 ore · spor 25%", True), (22, 6, "8 ore · spor 25%", True)],
         "ghid · spor de noapte", LEG, "art. 125–126 Codul muncii"),
    L, H,
)

PLANSE["L2-15.dc.html"] = (
    "#15 · ore suplimentare",
    coperta("48 de ore", "pe săptămână. Pe lună, legea nu dă nicio cifră.",
            "Întâi timp liber, în 90 de zile. Abia apoi spor de cel puțin 75%.",
            "ghid · ore suplimentare", LEG, "", marime=200, temei="art. 114 · art. 122–123 Codul muncii"),
    L, H,
)

E16, P16 = "culise · securitate", "culise"
PLANSE["L2-16-s1.dc.html"] = ("#16 · 1/7", coperta("0 rânduri", "din firma A, oricât ar căuta cineva din firma B.", "Cum se țin separat datele firmelor.", E16, P16, "1/7 →", marime=200), L, H)
reguli_16 = [
    ("01", "Separarea stă în baza de date.", "Nu în fiecare ecran. Fiecare rând poartă firma lui, iar baza refuză să-l arate altcuiva."),
    ("02", "O scăpare dă o listă goală.", "Nu datele altei firme. La fel pentru exporturi, rapoarte și căutare."),
    ("03", "Exportul poartă firma deschisă.", "Cât lucrați pe firma B, datele firmei A nu există pentru voi."),
    ("04", "Testăm în ambele direcții.", "Că nimeni nu vede ce n-are voie. Și că cine are voie chiar poate lucra."),
    ("05", "Cheile le dă firma.", "Fiecare cabinet e invitat separat, cu un rol ales de administrator. Clientul pleacă: accesul la el dispare."),
]
for i, (nr, t, d) in enumerate(reguli_16, start=2):
    PLANSE[f"L2-16-s{i}.dc.html"] = (f"#16 · {i}/7", regula(nr, t, d, None, E16, P16, f"{i}/7 →"), L, H)
PLANSE["L2-16-s7.dc.html"] = ("#16 · 7/7", final("Securitatea care blochează munca nu e securitate.", "administrativo.ro/pentru-contabili", "Urmărește pagina", E16, P16, "7/7"), L, H)

PLANSE["L2-17.dc.html"] = (
    "#17 · indemnizația",
    coperta("3 luni", "media lor, nu salariul lunii în care plecați.",
            "Indemnizația se plătește cu cel puțin 5 zile lucrătoare înainte de concediu.",
            "ghid · concediu", LEG, "", marime=220, temei="art. 150 Codul muncii"),
    L, H,
)

luni_2027 = [("ian", 18), ("feb", 20), ("mar", 23), ("apr", 21), ("mai", 20), ("iun", 20),
             ("iul", 22), ("aug", 22), ("sep", 22), ("oct", 21), ("nov", 21), ("dec", 22)]
PLANSE["L2-18.dc.html"] = (
    "#18 · 2027 pe luni",
    grila("zile lucrătoare în 2027.", [(l, str(z), f"{z * 8} ore") for l, z in luni_2027], 3, "calendar · 2027", LEG, "",
          cifra="252", sub="2.016 ore la normă întreagă. Norma lunii = zilele lucrătoare × 8.", temei="art. 139 Codul muncii", evidentiate=(0, 2), inaltime=148),
    L, H,
)

PLANSE["L2-19.dc.html"] = (
    "#19 · două amenzi",
    comparatie(
        None,
        ("fără contract de muncă", "40.000 lei", "pe persoană · plafon 1.000.000 lei"),
        ("cu contract, netrimis în REGES în ziua dinainte", "20.000 lei", "pe persoană · plafon 200.000 lei"),
        "Două fapte, două amenzi. Circulă amestecate.",
        "ghid · REGES", LEG, "art. 260 alin. (1) lit. e) C.m. · art. 9 alin. (1) HG 295/2025", amenda=True,
    ),
    L, H,
)

PLANSE["L2-21.dc.html"] = (
    "#21 · îngrijitor",
    coperta("5 zile", "lucrătoare pe an: concediul de îngrijitor.",
            "Nu se scade din concediul de odihnă. Neacordat: 4.000–8.000 lei.",
            "ghid · concediu", LEG, "", marime=220, amenda=True, temei="art. 152¹ · art. 260 alin. (1) lit. t) Codul muncii"),
    L, H,
)

PLANSE["L2-22.dc.html"] = (
    "#22 · 24 de luni",
    coperta("24 de luni", "cel mult, pe salariul minim.",
            "După aceea, salariul de bază trebuie să fie peste minim.",
            "ghid · salariul minim", LEG, "", marime=200, temei="art. 164 alin. (8) Codul muncii"),
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
    notes[cheie] = {"x": 0, "y": y - 260, "w": 240, "text": titlu, "kind": "title1", "maxW": max(len(nume), 3) * PAS_X - 80, "page": "lot1"}

randuri_2 = [
    ("#5 · luni 12 oct · 8 din 17 sărbători în weekend", ["L2-05.dc.html"]),
    ("#6 · marți 13 oct · punțile din 2027", [f"L2-06-s{i}.dc.html" for i in range(1, 9)]),
    ("#7 · miercuri 14 oct · capcana de 1 leu", ["L2-07.dc.html"]),
    ("#8 · joi 15 oct · REGES prin API", [f"L2-08-s{i}.dc.html" for i in range(1, 8)]),
    ("#9 · vineri 16 oct · 8 zile, nu 10", ["L2-09.dc.html"]),
    ("#10 · luni 19 oct · 18 luni", ["L2-10.dc.html"]),
    ("#11 · marți 20 oct · control ITM", [f"L2-11-s{i}.dc.html" for i in range(1, 9)]),
    ("#12 · miercuri 21 oct · 6 mituri", [f"L2-12-s{i}.dc.html" for i in range(1, 9)]),
    ("#13 · joi 22 oct · Paștele calculat", [f"L2-13-s{i}.dc.html" for i in range(1, 8)]),
    ("#14 · vineri 23 oct · spor de noapte", ["L2-14.dc.html"]),
    ("#15 · luni 26 oct · ore suplimentare", ["L2-15.dc.html"]),
    ("#16 · marți 27 oct · 0 rânduri", [f"L2-16-s{i}.dc.html" for i in range(1, 8)]),
    ("#17 · miercuri 28 oct · indemnizația", ["L2-17.dc.html"]),
    ("#18 · joi 29 oct · 2027 pe luni", ["L2-18.dc.html"]),
    ("#19 · vineri 30 oct · două amenzi", ["L2-19.dc.html"]),
    ("#21–#22 · rezerve", ["L2-21.dc.html", "L2-22.dc.html"]),
]
for r, (titlu, nume) in enumerate(randuri_2):
    y = r * PAS_Y
    for i, n in enumerate(nume):
        aseaza(n, i * PAS_X, y, "lot2")
    notes[f"l2r{r}"] = {"x": 0, "y": y - 260, "w": 240, "text": titlu, "kind": "title1", "maxW": max(len(nume), 3) * PAS_X - 80, "page": "lot2"}

canvas = {
    "v": 3,
    # Câmpurile pe care aplicația pânzei le adaugă singură; păstrate, ca republicarea să nu le șteargă.
    "attachments": {},
    "createdOnFiles": {"v": 1, "at": "2026-09-23T16:46:34Z"},
    "title": "LinkedIn T4 — Administrativo",
    "launch": {"view": "canvas", "page": "lot2"},
    "pages": [{"id": "lot2", "name": "Lotul 2 · seria de reach"}, {"id": "lot1", "name": "Lotul 1"}, {"id": "sistem", "name": "Sistem și banner"}],
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
