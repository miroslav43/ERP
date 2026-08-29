---
name: administrativo-migrare
description: Scrie o migrare SQL nouă pentru Administrativo după scheletul canonic din `0013_attendance.sql` — secțiuni numerotate, enum-uri în română, ordine fixă de coloane, indexuri PARȚIALE `where deleted_at is null`, trio de politici `_select`/`_insert`/`_update`, bucla `do $$` pentru actor + audit + granturi per tabelă, coada REVOKE/GRANT pe fiecare funcție. Se folosește când se cere o tabelă, coloană, enum, politică RLS, trigger sau funcție nouă în `supabase/migrations/`, sau când se decide cum se aplică o migrare pe baza live.
---

# Migrare nouă în Administrativo

## 1. Numărul migrării

```bash
ls supabase/migrations | tail -3
git fetch origin main && git diff --name-only origin/main -- supabase/migrations
```

La coliziune îți redenumești **propria** migrare, niciodată pe a altcuiva.
Numărul local e doar bookkeeping — Supabase urmărește aplicarea prin timestamp
intern. Proiectul a avut deja două coliziuni reale (`0035`, `0040`).

## 2. Scheletul

`supabase/migrations/0013_attendance.sql` (954 de rânduri) e forma canonică.
Secțiuni numerotate, cu bannere de 75 de liniuțe, în această ordine:

1. Tipuri (enum-uri) · 2–7. Tabele · 8. Helperi de vizibilitate în schema `app` ·
2. Triggere de integritate · 10–13. Funcții RPC în `public` · 14. RLS ·
3. Actor + audit + granturi · 16. **Note de proiectare**.

Antetul: calea fișierului, apoi 3–25 de rânduri de motivație în română — ce
construiește, pe ce se bazează, ce NU atinge deliberat.

## 3. Tabele și indexuri

Ordinea coloanelor e fixă:

```sql
create table public.<tabela> (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  -- … coloanele de domeniu, cu `check (...)` inline …
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  created_by      uuid references auth.users (id) on delete set null,
  updated_by      uuid references auth.users (id) on delete set null,
  deleted_at      timestamptz,
  constraint <tabela>_<ce>_ck check (...)
);
```

`organization_id` e mereu `on delete cascade`; cheile către `employees` sunt
`on delete restrict`; cele opționale `on delete set null`.

Indexuri — `_uq` unic, `_idx` simplu, prima coloană `organization_id`, și
aproape mereu **parțiale**:

```sql
create unique index <tabela>_<ce>_uq on public.<tabela> (organization_id, …)
  where deleted_at is null;
```

Consecință obligatorie în cod: **niciun `.upsert()`** pe tabela asta. PostgREST
nu emite predicatul în `ON CONFLICT`, iar Postgres respinge inferența la
PLANIFICARE — deci pică la fiecare apel, nu doar la conflict (capcana 7).

## 4. Politici

Trio-ul, cu numele `<tabela>_select` / `_insert` / `_update`:

```sql
alter table public.<tabela> enable row level security;
alter table public.<tabela> force  row level security;

create policy <tabela>_select on public.<tabela> for select to authenticated
using ( app.is_platform_admin()
     or ( organization_id = any ((select app.current_org_ids())::uuid[])
          and app.poate_vedea_<modul>(organization_id, …) ) );
```

Invariante:

- `(select app.current_org_ids())::uuid[]` ca **subselect** — fără el, Hash Semi
  Join în loc de InitPlan; fără `::uuid[]`, eroare `uuid = uuid[]`.
- SELECT începe cu `app.is_platform_admin() or`.
- INSERT `with check` **pinuiește coloanele de stare inițială** pe valorile lor
  (`status = 'deschisa'`, `approved_at is null`, `deleted_at is null`), ca
  nimeni să nu insereze un rând pre-aprobat.
- UPDATE repetă predicatul în **ambele** clauze, `using` și `with check`.
- **Nicio politică DELETE.** Ștergerea e `update { deleted_at }`; absența
  politicii plus `revoke delete` E regula.

⚠️ **`WITH CHECK` vede valoarea scrisă de triggerul BEFORE, nu ce a trimis
clientul** (capcana 6). Defectul a reapărut de două ori. Dacă un trigger BEFORE
completează o coloană, politica NU are voie să ceară valoarea de dinaintea lui.

⚠️ Semnătura e `app.has_permission(org, resursă, acțiune)` și întoarce
**scope-ul**, nu un boolean. Pentru un prag folosește `app.can(org, resursă,
acțiune, prag)`. Comparația `<> 'none'` tratează `own` și `team` ca `all`.

## 5. Actor, audit, granturi

```sql
do $$ declare v_tabela text; begin
  foreach v_tabela in array array['<t1>', '<t2>'] loop
    execute format('create trigger trg_%1$s_actor before insert or update on public.%1$I
                    for each row execute function internal.set_actor()', v_tabela);
    execute format('select internal.attach_audit(%L)', v_tabela);
    execute format('revoke all on table public.%I from public, anon', v_tabela);
    execute format('grant select, insert, update on table public.%I to authenticated', v_tabela);
    execute format('revoke delete on table public.%I from authenticated', v_tabela);
  end loop;
end $$;
```

Granturile se dau **per tabelă, aici**. Un `grant … on all tables` dintr-o
migrare veche NU acoperă tabelele create ulterior — capcana a lăsat descoperite
tabelele din `0004` și triggerele `set_actor` din `0002`.

Coada, o pereche per funcție, cu tipurile complete ale argumentelor:

```sql
revoke all on function app.<fn>(uuid, uuid) from public, anon;
grant execute on function app.<fn>(uuid, uuid) to authenticated;
```

Orice `security definer` cere `set search_path = ''` — niciodată `= public`,
fiindcă `pg_temp` se caută oricum primul. Bariera 1 cade altfel.

## 6. Verificare

```bash
bash .claude/skills/administrativo/scripts/banc-migrare.sh
```

Pornește un `postgres:17-alpine` efemer, aplică toate migrările în ordine, apoi
cele trei bariere din `scripts/checks/` și `tests/rls/izolare.sql` — exact ce
face jobul `migrations` din CI. Lipește ieșirea în răspuns.

## 7. Aplicare pe baza live

Prin **`psql`, byte-exact** (`NOTES.md` §1 dă comanda completă prin pooler —
`db.<ref>.supabase.co` nu rezolvă). NICI `supabase db push`, NICI
`mcp__supabase__apply_migration`: ambele cer ca SQL-ul să treacă prin model ca
text, iar 104 KB de DDL retranscris e exact locul erorii subtile. MCP-ul rămâne
pentru inspecție.

Aplicarea pe producție **cere confirmarea explicită a utilizatorului**. Un „da”
anterior nu acoperă o migrare nouă.

După aplicare: regenerează `src/types/database.ts` cu
`mcp__supabase__generate_typescript_types` și reaplică cele 3 patch-uri manuale
descrise în antetul fișierului (`| null` pe argumentele opționale ale
`hr_write_sensitive`, `log_audit_event`, `submit_demo_request`). Verifică apoi
că `git diff --stat` e strict aditiv.

## 8. Modul nou

Un modul opțional are nevoie și de o migrare mică de înregistrare a flagului:

```sql
insert into public.features (feature_key, denumire, descriere, icon, grup, is_core, sort_order)
values ('<cheie>', '<Denumire>', '<descriere>', '<icon>', '<grup>', false, <n>)
on conflict (feature_key) do nothing;
```

plus cheia în `src/config/features.ts`. Apoi treci la
`administrativo-proba-reala` — nu declara modulul gata fără ea.
