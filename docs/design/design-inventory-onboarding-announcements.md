## Enum-uri Postgres introduse

```
inventory_condition        : nou | bun | uzat | defect
inventory_status           : in_stoc | alocat | in_reparatie | casat
import_batch_status        : incarcat | in_validare | validat | cu_erori | aplicat | anulat
import_row_status          : valid | avertisment | eroare | aplicat | ignorat
checklist_type             : onboarding | offboarding
checklist_responsible      : hr | manager | it | angajat
checklist_resource_type    : video | ppt | pdf | document | task | form
checklist_instance_status  : planificat | in_curs | blocat | finalizat | anulat
checklist_item_status      : de_facut | in_curs | finalizat | neaplicabil | anulat
announcement_priority      : normal | important | urgent
announcement_status        : draft | programat | publicat | expirat | arhivat
announcement_target_type   : organizatie | departament | rol | angajat
```

Helperi presupusi din nucleu (nu-i redefinesc): `app.current_org_id()`, `app.is_member(org)`, `app.has_perm(org, 'cheie')` (citeste `role_permissions`), `app.current_employee_id(org)`. Extensie necesara: `btree_gist`.

---

# A) INVENTAR (feature `inventory`)

### inventory_categories
scop: nomenclator de categorii per organizatie, ca sa nu existe categorii hardcodate in cod.
coloane:
```
id uuid PK
organization_id uuid NOT NULL FK->organizations(id) RESTRICT
cod text NOT NULL
denumire text NOT NULL
necesita_serie boolean NOT NULL DEFAULT false
activ boolean NOT NULL DEFAULT true
```
constrangeri: UNIQUE(organization_id, cod) WHERE deleted_at IS NULL
indexuri: (organization_id, activ) WHERE deleted_at IS NULL
rls: SELECT = app.is_member(organization_id); INSERT/UPDATE = app.has_perm(organization_id,'inventory.manage'); DELETE = interzis
nota: `necesita_serie=true` (laptop, telefon) activa validarea de serie/IMEI la import si la creare.

### inventory_items
scop: obiectele de inventar ale organizatiei, cu starea fizica si statusul logistic.
coloane:
```
id uuid PK
organization_id uuid NOT NULL FK->organizations(id) RESTRICT
category_id uuid NOT NULL FK->inventory_categories(id) RESTRICT
numar_inventar text NOT NULL
denumire text NOT NULL
model text
producator text
serie text
imei text
data_achizitie date
valoare_achizitie numeric(14,2) NOT NULL DEFAULT 0
moneda char(3) NOT NULL DEFAULT 'RON'
garantie_expira date
stare inventory_condition NOT NULL DEFAULT 'nou'
status inventory_status NOT NULL DEFAULT 'in_stoc'
locatie text
location_id uuid FK->company_locations(id) RESTRICT
casat_la date
motiv_casare text
observatii text
import_batch_id uuid FK->inventory_import_batches(id) SET NULL
```
constrangeri:
```
UNIQUE(organization_id, numar_inventar) WHERE deleted_at IS NULL
UNIQUE(organization_id, serie)          WHERE deleted_at IS NULL AND serie IS NOT NULL
UNIQUE(organization_id, imei)           WHERE deleted_at IS NULL AND imei IS NOT NULL
CHECK (valoare_achizitie >= 0)
CHECK (status <> 'casat' OR casat_la IS NOT NULL)
CHECK (garantie_expira IS NULL OR data_achizitie IS NULL OR garantie_expira >= data_achizitie)
```
indexuri:
```
(organization_id, status) WHERE deleted_at IS NULL
(organization_id, category_id, status) WHERE deleted_at IS NULL
(organization_id, garantie_expira) WHERE deleted_at IS NULL AND garantie_expira IS NOT NULL
GIN pe to_tsvector('simple', denumire||' '||coalesce(model,'')||' '||coalesce(serie,''))  -- cautare
```
rls:
```
SELECT = app.is_member(organization_id) AND (
           app.has_perm(organization_id,'inventory.read')
           OR EXISTS(alocare activa catre app.current_employee_id(organization_id)))
INSERT/UPDATE = app.has_perm(organization_id,'inventory.manage')
DELETE = interzis (soft delete prin deleted_at, doar 'inventory.admin')
```

**Capcana UNIQUE(numar_inventar) + soft delete.** `UNIQUE ... WHERE deleted_at IS NULL` inseamna ca stergerea logica *elibereaza* numarul de inventar — exact ce nu vrei intr-un registru de mijloace fixe, unde numarul trebuie sa ramana trasabil pentru totdeauna. Regula pe care o impun:
1. Un obiect care a avut vreodata o alocare **nu se sterge logic niciodata**; iese din uz prin `status='casat' + casat_la`. Soft delete e rezervat exclusiv erorilor de introducere (tipic: randuri gresite dintr-un import), in primele zile, inainte de orice alocare. Se aplica cu trigger `BEFORE UPDATE`: `IF NEW.deleted_at IS NOT NULL AND EXISTS(alocare pe item) THEN RAISE`.
2. Adaug in plus un index unic „istoric", ca sa nu se refoloseasca numarul nici dupa stergere:
   `CREATE UNIQUE INDEX ON inventory_items (organization_id, upper(trim(numar_inventar)));` — fara clauza `WHERE`, peste toate randurile. UNIQUE-ul partial ramane pentru mesajul de eroare prietenos in UI; asta e plasa de siguranta.
3. Normalizarea (`upper(trim(...))`) e obligatorie: altfel „LT-0012" si „lt-0012 " sunt doua obiecte diferite si dublezi patrimoniul la primul import Excel.

