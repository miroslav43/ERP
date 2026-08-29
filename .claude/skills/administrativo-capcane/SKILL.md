---
name: administrativo-capcane
description: Caută în cele 37 de capcane cunoscute ale schemei Administrativo, după codul de eroare Postgres/PostgREST (42501, 42P10, 23505, 42703, 428C9, 22P02, P0001, PGRST116), după tabelă, modul sau rol. Acoperă și capcanele TĂCUTE — cele care nu produc nicio eroare: UPDATE cu zero rânduri, listă goală, meniu gol, embed NULL, trunchiere la 1000 de rânduri. Se folosește ÎNAINTE de a scrie cod care atinge o tabelă și ori de câte ori o scriere eșuează, o citire întoarce zero rânduri sau un ecran apare gol fără explicație.
---

# Capcanele schemei Administrativo

`docs/design/ecrane/capcane.md` are 37 de capcane verificate empiric, fiecare cu
fișierul afectat. Documentul e sursa de adevăr; acest skill e doar căutarea.

## 1. Cum cauți

```bash
node .claude/skills/administrativo/scripts/capcana.mjs 42501          # după cod
node .claude/skills/administrativo/scripts/capcana.mjs --tabela attendance_entries
node .claude/skills/administrativo/scripts/capcana.mjs --modul flota
node .claude/skills/administrativo/scripts/capcana.mjs --rol manager
node .claude/skills/administrativo/scripts/capcana.mjs --tacute       # fără cod de eroare
node .claude/skills/administrativo/scripts/capcana.mjs --nr 7         # textul integral
```

Scriptul parsează `capcane.md` **la rulare**. Nu există index duplicat, deci
nu poate rugini: dacă documentul crește la 40 de capcane, căutarea le vede imediat.

## 2. Cele nouă coduri și ce înseamnă AICI

| Cod        | Sensul în acest repo                                                                                                                           |
| ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| `42501`    | RLS a respins o **scriere** (`WITH CHECK` sau `USING`). La SELECT, RLS nu aruncă — filtrează.                                                  |
| `42P10`    | `ON CONFLICT` nu găsește constrângere — indexul unic e **parțial**. Pică la PLANIFICARE, deci la fiecare apel.                                 |
| `23505`    | Violare de unicitate — de regulă reordonare fără slot de parcare.                                                                              |
| `42703`    | Coloană inexistentă — de regulă `deleted_at` pe o tabelă care n-o are.                                                                         |
| `428C9`    | Coloană `GENERATED ALWAYS` trimisă din client.                                                                                                 |
| `22P02`    | Format nepermis — șir gol dintr-un filtru URL ajuns la `uuid`/`date`/`enum`. Corecția e `.default()` pe fiecare câmp al schemei Zod de filtru. |
| `P0001`    | `raise exception` dintr-un trigger — regulă de business. `mapPostgrestError` o înlocuiește cu un mesaj generic dacă modulul n-are `erori.ts`.  |
| `PGRST116` | `.single()` pe un rând ascuns de politica SELECT. Mapat la NEGĂSIT, nu INTERZIS.                                                               |
| `PGRST202` | Funcția RPC nu e vizibilă — aproape sigur e în schema `app`.                                                                                   |

## 3. Capcanele tăcute — cele mai scumpe

Nu produc nicio eroare, nu apar în niciun log, nu declanșează nicio poartă din
CI. Patru forme:

- **UPDATE cu zero rânduri** — respins de `USING`, raportat ca succes.
- **Listă goală** — rolul n-are permisiunea, politica filtrează, zero rânduri.
- **Embed NULL** — `vehicles!vehicle_id` vine `null` pentru un rol fără `vehicles:read`.
- **Trunchiere la 1000** — `max_rows` din PostgREST, fără niciun semnal.

Rulează `--tacute` ÎNAINTE de a scrie cod pe un modul, nu după ce ceva pare rupt.

## 4. Ai găsit o capcană nouă

Se scrie **întâi** în `docs/design/ecrane/capcane.md`, ca rând numerotat nou.
Nu scrie niciodată un octet NUL literal în document — l-ar face binar pentru
`grep` (s-a întâmplat exact așa, chiar în capcana care avertizează despre asta).
Testul `src/config/docs.test.ts` verifică numerotarea contiguă și absența NUL-urilor.

## 5. Capcane marcate REZOLVATĂ

Trei capcane (5, 13, 25) poartă marcajul `[REZOLVATĂ în <commit>]` — descriau
chei de permisiuni absente din `PERMISSION_KEYS`, adăugate între timp. Se
păstrează pentru clasa de defect pe care o descriu, nu pentru starea curentă.
Nu le trata ca fapte despre cod.
