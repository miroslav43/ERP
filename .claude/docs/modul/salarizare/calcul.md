---
tip: modul
titlu: Salarizare — motorul de calcul
aliases: [payroll-calc, calc.ts, facilitate salariu minim, suma neimpozabilă]
cai:
  - "src/domain/payroll/calc.ts"
  - "src/domain/payroll/erori.ts"
  - "src/domain/payroll/etape/**"
  - "src/domain/payroll/salariu-minim.ts"
  - "src/domain/payroll/program-saptamanal.ts"
  - "src/lib/unelte/salariu.ts"
tabele: [payroll_entries, payroll_settings]
permisiuni: [payroll:create]
feature: payroll
capcane: []
scris_pe: b7230e93ed7148835d36c2c155ef77fd0106b632
scris_la: 2026-10-22
tags: [modul, finance]
---

# Salarizare — motorul de calcul

`calculatePayrollEntry` din `src/domain/payroll/calc.ts` e o funcție pură: setările,
pontajul, contractul și **luna** intră ca date, iar rezultatul iese cu `breakdown` (pașii,
în lei) și `warnings`. O sumă greșită se repară aici, nu în pagină. Cine o cheamă și ce
scrie în bază: [[modul/salarizare]].

## Ce se mișcă împreună

- Un pas nou înregistrat în `calc.ts` cere etichetă în `ETICHETE_PAS` din
  `src/components/payroll/fluturas.tsx`; `breakdown-etichete.test.ts` o cere, altfel
  fluturașul tipărește cheia tehnică. Fiecare pas apare pe fluturaș, și cu valoarea zero.
- Un cod de problemă emis de o etapă din `src/domain/payroll/etape/` trebuie să existe în
  catalogul `src/domain/payroll/erori.ts`; `erori.test.ts` scanează directorul.
- Concediul medical are lanț propriu: `medical_leave_codes` → `certificateMedicaleLuna` →
  `calculeazaIndemnizatieCm` → bazele din `calc.ts`.
- Norma contractului are două capete: pragul de salariu minim din
  `src/domain/payroll/salariu-minim.ts` și împărțirea salariului pe zilele programului.
  Ambele citesc norma SĂPTĂMÂNALĂ; norma zilnică singură nu mai spune dacă omul are normă
  întreagă.

## Suma neimpozabilă de la salariul minim

Etapa `src/domain/payroll/etape/facilitate-salariu-minim.ts` (OUG 89/2025 art. III, doar
veniturile din 2026). Perioadele, minimele și plafoanele sunt un **tabel în cod**, nu o
setare a firmei: e o derogare națională cu dată de expirare, iar condiția „salariul de
bază egal cu minimul” se compară cu minimul din tabel, nu cu `payroll_settings`.

- **Luna vine ca dată, nu din ceas.** `lunaVenituri` („AAAA-LL”) e pusă de
  `calculeazaPerioada` din an și luna perioadei, deci decembrie recalculat în ianuarie
  păstrează suma. Absentă, motorul se poartă ca înainte (nicio sumă). Calculatorul public
  (`src/lib/unelte/salariu.ts`) trimite din 22 oct prima lună a perioadei și lasă suma
  etapei; cifrele perioadelor (`salarizare-publica.ts`) vin din tabelul etapei, nu sunt
  scrise a doua oară. Vezi „Paritatea cu calculatorul public” mai jos.
- **Ce iese din ce.** Suma iese din bazele CAS, CASS, impozit și CAM; nu iese din `brut`,
  fiindcă omul o primește. Deducerea personală rămâne pe brutul întreg (art. 77 nu e
  derogat), iar baza minimă de contribuții scade cu suma pentru TOȚI, nu doar pentru
  beneficiari.
- **Normă întreagă** înseamnă norma zilnică cel puțin cât a firmei ȘI cinci zile pe
  săptămână. Timpul parțial în zile întregi (8 h/zi, 24 h/săpt.) nu primește suma.
- **Suma stă în `calc_breakdown`**, la pasul `sumaNeimpozabila`, nu într-o coloană.
  `sumaNeimpozabilaDinBreakdown` o citește; rândurile calculate înainte n-au pasul și dau
  zero. O citesc ecranul fluturașului, PDF-ul, e-mailul cu fluturașul (rândul din
  `linii-fluturas.ts`, între CASS și deducere, fără să se scadă) și D112 (`A_5`, baza
  CAM, iese fără ea). Drumurile de citire cer `calc_breakdown` în `select`: fără el,
  rândul dispare tăcut, fără eroare — o păzesc testele rutelor.