### inventory_allocations
scop: istoricul predarilor de obiecte catre angajati, cu perioada de detinere ca interval.
coloane:
```
id uuid PK
organization_id uuid NOT NULL FK->organizations(id) RESTRICT
item_id uuid NOT NULL FK->inventory_items(id) RESTRICT
employee_id uuid NOT NULL FK->employees(id) RESTRICT
predat_la timestamptz NOT NULL DEFAULT now()
returnat_la timestamptz
perioada tstzrange GENERATED ALWAYS AS (tstzrange(predat_la, returnat_la, '[)')) STORED
stare_la_predare inventory_condition NOT NULL
stare_la_returnare inventory_condition
observatii text
pv_predare_path text        -- Storage: org/<org_id>/inventar/pv/<alloc_id>-predare.pdf
pv_returnare_path text
confirmat_de_angajat_la timestamptz
confirmat_ip inet
predat_de uuid FK->auth.users(id)
primit_de uuid FK->auth.users(id)
```
constrangeri:
```
CHECK (returnat_la IS NULL OR returnat_la > predat_la)
CHECK (returnat_la IS NOT NULL OR stare_la_returnare IS NULL)
CHECK (confirmat_de_angajat_la IS NULL OR confirmat_de_angajat_la >= predat_la)
EXCLUDE -> mai jos
```
indexuri:
```
(organization_id, employee_id) WHERE returnat_la IS NULL AND deleted_at IS NULL   -- „ce are omul acum"
(organization_id, item_id, predat_la DESC) WHERE deleted_at IS NULL
(organization_id) WHERE deleted_at IS NULL AND returnat_la IS NULL AND confirmat_de_angajat_la IS NULL  -- coada „neconfirmate"
```
rls:
```
SELECT = app.has_perm(organization_id,'inventory.read')
         OR employee_id = app.current_employee_id(organization_id)
INSERT/UPDATE = app.has_perm(organization_id,'inventory.manage')
UPDATE (angajat) = politica separata, doar pe randul propriu, doar coloana confirmat_de_angajat_la
                   cand era NULL (se aplica prin functie SECURITY DEFINER, nu prin UPDATE liber)
DELETE = interzis
```

**Garantia „un obiect, un singur detinator la un moment dat" — la nivel de DB:**

```sql
CREATE EXTENSION IF NOT EXISTS btree_gist;

ALTER TABLE public.inventory_allocations
  ADD CONSTRAINT inventory_allocations_fara_suprapunere
  EXCLUDE USING gist (
    item_id  WITH =,
    perioada WITH &&
  )
  WHERE (deleted_at IS NULL);
```

Cum functioneaza si de ce e corecta:
- `perioada` e coloana **generata** din `predat_la`/`returnat_la`, deci nu poate fi desincronizata de aplicatie. `tstzrange(ts, ts)` este IMMUTABLE, deci e acceptata ca `STORED`.
- Alocare activa ⇒ `returnat_la IS NULL` ⇒ `perioada = [predat_la, ∞)`. Orice a doua predare a aceluiasi item, la orice moment ulterior, se suprapune cu intervalul infinit si e respinsa cu `23P01 exclusion_violation`. Nu ai nevoie de niciun trigger, niciun `SELECT ... FOR UPDATE` si e sigur si sub concurenta (doi HR care predau simultan acelasi laptop — unul primeste eroare).
- Limita `'[)')` (inclus-exclus) permite predare-in-aceeasi-secunda dupa returnare: `returnat_la = 10:00` si `predat_la = 10:00` nu se suprapun. Fara asta, orice returnare+repredare instant esueaza.
- `WHERE (deleted_at IS NULL)` face constrangerea partiala, coerenta cu restul schemei.
- Server Action-ul mapeaza `23P01` intr-un mesaj romanesc: „Obiectul este deja alocat catre <nume>. Inregistreaza intai returnarea."
- Trigger complementar `AFTER INSERT/UPDATE` care sincronizeaza `inventory_items.status` (`alocat` / `in_stoc`) — status-ul de pe item e derivat, cache pentru liste; sursa de adevar ramane `inventory_allocations`.

**Continutul PDF „Proces-verbal de predare-primire":**
- Antet: denumire firma, CUI, Reg. Com., sediu, logo; „PROCES-VERBAL DE PREDARE-PRIMIRE Nr. `<serie>/<numar>` din `dd.MM.yyyy`" (numerotare per organizatie, dintr-un `document_sequences`, nu din `id`).
- Partile: societatea, reprezentata prin `<predat_de: nume, functie>` — predator; `<angajat: nume, functie, departament, marca/nr. contract>` — primitor. **Fara CNP** (e in `employee_sensitive_data`, nu are ce cauta intr-un PV de laptop).
- Tabel obiecte: nr. crt., denumire, model/producator, nr. inventar, serie/IMEI, accesorii, stare la predare, valoare de inventar (`1.234,56 lei`), garantie pana la `dd.MM.yyyy`.
- Data si ora predarii, locatia.
- Clauze standard, parametrizabile per organizatie dintr-un template (`document_templates`), nu hardcodate: utilizare exclusiv in interes de serviciu, obligatia de pastrare, anuntarea defectiunilor/furtului in 24h, obligatia restituirii la incetarea contractului sau la cerere, raspunderea patrimoniala conform art. 254 Codul muncii, mentiune GDPR pentru dispozitivele cu date.
- Observatii libere.
- Doua casete de semnatura (predator / primitor) + blocul de confirmare electronica: „Confirmat electronic de `<nume>` la `dd.MM.yyyy HH:mm` (Europe/Bucharest), IP `<ip>`" — se tipareste doar cand `confirmat_de_angajat_la IS NOT NULL`.
- Subsol: hash SHA-256 al continutului + `allocation_id` scurt, ca sa poti dovedi ca PDF-ul din Storage e cel confirmat.
- Varianta „returnare" a aceluiasi template: stare la returnare, diferente/lipsuri, decizie (repus in stoc / in reparatie / imputare).

