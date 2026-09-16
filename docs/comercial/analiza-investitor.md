# Administrativo: cum abordăm un investitor cu 20.000 €

_Analiză din perspectiva fondatorului, scrisă pe 17 septembrie 2026, înainte de
lansare și înainte de primul client plătitor. Revizuită în aceeași zi: plafonul
investitorului e **20.000 €**, nu 300.000 €, iar scenariul se schimbă complet._

> Cifrele de piață și costurile sunt estimări de ordin de mărime și trebuie
> verificate înainte de o întâlnire. Cursul folosit: ~5 RON pentru 1 €. Dacă suma
> e de fapt 20.000 **RON** (~4.000 €), concluzia din §2 devine și mai tăioasă: nu
> merită să primim un asociat pentru atât.

## 0. Punctul de plecare

| Ce avem                                                                                      | Ce înseamnă pentru un investitor                                                                                                     |
| -------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| 22 de module, 143 de migrări, ~260.000 de linii TS, 631 de commit-uri                        | Produs lat și bine făcut. Izolarea între firme-client e făcută în bază (RLS FORCED), nu doar în aplicație.                           |
| Construit în **4 săptămâni** (17 aug – 13 sep 2026), în mare parte cu AI                     | Lucrăm foarte repede, dar **codul se poate reface ieftin**, deci nu valorează mult singur. Evaluarea nu poate sta pe liniile de cod. |
| Ofertă comercială gata: Nucleu 149 RON, Toată aplicația 499 RON pe lună, prima lună gratuită | O teză de preț, dar **niciun client plătitor și nicio integrare de plată**.                                                          |
| `NOTES.md` §3 are valori legale ⚠️ nevalidate (CAS, CASS, salariul minim, sporuri)           | **Salarizarea nu se poate lansa** până nu le confirmă un contabil.                                                                   |
| Zero teste pe acțiuni și citiri, niciun test e2e                                             | Datorie tehnică cunoscută.                                                                                                           |
| Prețul e **fix pe firmă**, nu pe angajat                                                     | O firmă cu 300 de oameni plătește cât una cu 8. Plafonează piața.                                                                    |

---

## 1. Ce schimbă 20.000 € față de 300.000 €

**20.000 € nu e o rundă. E un bilet de business angel, o punte.**

| Cu 300.000 € (scenariul inițial)     | Cu 20.000 €                                                                  |
| ------------------------------------ | ---------------------------------------------------------------------------- |
| Echipă: un senior + un om de vânzări | **Nicio angajare.** Fondatorul face tot, cu AI.                              |
| 18 luni de runway                    | 9–12 luni de **costuri fixe**, fără salariul fondatorului                    |
| Ținta: ~25.000 € MRR, apoi seed      | Ținta: **dovada că plătește cineva** (30 de clienți), apoi o rundă adevărată |
| Se negociază evaluarea               | **Nu fixăm o evaluare deloc**, sau o fixăm mică și pentru un procent mic     |

Banii ăștia nu construiesc firma. Cumpără **timp și legitimitate** ca să ajungem la
primii clienți plătitori, iar clienții sunt cei care fac posibilă o rundă de
150.000–300.000 € în 9–12 luni.

**Condiția asumată:** fondatorul are din ce trăi în perioada asta (alt venit,
economii). 20.000 € nu acoperă și un salariu, și lansarea. Dacă nu are, prima
decizie e alta: cât timp pe săptămână poate pune realist în Administrativo.

---

## 2. Merită să-l luăm pe investitor?

Întrebarea e legitimă. La 20.000 €, costul ascuns al unui asociat poate fi mai
mare decât banii.

### Capcana SRL-ului: un asociat mic poate bloca rundele viitoare

În SRL, **modificarea actului constitutiv cere votul tuturor asociaților**, dacă
actul constitutiv nu prevede altfel (Legea 31/1990, art. 192). Majorarea de
capital pentru următorul investitor e o modificare a actului constitutiv. Deci un
asociat cu 3% primit acum pentru 20.000 € poate **bloca runda de 300.000 €** de
peste un an, sau o poate condiționa.

**Consecința:** dacă investitorul intră ca asociat, actul constitutiv se modifică
**în același act** ca să permită hotărâri cu majoritate (de exemplu 3/4 din
capital), plus clauze de drag-along. Fără asta, nu semnăm.

### Matricea de decizie

| Situația investitorului                                           | Decizia                                                                       |
| ----------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| Aduce clienți: e contabil, are firme, are o rețea de antreprenori | **Da.** Banii contează mai puțin decât primii 10 clienți pe care îi deschide. |
| Aduce doar banii, dar e rezonabil și acceptă împrumut convertibil | **Da, prin împrumut convertibil** (§3). Fără asociat nou acum.                |
| Aduce doar banii și vrea neapărat părți sociale acum, cu drepturi | **Probabil nu.** Căutăm aceeași sumă din granturi, clienți sau economii.      |
| Vrea peste 10% sau veto pe decizii                                | **Nu.** Strică tabelul de capital pentru orice investitor care vine după.     |

