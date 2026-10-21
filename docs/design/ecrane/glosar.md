# Glosar și registru de adresare

Sursa citată de poarta `src/config/registru-adresare.test.ts`. Când adaugi un
text pe ecran, îl scrii după regulile de aici; când o regulă se schimbă, se
schimbă AICI și în poartă, în același commit.

## (a) Registrul

| Unde                                                  | Cum                                                   | Exemplu                                                |
| ----------------------------------------------------- | ----------------------------------------------------- | ------------------------------------------------------ |
| Proză adresată omului (descrieri, ajutor, erori)      | „dumneavoastră”, scris întreg — niciodată „dvs.”      | „Contul dumneavoastră nu are o fișă de angajat.”       |
| Etichete parantetice după nume (tabele, fișe)         | „(dumneavoastră)”                                     | „Ana Pop (dumneavoastră)”                              |
| Etichete de stare                                     | impersonale — le văd și solicitantul, și operatorul   | „Așteaptă solicitantul”, nu „Așteaptă răspunsul tău”   |
| Butoane și linkuri                                    | imperativ singular — convenția existentă              | „Salvează”, „Pornește parcursul”, „Adaugă”             |
| Descrierile tipurilor de tichet (`DESCRIERI_TIP`)     | persoana întâi, deliberat — e vocea solicitantului    | „Am nevoie de un echipament”                           |
| E-mailurile (`src/lib/email/templates/`)              | „dumneavoastră”, ca proza din ecrane                  | „Contul dumneavoastră a fost creat.”                   |

Nu se scrie la persoana a doua singular („tu”) nicăieri în proză: nici „ta /
tău / tăi / tale”, nici „îți / ți-a”, nici verbe ca „poți”, „ai nevoie”,
„deschizi”. Butoanele rămân la imperativ singular („Salvează” e de ~90 de ori
mai frecvent decât „Salvați”); trecerea lor la plural ar fi o lucrare separată.

Răspunsul generat de asistent (`src/lib/asistent/prompt.ts`) nu e acoperit de
poartă: textele fixe ale panoului sunt la „dumneavoastră”, dar promptul nu
impune încă registrul răspunsului modelului.

## (b) Glosarul

| Spunem                         | Nu spunem                              | Note                                                      |
| ------------------------------ | -------------------------------------- | --------------------------------------------------------- |
| Integrare angajați / integrare | Onboarding                             | numele modulului în titluri și firimituri                 |
| parcurs (de integrare / ieșire)| checklist, instanță (de checklist)     | „Pornește un parcurs”, „Parcurs nou”, fila „Parcursuri”   |
| pas, listă de pași             | item, task                             |                                                           |
| șablon de parcurs              | șablon de checklist                    |                                                           |
| Plecare din firmă              | Ieșire din organizație, offboarding    | tipul de parcurs `iesire`                                 |
| Tichete IT, tichet             | Ticketing, ticket                      | inclusiv în catalogul de module (Setări → Module)         |
| sesizare                       | ticket de mentenanță                   | modulul Mentenanță                                        |
| deplasare                      | trip                                   | modulul Diurnă                                            |
| fluturaș                       | payslip                                | modulul Salarizare                                        |

## (c) Excepții asumate

- **Mesajele P0001 din SQL** care ajung la om („Checklistul este închis…” din
  0088/0092, „contul dvs.” din 0118/0133) rămân cum sunt: repararea lor ar cere
  retranscrierea a patru funcții mari, iar riscul de eroare subtilă e mai mare
  decât câștigul. Se repară când funcția e re-creată oricum, din alt motiv.
- **Pagina de marketing** (`src/content/landing/ro.ts`) are registrul ei și nu
  intră în poartă.
- **„instanța” cu sensul de tribunal** (registrul de documente primite) e
  vocabular juridic, nu termenul tehnic interzis.

## (d) Identificatorii NU se traduc

Glosarul privește textul văzut de om. Rămân neatinse: permisiunile
(`checklists:read`), acțiunile de audit (`checklist.instance.start`), tabelele
(`checklist_instances`), tipurile (`ChecklistTip`), constantele
(`BUCKET_CHECKLISTS`), rutele (`/onboarding/*`, `/ticketing/*`) și componentele
(`NavOnboarding`, `PaginaOnboarding`). Poarta scanează doar șirurile și textul
JSX, iar șirurile-identificator (litere mici, fără spații) sunt ignorate.