### inventory_import_batches
scop: un lot de import Excel, cu starea lui de validare/aplicare.
coloane:
```
id uuid PK
organization_id uuid NOT NULL FK->organizations(id) RESTRICT
fisier_nume text NOT NULL
fisier_path text NOT NULL          -- xlsx original in Storage, se pastreaza ca dovada
maparea_coloanelor jsonb NOT NULL DEFAULT '{}'   -- header Excel -> camp
status import_batch_status NOT NULL DEFAULT 'incarcat'
total_randuri int NOT NULL DEFAULT 0
randuri_valide int NOT NULL DEFAULT 0
randuri_cu_erori int NOT NULL DEFAULT 0
randuri_aplicate int NOT NULL DEFAULT 0
raport_erori_path text            -- xlsx generat cu doar randurile picate
aplicat_la timestamptz
aplicat_de uuid FK->auth.users(id)
```
constrangeri: CHECK (total_randuri >= 0); CHECK (status <> 'aplicat' OR aplicat_la IS NOT NULL)
indexuri: (organization_id, status, created_at DESC) WHERE deleted_at IS NULL
rls: SELECT/INSERT/UPDATE = app.has_perm(organization_id,'inventory.import'); DELETE = interzis

### inventory_import_rows
scop: staging linie-cu-linie: valorile brute din Excel, valorile normalizate si erorile per rand.
coloane:
```
id uuid PK
organization_id uuid NOT NULL FK->organizations(id) RESTRICT
batch_id uuid NOT NULL FK->inventory_import_batches(id) CASCADE
numar_rand int NOT NULL              -- randul real din xlsx, pentru mesaje utile
date_brute jsonb NOT NULL            -- exact ce a citit exceljs, ca text
numar_inventar text
denumire text
category_cod text
model text
serie text
imei text
data_achizitie date
valoare_achizitie numeric(14,2)
garantie_expira date
stare inventory_condition
locatie text
status import_row_status NOT NULL DEFAULT 'valid'
erori jsonb NOT NULL DEFAULT '[]'    -- [{camp, cod, mesaj}]
item_id uuid FK->inventory_items(id) SET NULL   -- completat la aplicare
```
constrangeri: UNIQUE(batch_id, numar_rand); CHECK (jsonb_typeof(erori) = 'array')
indexuri: (batch_id, status); (organization_id, batch_id) WHERE status = 'eroare'
rls: identic cu `inventory_import_batches` (aceeasi permisiune `inventory.import`)
nota: `date_brute` se pastreaza intacte — cand cineva reclama ca „valoarea a intrat gresit", vrei sa vezi ce scria efectiv in celula, nu ce a interpretat parserul.

**Fluxul de import a 300 de laptopuri (in 5 pasi, tranzactional la final):**
1. **Upload**: xlsx in Storage (`org/<org_id>/inventar/importuri/<batch_id>.xlsx`), se creeaza batch-ul cu `status='incarcat'`. Un sablon descarcabil cu antete fixe reduce la zero problema mapping-ului; mapping manual header→camp e totusi disponibil si salvat in `maparea_coloanelor`.
2. **Parsare** (Server Action + exceljs, cu limita de dimensiune si numar de randuri): toate celulele se citesc **ca text** si se insereaza in `inventory_import_rows` (`date_brute`), apoi se normalizeaza: trim, `upper` pe numar inventar/serie, virgula zecimala romaneasca `1.234,56` → `1234.56`, date `dd.MM.yyyy` → `date` cu date-fns `ro`.
3. **Validare** (o singura functie SQL peste tot batch-ul, nu 300 round-trip-uri): Zod la nivel de rand in TS pentru forma, apoi SQL pentru unicitati. Verificari: campuri obligatorii; `category_cod` exista si e activ; serie obligatorie daca `necesita_serie`; valoare ≥ 0; `garantie_expira >= data_achizitie`; **duplicat in interiorul fisierului** (`numar_inventar`/`serie` repetate — capcana clasica la 300 de randuri copiate); **coliziune cu baza**, verificata pe indexul istoric normalizat, deci si cu itemi sterși logic sau casati. Rezultat: `valid` / `avertisment` (ex. garantie deja expirata, valoare 0) / `eroare`. Batch → `validat` sau `cu_erori`.
4. **Preview**: tabel cu 3 taburi (valide / avertismente / erori), `numar_rand` + mesaj in romana. Butonul de aplicare e activ doar daca exista randuri valide; politica pe care o recomand este **partial apply** (aplica valide, lasa erorile in batch) — la 300 de randuri, blocarea totala pentru 4 greseli de tastare inseamna ca omul renunta la import.
5. **Aplicare**: o singura tranzactie, `INSERT INTO inventory_items ... SELECT ... FROM inventory_import_rows WHERE batch_id=$1 AND status IN ('valid','avertisment') RETURNING id` → `item_id` inapoi pe rand, rand → `aplicat`, batch → `aplicat`. Idempotenta: se ignora randurile deja `aplicat`, deci un re-click nu dubleaza. Constrangerile unice raman ultima linie de aparare (race intre doua importuri simultane) — eroarea `23505` marcheaza randul, nu arunca tranzactia (`ON CONFLICT DO NOTHING` + reconciliere).
6. **Raport de erori**: xlsx generat din randurile `eroare` = fisierul original + doua coloane adaugate (`Eroare`, `Detaliu`), salvat in Storage, `raport_erori_path`. Omul il corecteaza si il reincarca ca batch nou — fara sa mai atinga randurile care au intrat.

---

# B) CHECKLIST ONBOARDING / OFFBOARDING (feature `onboarding`)

