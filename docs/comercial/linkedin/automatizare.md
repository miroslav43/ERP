# Automatizarea publicării pe LinkedIn — ce se poate

Cercetare din **23 septembrie 2026**, făcută de un agent cu surse web. Afirmațiile
marcate _oficial_ vin din documentația LinkedIn (mutată pe
learn.microsoft.com/linkedin); cele marcate _neoficial_ vin din bloguri sau din
agregatoare de prețuri. **Nimic de aici n-a fost încă încercat de noi**: se
verifică la prima folosire, iar ce nu se confirmă se corectează aici.

Atenție la date: paginile Microsoft Learn se republică lunar, iar data din antet
poate fi mai nouă decât conținutul.

## Ce acceptă API-ul oficial

| Nevoie                        | Răspuns                                                                                                                     | Sursă     |
| ----------------------------- | --------------------------------------------------------------------------------------------------------------------------- | --------- |
| Publicare pe pagina de firmă  | **Community Management API**, scope `w_organization_social`. **Nu e self-serve**: cere aprobare.                            | oficial   |
| Condiții de acces             | e-mail de firmă (NU gmail/yahoo), website, politică de confidențialitate; pagina verificată de un super admin al ei         | oficial   |
| Durata aprobării              | nedocumentată; „2–4 săptămâni” circulă doar pe bloguri                                                                      | neoficial |
| Carusel PDF                   | **da**: Documents API + Posts API, autor organizație (max 100 MB, 300 de pagini). „Carousel: No” din tabel e despre reclame | oficial   |
| Imagine cu text alternativ    | da: Images API + Posts API (câmpul exact de alt text încă necitit)                                                          | oficial   |
| Programare la 8:30            | **nu există** în API: postarea iese la apel, deci ora o dă un cron propriu                                                  | oficial   |
| Primul comentariu             | da, Comments API cu autor organizație, dar pe **alt scope**: `w_organization_social_feed`                                   | oficial   |
| Statistici                    | afișări, clicuri, reacții per postare, urmăritori: `rw_organization_admin`, fereastră de 12 luni                            | oficial   |
| Tokenuri                      | acces 60 de zile; refresh 365 de zile, apoi **reautentificare manuală obligatorie**, cel puțin o dată pe an                 | oficial   |
| Limite în treapta Development | 500 de apeluri/aplicație/zi, valabilă max. 12 luni; Standard cere o cerere separată cu un screencast                        | oficial   |

## Unelte terțe, pentru pagină de firmă

| Unealtă        | Carusel PDF | Primul comentariu | Text alternativ | Programare        | Preț minim (2026)                          |
| -------------- | ----------- | ----------------- | --------------- | ----------------- | ------------------------------------------ |
| Metricool      | da          | **da, oficial**   | da              | da                | de la 16 €/lună (anual)                    |
| Buffer         | da          | da (plătit)       | da              | da                | ~5–6 $/lună/canal, neoficial               |
| Publer         | da          | da                | neconfirmat     | da                | ~4–5 $/lună, neoficial                     |
| SocialBee      | da          | da                | da              | da                | 29 $/lună; neclar dacă e în planul de bază |
| Hootsuite      | da          | neconfirmat       | —               | da                | 99 $/lună                                  |
| Later          | neconfirmat | —                 | —               | da                | ~19–25 $/lună                              |
| Zapier         | probabil nu | neconfirmat       | —               | cron extern       | —                                          |
| LinkedIn nativ | zonă gri    | **nu**            | da              | da (1 h – 3 luni) | gratuit                                    |

## Cele trei variante

| Varianta                         | Ce rămâne manual                                                                                             | Cost                            |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------ | ------------------------------- |
| **a. Manual**, cum e acum        | publicarea la 8:30 și comentariul, de două ori pe săptămână (~10 min)                                        | 0                               |
| **b. Unealtă terță** (Metricool) | o încărcare pe săptămână a celor două postări deja generate (~15–20 min); ora și comentariul le face unealta | ~16 €/lună                      |
| **c. API propriu**               | cererea de acces, reautentificarea anuală, întreținerea codului; aprobarea poate fi refuzată                 | licență 0, câteva zile de lucru |

**Recomandarea cercetării: b.** Automatizează exact partea care doare (prezența
la 8:30 și comentariul imediat), fără să depindă de o aprobare incertă. Varianta
c merită abia dacă vrem statisticile direct în ERP sau crește volumul.

## De verificat la prima folosire

1. Metricool: un carusel PDF de probă pe pagina de firmă, cu primul comentariu programat.
2. Programarea nativă LinkedIn acceptă un PDF? Documentația nu spune nici da, nici nu.
3. Pentru c: aprobă LinkedIn o firmă mică? Primește treapta Development token de refresh?
4. Termenii (User Agreement 8.2) interzic „metodele automate neautorizate”; API-ul
   aprobat pare o altă categorie, dar documentul nu o spune explicit.