- **Fiecare aplicare lasă un avertisment informativ** (`SAL_FACILITATE_SALARIU_MINIM`),
  fiindcă aplicația nu are câmp pentru funcția de bază și nu verifică alin. (2). Ecranul
  perioadei îl numără ca pe orice atenționare.

## Ce refuză motorul tăcut

- O `lunaVenituri` scrisă greșit („2026-7”) nu aruncă și nu avertizează: nicio facilitate,
  suma zero. Formatul e verificat doar de `facilitatePentruLuna`.
- Un salariu de bază de 4.326 sau 4.324 lei nu primește suma, fără niciun avertisment:
  condiția e egalitate cu minimul lunii, iar cazul „aproape de minim” nu are semnal.
- Cazul în care salariul a fost la minim doar o parte din lună (alin. (4) lit. a)) nu e
  tratat; îl semnalează doar `SAL_CONTRACT_SCHIMBAT_IN_LUNA`.
- Valorile legale și întrebările pentru contabil sunt în `NOTES.md` §3.

## Programul sub cinci zile pe săptămână (garda L4)

Contractul n-are un câmp pentru zile: `program-saptamanal.ts` le deduce, săptămâna / zi.
Sub cinci, salariul se împarte la zilele programului din lună (21 × 2,5 / 5 = 10,5), iar
zilele peste ele nu trec de salariul întreg. „8 h/zi, 20 h/săpt.” e însă și forma unui
timp parțial de 4 h în cinci zile cu norma zilnică rămasă la 8 — contract vechi sau
importat doar cu norma săptămânală —, iar acela, cu 15 din 21 de zile, lua tot salariul.

- **Calculul nu se schimbă, se spune.** `SAL_PROGRAM_SUB_CINCI_ZILE` (avertisment, în
  catalog, `unde: /angajati` ⇒ fișa omului): „Programul contractului: 2,5 zile pe
  săptămână (…) — confirmați în contract”, plus fraza cu zilele plătite peste program.
  Ecranul perioadei îi numește pe oameni (`programSubCinciZile` din
  `listeazaInregistrari`); asistentul de angajare și fișa arată zilele deduse.
- **Fără confirmare stocată** (decizie, 22 oct 2026): zero contracte 8/20 pe producție
  (21 oct); o bifă ar ascunde doar atenționarea și ar trebui invalidată la orice act
  care schimbă normele; sursa vie — importul — scrie acum norma zilnică pe cinci zile
  (`normaZilnicaPeCinciZile`); modelul corect, dacă se vrea, e programul explicit pe
  zile (și pentru REGES), o decizie de produs, nu o coloană booleană. Prețul: un program
  real de 2–3 zile poartă atenționarea în fiecare lună.
- Codul vechi `NORMA_SUB_CINCI_ZILE` rămâne doar pe fluturașii calculați 12–22 oct,
  ca text fără legătură.

## Paritatea cu calculatorul public

`src/lib/unelte/salariu.paritate.test.ts` cheamă motorul ca `calculeazaPerioada`
(`lunaVenituri`, ambele norme, handicapul ca scutire 100%) și compară, lună cu lună în
2026: persoane, funcția de bază, deducerea suplimentară, tichetele, timpul parțial,
handicapul. Luna intră ca o singură zi, ca în calculator. Divergențele sunt pe față:

- ⚠ NOTES.md §3: tichetele intră în venitul grilei doar în calculator; cu
  `aplica_minim_contributii`, motorul reține angajatului diferența până la baza minimă,
  calculatorul o trece la firmă (art. 146 alin. (5^9)).
- `it.fails("DEFECT")`: scutirea de 100% impozitează tichetele (`scutireFiscala` se ia
  din `brut`); pe 21 de zile, 5.394 dă CAS 1.348 (virgulă mobilă în
  `salariuZi * zilePlatiteInProgram`) — repararea e decizia 2 a utilizatorului din
  README-ul planului de unelte.

## Orele pe ceas în avertismente

Avertismentele își scriu **orele pe ceas**: `calc.ts` trece fiecare durată prin `formatOre`
(`src/lib/format/ore.ts`) și lipește unitatea `h` — `6:00 h de noapte`, nu `6.00 ore`.
Sumele în lei rămân zecimale (`toFixed(2)`), iar coloanele de ore din bază rămân
`numeric`, fiindcă tariful orar se înmulțește cu ele; ceasul e doar reprezentarea de
citire, convertită într-un singur loc. `calc.test.ts` fixează șirurile verbatim pentru
`SAL_ORE_IN_MOD_NEDECLARAT`, deci un avertisment nou care formatează orele altfel iese
inconsecvent pe ecran, nu la teste.

## Când NU e suficientă pagina asta

- Plata, exporturile și starea perioadei: [[modul/salarizare]].
- Pontajul care alimentează calculul: [[modul/pontaj]].