### checklist_templates
scop: sablonul de pasi aplicabil unei categorii de angajati la intrare sau la iesire.
coloane:
```
id uuid PK
organization_id uuid NOT NULL FK->organizations(id) RESTRICT
denumire text NOT NULL
tip checklist_type NOT NULL
department_id uuid FK->departments(id) RESTRICT     -- NULL = orice departament
position_id uuid FK->positions(id) RESTRICT         -- NULL = orice functie
rol app_role                                        -- NULL = orice rol
prioritate int NOT NULL DEFAULT 0                   -- la egalitate de potrivire, castiga prioritatea mare
activ boolean NOT NULL DEFAULT true
versiune int NOT NULL DEFAULT 1
```
constrangeri: UNIQUE(organization_id, denumire, tip, versiune) WHERE deleted_at IS NULL
indexuri: (organization_id, tip, activ) WHERE deleted_at IS NULL
rls: SELECT = app.is_member(organization_id); INSERT/UPDATE = app.has_perm(organization_id,'onboarding.manage'); DELETE = interzis
nota: selectia sablonului = cel mai **specific** potrivit (department+position+rol > department > nimic), apoi `prioritate DESC`. Nu aplic mai multe sabloane simultan — duce la pasi duplicati.

### checklist_template_items
scop: pasii sablonului, cu responsabil, scadenta relativa si eventuala resursa de parcurs.
coloane:
```
id uuid PK
organization_id uuid NOT NULL FK->organizations(id) RESTRICT
template_id uuid NOT NULL FK->checklist_templates(id) CASCADE
titlu text NOT NULL
descriere text
ordine int NOT NULL DEFAULT 0
responsabil checklist_responsible NOT NULL
scadenta_relativa_zile int NOT NULL DEFAULT 0     -- +1 = ziua 1 de la reper; -3 = cu 3 zile inainte de plecare
zile_lucratoare boolean NOT NULL DEFAULT true     -- offset in zile lucratoare (sarbatori legale din tabela de config)
obligatoriu boolean NOT NULL DEFAULT true
blocheaza_finalizarea boolean NOT NULL DEFAULT false
resource_type checklist_resource_type NOT NULL DEFAULT 'task'
resource_url text
storage_path text
resource_versiune int NOT NULL DEFAULT 1
resource_hash text                                -- SHA-256 al fisierului la momentul publicarii
necesita_confirmare_parcurgere boolean NOT NULL DEFAULT false
durata_minima_secunde int                         -- prag anti-„next-next-finish" pentru video/ppt
form_schema jsonb                                 -- schema campurilor (se traduce in Zod la runtime)
```
constrangeri:
```
UNIQUE(template_id, ordine) WHERE deleted_at IS NULL
CHECK (resource_type <> 'form' OR form_schema IS NOT NULL)
CHECK (resource_type IN ('task','form') OR (resource_url IS NOT NULL OR storage_path IS NOT NULL))
CHECK (scadenta_relativa_zile BETWEEN -365 AND 365)
```
indexuri: (template_id, ordine) WHERE deleted_at IS NULL
rls: ca la `checklist_templates`
nota: `form_schema` e validata la salvare cu un meta-schema Zod si NU se evalueaza niciodata ca cod; randarea foloseste o lista inchisa de tipuri de camp.

### checklist_instances
scop: aplicarea unui sablon unui angajat concret, cu data de reper si progresul curent.
coloane:
```
id uuid PK
organization_id uuid NOT NULL FK->organizations(id) RESTRICT
employee_id uuid NOT NULL FK->employees(id) RESTRICT
template_id uuid NOT NULL FK->checklist_templates(id) RESTRICT
template_versiune int NOT NULL
tip checklist_type NOT NULL
data_reper date NOT NULL                 -- data angajarii sau ultima zi lucrata
status checklist_instance_status NOT NULL DEFAULT 'planificat'
progres_procent int NOT NULL DEFAULT 0
total_itemi int NOT NULL DEFAULT 0
itemi_finalizati int NOT NULL DEFAULT 0
responsabil_hr uuid FK->employees(id)
manager_id uuid FK->employees(id)
finalizat_la timestamptz
finalizat_de uuid FK->auth.users(id)
motiv_anulare text
```
constrangeri:
```
UNIQUE(organization_id, employee_id, tip) WHERE deleted_at IS NULL AND status <> 'anulat'
CHECK (progres_procent BETWEEN 0 AND 100)
CHECK (status <> 'finalizat' OR finalizat_la IS NOT NULL)
```
indexuri:
```
(organization_id, status, data_reper) WHERE deleted_at IS NULL
(organization_id, employee_id) WHERE deleted_at IS NULL
(organization_id, manager_id, status) WHERE deleted_at IS NULL
```
rls:
```
SELECT = app.has_perm(organization_id,'onboarding.read')
         OR employee_id = app.current_employee_id(organization_id)
         OR manager_id = app.current_employee_id(organization_id)
INSERT/UPDATE = app.has_perm(organization_id,'onboarding.manage')
DELETE = interzis
```
nota: `template_versiune` e copiata la creare — daca HR modifica sablonul peste 3 luni, instantele vechi raman dovada a ce s-a cerut atunci.

