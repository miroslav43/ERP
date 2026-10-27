---
tip: modul
titlu: Pontaj — acțiuni și citiri
aliases: [pontaj-actiuni]
cai:
  - "src/app/(app)/pontaj/**/actions.ts"
  - "src/lib/queries/attendance.ts"
  - "src/schemas/attendance.ts"
  - "src/domain/attendance/**"
tabele:
  [
    attendance_entries,
    attendance_periods,
    attendance_approval_batches,
    attendance_settings,
    attendance_week_submissions,
    setari_pontare_rapida,
    puncte_lucru,
    contract_suspendari,
  ]
permisiuni:
  [
    attendance:read,
    attendance:create,
    attendance:update,
    attendance:approve,
    employees:update,
    departments:update,
  ]
feature: attendance
capcane: [2, 6, 7, 17]
scris_pe: 773c1627da87c388355631aa7419448022014599
scris_la: 2026-10-27
tags: [modul, hr]
---

# Pontaj — acțiuni și citiri

Secțiune extrasă din [[modul/pontaj]]: „Server Actions” trecuse de 40 de rânduri,
ceea ce convenția vault-ului tratează ca o condiție de spargere.

| Pagina                           | Ce ține                                                                         |
| -------------------------------- | ------------------------------------------------------------------------------- |
| [[modul/pontaj/actiuni/lanturi]] | lanțul unei schimbări de formă a zilei, `src/domain/attendance/`, orele pe ceas |

## Server Actions

Toate în `src/app/(app)/pontaj/actions.ts`, cu excepțiile notate.

| Funcție                                           | Permisiune / minScope          | Ce scrie                                |
| ------------------------------------------------- | ------------------------------ | --------------------------------------- |
| `deschidePerioada`                                | `attendance:create` / all      | perioada lunii, status `deschisa`       |
| `salveazaZiPontaj`                                | `attendance:create` / own      | o zi în `attendance_entries`            |
| `pontezaIntrarea`, `pontezaIesirea`               | `attendance:create` / own      | ora de intrare/ieșire pe ziua curentă   |
| `confirmaZiuaStandard`                            | `attendance:create` / own      | ziua completă, din setări               |
| `stergeZiPontaj`                                  | `attendance:create` / own      | `deleted_at` pe zi                      |
| `aprobaPontajBloc`                                | `attendance:approve` / team    | lotul + liniile lui închise             |
| `decideZiPontaj`                                  | `attendance:approve` / team    | verdictul pe o zi                       |
| `respingePontajBloc`                              | `attendance:approve` / team    | respingerea, pe zilele bifate           |
| `emiteSuspendareAbsente`                          | `employees:update` / all       | `contract_suspendari` + eveniment REGES |
| `blocheazaPerioada`, `redeschidePerioada`         | `attendance:approve` / **all** | statusul perioadei                      |
| `sincronizeazaConcediile`                         | `attendance:create` / all      | zilele care vin din concedii aprobate   |
| `trimiteSaptamanaPontaj` (`saptamana/actions.ts`) | `attendance:create` / own      | submisia săptămânii                     |
| `decideSaptamanaPontaj` (`saptamana/actions.ts`)  | `attendance:approve` / team    | verdictul pe săptămână                  |
| `salveazaSetariPontaj` (`setari/actions.ts`)      | `attendance:update` / all      | `attendance_settings` (versiune nouă)   |
| `salveazaPontareaRapida` (`setari/actions.ts`)    | `attendance:update` / all      | `setari_pontare_rapida` (un rând/firmă) |

Pontarea rapidă — `pontezaIntrarea`, `pontezaIesirea`, `confirmaZiuaStandard` — nu
primește de la client nici ora, nici orele, nici angajatul: schemele ei au un singur
câmp, `cod_punct_lucru`. Ora vine din `ctx.now`, orele se derivă din `configZiDin` +
`oreleZilei`, fișa se rezolvă din sesiune cu `fisaProprie`. Preambulul comun
(`pregatirePontareRapida`) refuză întâi pe `mod_pontare_rapida`, apoi decide ce face cu
codul prin `cumSeTrateazaCodul`. `pontezaIntrarea` e **idempotentă**: a doua atingere pe
o zi deja deschisă întoarce aceeași zi cu `reluare: true`, nu 23505.

