"""Sincronizează dosarul VestVentures cu folderul de pe Google Drive.

Rulare (din rădăcina repo-ului):
    ~/.claude/plugins/data/claude-seo-agricidaniel-claude-seo/.venv/bin/python -I \
        vestventures/tools/sync_drive.py

── DE CE ACTUALIZARE, NU ÎNCĂRCARE NOUĂ ─────────────────────────────────────
Fiecare fișier are un ID ținut în `drive-ids.json`. La a doua rulare, conținutul
se înlocuiește în ACELAȘI fișier (`files.update`), deci linkul trimis cuiva
rămâne valabil și istoricul de versiuni al Drive-ului păstrează varianta veche.
O încărcare nouă ar fi dat un link nou la fiecare corectură.

── DE CE CONTUL ROBOT ───────────────────────────────────────────────────────
Conectorul Drive din Claude primește fișierul ÎN apel, ca text base64: un PDF de
2 MB nu încape. Contul robot (`claude-seo@…`) are drept de editare doar pe
folderul ăsta, partajat explicit, și nimic altceva din Drive.

── DE CE FIȘIERELE SE CREEAZĂ GOALE, DIN ALTĂ PARTE ─────────────────────────
Robotul NU poate crea fișiere: Google răspunde 403 „Service Accounts do not have
storage quota" (7 oct 2026). Poate doar ACTUALIZA un fișier deținut de un om.
Deci un fișier nou din `FISIERE` se creează întâi gol, prin conectorul Drive
din Claude, în folder — PDF de 191 de octeți, Doc sau Sheet gol, după tip —
iar ID-ul lui se trece în `drive-ids.json`. Abia apoi îl umple scriptul.
Proprietarul rămâne omul, cota e a lui.

La o actualizare peste un Doc sau un Sheet, Drive CONVERTEȘTE conținutul:
Markdown devine document, XLSX devine foaie cu formule vii (verificat: 2.715
din 2.715; cele cu `INDEX` se exportă înapoi ca formule-matrice).

Se urcă doar ce e în `FISIERE`. Sursele interne (`_surse/`, `piata.md`) nu pleacă.
"""

import json
import os
import sys
from pathlib import Path

from google.oauth2 import service_account
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError
from googleapiclient.http import MediaFileUpload

FOLDER = "19A22Z9YUyuTqEWHt2lwKg9hRYeABvdpS"
CHEIE = Path("~/.config/claude-seo/service_account.json").expanduser()
RADACINA = Path(__file__).resolve().parent.parent
STARE = Path(__file__).resolve().parent / "drive-ids.json"

PDF = "application/pdf"
XLSX = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
MD = "text/markdown"
DOC = "application/vnd.google-apps.document"
SHEET = "application/vnd.google-apps.spreadsheet"

# cale locală → (titlu pe Drive, tipul conținutului, tipul Google în care se convertește sau None)
FISIERE = {
    "pitch-deck.pdf": ("01 · Pitch deck.pdf", PDF, None),
    "financial-model.xlsx": ("02 · Financial model", XLSX, SHEET),
    "business-plan.pdf": ("03 · Business plan.pdf", PDF, None),
    "roadmap.pdf": ("04 · Roadmap.pdf", PDF, None),
    "cap-table.pdf": ("05 · Cap table.pdf", PDF, None),
    "cap-table.xlsx": ("05 · Cap table (model)", XLSX, SHEET),
    "product-mockups.pdf": ("06 · Product screenshots.pdf", PDF, None),
    "form-answers.md": ("07 · Răspunsuri formular (EN)", MD, DOC),
    "media/demo-video-script.md": ("08 · Demo video script", MD, DOC),
    "README.md": ("00 · Citește-mă (RO)", MD, DOC),
}


def main() -> int:
    cred = service_account.Credentials.from_service_account_file(
        CHEIE, scopes=["https://www.googleapis.com/auth/drive"]
    )
    drive = build("drive", "v3", credentials=cred, cache_discovery=False)
    ids = json.loads(STARE.read_text()) if STARE.exists() else {}
    esuate = []

    for cale, (titlu, tip, google) in FISIERE.items():
        sursa = RADACINA / cale
        media = MediaFileUpload(str(sursa), mimetype=tip, resumable=True)
        try:
            if cale in ids:
                f = drive.files().update(
                    fileId=ids[cale], media_body=media, fields="id,webViewLink"
                ).execute()
                actiune = "actualizat"
            else:
                meta = {"name": titlu, "parents": [FOLDER]}
                if google is not None:
                    meta["mimeType"] = google
                f = drive.files().create(body=meta, media_body=media, fields="id,webViewLink").execute()
                ids[cale] = f["id"]
                actiune = "creat"
            print(f"{actiune:11} {titlu:38} {f['webViewLink']}")
        except HttpError as e:
            esuate.append(cale)
            print(f"EȘUAT      {titlu:38} {e.status_code} {e.reason}", file=sys.stderr)

    STARE.write_text(json.dumps(ids, indent=2, ensure_ascii=False) + "\n")
    return 1 if esuate else 0


if __name__ == "__main__":
    os.chdir(RADACINA)
    sys.exit(main())