### Alternativele la cei 20.000 €

- **Primii clienți plătitori.** 30 de clienți la ~250 RON pe lună înseamnă ~1.500 €
  pe lună. În 12 luni, cam cât investiția, fără să cedăm nimic.
- **Fonduri nerambursabile** pentru start-up-uri și digitalizare. Apelurile se
  schimbă des, deci se verifică ce e deschis acum.
- **Un cabinet de contabilitate partener** care plătește anticipat licențele
  pentru firmele lui, în schimbul unui preț redus.

---

## 3. Cum structurăm cei 20.000 €

### Varianta preferată: împrumut convertibil

- **Suma:** 20.000 €.
- **Plafon de evaluare:** 500.000–800.000 €. La conversie, investitorul primește
  părți sociale ca și cum ar fi intrat la evaluarea asta, chiar dacă runda
  următoare e la 2 mil. €.
- **Discount:** 20% față de prețul rundei următoare, dacă iese mai avantajos decât
  plafonul.
- **Conversie:** automată la prima rundă de peste ~100.000 €.
- **Scadență:** 24–36 de luni. Dacă nu vine nicio rundă până atunci, se convertește
  la plafon, nu se cere banul înapoi.
- **Dobândă:** zero sau simbolică.

**Ce primește investitorul, echivalent:** între ~2,5% (plafon 800.000 €) și ~4%
(plafon 500.000 €).

**De ce e mai bun pentru ambele părți:**

- nu fixăm azi o evaluare pe care nu o poate justifica nimeni;
- investitorul nu devine asociat acum, deci **nu poate bloca** runda următoare;
- costurile de notar și ONRC apar o singură dată, la conversie;
- investitorul e răsplătit pentru risc prin plafon și discount.

### Dacă vrea neapărat părți sociale acum

- **Procent cerut:** 4–5% (evaluare pre-money ~400.000–500.000 €).
- **Limita: 8%.** Peste ea, refuzăm. 10%+ pentru 20.000 € arată pentru orice
  investitor viitor ca o greșeală de început și scade atractivitatea firmei.
- **Mecanismul:** majorare de capital cu primă de emisiune.
- **Obligatoriu în același act:** hotărâri cu majoritate, nu cu unanimitate;
  drag-along; renunțarea la veto pe decizii operaționale.
- **Fără:** preferință la lichidare peste 1x, loc în conducere, drept de veto pe
  angajări, prețuri sau produs.

### Simularea diluării

| Etapă                                   | Ce se cedează | Rămâne la fondator |
| --------------------------------------- | ------------- | ------------------ |
| Azi                                     | —             | 100%               |
| Angel, 20.000 € (convertit la ~4%)      | 4%            | 96%                |
| Pre-seed, ~200.000 € (15%)              | 15%           | 81,6%              |
| Pool pentru opțiunile angajaților (10%) | 10%           | 73,4%              |
| Seed (20%)                              | 20%           | **~58,8%**         |

Cu un procent mic acum, fondatorul intră la seed cu majoritate clară. Cu 20%
pentru 20.000 € ar ajunge la seed cu ~47%.

---

## 4. Pe ce se duc cei 20.000 €

**Principiul:** banii merg doar în ce **deblochează lansarea** și în ce **aduce
clienți plătitori**. Fără angajări, fără birou, fără salarii.

| Categorie                                  | Sumă         | %    | Detaliu                                                                                                                                                 |
| ------------------------------------------ | ------------ | ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Juridic minim**                          | 3.500 €      | 18%  | Termeni și condiții, politică de confidențialitate, contract de prelucrare (DPA) pentru clienți, cesiunea codului către SRL, contractul cu investitorul |
| **Validare legală pe modulele de lansare** | 1.500 €      | 8%   | Contabil sau jurist pe valorile folosite de Pontaj, Concedii și REGES-Online (zile CO, sărbători legale, termene)                                       |
| **Asigurare de răspundere profesională**   | 1.200 €      | 6%   | Pentru erori în datele HR ale clienților                                                                                                                |
| **Infrastructură, 12 luni**                | 2.000 €      | 10%  | Supabase Pro, hosting, domeniu, e-mail tranzacțional, monitorizare erori, backup                                                                        |
| **Unelte de dezvoltare și AI, 12 luni**    | 2.400 €      | 12%  | Abonamentele AI cu care se construiește și se întreține aplicația                                                                                       |
| **Vânzări prin contabili**                 | 4.000 €      | 20%  | Deplasări la cabinete, evenimente pentru contabili, comisioane pentru primii parteneri, materiale tipărite                                              |
| **Marketing digital**                      | 2.400 €      | 12%  | Pagina de prezentare, video-uri demo, campanii mici pe LinkedIn și Google, țintite pe REGES-Online                                                      |
| **Rezervă**                                | 3.000 €      | 15%  | Nu se atinge fără decizie explicită. Acoperă surprize legale și întârzieri.                                                                             |
| **Total**                                  | **20.000 €** | 100% |                                                                                                                                                         |