Cele patru acțiuni de DECIZIE — `aprobaPontajBloc`, `respingePontajBloc`,
`decideZiPontaj`, `decideSaptamanaPontaj` — cheamă întâi `refuzaCandAprobareaEStinsa`
(`aprobarea-firmei.ts`). Ascunderea filei „Aprobare" e cosmetică: ruta rămâne validă,
un ecran deschis dinainte are încă butoanele randate, iar o Server Action e un punct de
rețea. Regula NU se poate scrie ca politică RLS — ar cere un subselect peste altă tabelă
în `with check`, iar refuzul ar deveni un UPDATE cu zero rânduri, adică tăcut.

**La lot, `null` nu e lista întreagă.** `employee_ids` și `entry_ids` ale lui
`aprobaPontajBloc` sunt nullable, iar `null` înseamnă „ce e pe ecran acum", nu „exact
ăștia"; se aplică una peste alta și peste departament, ca restrângeri.
`respingePontajBloc` le cere EXPLICIT — un refuz nu se dă în alb — și cheamă
`decide_zi_pontaj` o zi la rând, fiindcă gărzile deciziei stau deja acolo: **nu e
atomică**, iar rezultatul spune câte au trecut, câte nu și câte vești au plecat. `motiv`
nu intră în allow-list-ul de audit, ca la `decideZiPontaj`.

**Cele două excluderi se scriu în oglindă:** `leave_request_id is null` (ziua de concediu
e proiecția unei decizii din modulul de concedii) și `respins_la is null` (mingea e la
angajat, în corectare) stau la fel în `aprobaPontajBloc`, `liniiDeAprobat`,
`numaraLiniiNeaprobate` și `pontajDeAprobat`. Despărțite, o zi respinsă ajunsă în UPDATE
încalcă `attendance_entries_decizie_ck` (0067) și cade cu tot lotul.

`salveazaZiPontaj` rescrie orele pe server pentru orice scope diferit de `all`: cu
interval complet le derivă, iar fără oră de sfârșit le pune **zero**. Cifrele venite
din client sunt păstrate doar de `attendance:create = all`, unde calculul e o sugestie.
`punct_lucru_declarat_id` are implicit `null` în schemă, deci un apelant care nu-l trimite
îl ȘTERGE — ca la `tip_prezenta`; restul sediului e în [[modul/pontaj/foaia]].

Aceeași acțiune, cu ore lucrate pe un contract suspendat pentru absențe nemotivate, NU
scrie nimic: întoarce `id: null` plus `conflictSuspendare`, iar ecranul întreabă dacă se
emite decizia de reluare. Retrimiterea aduce `confirma_reluare` (implicit `false`, deci
cine nu știe de conflict îl primește, nu îl calcă), iar `inchideSuspendareaLaReluare`
rulează ÎNAINTE de scrierea zilei. Suspendarea se citește cu clientul admin:
`contract_suspendari_select` cere drepturi pe care responsabilul de pontaj nu le are.
Forma de retur, `RezultatCuAvertismente` (`avertismente.ts`), e comună cu săptămâna.

`emiteSuspendareAbsente` e capătul de om al aceluiași drum: alerta semnalează seriile de
la a doua zi consecutivă (`PRAG_ZILE_ALERTA`), decizia o ia cineva, pe un interval ales.
Poarta e `employees:update = all` — EXACT ce cere `contract_suspendari_insert` — deși
scrierea merge prin `createAdminSupabase()`, fiindcă drumul trece prin
`genereazaEvenimenteReges`. Suprapunerea peste altă suspendare vine ca `23P01`
(`suspendare-absente.ts`) și se traduce în text, nu în eroare.

`trimiteSaptamanaPontaj` citește `p_lucreaza_weekend` din `attendance_settings`, NU din
formular — câmpul a plecat din `trimiteSaptamanaPontajSchema`. Steagul se salvează pe
submisie fiindcă aprobatorul trebuie să vadă ce regulă era ATUNCI, dar regula e a firmei:
venind de la client, o cerere fabricată putea declara „aici se lucrează în weekend" la o
firmă de birou. Caseta din formular a rămas ce a fost mereu în fapt — alege dacă zilele de
weekend pleacă cu interval (`intervalDeTrimis`). Din 0133 RPC-ul întoarce
`{ submission_id, zile_sarite }`, nu doar identificatorul: zilele cu concediu aprobat se
sar, iar acțiunea le duce mai departe ca `zileSarite` — un plan salvat cu trei zile din
cinci trebuie SPUS. Citirea e defensivă (RPC tipat `Json`), fiindcă planul S-A salvat
deja. Zilele cu interval inversat ies acum ÎNTR-UN singur mesaj: înainte, a doua zi
greșită apărea abia după ce o reparai pe prima. În varianta `saptamanal` refuză săptămâna
care n-a început, iar fișa închisă singură de trigger devine pontaj pe loc —
[[modul/pontaj/varianta]]. **Atenție**: `createAction` primește `rawInput: unknown`, deci
un câmp rămas într-un apelant NU produce eroare de tip; Zod îl taie tăcut. Câmpurile
scoase din scheme se caută de mână prin apelanți.

