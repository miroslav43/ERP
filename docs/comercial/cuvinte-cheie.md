# Cuvintele cheie: ce caută oamenii și ce pagină le răspunde

Cercetare din 2 oct 2026. Completează secțiunea 4A din
[`vizibilitate-organica.md`](vizibilitate-organica.md) („long tail întâi”) cu
date despre cerere, nu cu presupuneri.

## Cum s-a măsurat — și ce NU spune măsura

- **Completarea automată Google** (`hl=ro`, `gl=ro`): 42 de subiecte din
  domeniu × 27 de prefixe (subiectul singur și urmat de a–z), 1.134 de cereri,
  **5.411 termeni**, zero erori. Scorul unui termen = suma lui `10 − poziție`
  peste toate listele în care apare. Google ordonează sugestiile după
  popularitate, deci scorul spune **ce se caută mai des decât altceva în
  aceeași familie**.
- **NU e volum lunar.** Un scor de 30 nu înseamnă 30 de căutări, iar scorurile
  din familii diferite se compară doar aproximativ. Pentru volume reale:
  Keyword Planner din Google Ads (gratuit, fără buget cheltuit, export CSV) —
  vezi „Pasul următor” la final.
- **Search Console** (4–29 sept, proprietatea `sc-domain:administrativo.ro`):
  159 de afișări, 1 clic. Confirmă direcția: „foaie de pontaj lunar” (poziția
  28), „câte zile de concediu ai pe lună” (5,8), „portal angajați” (1–5).

Scriptul: `sugestii.py` din scratchpad-ul sesiunii; se reface în ~5 minute.

## Concluzia, într-o frază

Cererea nu e pe numele modulelor, ci pe **modele de documente, calculatoare și
întrebări despre Codul muncii** — exact ce caută omul de HR sau contabila unei
firme mici înainte să știe că vrea un program. Termenii comerciali („program
salarizare”) sunt mici și ocupați de SAGA, Nexus, Charisma.

Semnal de reținut: `kpi angajati` (scor 10), `aplicatie hr` (37) și
`onboarding angajati` (0) **aproape nu se caută**. Paginile acelor module nu vor
aduce trafic din căutare, oricât de bine ar fi scrise.

## Prioritatea 1 — unelte (cerere mare, intenția potrivită, se pot face mai bine decât ce există)

| #   | Familie               | Termeni (scor)                                                                                                                                                                       | Pagina                              | Stare                                                           |
| --- | --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------- | --------------------------------------------------------------- |
| 1   | Calculator salariu    | calcul salariu net (34), brut (29), brut net (23), brut 2026 (20), net 2026 (17), net din brut (14), brut din net (14); salariu minim pe economie 2026 (18), … net (15), … brut (15) | `/unelte/calculator-salariu`        | **nouă**. Motorul există: `src/domain/payroll/calc.ts`          |
| 2   | Condica de prezență   | model word (26), model word free download (21), este obligatorie 2026 (19), în format electronic (17), pdf (16)                                                                      | `/unelte/condica-de-prezenta`       | **nouă**. Același generator ca foaia de pontaj                  |
| 3   | Foaie de pontaj       | lunar pdf (29), lunar word (23), lunar excel (18), foaie colectivă de pontaj pdf (17) / excel (16)                                                                                   | `/unelte/foaie-de-pontaj`           | există, doar tipărire + Excel → **adaugă PDF și Word**          |
| 4   | Foaie de parcurs      | model (19), model word free download (18), model completat (17), pdf (17), excel (16)                                                                                                | `/unelte/foaie-de-parcurs`          | **nouă**. Legătură spre `/module/flota`                         |
| 5   | Fișa de instruire SSM | fișa instruire ssm model (34), fișa ssm în format electronic (28), completată (19); instruire la reluarea activității (32), la angajare (28), după concediu medical (26)             | `/unelte/fisa-instruire-ssm` + ghid | **nouă**. Legătură spre `/module/ssm`                           |
| 6   | Fișa de evaluare      | fișa evaluare angajați model (25), evaluare angajați codul muncii (26), evaluare anuală (21), criterii (13)                                                                          | `/unelte/fisa-evaluare` + ghid      | **nouă**. Legătură spre `/module/evaluari`                      |
| 7   | Cerere de concediu    | cerere concediu de odihnă word (24), fără plată model (14), căsătorie (16), paternal (11)                                                                                            | `/unelte/cerere-concediu-de-odihna` | există → **adaugă Word și variantele** (fără plată, evenimente) |

**Atenție la #1:** un calculator public de salariu trebuie să dea cifra corectă
la leu. `NOTES.md` §⚠ spune că valorile legale (cote, deducerea personală,
plafoane) se confirmă de contabil înainte de orice calcul real. Fără
confirmarea asta, pagina nu se publică.

