# Administrativo: cum abordăm o rundă cu un investitor

_Analiză din perspectiva fondatorului, scrisă pe 17 septembrie 2026, înainte de
lansare și înainte de primul client plătitor._

> Cifrele de piață (numărul de firme de la INS) și prețurile concurenților sunt
> estimări de ordin de mărime și trebuie verificate înainte de o întâlnire.
> Cursul folosit: ~5 RON pentru 1 €.

## 0. Punctul de plecare: ce are un investitor de cumpărat

| Ce avem                                                                                      | Ce înseamnă pentru un investitor                                                                                                                                                       |
| -------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 22 de module, 143 de migrări, ~260.000 de linii TS, 631 de commit-uri                        | Produs lat și bine făcut. Izolarea între firme-client e făcută în bază (RLS FORCED), nu doar în aplicație, iar asta trece un audit tehnic.                                             |
| Construit între **17 aug și 13 sep 2026**, adică în **4 săptămâni**, în mare parte cu AI     | Taie în două. Arată că lucrăm foarte repede, dar și că **codul în sine se poate reface ieftin**, deci nu valorează mult singur. Evaluarea nu poate sta pe „am scris 260.000 de linii". |
| Ofertă comercială gata: Nucleu 149 RON, Toată aplicația 499 RON pe lună, prima lună gratuită | Există o teză de preț, dar **niciun client plătitor și nicio integrare de plată** (nu există Stripe sau Netopia în cod).                                                               |
| `NOTES.md` §3 are valori legale ⚠️ nevalidate: CAS, CASS, salariul minim, sporuri            | **Salarizarea nu se poate lansa** până nu le confirmă un contabil. O greșeală de calcul pe salarii înseamnă răspundere juridică.                                                       |
| Zero teste pe acțiuni și citiri, niciun test e2e                                             | Datorie tehnică pe care o găsește orice verificare tehnică (due diligence).                                                                                                            |
| Prețul e **fix pe firmă**, nu pe angajat                                                     | Cea mai mare problemă de business. O firmă cu 300 de oameni plătește cât una cu 8.                                                                                                     |

**Concluzia sinceră:** suntem înainte de lansare și fără venituri. Avem un produs
impresionant, dar nicio dovadă că îl cumpără cineva. Evaluarea trebuie construită
în jurul acestui fapt, nu negându-l.

---

## 1. Prima decizie: nu semnăm în prima săptămână

Nu negociem din poziția „avem nevoie de bani". Răspunsul către investitor:

> „Suntem interesați. Dați-ne 60 de zile. În timpul ăsta pornim 10–15 firme pilot
> și discutăm pe cifre, nu pe promisiuni."

**De ce:** o firmă fără venituri, cu 10 clienți care au trecut pe plată după luna
gratuită, valorează realist de **2–3 ori** mai mult decât una cu zero clienți. 60
de zile pot face diferența între 25% și 12% cedat pentru aceeași sumă.

Dacă investitorul nu vrea să aștepte, trecem la varianta de la §4 (împrumut
convertibil), care amână stabilirea evaluării.

---

## 2. Ce analizăm înainte de orice cifră

### a) Piața

- **Ținta:** firmele românești cu 10–249 de angajați. Sunt de ordinul a
  **~50–60 de mii**; cifra exactă trebuie verificată la INS. Sub 10 angajați,
  firma își ține HR-ul la contabil și nu plătește 150 RON pe lună. Peste 250,
  cumpără Charisma sau Senior ERP.
- **Plafonul matematic, cu prețul de azi:** 1% din țintă, adică ~550 de firme, la
  ~300 RON pe lună în medie, înseamnă **~2 mil. RON ARR (~400.000 €)**. La 5% din
  piață: ~2 mil. €.
- **Ce iese de aici:** cu prețul fix pe firmă, România singură nu produce o
  afacere care să justifice o evaluare mare. Pentru investitor, asta e întrebarea
  numărul unu, iar răspunsul e în §5.

### b) De ce acum

REGES-Online, care înlocuiește REVISAL, obligă firmele să-și schimbe fluxul. O
schimbare impusă prin lege e cel mai bun moment în care un client își schimbă
furnizorul. Asta e povestea pentru investitor.

### c) Concurența

- ERP-urile mari (Charisma, Senior) sunt scumpe, se implementează în luni de zile
  și sunt greoaie.
- Contabilii și firmele de payroll fac salarizarea deja. **Sunt concurenți, dar și
  cel mai bun canal de vânzare.**
- Excel plus aplicația gratuită a ITM e concurentul real al firmelor mici.
- Tabelul de concurență se face înainte de întâlnire, cu prețurile lor reale.

### d) Investitorul

- **Bani deștepți sau doar bani?** Aduce clienți, de exemplu o rețea de contabili
  sau un grup de firme? Aduce experiență B2B SaaS?
- Vorbim cu 2–3 fondatori în care a mai investit, mai ales cu unul la care
  lucrurile au mers prost.
- **Are bani de urmat?** Poate participa și la runda următoare, sau dispare după
  primul cec?
- Ce drepturi de veto cere și ce se întâmplă dacă apare un conflict.