### checklist_instance_items
scop: pasul concret al unui angajat, cu scadenta absoluta si dovada de executie.
coloane:
```
id uuid PK
organization_id uuid NOT NULL FK->organizations(id) RESTRICT
instance_id uuid NOT NULL FK->checklist_instances(id) CASCADE
template_item_id uuid FK->checklist_template_items(id) RESTRICT   -- NULL pentru itemii generati dinamic
titlu text NOT NULL                       -- copiat, nu join-uit: textul trebuie sa ramana ce a vazut omul
descriere text
ordine int NOT NULL DEFAULT 0
responsabil checklist_responsible NOT NULL
scadenta date NOT NULL                    -- calculata absolut la generare
obligatoriu boolean NOT NULL DEFAULT true
blocheaza_finalizarea boolean NOT NULL DEFAULT false
blocat boolean NOT NULL DEFAULT false
blocat_motiv text
status checklist_item_status NOT NULL DEFAULT 'de_facut'
resource_type checklist_resource_type NOT NULL DEFAULT 'task'
resource_url text
storage_path text
resource_versiune int
resource_hash text
confirmare_parcurgere_la timestamptz
confirmare_ip inet
timp_petrecut_secunde int
raspuns_form jsonb
completat_de uuid FK->auth.users(id)
completat_la timestamptz
sursa_allocation_id uuid FK->inventory_allocations(id) RESTRICT   -- item de returnare inventar
generat_automat boolean NOT NULL DEFAULT false
```
constrangeri:
```
UNIQUE(instance_id, template_item_id) WHERE deleted_at IS NULL AND template_item_id IS NOT NULL
UNIQUE(instance_id, sursa_allocation_id) WHERE deleted_at IS NULL AND sursa_allocation_id IS NOT NULL
CHECK (status <> 'finalizat' OR completat_la IS NOT NULL)
CHECK (blocat = false OR status <> 'finalizat')
```
indexuri:
```
(instance_id, ordine) WHERE deleted_at IS NULL
(organization_id, responsabil, status, scadenta) WHERE deleted_at IS NULL AND status IN ('de_facut','in_curs')
(organization_id, scadenta) WHERE deleted_at IS NULL AND status <> 'finalizat'   -- notificari intarzieri
```
rls:
```
SELECT = mostenit logic din instanta (perm 'onboarding.read' OR angajatul instantei OR managerul instantei)
UPDATE = app.has_perm(organization_id,'onboarding.manage')
         OR (responsabil = 'angajat' AND angajatul instantei = app.current_employee_id(organization_id))
         OR (responsabil = 'manager' AND managerul instantei = ...)
         OR (responsabil = 'it' AND app.has_perm(organization_id,'inventory.manage'))
INSERT = app.has_perm(organization_id,'onboarding.manage') (in practica: doar functii SECURITY DEFINER)
DELETE = interzis
```

### Integrarea cu inventarul: returnarea obiectelor la offboarding

Modelul: **item materializat + verificare la finalizare pe sursa reala**. Ambele, nu unul singur.

*De ce materializat* (rand real in `checklist_instance_items`, cu `sursa_allocation_id`): pasul trebuie sa aiba scadenta proprie, responsabil (`it`), sa apara in lista de sarcini a colegului de IT, sa fie notificabil si auditabil. Un item calculat dinamic la afisare nu poate purta nimic din toate astea.

*De ce verificarea finala nu se face pe itemi*: daca sursa de adevar ar fi bifa, cineva o bifeaza si obiectul ramane la om. Sursa de adevar la finalizare este `inventory_allocations.returnat_la IS NULL`.

**1) Generarea itemilor** — la crearea instantei de offboarding si re-sincronizabila oricand (idempotenta prin UNIQUE-ul pe `sursa_allocation_id`):

```sql
CREATE OR REPLACE FUNCTION app.sync_itemi_returnare_inventar(p_instance_id uuid)
RETURNS int LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_inserate int;
BEGIN
  INSERT INTO public.checklist_instance_items (
    id, organization_id, instance_id, titlu, descriere, ordine, responsabil,
    scadenta, obligatoriu, blocheaza_finalizarea, resource_type,
    sursa_allocation_id, generat_automat, created_by)
  SELECT gen_random_uuid(), i.organization_id, i.id,
         'Returnare: ' || it.denumire || ' (nr. inv. ' || it.numar_inventar || ')',
         'Obiect predat la ' || to_char(a.predat_la AT TIME ZONE 'Europe/Bucharest','DD.MM.YYYY')
           || coalesce(', serie ' || a.id::text, ''),
         900 + row_number() OVER (ORDER BY it.denumire),
         'it', i.data_reper, true, true, 'task',
         a.id, true, auth.uid()
  FROM public.checklist_instances i
  JOIN public.inventory_allocations a
    ON a.organization_id = i.organization_id
   AND a.employee_id     = i.employee_id
   AND a.returnat_la IS NULL
   AND a.deleted_at IS NULL
  JOIN public.inventory_items it ON it.id = a.item_id
  WHERE i.id = p_instance_id
    AND i.tip = 'offboarding'
    AND i.deleted_at IS NULL
  ON CONFLICT DO NOTHING;
  GET DIAGNOSTICS v_inserate = ROW_COUNT;
  RETURN v_inserate;
END $$;
```

Se apeleaza: (a) la crearea instantei, (b) dintr-un trigger `AFTER INSERT ON inventory_allocations` — daca omul primeste un telefon nou *dupa* ce a inceput offboarding-ul, apare automat si pasul de returnare, (c) manual, buton „Resincronizeaza".

**2) Inchiderea automata a itemului** — trigger `AFTER UPDATE ON inventory_allocations`: cand `returnat_la` trece din NULL in non-NULL, itemul cu acel `sursa_allocation_id` devine `status='finalizat', completat_la=now(), completat_de=auth.uid()`. Bifa urmeaza realitatea, nu invers; in UI itemul nu are checkbox, are butonul „Inregistreaza returnarea", care deschide formularul de returnare din inventar.

**3) Blocarea finalizarii** — trigger `BEFORE UPDATE ON checklist_instances`, care nu se poate ocoli din niciun Server Action:

