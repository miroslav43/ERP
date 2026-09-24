"""Capturile din aplicație, pregătite pentru LaTeX.

Sursa sunt capturile de pe site, `public/capturi/*.webp`, făcute pe firma de
demonstrație. XeLaTeX (xdvipdfmx) nu citește WebP, deci aici se transformă în
JPEG. Numele rămâne cheia de modul din `src/config/features.ts`
(`attendance.jpg`, `per_diem.jpg`) — aceeași cheie ca în capturile site-ului.

Lățimea de 1280 px e aleasă pentru o captură de ~6,5 cm pe slide: la tipar
înseamnă ~500 dpi, deci nu se vede pixelul, iar PDF-ul rămâne sub 3 MB.

Rulare, din rădăcina repo-ului, după orice captură nouă în `public/capturi/`:

    python3 docs/comercial/capturi/converteste.py
"""

from pathlib import Path

from PIL import Image

RADACINA = Path(__file__).resolve().parents[3]
SURSA = RADACINA / "public" / "capturi"
DESTINATIE = Path(__file__).resolve().parent

LATIME_ECRAN = 1280
CALITATE = 85


def salveaza(sursa: Path, destinatie: Path, latime: int) -> None:
    with Image.open(sursa) as imagine:
        imagine = imagine.convert("RGB")
        if imagine.width > latime:
            inaltime = round(imagine.height * latime / imagine.width)
            imagine = imagine.resize((latime, inaltime), Image.Resampling.LANCZOS)
        imagine.save(destinatie, "JPEG", quality=CALITATE, optimize=True, progressive=True)
    print(f"{destinatie.name}: {destinatie.stat().st_size // 1024} KB")


def main() -> None:
    # Ecranele de birou: `<cheie>-1920.webp`, 16:10.
    for sursa in sorted(SURSA.glob("*-1920.webp")):
        cheie = sursa.name.removesuffix("-1920.webp")
        salveaza(sursa, DESTINATIE / f"{cheie}.jpg", LATIME_ECRAN)

    # Portalul e fotografiat pe telefon, în portret: se păstrează la 780 px,
    # fiindcă pe slide stă îngust, două capturi alăturate.
    for sursa in sorted(SURSA.glob("portal-*-780.webp")):
        nume = sursa.name.removesuffix("-780.webp")
        salveaza(sursa, DESTINATIE / f"{nume}.jpg", 780)


if __name__ == "__main__":
    main()
