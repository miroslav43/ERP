-- supabase/migrations/0130_numar_contract_cu_data.sql
-- Numărul de contract capătă DATA, nu doar anul: „1/04.09.2026", nu „1/2026".
--
-- ┌ De ce se schimbă ────────────────────────────────────────────────────────
-- │ Un număr de înregistrare românesc e perechea NUMĂR / DATA înregistrării.
-- │ Anul singur nu identifică ziua în care s-a înregistrat actul, iar la un
-- │ control ITM sau la o adeverință numărul trebuie să se potrivească exact cu
-- │ ce scrie pe hârtia semnată.
-- │
-- │ Registrul de documente (0120) folosea deja forma corectă —
-- │ `to_char(v_data, 'DD.MM.YYYY')`. Contractele rămăseseră pe an, ceea ce
-- │ făcea ca aceeași aplicație să numeroteze în două feluri.
-- └───────────────────────────────────────────────────────────────────────────
--
-- ┌ De ce NU se atinge ramura cu prefix ──────────────────────────────────────
-- │ O firmă care și-a configurat o serie proprie („CIM-2026-00042") a ales
-- │ forma aceea deliberat, iar numerele deja emise o poartă. Schimbarea ei ar
-- │ rupe continuitatea unei serii pe care cineva o ține la mână într-un
-- │ registru pe hârtie. Se schimbă DOAR implicitul, adică forma pe care n-a
-- │ ales-o nimeni.
-- └───────────────────────────────────────────────────────────────────────────
--
-- ┌ Ce NU se schimbă: contorul ───────────────────────────────────────────────
-- │ `document_sequences` are ANUL în cheie, deci numerotarea rămâne anuală și
-- │ se resetează la 1 ianuarie. Data din număr e ziua ALOCĂRII, nu o a doua
-- │ dimensiune a contorului: două contracte din aceeași zi primesc numere
-- │ diferite („1/04.09.2026", „2/04.09.2026"), iar unul din ziua următoare
-- │ continuă seria („3/05.09.2026"). Un contor pe zi ar fi însemnat că fiecare
-- │ zi începe de la 1, ceea ce nu e un registru.
-- └───────────────────────────────────────────────────────────────────────────
--
-- ┌ Contractele deja emise rămân cum sunt ────────────────────────────────────
-- │ Niciun UPDATE retroactiv. Un număr de contract e scris pe un act semnat de
-- │ două părți și, de la 0087 încoace, transmis la Inspecția Muncii. Schimbat
-- │ în bază, ar face ca aplicația să contrazică hârtia și registrul oficial.
-- └───────────────────────────────────────────────────────────────────────────
--
-- Corpul de mai jos e cel din 0098, cu o singură linie schimbată (ramura fără
-- prefix) și comentariul ei adaptat. Restul e neatins.

begin;

create or replace function public.aloca_numar_contract(p_organization_id uuid)
returns text
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_azi     date := app.azi_local();
  v_an      integer := extract(year from v_azi)::integer;
  v_numar   integer;
  v_prefix  text;
  v_padding smallint;
begin
  -- Aceeași gardă ca la tichete: `security definer` ocolește RLS, deci dreptul
  -- se verifică explicit, aici. `employees:create` e pragul înrolării — cine nu
  -- poate înrola nu are de ce să consume numere din registru.
  if not (
    p_organization_id = any ((select app.current_org_ids())::uuid[])
    and app.can(p_organization_id, 'employees', 'create', 'all')
  ) then
    raise exception using errcode = 'P0001',
      message = 'Nu aveți dreptul de a aloca numere de contract în această organizație.';
  end if;

  -- Un singur INSERT … ON CONFLICT DO UPDATE … RETURNING: fără fereastră între
  -- citire și scriere, deci fără două înrolări simultane cu același număr.
  insert into public.document_sequences
    (organization_id, document_type, year, prefix, next_number, padding)
  values
    (p_organization_id, 'contract_munca', v_an, '', 2, 1)
  on conflict (organization_id, document_type, year) do update
    set next_number = public.document_sequences.next_number + 1,
        updated_at  = now()
  returning next_number - 1, prefix, padding
       into v_numar, v_prefix, v_padding;

  -- Ramura fără prefix: „1/04.09.2026”. Numărul și DATA înregistrării, ca în
  -- registrul de documente (0120). FĂRĂ `lpad` — vezi antetul lui 0098; cu
  -- `padding = 1` ar trunchia orice număr de două cifre la prima.
  if coalesce(v_prefix, '') = '' then
    return v_numar::text || '/' || to_char(v_azi, 'DD.MM.YYYY');
  end if;

  -- Ramura cu prefix, pentru firmele care își configurează o serie proprie:
  -- „CIM-2026-00042”. NEATINSĂ de 0130: forma e aleasă de firmă, iar numerele
  -- deja emise o poartă. `greatest` apără de trunchiere, dacă cineva pune un
  -- padding mai mic decât numărul de cifre atins.
  return v_prefix || '-' || v_an::text || '-'
       || lpad(v_numar::text, greatest(v_padding, length(v_numar::text)), '0');
end;
$$;

comment on function public.aloca_numar_contract(uuid) is
  'Rezervă următorul număr de contract al anului („1/04.09.2026”, cu data alocării). '
  'Contorul se resetează anual, fiindcă `document_sequences` are anul în cheie — data '
  'din număr e ziua alocării, nu o a doua dimensiune a contorului. Firmele cu prefix '
  'configurat păstrează forma proprie („CIM-2026-00042”). Numărul se consumă chiar dacă '
  'înrolarea eșuează mai departe: o gaură în serie e mai ieftină decât un duplicat.';

revoke all on function public.aloca_numar_contract(uuid) from public, anon;
grant execute on function public.aloca_numar_contract(uuid) to authenticated;

commit;