Câmpurile numerice din `setariPontajSchema` trec prin `numarObligatoriu`
(`src/schemas/comun.ts`), nu prin `z.coerce.number()`: `Number("")` e `0`, iar șapte au
plafonul de jos chiar 0 — o casetă goală se SALVA ca zero, fără mesaj. Golul se scoate
ÎNAINTE de coerciție, cu trei mesaje: lipsă, „nu e număr”, interval
(`src/schemas/attendance.test.ts`). Pe aceeași acțiune, `23505` e tradus pe loc:
`attendance_settings_valabilitate_uq` înseamnă „există deja o versiune cu acest
`valabil_de_la`", nu o zi de pontaj duplicată.

## Citiri

`src/lib/queries/attendance.ts`, cu `"server-only"` în cap, funcții libere cu
`organizationId` primul argument: `citestePerioada`, `citestePerioadaDupaId`,
`listeazaPerioade`, `numarZilePontatePerioada`, `listeazaAngajatiPontaj`,
`totiAngajatiiPontaj`, `angajatiPontajDupaId`, `intrariLuna`, `intrariProprii`,
`zilePontateAngajat`, `setariPontaj`, `setariPontajComplete`, `istoricSetariPontaj`,
`loturiPerioadei`, `liniiDeAprobat`, `numaraLiniiNeaprobate`, `numaraZileRespinse`,
`citesteSaptamanaPontaj`, `saptamaniDeAprobat`, `departamente`, `setariPontareRapida`,
`sediiPentruPontaj`, `afiseDePontare`, `coduriQrDePontare`,
`absenteNemotivateFaraDecizie`, `pontajDeAprobat`.

`setariPontareRapida` și `sediiPentruPontaj` trec prin `cache()`: o pagină de pontaj le
cere de mai multe ori, iar memoizarea e pe CERERE — o scriere din aceeași cerere nu se
vede în ce s-a citit înainte de ea. Cursorul și limita nu mai vin din adresă
(`filtrePontajSchema` le-a pierdut): `listeazaAngajatiPontaj` le primește prin
`PaginaAngajatiPontaj`, iar foaia urmează cursorul până la capăt cu `totiAngajatiiPontaj`.

`pontajDeAprobat` întoarce `null` DOAR când nu e nimic de aprobat. Lunile `blocata` ies —
acolo aprobarea nu mai e posibilă, deci numărate ar fi ținut panoul plin cu o restanță pe
care nimeni n-o poate închide — dar funcția nu se oprește când firma n-are nicio lună
neblocată: fișele săptămânale nu țin de perioade. Rezultatul poartă LUNILE cu restanțe, nu
doar cifra, fiindcă ecranul de aprobare lucrează pe o lună odată.

`absenteNemotivateFaraDecizie` merge în trei pași, în ordinea asta din motive de cost:
zilele perioadei, seriile calculate în memorie (`seriiDeAbsente`,
`src/domain/reges/absente.ts`), apoi suspendările doar ale angajaților rămași. Filtrul pe
suspendarea activă din `absenta_nemotivata` e ce împiedică alerta să reapară după ce
decizia a fost emisă.

`zilePontateAngajat` e singura care cere explicit `employee_id` și n-are cursor: aduce
dintr-un drum reuniunea celor trei ferestre de care are nevoie verificarea limitelor
(săptămâna, ziua dinainte, perioada de referință) și le taie în TypeScript. Filtrul pe
angajat NU e opțional acolo — pentru scope `all` RLS nu îngustează nimic, iar media s-ar
calcula pe orele întregii firme. Nu poate fi trunchiată de `max_rows`, fiindcă
`attendance_entries_zi_uq` garantează cel mult un rând pe angajat pe zi: sub 380 de
rânduri chiar la o perioadă de referință de 12 luni.

`setariPontaj` întoarce DOAR parametrii juridici (cele trei câmpuri de pontare rapidă
au plecat în 0115) — cine adaugă o coloană de setări o adaugă în DOUĂ locuri:
lista de câmpuri a lui `setariPontaj` și `CAMPURI_SETARI_PONTAJ`. Amândouă întorc
versiunea în vigoare la o dată (`valabil_de_la`), iar `null` e o stare normală: firma
n-a configurat nimic și apelantul cade pe valori de rezervă.