```sql
CREATE OR REPLACE FUNCTION app.tg_blocheaza_finalizare_offboarding()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_obiecte int; v_pasi int;
BEGIN
  IF NEW.status = 'finalizat' AND OLD.status IS DISTINCT FROM 'finalizat' THEN
    IF NEW.tip = 'offboarding' THEN
      SELECT count(*) INTO v_obiecte
      FROM public.inventory_allocations a
      WHERE a.organization_id = NEW.organization_id
        AND a.employee_id     = NEW.employee_id
        AND a.returnat_la IS NULL
        AND a.deleted_at IS NULL;
      IF v_obiecte > 0 THEN
        RAISE EXCEPTION
          'Offboarding blocat: % obiect(e) de inventar nereturnate.', v_obiecte
          USING ERRCODE = 'check_violation', HINT = 'inventar_nereturnat';
      END IF;
    END IF;

    SELECT count(*) INTO v_pasi
    FROM public.checklist_instance_items ci
    WHERE ci.instance_id = NEW.id
      AND ci.deleted_at IS NULL
      AND (ci.obligatoriu OR ci.blocheaza_finalizarea)
      AND ci.status NOT IN ('finalizat','neaplicabil');
    IF v_pasi > 0 THEN
      RAISE EXCEPTION 'Exista % pas(i) obligatoriu(i) nefinalizat(i).', v_pasi
        USING ERRCODE = 'check_violation', HINT = 'pasi_obligatorii';
    END IF;

    NEW.finalizat_la := now();
    NEW.finalizat_de := auth.uid();
  END IF;
  RETURN NEW;
END $$;
```

