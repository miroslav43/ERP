#!/usr/bin/env python3
"""Altoiește ieșirea brută a generatorului de tipuri Supabase peste convențiile repo-ului.

    bash .claude/skills/administrativo/scripts/banc-migrare.sh --pastreaza
    PORT=$(docker ps --filter name=administrativo-banc --format '{{.Ports}}' \
           | grep -oE '0.0.0.0:[0-9]+' | head -1 | cut -d: -f2)
    pnpm exec supabase gen types typescript \
      --db-url "postgresql://postgres:banc@localhost:$PORT/postgres" \
      | python3 scripts/altoieste-tipuri.py > src/types/database.ts

DE CE EXISTĂ FIȘIERUL ĂSTA
`src/types/database.ts` are două abateri deliberate față de ieșirea generatorului,
amândouă documentate în antetul lui, amândouă pierdute la o regenerare oarbă:

  1. antetul propriu-zis, care spune de unde vin tipurile;
  2. `| null` pe argumentele opționale ale celor trei RPC-uri cu `default null` —
     generatorul le tipează doar `?: T`, dar apelanții trimit explicit `null`,
     nu omit cheia. Fără patch, regenerarea rupe fișiere care n-au nicio treabă
     cu schema schimbată.

Reaplicarea lor manuală a fost făcută de două ori dintr-un script ținut în
scratchpad, care s-a pierdut de fiecare dată. De aici, în repo.

`--verifica <fișier>` compară numărul de intrări din ieșirea altoită cu cel din
brut: o altoire care taie o tabelă din greșeală ar trece altfel neobservată.
"""

from __future__ import annotations

import re
import sys

# Rezerva folosită când scriptul rulează fără `--db-url`. NU e sursa de adevăr:
# lista scrisă de mână a rămas deja în urmă o dată — `trimite_saptamana_pontaj`
# a apărut în 0084 cu `p_employee_id ... default null`, nimeni n-a adăugat-o
# aici, iar prima regenerare de după a rupt `pontaj/saptamana/actions.ts` fără
# nicio schimbare de schemă. Cu `--db-url`, lista se citește din catalog.
RPC_CU_NULL_IMPLICIT = frozenset(
    {"hr_write_sensitive", "log_audit_event", "submit_demo_request", "trimite_saptamana_pontaj"}
)


def argumente_cu_default_null(db_url: str) -> dict[str, set[str]]:
    """Citește din catalog ce parametri au chiar `DEFAULT NULL`.

    `pg_get_function_arguments` redă semnătura ca text, cu tot cu valorile
    implicite: `p_org uuid, p_secunde integer DEFAULT 300`. Distincția contează —
    `reges_ia_inchirierea.p_secunde` are `default 300`, unde `null` ar fi GREȘIT:
    omisiunea trebuie să lase serverul să pună 300, nu să primească null.
    """
    import subprocess

    sql = """
      select p.proname || ' :: ' || pg_catalog.pg_get_function_arguments(p.oid)
        from pg_catalog.pg_proc p
        join pg_catalog.pg_namespace n on n.oid = p.pronamespace
       where n.nspname = 'public' and p.pronargdefaults > 0
    """
    iesire = subprocess.run(
        ["psql", db_url, "-tA", "-c", sql],
        capture_output=True, text=True, check=True,
    ).stdout

    harta: dict[str, set[str]] = {}
    for linie in iesire.splitlines():
        if " :: " not in linie:
            continue
        nume, semnatura = linie.split(" :: ", 1)
        for arg in semnatura.split(", "):
            bucati = arg.split()
            # Valoarea implicită se redă cu tot cu castul: `DEFAULT NULL::text`,
            # nu `DEFAULT NULL`. O potrivire exactă pe „NULL" nu prinde nimic —
            # și tace, ceea ce e mai rău decât să cadă.
            if (len(bucati) >= 2 and bucati[-2].upper() == "DEFAULT"
                    and bucati[-1].upper().startswith("NULL")):
                harta.setdefault(nume, set()).add(bucati[0])
    return harta