## Prioritatea 2 — ghiduri (întrebări despre Codul muncii)

| #   | Familie                | Termeni (scor)                                                                                                                               | Pagina                                  | Stare                                                       |
| --- | ---------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------- | ----------------------------------------------------------- |
| 8   | Diurna externă pe țări | diurna externă 2026 (29), germania (24), bulgaria (22), ungaria (18), turcia (15), marea britanie (14), pe zi (15), maximă neimpozabilă (13) | `/ghid/diurna-externa`                  | **nouă**. Cuantumurile pe țări sunt deja în `0015_per_diem` |
| 9   | Ore suplimentare       | codul muncii (20), codul muncii 2026 (18), în zi de sărbătoare legală (18), câte ore ai voie pe lună (16), în weekend (13), part time (13)   | `/ghid/ore-suplimentare`                | **nouă**                                                    |
| 10  | Spor de noapte         | codul muncii (28), calcul (16), 25 la sută (15), noapte și weekend (16)                                                                      | în #9 sau `/ghid/spor-de-noapte`        | **nouă**                                                    |
| 11  | Zile de concediu       | pe an (20), de odihnă (19), în funcție de vechime (16), neefectuat (18), în preaviz (17), se plătește (16); căsătorie (12), deces (13)       | `/ghid/concediu-de-odihna` + evenimente | există (poziția 5,8) → **extinde**                          |
| 12  | REGES — registrul      | registru salariați reges online (27), generare registru salariați (23), reges online creare cont (17), login (16)                            | `/reges-online`                         | există → **secțiune nouă**: cum generezi registrul          |
| 13  | Concediu medical       | cod 01 (18), cod 06 (15), îngrijire copil (14), cod 06 se plătește prima zi (13)                                                             | `/ghid/concediu-medical`                | **nouă**, prioritate mai mică                               |

Cuantumurile de diurnă și orice sumă se verifică pe forma consolidată din
Portalul Legislativ înainte de publicare (vezi memoria despre consolidări:
`DetaliiDocumentAfis` poate servi o formă veche).

## Prioritatea 3 — termenii comerciali (pagini existente, ajustări de titlu)

| Termeni (scor)                                                                                                | Pagina                               | Observație                                                                                  |
| ------------------------------------------------------------------------------------------------------------- | ------------------------------------ | ------------------------------------------------------------------------------------------- |
| aplicație pontaj angajați (30), aplicație pontaj pe telefon (23), aplicație pontaj gratuită (23), online (17) | `/pontaj-pe-telefon`                 | „gratuit” doar cinstit: prima lună și uneltele sunt gratuite, programul nu                  |
| program pontaj angajați (25), gratuit (21), online (17)                                                       | `/module/pontaj`                     |                                                                                             |
| program salarizare gratuit (19), program salarii gratuit (19), program calcul salarii gratuit (17)            | `/module/salarizare`                 | dominat de SAGA, Nexus, Charisma (apar chiar în sugestii); efort lung, cu linkuri acumulate |
| program evidență angajați (17), registru evidență angajați (19)                                               | `/module/nucleu` sau pagină dedicată |                                                                                             |

## Ce am exclus, ca să nu se reia

`software hr` / `program hr` (rezultate în engleză și alte limbi), `resurse
umane isj …`, `medicina muncii <oraș>`, `parc auto <oraș>` (intenție locală,
alt public), `inventar` (generic: dicționar, jocuri), `ssm holding`, `fluturaș
salariu <instituție publică>`, `d112` (public de contabili, formularul ANAF).

## Ordinea recomandată

1. **#3 și #2**: PDF și Word pe foaia de pontaj, plus condica de prezență din
   același generator. Risc legal zero, cod refolosit, iar foaia aduce deja
   afișări.
2. **#4, #5, #6**: modele de documente, fiecare legat de modulul lui.
3. **#8**: diurna externă pe țări, din datele care există deja.
4. **#9–#11**: ghidurile de Cod al muncii.
5. **#1**: calculatorul de salariu, după confirmarea contabilului.

Nimic din tabelele de mai sus nu înlocuiește pasul B din
`vizibilitate-organica.md` (primul link real din afară). Paginile noi îi dau
însă unui link ceva de citat: un calculator sau un model gratuit e genul de
pagină la care alte situri trimit singure.

## Pasul următor pentru volume reale

Keyword Planner: ads.google.com → Instrumente → Planificator de cuvinte cheie →
„Obțineți volumele de căutare”, locația România, limba română. Se lipesc
termenii din tabelele de mai sus, se descarcă CSV-ul. Nu cere campanie activă
și nu cheltuie nimic; fără campanie, volumele vin pe intervale (10–100,
100–1.000). Cu CSV-ul, prioritățile de aici se recalculează pe cifre.
