---
tip: modul
titlu: REGES — forma mesajului și nomenclatoarele
cai:
  - "src/domain/reges/export.ts"
  - "src/domain/reges/operatii.ts"
  - "src/domain/reges/validare.ts"
  - "src/lib/reges/compune.ts"
  - "src/lib/reges/reconciliere.ts"
  - "supabase/migrations/0129_reges_sporuri.sql"
tabele: [reges_nomenclatoare, salary_component_types, salary_components]
permisiuni: [reges:transmit, reges:export]
feature: reges
capcane: []
scris_pe: a67bb3cc1be0a37072b4d1bb96fb262cf8338586
scris_la: 2026-10-31
tags: [modul, hr]
---

# REGES — forma mesajului și nomenclatoarele

Secțiune extrasă din [[modul/reges]]: ce pleacă efectiv la Inspecția Muncii — vocabularul
de protocol, referințele către nomenclatoare și de ce nu există un fișier oficial.

## De ce n-a existat un fișier oficial

Până la REGES-Online, aplicația **nu putea** produce documentul cerut: `.rvs` e formatul
de IEȘIRE al aplicației Revisal, codificat, nu unul pe care un terț să-l poată scrie.
Drumul real ar fi fost `ERP → XML → import în Revisal → .rvs`, iar acel XSD nu era în
posesie. Serializarea nu s-a inventat, deliberat: un fișier care arată plauzibil dar are un
element greșit se descoperă abia la import. CSV-ul de lucru a rămas, ca instrument intern.
— antetul lui `src/domain/reges/export.ts`

## Vocabularul de protocol rămâne în engleză

`reges_operatie` conține literal valorile din enum-ul `MessageType` al schemei REGES 2025,
inclusiv scrierea PascalCase — `InregistrareSalariat`, `AdaugareContract`,
`IncetareSuspendareContract`. Sunt vocabular de protocol, ca numele metodelor HTTP, nu
identificatori de domeniu: o traducere ar cere o tabelă de mapare ținută sincronizată cu un
sistem pe care nu-l controlăm, iar prima valoare uitată acolo ar produce un mesaj respins
fără explicație. Regula proiectului „identificatorii de domeniu în română" **nu** se aplică
aici.

## Nomenclatorul complet ≠ ce se oferă în formular

`TIPURI_ACT_IDENTITATE` rămâne lista REGES întreagă; `TIPURI_ACT_IDENTITATE_ALEGERE`
(`src/domain/reges/operatii.ts`) e subsetul oferit în formulare, fără `BuletinIdentitate` —
documentul tip carnet, neemis din 1997, vecin în listă cu `CarteIdentitate` și greu de
deosebit de el pentru cine nu le știe istoria, iar alegerea greșită pleacă la ITM. Scoaterea
din ofertă NU e scoatere din nomenclator: eticheta, schemele Zod și transmiterea îl acceptă
mai departe, iar `optiuniActIdentitate` din
`src/app/(app)/angajati/formular-angajat.tsx` îl readaugă în `<select>` când e chiar valoarea
fișei — altfel browserul ar fi afișat prima opțiune, iar prima salvare ar fi rescris tăcut
actul omului. Același tipar ca `TIPURI_ZI_ALEGERE` din [[modul/pontaj]]. — v. [[modul/angajati]]

## Nomenclatoarele se referențiază prin UUID, nu prin cod

În mesajul de contract, unde fișierele Revisal vechi purtau coduri: `Cor` e azi un
`Referinta`, nu perechea `{ cod, versiune }` — `idCor` ia UUID-ul din oglinda locală
(`reges_nomenclatoare`, `tip = "Cor"`, `activ`), nu live de la ITM, iar `codCor` rămâne pe
`ContractIntern` pentru validare. Și `salariu` a încetat să fie un număr: e
`{ salariuBaza, sporuri? }`, cu `SporSalarial` = `referintaTipSpor` (UUID **brut**, nu
`Referinta`) + `valoare` + `esteProcent`, fără `$type` și fără monedă. `sporuri` se **omite**
când e gol — `[]` nu e același lucru cu absența câmpului pentru un deserializator strict.

`compuneContract` le primește pe amândouă de la apelant, ca să rămână sincronă; în
reconciliere le rezolvă `idCor` și `sporurileContractului`, care citește doar
`kind in ('spor_procent', 'spor_suma')`, active la data trimiterii — aceeași linie trasă în
bază de `salary_component_types_spor_reges_ck` (`0129`). Maparea nu se ghicește din denumire.

„Activ la data trimiterii" înseamnă și **încheiat după** ea: sporul închis de salarizare
rămâne în tabelă ca istoric, iar fără filtrul pe `valabil_pana` se declara în continuare la
Inspecția Muncii, adică un pachet salarial care nu mai exista. Filtrul are azi aceeași formă
ca în citirile de salarizare.

**Ce lipsește din oglindă OPREȘTE mesajul, nu se sare tăcut.** `verificaContract` refuză
contractul cu `regesCorId` null și sporul cu `referintaTipSpor` gol: o referință inventată
trece de schemă și e refuzată **asincron**, ore mai târziu, cu termenul deja curgând, iar un
spor sărit ar declara un salariu mai mic decât cel real. Tot acolo cad valoarea ≤ 0 și
procentul peste 100.

## Actul adițional se transmite pe identificatorul contractului de bază

La ITM un contract are UN identificator, primit la `AdaugareContract` și scris pe contractul
de bază. La noi actul adițional e un rând separat (`este_act_aditional`) care poartă termenii
noi, dar pentru Inspecția Muncii nu e un contract nou: pleacă drept `ModificareContract` pe
identificatorul bazei. Rândul actului n-are identificator propriu și nici nu poate primi o
copie la creare, fiindcă baza îl capătă abia după înregistrare — de aceea referința se
rezolvă la transmitere, cu `referintaContractReges` (`src/lib/reges/compune.ts`), din rândul
actului către părintele lui. Același drum îl fac și `pregatesteTransmiterea` și
reconcilierea; v. [[modul/reges/actiuni]].

Sporurile actului adițional se citesc tot de pe contractul de **bază**, fiindcă acolo sunt
legate componentele: citite de pe rândul actului, modificarea ar fi plecat fără niciun spor,
adică ar fi declarat mai puțin decât se plătește.