ANTET = """// GENERAT AUTOMAT — nu edita manual.
//
// Regenerare: `scripts/altoieste-tipuri.py` peste ieșirea lui
// `supabase gen types typescript --db-url <bancul local>`. Bancul se ridică cu
// `banc-migrare.sh --pastreaza`, deci tipurile ies din MIGRĂRILE din repo, nu
// din starea cloud-ului — care poate avea drift.
//
// Argumentele SQL cu `default null` primesc înapoi `| null`: generatorul le
// tipează doar `?: T` (omisibil), dar apelanții existenți trimit explicit
// `null`, nu omit cheia. Lista se citește din catalog, nu din memorie. Fără patch,
// regenerarea rupe fișierele care apelează aceste RPC-uri fără nicio schimbare
// reală de schemă. Patch-ul e mecanic, aplicat de script.
//
// Generatorul CLI poate adăuga și schema `graphql_public`; e eliminată tot
// acolo, pentru că `src/lib/supabase/server.ts` tipează clientul strict pe
// `public`.
"""

INTRARE = re.compile(r"^      [A-Za-z_][A-Za-z0-9_]*: \{$", re.MULTILINE)
# Tipul e luat ca text până la capătul liniei, nu ca identificator: două
# argumente sunt tipate `Database["public"]["Enums"][...]`, iar un tipar prea
# strâns le sărea — 24 de argumente altoite în loc de 26, fără nicio plângere.
ARG_OPTIONAL = re.compile(r"^(\s+)(\w+)\?: (?!.*\|\s*null\s*$)(\S.*?)\s*$")


def numara_intrari(text: str) -> int:
    return len(INTRARE.findall(text))


def adauga_null(text: str, harta: dict[str, set[str]] | None) -> str:
    """Pune `| null` pe argumentele care au chiar `DEFAULT NULL` în SQL."""
    linii = text.split("\n")
    rpc_curent: str | None = None
    in_args = False
    atinse = 0

    for i, linie in enumerate(linii):
        antet_rpc = re.match(r"^      (\w+): \{$", linie)
        if antet_rpc:
            rpc_curent = antet_rpc.group(1)
            in_args = False
            continue
        vizat = (
            rpc_curent in harta if harta is not None else rpc_curent in RPC_CU_NULL_IMPLICIT
        )
        if vizat:
            if linie.strip() == "Args: {":
                in_args = True
                continue
            if in_args and linie.strip() == "}":
                in_args = False
                continue
            if in_args:
                m = ARG_OPTIONAL.match(linie)
                if m and (harta is None or m.group(2) in harta[rpc_curent]):
                    linii[i] = f"{m.group(1)}{m.group(2)}?: {m.group(3)} | null"
                    atinse += 1

    print(f"altoire: {atinse} argumente au primit `| null`", file=sys.stderr)
    return "\n".join(linii)


def scoate_graphql(text: str) -> str:
    """Taie schema `graphql_public`, dacă generatorul a emis-o."""
    inceput = text.find("\n  graphql_public: {")
    if inceput == -1:
        return text
    adancime = 0
    for poz in range(inceput + 1, len(text)):
        if text[poz] == "{":
            adancime += 1
        elif text[poz] == "}":
            adancime -= 1
            if adancime == 0:
                sfarsit = poz + 1
                if text[sfarsit : sfarsit + 1] == "\n":
                    sfarsit += 1
                print("altoire: schema graphql_public eliminată", file=sys.stderr)
                return text[:inceput] + "\n" + text[sfarsit:]
    raise SystemExit("altoire: blocul graphql_public nu se închide — refuz să ghicesc.")


def main() -> None:
    db_url = None
    if "--db-url" in sys.argv:
        db_url = sys.argv[sys.argv.index("--db-url") + 1]

    brut = sys.stdin.read()
    if "export type Database" not in brut:
        raise SystemExit("altoire: intrarea nu arată a ieșire de `supabase gen types`.")

    harta = argumente_cu_default_null(db_url) if db_url else None
    if harta is None:
        print("altoire: fără --db-url, folosesc lista de rezervă", file=sys.stderr)
    else:
        print(f"altoire: {len(harta)} RPC-uri cu DEFAULT NULL, citite din catalog", file=sys.stderr)

    inainte = numara_intrari(brut)
    iesire = ANTET + "\n" + adauga_null(scoate_graphql(brut), harta).lstrip("\n")
    dupa = numara_intrari(iesire)

    # Verificarea din memoria proiectului: o altoire care pierde o tabelă e
    # invizibilă la citire și devine `never` abia la primul apel din cod.
    if inainte != dupa:
        raise SystemExit(f"altoire: {inainte} intrări la intrare, {dupa} la ieșire — REFUZ.")

    print(f"altoire: {dupa} intrări, neschimbate", file=sys.stderr)
    sys.stdout.write(iesire)


if __name__ == "__main__":
    main()