### Ce NU se cumpără din banii ăștia, și de ce

| Nu cumpărăm                                          | În schimb                                                                                               |
| ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| Salarizarea validată complet (~8.000 € de expertiză) | **Salarizarea nu intră la lansare.** O pornim după primii bani din abonamente sau după runda următoare. |
| Pentest profesionist (~6.000 €)                      | Revizuirea de securitate existentă în proiect și uneltele gratuite. Pentestul vine la runda următoare.  |
| Primul angajat                                       | Fondatorul, cu AI. Prima angajare vine după 30 de clienți.                                              |
| Integrarea de plăți făcută de altcineva              | O face fondatorul (Netopia sau Stripe, plus e-Factura pentru facturile proprii).                        |
| Agenție de marketing                                 | Vânzare directă, prin contabili.                                                                        |

---

## 5. Deciziile de business, adaptate la buget mic

### Decizia 1: prețul pe angajat, înainte de lansare

Nu costă nimic și schimbă tot plafonul afacerii. Abonament de bază plus preț pe
angajat, pe trepte:

| Treaptă             | Exemplu                     |
| ------------------- | --------------------------- |
| Până la 15 angajați | 149 RON pe lună, tot inclus |
| 16–50               | 149 RON + 8 RON pe angajat  |
| 51–250              | 149 RON + 6 RON pe angajat  |

### Decizia 2: nucleu îngust la lansare

Lansăm doar ce doare și ce e sigur juridic: **Angajați, Pontaj, Concedii,
REGES-Online, SSM, Portal angajat.** Salarizarea rămâne închisă. Restul modulelor
se pornesc la cerere, ca motiv de upsell.

### Decizia 3: canalul e contabilul

Cu 4.000 € de vânzări nu se cumpără reclame, se cumpără **întâlniri**. Un contabil
are 30–80 de firme-client. Oferta: 20–30% comision recurent sau cont gratuit din
care își administrează toate firmele.

### Decizia 4: fondatorul nu scrie cod nou până la primii 10 clienți

Aplicația are deja mai mult decât poate vinde un om. Timpul merge în: plăți,
onboarding, termeni legali, demo-uri, întâlniri. Codul nou se scrie doar când îl
cere un client plătitor.

### Decizia 5: praguri de alarmă

| Lună | Dacă nu avem...         | Atunci...                                                                         |
| ---- | ----------------------- | --------------------------------------------------------------------------------- |
| 4    | 5 clienți plătitori     | Oprim marketingul digital și schimbăm mesajul sau segmentul                       |
| 8    | 20 de clienți plătitori | Nu cheltuim rezerva pe marketing. Reevaluăm dacă produsul rezolvă o durere reală. |

---

## 6. Etapele pe 12 luni

| Lună | Țintă                                                                                                |
| ---- | ---------------------------------------------------------------------------------------------------- |
| 1    | Contract cu investitorul semnat, cod cedat SRL-ului, termeni și DPA gata, prețul pe angajat publicat |
| 2    | Plăți funcționale, lansare pe nucleul îngust, primii 10 piloți în luna gratuită                      |
| 4    | 5–10 clienți plătitori, 2 cabinete de contabilitate partenere                                        |
| 8    | 20+ clienți plătitori, ~1.000 € MRR, churn cunoscut                                                  |
| 12   | **30–50 de clienți plătitori, ~2.000 € MRR**, pregătit pentru o rundă de pre-seed                    |

## 7. Ce urmează după: runda adevărată

Cu 30–50 de clienți plătitori, o creștere lunară vizibilă și salarizarea gata de
validat, ridicăm o rundă de **150.000–300.000 €** la o evaluare de 1,5–2,5 mil. €.
Împrumutul convertibil de 20.000 € se transformă atunci automat în părți sociale.

Abia din runda aceea se finanțează ce era în scenariul inițial: un dezvoltator
senior, un om de vânzări, validarea completă a salarizării, pentestul și
marketingul la scară.

---

## 8. Rezumat

1. **20.000 € e o punte, nu o rundă.** Cumpără timp până la primii clienți
   plătitori, nu o echipă.
2. **Structura preferată: împrumut convertibil**, plafon 500.000–800.000 €,
   discount 20%, conversie la prima rundă de peste 100.000 €.
3. **Dacă vrea părți sociale acum:** 4–5%, maximum 8%, cu actul constitutiv
   modificat ca un asociat mic să nu poată bloca rundele viitoare.
4. **Luăm banii mai ales dacă investitorul aduce clienți.** Dacă aduce doar bani
   și vrea condiții grele, căutăm aceeași sumă în altă parte.
5. **Banii merg în:** juridic, infrastructură, unelte, vânzări prin contabili și
   rezervă. Nu în salarii, nu în angajări, nu în cod nou.
6. **Prețul pe angajat și nucleul îngust** se decid înainte de lansare, indiferent
   dacă vin banii sau nu.