Server Action-ul `finalizeazaOffboarding()` face aceeasi verificare *inainte*, ca sa poata afisa lista concreta de obiecte lipsa („Laptop Dell LT-0042, Telefon Samsung TL-0117"), nu doar o eroare. Triggerul e plasa: chiar daca cineva scrie un `UPDATE` gresit sau adauga un endpoint nou, DB-ul refuza. **Excaladare controlata**: doar `org_admin` cu permisiunea `onboarding.override` poate seta `status='anulat'` cu `motiv_anulare` obligatoriu (angajat disparut, obiect declarat furat) — obiectul trece atunci prin `status='casat'` cu motiv sau prin procedura de imputare, deci nu ramane fantoma in patrimoniu.

**Calculul progresului** — trigger `AFTER INSERT/UPDATE/DELETE ON checklist_instance_items`, care recalculeaza si scrie pe instanta:
```
numitor  = itemi cu deleted_at IS NULL AND status <> 'anulat'
numarator= dintre ei, cei cu status IN ('finalizat','neaplicabil')
progres_procent = CASE WHEN numitor = 0 THEN 0 ELSE round(100.0*numarator/numitor) END
status instantei: 0% -> 'planificat'; 100% -> ramane 'in_curs' pana la finalizare explicita
                  exista item blocat -> 'blocat'
```
Doua decizii: (1) `neaplicabil` intra la numarator, altfel un pas irelevant („predare masina de serviciu" pentru cineva fara masina) tine checklistul vesnic la 90%; (2) procentul este **denormalizat** pe instanta, pentru ca ecranul principal e o lista de 40 de angajati si nu vrei 40 de subselecturi — dar 100% **nu** implica finalizare, pentru ca itemii de inventar pot aparea dupa (vezi punctul 2b).

**De ce `confirmare_parcurgere_la` cu timestamp e dovada SSM.** Legea 319/2006 (art. 20) si HG 1425/2006 cer ca instruirea SSM sa fie **nominala, datata si consemnata**, iar in caz de accident de munca ITM cere exact asta: cine, ce material, cand. Un `boolean citit=true` nu dovedeste nimic. Tripleta `confirmare_parcurgere_la` (timestamptz) + `completat_de` (identitate autentificata) + `resource_hash`/`resource_versiune` (ce continut exact era publicat atunci) formeaza o dovada verificabila: poti reconstitui PDF-ul/videoclipul din Storage si demonstra ca versiunea confirmata e cea din dosar. `timp_petrecut_secunde` + `durata_minima_secunde` inchid gaura evidenta („a dat click pe confirm in 2 secunde"), iar `confirmare_ip` completeaza trasabilitatea. Randul devine imutabil dupa confirmare: trigger care refuza modificarea `confirmare_parcurgere_la`, `resource_hash` si `raspuns_form` odata setate — o dovada care poate fi rescrisa nu e dovada. Instruirea pe hartie ramane in continuare necesara acolo unde legea cere semnatura olografa; asta e evidenta digitala complementara, si asa trebuie prezentata in UI.

---

# C) AVIZIER (feature `announcements`)

### announcements
scop: anunturile interne ale organizatiei, cu programare, expirare si eventual confirmare de citire.
coloane:
```
id uuid PK
organization_id uuid NOT NULL FK->organizations(id) RESTRICT
autor_user_id uuid NOT NULL FK->auth.users(id) RESTRICT
autor_employee_id uuid FK->employees(id) SET NULL
titlu text NOT NULL
continut_html text NOT NULL          -- sanitizat server-side, lista alba de taguri
continut_text text NOT NULL          -- extras pentru cautare si pentru email
categorie_id uuid FK->announcement_categories(id) RESTRICT
prioritate announcement_priority NOT NULL DEFAULT 'normal'
cover_image_path text
pinned boolean NOT NULL DEFAULT false
pinned_pana_la timestamptz
publish_at timestamptz NOT NULL DEFAULT now()
expires_at timestamptz
requires_read_confirmation boolean NOT NULL DEFAULT false
trimite_email boolean NOT NULL DEFAULT false
status announcement_status NOT NULL DEFAULT 'draft'
publicat_de uuid FK->auth.users(id)
```
constrangeri:
```
CHECK (expires_at IS NULL OR expires_at > publish_at)
CHECK (status <> 'publicat' OR publicat_de IS NOT NULL)
CHECK (length(titlu) BETWEEN 3 AND 200)
```
indexuri:
```
idx_ann_feed: (organization_id, pinned DESC, publish_at DESC)
              WHERE deleted_at IS NULL AND status IN ('publicat','expirat')
(organization_id, status, publish_at) WHERE deleted_at IS NULL   -- pentru pg_cron
GIN pe to_tsvector('simple', titlu || ' ' || continut_text)
```
rls: vezi politica de mai jos
nota: `continut_html` se sanitizeaza **server-side** la scriere (nu la randare) si se randeaza cu `dangerouslySetInnerHTML` doar dupa sanitizare — un anunt e cel mai comod vector de XSS stocat intr-un ERP, pentru ca il vede toata firma.

### announcement_attachments
scop: fisierele atasate unui anunt.
coloane:
```
id uuid PK
organization_id uuid NOT NULL FK->organizations(id) RESTRICT
announcement_id uuid NOT NULL FK->announcements(id) CASCADE
storage_path text NOT NULL
nume_fisier text NOT NULL
mime_type text NOT NULL
marime_bytes bigint NOT NULL
ordine int NOT NULL DEFAULT 0
```
constrangeri: UNIQUE(announcement_id, storage_path) WHERE deleted_at IS NULL; CHECK (marime_bytes > 0)
indexuri: (announcement_id, ordine) WHERE deleted_at IS NULL
rls: SELECT = EXISTS(anuntul e vizibil pentru mine); INSERT/UPDATE = 'announcements.manage'; DELETE = interzis
nota: descarcarea se face prin signed URL generat in Server Action dupa re-verificarea vizibilitatii; nu te baza doar pe politica de Storage.

### announcement_targets
scop: cui se adreseaza anuntul; un rand per tinta, normalizat intr-o cheie unica indexabila.
coloane:
```
id uuid PK
organization_id uuid NOT NULL FK->organizations(id) RESTRICT
announcement_id uuid NOT NULL FK->announcements(id) CASCADE
target_type announcement_target_type NOT NULL
department_id uuid FK->departments(id) RESTRICT
rol app_role
employee_id uuid FK->employees(id) RESTRICT
match_key text GENERATED ALWAYS AS (
  CASE target_type
    WHEN 'organizatie'  THEN 'org'
    WHEN 'departament'  THEN 'dept:' || department_id::text
    WHEN 'rol'          THEN 'role:' || rol::text
    WHEN 'angajat'      THEN 'emp:'  || employee_id::text
  END) STORED
```
constrangeri:
```
CHECK (target_type <> 'organizatie' OR (department_id IS NULL AND rol IS NULL AND employee_id IS NULL))
CHECK (target_type <> 'departament' OR department_id IS NOT NULL)
CHECK (target_type <> 'rol'         OR rol IS NOT NULL)
CHECK (target_type <> 'angajat'     OR employee_id IS NOT NULL)
UNIQUE(announcement_id, match_key) WHERE deleted_at IS NULL
```
indexuri:
```
UNIQUE (announcement_id, match_key) WHERE deleted_at IS NULL      -- sustine politica RLS
(organization_id, match_key) INCLUDE (announcement_id) WHERE deleted_at IS NULL  -- sustine feed-ul
```
rls: SELECT = app.is_member(organization_id); INSERT/UPDATE = app.has_perm(organization_id,'announcements.manage'); DELETE = interzis
nota: un anunt fara niciun rand aici e **invizibil**, nu public. Server Action-ul insereaza implicit `('organizatie')` cand utilizatorul nu alege nimic; iar publicarea refuza anunturile fara tinte.

### announcement_reads
scop: cine a deschis anuntul si cine a confirmat explicit luarea la cunostinta.
coloane:
```
id uuid PK
organization_id uuid NOT NULL FK->organizations(id) RESTRICT
announcement_id uuid NOT NULL FK->announcements(id) CASCADE
user_id uuid NOT NULL FK->auth.users(id) CASCADE
employee_id uuid FK->employees(id) SET NULL
citit_la timestamptz NOT NULL DEFAULT now()
confirmat_la timestamptz
confirmat_ip inet
```
constrangeri: UNIQUE(announcement_id, user_id); CHECK (confirmat_la IS NULL OR confirmat_la >= citit_la)
indexuri: (announcement_id) WHERE confirmat_la IS NOT NULL; (organization_id, user_id, announcement_id)
rls:
```
SELECT = user_id = auth.uid() OR app.has_perm(organization_id,'announcements.manage')
INSERT/UPDATE = user_id = auth.uid() (upsert propriu, prin functie SECURITY DEFINER)
DELETE = interzis
```
nota: aici nu se face soft delete si nu se sterge — e dovada de comunicare. Raportul „cine nu a confirmat" e un `LEFT JOIN` intre audienta calculata si aceasta tabela.

### Politica de SELECT: angajatul vede exact ce i se adreseaza

Problema de performanta e ca varianta naiva (`EXISTS` cu patru `OR`-uri peste `department_id`, `rol`, `employee_id`, `target_type`) nu poate folosi un singur index si degenereaza in seq scan pe `announcement_targets` **pentru fiecare rand** din `announcements`. Solutia: colapsez toate cele patru forme de targeting intr-o singura coloana text (`match_key`) si compar cu **multimea de chei a utilizatorului curent**, printr-un singur `= ANY(...)`.

```sql
-- Cheile de audienta ale utilizatorului curent, intr-o organizatie.
-- STABLE => evaluata O SINGURA DATA per query, nu per rand. Asta e tot secretul.
CREATE OR REPLACE FUNCTION app.audience_keys(p_org uuid)
RETURNS text[]
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
PARALLEL SAFE
AS $$
  SELECT array_agg(k) FROM (
    SELECT 'org'::text AS k
    WHERE EXISTS (SELECT 1 FROM public.organization_members m
                  WHERE m.organization_id = p_org AND m.user_id = auth.uid()
                    AND m.deleted_at IS NULL AND m.activ)
    UNION
    SELECT 'role:' || m.rol::text
    FROM public.organization_members m
    WHERE m.organization_id = p_org AND m.user_id = auth.uid()
      AND m.deleted_at IS NULL AND m.activ
    UNION
    SELECT 'emp:' || e.id::text
    FROM public.employees e
    WHERE e.organization_id = p_org AND e.user_id = auth.uid() AND e.deleted_at IS NULL
    UNION
    SELECT 'dept:' || e.department_id::text
    FROM public.employees e
    WHERE e.organization_id = p_org AND e.user_id = auth.uid()
      AND e.deleted_at IS NULL AND e.department_id IS NOT NULL
  ) s;
$$;
REVOKE EXECUTE ON FUNCTION app.audience_keys(uuid) FROM public;
GRANT  EXECUTE ON FUNCTION app.audience_keys(uuid) TO authenticated;

ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.announcements FORCE  ROW LEVEL SECURITY;

CREATE POLICY announcements_select_audienta
ON public.announcements
FOR SELECT
TO authenticated
USING (
  deleted_at IS NULL
  AND organization_id = app.current_org_id()
  AND (
    -- redactorii isi vad tot, inclusiv draft si programat
    app.has_perm(organization_id, 'announcements.manage')
    OR (
      status IN ('publicat', 'expirat')
      AND publish_at <= now()
      AND (expires_at IS NULL OR expires_at > now())
      AND EXISTS (
        SELECT 1
        FROM public.announcement_targets t
        WHERE t.announcement_id = announcements.id
          AND t.deleted_at IS NULL
          AND t.match_key = ANY (app.audience_keys(announcements.organization_id))
      )
    )
  )
);

CREATE POLICY announcements_write_redactori
ON public.announcements
FOR ALL
TO authenticated
USING      (organization_id = app.current_org_id()
            AND app.has_perm(organization_id, 'announcements.manage'))
WITH CHECK (organization_id = app.current_org_id()
            AND app.has_perm(organization_id, 'announcements.manage'));
```

**Indexul care o sustine** este cel unic partial de pe tinte:
```sql
CREATE UNIQUE INDEX announcement_targets_ann_key_uidx
  ON public.announcement_targets (announcement_id, match_key)
  WHERE deleted_at IS NULL;
```
Planul devine, pentru fiecare anunt candidat, un `Index Only Scan` cu `ScalarArrayOpExpr`: prefixul `announcement_id` e fixat de corelatie, iar `match_key = ANY('{org,role:hr,dept:...,emp:...}')` face 3-5 sonde de index si se opreste la primul hit (`EXISTS` = semi-join). Cost constant, independent de cate anunturi are firma. Al doilea index, `(organization_id, match_key) INCLUDE (announcement_id)`, serveste directia inversa — feed-ul „anunturile mele", unde pornesti de la chei si aduni id-urile — plus indexul de feed `idx_ann_feed` pentru sortarea `pinned DESC, publish_at DESC`. Pentru dataset-uri mari, feed-ul se scrie explicit ca `IN (SELECT announcement_id FROM announcement_targets WHERE organization_id = $1 AND match_key = ANY(...))`, ca planificatorul sa porneasca din partea selectiva, nu din tabelul de anunturi.

Capcane pe care le rezolva explicit designul:
- **`STABLE`, nu `VOLATILE`.** O functie volatila ar fi re-executata per rand si ai avea 5.000 de interogari pe `organization_members`. `STABLE` + `SECURITY DEFINER` + `search_path = ''` e combinatia corecta.
- **RLS pe `announcement_targets` trebuie sa fie triviala.** Politica de pe `announcements` face un subselect pe tinte, iar RLS-ul acelei tabele se aplica si el, in interiorul evaluarii. Daca ii pui acolo o politica ce se uita inapoi in `announcements`, obtii recursivitate infinita sau un plan catastrofal. De aceea tintele au doar `app.is_member(organization_id)` la SELECT: nu scurg nimic (a sti ca *exista* un anunt pentru departamentul X e inofensiv atata timp cat continutul e protejat), dar tin politica principala plata. Alternativ, `EXISTS`-ul se muta intr-o functie `SECURITY DEFINER` care ocoleste RLS-ul tintelor.
- **`= ANY(array)` in loc de `IN (subquery)`** — array-ul e materializat o data ca parametru al ScalarArrayOp; un subquery corelat re-planifica.
- **Alternativa respinsa**: tabela materializata de vizibilitate per (user, announcement). Da citiri si mai rapide, dar la 400 de angajati un anunt catre toata firma inseamna 400 de inserari, iar orice mutare de departament sau schimbare de rol cere reconstructie — inconsistenta tacuta, exact tipul de bug in care cineva vede un anunt care nu-i mai era destinat. Se justifica doar peste ~50k angajati.
- **`expirat` ramane vizibil** (arhiva), `arhivat` si `draft` nu. Cine nu vrea arhiva accesibila scoate `'expirat'` din lista — dar atunci pierzi dovada „anuntul a fost afisat".
- **`pg_cron`**, la fiecare 5 minute: `programat → publicat` cand `publish_at <= now()`, `publicat → expirat` cand `expires_at <= now()`, plus depinning cand `pinned_pana_la` a trecut. Politica nu depinde de acest job (compara oricum `publish_at`/`expires_at` cu `now()`), deci o intarziere a cron-ului nu expune nimic si nu ascunde nimic — status-ul e doar pentru UI si filtrare rapida.
- **Confirmarea de citire**: se poate inregistra doar daca anuntul e vizibil pentru utilizator — se face prin `app.confirma_citire(announcement_id)` `SECURITY DEFINER`, care re-verifica vizibilitatea cu `app.audience_keys()` inainte de upsert; altfel un utilizator poate „confirma" un anunt care nu i se adresa si poluezi raportul de conformitate.