### e) Propria casă, înainte să ne verifice el

- **Proprietatea intelectuală:** codul trebuie să fie al SRL-ului, nu al
  fondatorului personal. Contract de cesiune a drepturilor de autor către firmă
  **înainte** de rundă. Tot atunci se verifică licențele open-source din
  dependențe.
- **GDPR:** păstrăm CNP, IBAN și date medicale SSM, deci date sensibile. E nevoie
  de evaluare de impact (DPIA), contract de prelucrare (DPA) pentru clienți și un
  DPO extern.
- **Riscul de fondator unic:** un singur om plus AI a scris tot. Investitorul va
  întreba „ce se întâmplă dacă fondatorul dispare?"

---

## 3. Câți bani cerem

**Cererea: 300.000 € pentru 18 luni, pentru 18–20% din părțile sociale.**

- Asta înseamnă o evaluare post-money de ~1,5–1,65 mil. € (pre-money ~1,2–1,35
  mil. €).
- Pentru o firmă românească fără venituri, e **în partea de sus a intervalului**
  realist, care e aproximativ 0,8–1,5 mil. € pre-money. Justificarea: produsul deja
  construit, legea care forțează schimbarea (REGES) și costul mic de construcție
  deja demonstrat.
- **Limita: 25%.** Peste ea, ne ridicăm de la masă sau reducem suma.

### De ce nu dăm mai mult: simularea diluării

| Etapă                             | Ce se cedează | Rămâne la fondator |
| --------------------------------- | ------------- | ------------------ |
| Azi                               | —             | 100%               |
| Pre-seed (acum)                   | 20%           | 80%                |
| Pool pentru opțiunile angajaților | 10%           | 72%                |
| Seed                              | 20%           | 57,6%              |
| Seria A                           | 20%           | **~46%**           |

Cu 35% cedat acum, fondatorul ajunge la Seria A cu ~37% și riscă să piardă
controlul înainte să ajungă firma unde trebuie. **Fondatorul trebuie să rămână
peste 50% până la seed inclusiv.**

### De ce nu cerem mai mult de 300.000 €

Mai mulți bani înainte de validare înseamnă diluare mai mare, pe cea mai mică
evaluare pe care o va avea firma vreodată. Luăm cât ne trebuie ca să ajungem la
cifrele care cresc evaluarea, adică ~20.000–25.000 € MRR, apoi ridicăm la seed cu o
evaluare de 3–5 ori mai mare.

---

## 4. Structura tranzacției, nu doar procentul

1. **Varianta preferată: împrumut convertibil**, cu plafon de evaluare de 1,5–2
   mil. € și 20% discount la runda următoare. Nu fixăm acum o evaluare pe care
   nimeni nu o poate justifica. Investitorul primește părți sociale la seed, la un
   preț mai bun decât noii veniți.
2. **Dacă vrea neapărat părți sociale acum:** majorare de capital social cu primă
   de emisiune. Capitalul social crește simbolic, iar restul banilor intră ca
   primă. Legea 31/1990 cere și acordul asociaților care dețin 3/4 din capital
   pentru intrarea unui nou asociat.
3. **Termeni acceptabili:**
   - preferință la lichidare 1x, neparticipativă;
   - drept de a participa pro-rata la rundele viitoare;
   - drept de informare, cu raport lunar;
   - vesting invers pe fondator pe 4 ani, **cu recunoașterea muncii deja făcute**;
   - tag-along și drag-along;
   - anti-diluare de tip medie ponderată.
4. **Termeni refuzați:**
   - preferință participativă sau 2x;
   - anti-diluare „full ratchet";
   - drept de veto pe decizii operaționale (angajări, prețuri, produs);
   - control în consiliul de administrație;
   - neconcurență mai lungă de 12–24 de luni.
