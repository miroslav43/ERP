"""Pozițiile termenilor-țintă din Search Console, ultimele 28 de zile.

Rulare:
  ~/.claude/plugins/data/claude-seo-agricidaniel-claude-seo/.venv/bin/python \
    scripts/seo/pozitii.py >> docs/comercial/cuvinte-cheie-progres.md

Termenul se caută EXACT (operator `equals`), pe toate paginile; coloana „pe țintă”
spune dacă Google afișează chiar pagina pe care o vrem. Un termen fără afișări
apare cu „—”, nu lipsește: absența e informație.

Nu citește și nu tipărește cheia: ia doar calea contului de serviciu din config.
"""

import csv
import datetime as dt
import json
import os
import sys

from google.oauth2 import service_account
from googleapiclient.discovery import build

CONFIG = os.path.expanduser("~/.config/claude-seo/google-api.json")
SITE = "sc-domain:administrativo.ro"
DOMENIU = "https://administrativo.ro"
TINTE = os.path.join(os.path.dirname(__file__), "..", "..", "docs", "comercial", "cuvinte-tinta.tsv")


def main() -> int:
    with open(CONFIG, encoding="utf-8") as f:
        cale_cont = json.load(f)["service_account_path"]
    acreditari = service_account.Credentials.from_service_account_file(
        cale_cont, scopes=["https://www.googleapis.com/auth/webmasters.readonly"]
    )
    gsc = build("searchconsole", "v1", credentials=acreditari, cache_discovery=False)

    sfarsit = dt.date.today() - dt.timedelta(days=3)
    inceput = sfarsit - dt.timedelta(days=27)

    with open(TINTE, encoding="utf-8") as f:
        tinte = list(csv.DictReader(f, delimiter="\t"))

    print(f"\n## {dt.date.today().isoformat()} (date {inceput} – {sfarsit})\n")
    print("| Termen | Afișări | Clicuri | Poziție | Pagina afișată | Pe țintă |")
    print("| --- | ---: | ---: | ---: | --- | :---: |")
    for t in tinte:
        corp = {
            "startDate": inceput.isoformat(),
            "endDate": sfarsit.isoformat(),
            "dimensions": ["page"],
            "dimensionFilterGroups": [
                {"filters": [{"dimension": "query", "operator": "equals", "expression": t["termen"]}]}
            ],
            "rowLimit": 5,
        }
        randuri = gsc.searchanalytics().query(siteUrl=SITE, body=corp).execute().get("rows", [])
        if not randuri:
            print(f"| {t['termen']} | — | — | — | — | — |")
            continue
        r = max(randuri, key=lambda x: x["impressions"])
        pagina = r["keys"][0].replace(DOMENIU, "") or "/"
        pe_tinta = "✅" if pagina == t["pagina"] else "❌"
        print(
            f"| {t['termen']} | {int(r['impressions'])} | {int(r['clicks'])} | "
            f"{r['position']:.1f} | `{pagina}` | {pe_tinta} |"
        )
    return 0


if __name__ == "__main__":
    sys.exit(main())
