-- supabase/migrations/0079_cursuri_termen_optional.sql
-- Un curs poate exista FĂRĂ TERMEN.
--
-- ── DE CE ────────────────────────────────────────────────────────────────
-- `courses.termen_zile` era `not null default 30`, deci „cursul ăsta n-are
-- termen limită" nu era exprimabil în bază. În interfață, câmpul n-avea nici
-- asterisc, nici `required`, iar `Formular` pune `noValidate` — deci arăta
-- exact ca unul opțional. Golit, cădea la server cu „Termenul are cel puțin o
-- zi.", un mesaj care nu spune omului ce să facă.
--
-- Cazul real e obișnuit: un ghid intern sau o procedură pe care vrei s-o dai
-- fără să pui presiune. Înrolarea putea deja să n-aibă termen
-- (`course_enrollments.termen` e nullable de la 0075); cursul nu putea.
--
-- ── CE SE SCHIMBĂ ODATĂ CU EA ────────────────────────────────────────────
-- Triggerul de pregătire a înrolării calcula `atribuit_la + termen_zile`.
-- Cu `termen_zile` NULL, adunarea ar fi dat NULL oricum — dar prin accident,
-- nu prin decizie. Se scrie explicit, ca următorul cititor să nu se întrebe.
--
-- Jobul de reamintire (`internal.cursuri_reaminteste`) cere deja
-- `e.termen is not null` (0075:987), deci sare corect peste înrolările fără
-- termen, fără nicio modificare.
--
-- ⚠ Al treilea loc e în TypeScript, nu aici, și e cel care ar fi mințit:
-- `treaptaCelula` din `conformitate/page.tsx` ar fi trecut un curs obligatoriu,
-- fără termen și neînceput drept „La zi", fiindcă `treaptaTermen` întoarce
-- `neaplicabil` când termenul lipsește. Se repară în același commit.

begin;

alter table public.courses
  alter column termen_zile drop not null;

comment on column public.courses.termen_zile is
  'Câte zile are angajatul de la atribuire. NULL = cursul nu are termen limită: angajatul îl vede fără dată și fără pastilă de scadență, iar jobul de reamintire îl sare.';

-- Corpul e cel din 0075, cu o singură linie schimbată. Se rescrie integral,
-- nu prin petic: un `create or replace` parțial ar pierde restul gărzilor
-- (curs inexistent, dezactivat, nepublicat, fără lecții, angajat din altă firmă).
create or replace function internal.cursuri_pregateste_inrolarea()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_curs   public.courses%rowtype;
  v_lectii integer;
begin
  select * into v_curs
  from public.courses
  where id = new.course_id and organization_id = new.organization_id and deleted_at is null;

  if not found then
    raise exception 'Cursul nu există în această organizație.' using errcode = 'P0001';
  end if;
  if not v_curs.activ then
    raise exception 'Cursul „%" este dezactivat și nu poate fi atribuit.', v_curs.denumire using errcode = 'P0001';
  end if;
  if not v_curs.publicat then
    raise exception 'Cursul „%" nu este publicat. Publicați-l înainte de a-l atribui.', v_curs.denumire using errcode = 'P0001';
  end if;

  select count(*) into v_lectii
  from public.course_items
  where course_id = new.course_id and deleted_at is null;

  if v_lectii = 0 then
    raise exception 'Cursul „%" nu are nicio lecție și nu poate fi atribuit.', v_curs.denumire using errcode = 'P0001';
  end if;

  if not exists (
    select 1 from public.employees
    where id = new.employee_id and organization_id = new.organization_id and deleted_at is null
  ) then
    raise exception 'Angajatul nu există în această organizație.' using errcode = 'P0001';
  end if;

  select coalesce(max(ciclu), 0) + 1 into new.ciclu
  from public.course_enrollments
  where organization_id = new.organization_id
    and employee_id = new.employee_id
    and course_id = new.course_id
    and deleted_at is null;

  new.status               := 'neinceput';
  new.materiale_total      := v_lectii;
  new.materiale_finalizate := 0;
  new.inceput_la           := null;
  new.finalizat_la         := null;
  new.expira_la            := null;
  new.anulat_la            := null;
  new.motiv_anulare        := null;
  -- Explicit, nu prin aritmetica NULL: un curs fără termen produce o înrolare
  -- fără termen. Termenul trimis de cel care atribuie are întâietate.
  new.termen := coalesce(
    new.termen,
    case when v_curs.termen_zile is null then null else new.atribuit_la + v_curs.termen_zile end
  );
  return new;
end;
$$;

commit;
