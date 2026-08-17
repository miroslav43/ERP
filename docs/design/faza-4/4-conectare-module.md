**Infrastructura de test** (`tests/rls/conformitate.test.ts`) — am presupus:
   - `clientEnv.supabaseUrl` / `clientEnv.supabaseAnonKey` şi `serverEnv.databaseUrl` ca nume de câmp — nevăzute în inventar (doar `clientEnv, serverEnv` erau listate, fără proprietăţi).
   - Dependenţa `pg` disponibilă ca dev-dependency pentru apeluri directe la `internal.genereaza_alerte` (schema `internal` nu e expusă prin PostgREST, deci `.rpc()` nu ajunge acolo).
   - Coloanele `role_permissions(organization_id, role, permission_key, scope)` şi valoarea `AppRole` `'administrator'` — placeholder, verifică enumul real din `@/lib/tenant/types`.
   - Dacă există deja utilitare de test din Faza 2/3 în `tests/rls/*.ts` (helpers de autentificare, fixtures), acest fişier ar trebui rescris să le refolosească, nu să le dubleze — nu am avut vizibilitate asupra lor.

6. **`src/domain/alerte/prag.ts`** — nu ştiu dacă „agentul de motor" l-a scris deja şi, dacă da, sub ce nume exportă funcţiile. Testele din `prag.test.ts` presupun `calculeazaZileRamase`, `calculeazaPraguriAtinse`, `determinaNivelAlerta` şi tipul `NivelAlerta` (`'expirat' | 'critic' | 'atentie' | 'in_regula'`) — o specificaţie minimă aleasă să oglindească exact predicatele din `internal.genereaza_alerte`. Dacă implementarea reală foloseşte alte nume, fie testul trebuie realiniat, fie fişierul `prag.ts` trebuie scris de la zero cu acest contract.

7. **`employees.full_name`** şi **`profiles.full_name`** folosite în fixture-urile de test — presupuse, nu confirmate.

8. **Jobul zilnic real** (pg_cron + Edge Function, secţiunea 14 din `0006_expirables.sql`) rămâne doar pseudocod — nicio migrare sau funcţie Edge nu a fost cerută/scrisă în această sarcină. Fazele 1 (sincronizare) şi 3 (notificare) din pseudocod nu au implementare de cod încă, nici pentru HR.

**Ce rămâne de conectat** (module viitoare, cerut explicit la final):
- **Flotă (`fleet`)**: ITP, RCA, CASCO, rovinietă, verificări tahograf — pe vehicule; `entity_type='vehicul'`, `entity_id` = id-ul vehiculului, `responsible_employee_id` probabil şoferul alocat sau managerul de flotă.
- **SSM (`ssm`)**: instructaje periodice, controale medicina muncii la nivel de post (dacă diferă de `employee_documents`), verificări echipamente de protecţie; posibil suprapunere cu `entity_type='medical'` deja introdus aici — de decis dacă SSM îşi defineşte propriul `entity_type` sau reutilizează `'medical'`.
- **Mentenanţă (`maintenance`)**: revizii tehnice, contracte de service, garanţii echipamente — `entity_type='echipament'` sau similar.
- Fiecare din cele trei va avea nevoie de propriul fişier `NNNN_expirables_<modul>.sql`, cu acelaşi tipar: funcţie de trigger `security definer`, `set search_path=''`, apel la `internal.sync_expirable()`, plus backfill pentru rândurile existente sub `set local role service_role`.
- Odată ce toate modulele sunt conectate, merită revizuită lista hardcodată de coduri „medicale" din acest fişier şi înlocuită cu clasificarea proprie fiecărui modul.