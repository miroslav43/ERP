---
name: administrativo-postari
description: Se folosește când se cere o postare, un lot, un carusel, o imagine sau un banner pentru pagina de LinkedIn Administrativo (ori alt canal social al firmei), când se scrie ceva în `docs/comercial/linkedin/`, când se completează rezultatele postărilor sau când se pregătește kit-ul de publicare.
---

# Postările Administrativo

Un singur sistem pentru tot ce publică firma: aceeași voce, aceleași surse,
același aspect, aceleași unelte. Nu se improvizează nimic din ce e deja fixat aici.

## Unde e adevărul

| Ce                                                 | Unde                                                                                  |
| -------------------------------------------------- | ------------------------------------------------------------------------------------- |
| Calendarul T4, pilonii, sistemul vizual            | `docs/superpowers/specs/2026-09-23-linkedin-t4-design.md`                             |
| Loturile, rezultatele, adresele pânzei și kit-ului | `docs/comercial/linkedin/README.md`                                                   |
| Orice cifră sau articol de lege                    | `src/content/legal/*.ts` — nu spec-ul, nu memoria                                     |
| Cifrele pilotului                                  | `PILOT` din `src/content/landing/pentru-contabili.ts`                                 |
| Subiecte blocate                                   | `NOTES.md`, rândurile ⚠ (azi: plafonul lunar de „3 salarii” la diurnă)                |
| Zile lucrătoare, sărbători                         | `sarbatoriAnului()` din `src/domain/calendar/sarbatori.ts`, rulat cu `pnpm exec jiti` |

Cifra-vedetă din calendar se **reverifică în sursă**. Când diferă (#7 scria „7
documente”, `control-itm.ts` are 8 în `reguli`), sursa câștigă, iar spec-ul și
README-ul se corectează în același commit.

## Ce conține o postare în `lot-NN.md`, în ordinea asta

1. `## #N · <ziua> <data> · carusel (K slide-uri)` sau `· imagine`, plus ★ dacă trimite la pilot.
2. **Pilon** și **Sursă**. Pilonul vine din sursă: `src/content/legal/` →
   Legislație (pătrat cerneală); `/unelte/*` → Unelte (verde); cum e construit
   produsul (API, bază, calendar) → Culise (ocru); pilot, capturi, cazuri →
   Produs și pilot (ușă). O amendă primește în plus marcajul roșu lângă cifră.
3. Rânduri ⚠ (de verificat înainte de publicare) și ⧗ (dependențe), dacă există.
4. **Textul postării**, ca citat: 150–250 de cuvinte. Primele două rânduri opresc
   derularea, urmează contextul cu articolul de lege, iar ultimul rând e o întrebare.
5. **Primul comentariu**: linkul cu
   `?utm_source=linkedin&utm_medium=social&utm_campaign=t4-NN-<subiect>`.
6. **Hashtag-uri**: cel mult trei.
7. **Slide-urile**: un tabel cu coloanele Șablon | Conținut | Text alternativ.
   Caruselul are **6–8 slide-uri**: copertă, reguli și final. Dacă sursa are mai
   multe puncte, se grupează: pe un slide grupat, titlul numește grupul, detaliul
   enumeră punctele, iar temeiurile se despart prin „·”. Fiecare slide are cel
   mult 40 de cuvinte. O imagine unică folosește șablonul 5 și un text alternativ.

**Vocea:** pagina Administrativo, „noi”, cu cititorii la „voi”. Frecvența sau
experiența („cel mai des”, „vedem”) apare doar dacă sursa o spune.

## Fluxul unui lot

1. Citești tabelul de rezultate din README și ajustezi lotul după ce a mers.
2. Scrii `docs/comercial/linkedin/lot-NN.md`, după rețeta de mai sus.
3. Cauți cu `grep` fiecare cifră și fiecare articol în `src/content/legal/`.
4. În `docs/comercial/linkedin/unelte/`:
   - adaugi planșele în `genereaza.py`, cu `coperta()`, `regula()` și `final()`, pe un rând nou de pânză;
   - actualizezi `CARUSELURI` și `UNICE` în `pdf.cjs`, iar `LOT` și `POSTARI` în `kit_genereaza.py`;
   - rulezi `python3 genereaza.py && node randeaza.cjs`, apoi te uiți la PNG-uri;
   - rulezi `node pdf.cjs && python3 kit_genereaza.py`.
5. Republici pe **aceleași adrese** din README: pânza (`root` = `unelte/canvas`,
   indexul plus toate planșele) și kit-ul (`url` al kit-ului, cu
   `capabilities: {downloads: true}`).
6. Actualizezi starea lotului în README, rulezi prettier pe `docs/comercial/linkedin`,
   apoi `git commit --only -- docs/comercial/linkedin` și push.

Ieșirile din `unelte/` (canvas, export, png, livrare, kit) nu intră în git.

## Greșeli cunoscute

| Greșeala                                | Ce faci                                                                  |
| --------------------------------------- | ------------------------------------------------------------------------ |
| Carusel de 10 slide-uri ca să intre tot | Grupezi punctele înrudite pe un slide; maximum 8                         |
| Cifra din calendar ≠ sursa              | Sursa câștigă; corectezi spec-ul și README-ul                            |
| Virgula lui ț atinge rândul de dedesubt | Interlinie ≥ 1,12 la titluri, verificată pe PNG                          |
| Comision exprimat în lei                | Doar procent, din `PILOT`                                                |
| Pânza citită înapoi ca s-o „verifici”   | Nu: tipul Design interzice asta; verificarea se face pe PNG-urile locale |
| Link în corpul postării                 | Doar în primul comentariu                                                |