5. **Tranșe:** acceptabile doar dacă păstrăm evaluarea mai mare. De exemplu,
   120.000 € la semnare și 180.000 € la 50 de clienți plătitori. Pragul trebuie să
   fie ceva ce controlăm noi (clienți), nu ceva vag (o „tracțiune suficientă").

---

## 5. Decizii de business, indiferent de investitor

### Decizia 1: schimbăm prețul înainte de lansare

Prețul fix pe firmă lasă bani pe masă și plafonează piața. Trecem pe **abonament
de bază plus preț pe angajat, pe trepte**:

| Treaptă             | Exemplu                     |
| ------------------- | --------------------------- |
| Până la 15 angajați | 149 RON pe lună, tot inclus |
| 16–50               | 149 RON + 8 RON pe angajat  |
| 51–250              | 149 RON + 6 RON pe angajat  |

Un client cu 100 de angajați ajunge de la 499 la ~750–1.000 RON pe lună. **ARPU se
dublează sau triplează**, iar plafonul de piață din §2 se mută de la ~400.000 € la
~1–1,5 mil. € ARR doar în România. Asta e răspunsul la întrebarea numărul unu a
investitorului.

### Decizia 2: nu lansăm 22 de module

Lansăm un **nucleu îngust care doare**: Angajați, Pontaj, Concedii, REGES-Online,
SSM și Portal angajat.

- **Salarizarea rămâne închisă** până semnează un expert contabil pe valorile din
  `NOTES.md` §3 și până avem asigurare de răspundere profesională.
- Restul modulelor le pornim treptat, pe măsură ce clienții le cer. Fiecare
  pornire devine motiv de upsell și de anunț.

### Decizia 3: vindem prin contabili

Nu vindem firmă cu firmă, ci prin cabinetele de contabilitate și payroll. Un
contabil are 30–80 de firme-client. Le oferim **20–30% comision recurent** sau un
cont gratuit din care își administrează toate firmele. Costul de achiziție scade de
5–10 ori față de reclame.

### Decizia 4: primul angajat e un senior care citește codul

Nu un junior care scrie mai mult cod. Un om care înțelege 260.000 de linii scrise
rapid, reduce dependența de un singur om și închide datoria cunoscută (teste pe
acțiuni, e2e). **Nu punem oameni de vânzări înainte să avem 10 clienți** care
confirmă mesajul.

### Decizia 5: bugetul are prag de alarmă

Dacă la luna 9 nu avem 30 de clienți plătitori, tăiem marketingul, păstrăm echipa
minimă și schimbăm strategia. Nu cheltuim liniar până se termină banii.

---

## 6. Pe ce se duc cei 300.000 € (18 luni)

| Categorie                         | Sumă          | %    | Detaliu                                                                                                                                                                   |
| --------------------------------- | ------------- | ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Echipa de produs**              | 95.000 €      | 32%  | Un dezvoltator senior full-stack (~4.000 € cost total pe lună × 18) + ~20.000 € pentru un QA sau un dezvoltator part-time în primele 6 luni                               |
| **Salariul fondatorului**         | 36.000 €      | 12%  | 2.000 € pe lună. Mic, dar necesar: un fondator care nu-și plătește chiria ia decizii proaste.                                                                             |
| **Vânzări și customer success**   | 55.000 €      | 18%  | Un om angajat de la luna 4 (~3.000 € + comision) pentru onboarding, pilot și relația cu contabilii                                                                        |
| **Marketing și canal**            | 35.000 €      | 12%  | Comisioane pentru contabili, conținut despre REGES-Online (trafic organic), evenimente pentru contabili, Google Ads țintit, studii de caz                                 |
| **Juridic, fiscal, conformitate** | 25.000 €      | 8%   | Expert contabil care validează salarizarea (~8.000 €), avocat pentru termeni, DPA și rundă (~7.000 €), DPO extern, pentest (~6.000 €), asigurare de răspundere (~4.000 €) |
| **Infrastructură și unelte**      | 14.000 €      | 5%   | Supabase Pro sau Team, hosting, monitorizare, e-mail tranzacțional, backup, costuri AI pentru Asistent și dezvoltare                                                      |
| **Finalizare înainte de lansare** | 10.000 €      | 3%   | Integrare de plată (Netopia sau Stripe), emitere e-Factura pentru propriile facturi, teste e2e pe fluxurile critice                                                       |
| **Rezervă**                       | 30.000 €      | 10%  | Nu se atinge fără decizie explicită. Acoperă întârzieri la încasare și surprize legale.                                                                                   |
| **Total**                         | **300.000 €** | 100% |                                                                                                                                                                           |

Consumul lunar crește de la ~9.000 € în lunile 1–3 la ~19.000 € în lunile 10–18.

### Etapele promise investitorului

| Lună | Țintă                                                                                     |
| ---- | ----------------------------------------------------------------------------------------- |
| 3    | Lansare pe nucleul îngust, 15 piloți, plăți funcționale, salarizarea validată de contabil |
| 6    | 40 de clienți plătitori, ~4.000 € MRR, 3 cabinete de contabilitate partenere              |
| 12   | 150 de clienți, ~15.000 € MRR, churn lunar sub 3%                                         |
| 18   | 250+ clienți, **~25.000 € MRR (~300.000 € ARR)**, pregătit de seed                        |

La 300.000 € ARR și creștere bună, un seed la 3–4 mil. € evaluare e realist. Asta
închide cercul: dăm 20% la 1,5 mil. € ca să putem da următorii 20% la 4 mil. €.

---

## 7. Rezumat: pașii, în ordine

1. Îi spunem investitorului „da, discutăm" și cerem 60 de zile.
2. Mutăm codul în proprietatea SRL-ului și facem pachetul GDPR.
3. Schimbăm prețul pe angajat și pregătim nucleul îngust de lansare, fără
   salarizare.
4. Mergem la 5 cabinete de contabilitate cu oferta de parteneriat.
5. Pornim 10–15 piloți.
6. Ne întoarcem cu cifre și propunem împrumut convertibil: **300.000 €, plafon de
   evaluare 1,5–2 mil. €, 20% discount.** Dacă insistă pe părți sociale:
   **18–20%, maximum 25%**, fără veto operațional și fără preferință
   participativă.

**Ce nu facem:** nu vindem 30–40% ca să „avem liniște", nu luăm mai mulți bani
decât ne trebuie pentru următoarele cifre și nu lăsăm pe nimeni să evalueze firma
după liniile de cod.
