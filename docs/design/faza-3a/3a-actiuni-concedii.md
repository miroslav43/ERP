```ts
  const hartaCereri = new Map((cereriData ?? []).map((c) => [c.id, c]));
  const sarcini = paginaSarcini.map((sarcina) => ({
    sarcina,
    cerere: hartaCereri.get(sarcina.entity_id) ?? null,
  }));

  const ultima = paginaSarcini[paginaSarcini.length - 1];
  const cursorUrmator =
    arePaginaUrmatoare && ultima ? codificaCursor({ createdAt: ultima.created_at, id: ultima.id }) : null;

  return { sarcini, cursorUrmator };
}

export interface SoldConcediuCuTip {
  readonly sold: Tables<'leave_balances'>;
  readonly tip: Tables<'leave_types'> | null;
}

export async function obtineSold(
  supabase: ServerSupabase,
  organizationId: string,
  employeeId: string,
  an: number
): Promise<readonly SoldConcediuCuTip[]> {
  const { data: solduri, error: eroareSolduri } = await supabase
    .from('leave_balances')
    .select('*')
    .eq('organization_id', organizationId)
    .eq('employee_id', employeeId)
    .eq('an', an)
    .is('deleted_at', null)
    .order('leave_type_id');
  if (eroareSolduri) throw eroareSolduri;

  const idTipuri = [...new Set((solduri ?? []).map((s) => s.leave_type_id))];
  const { data: tipuri, error: eroareTipuri } =
    idTipuri.length === 0
      ? { data: [] as Tables<'leave_types'>[], error: null }
      : await supabase.from('leave_types').select('*').in('id', idTipuri);
  if (eroareTipuri) throw eroareTipuri;

  const hartaTipuri = new Map((tipuri ?? []).map((t) => [t.id, t]));
  return (solduri ?? []).map((sold) => ({ sold, tip: hartaTipuri.get(sold.leave_type_id) ?? null }));
}

export interface AngajatMinimal {
  readonly id: string;
  readonly prenume: string;
  readonly nume: string;
}

export interface ZiConcediuEchipa {
  readonly ziua: Tables<'leave_request_days'>;
  readonly cerere: Tables<'leave_requests'> | null;
  readonly angajat: AngajatMinimal | null;
}

export async function obtineCalendarEchipa(
  supabase: ServerSupabase,
  organizationId: string,
  an: number,
  luna: number
): Promise<readonly ZiConcediuEchipa[]> {
  const primaZi = `${an}-${String(luna).padStart(2, '0')}-01`;
  const ultimaZi = new Date(Date.UTC(an, luna, 0)).toISOString().slice(0, 10);

  const { data: zile, error: eroareZile } = await supabase
    .from('leave_request_days')
    .select('*')
    .eq('organization_id', organizationId)
    .gte('data', primaZi)
    .lte('data', ultimaZi)
    .neq('status', 'anulata')
    .order('data');
  if (eroareZile) throw eroareZile;

  const idCereri = [...new Set((zile ?? []).map((z) => z.leave_request_id))];
  const { data: cereri, error: eroareCereri } =
    idCereri.length === 0
      ? { data: [] as Tables<'leave_requests'>[], error: null }
      : await supabase.from('leave_requests').select('*').in('id', idCereri);
  if (eroareCereri) throw eroareCereri;

  const idAngajati = [...new Set((cereri ?? []).map((c) => c.employee_id))];
  const { data: angajati, error: eroareAngajati } =
    idAngajati.length === 0
      ? { data: [] as AngajatMinimal[], error: null }
      : await supabase.from('employees').select('id, prenume, nume').in('id', idAngajati);
  if (eroareAngajati) throw eroareAngajati;

  const hartaCereri = new Map((cereri ?? []).map((c) => [c.id, c]));
  const hartaAngajati = new Map((angajati ?? []).map((a) => [a.id, a]));

  return (zile ?? []).map((ziua) => {
    const cerere = hartaCereri.get(ziua.leave_request_id) ?? null;
    const angajat = cerere ? hartaAngajati.get(cerere.employee_id) ?? null : null;
    return { ziua, cerere, angajat };
  });
}

export async function obtineTipuriConcediuActive(
  supabase: ServerSupabase,
  organizationId: string
): Promise<readonly Tables<'leave_types'>[]> {
  const { data, error } = await supabase
    .from('leave_types')
    .select('*')
    .eq('organization_id', organizationId)
    .eq('activ', true)
    .is('deleted_at', null)
    .order('denumire');
  if (error) throw error;
  return data ?? [];
}

export async function obtineCoduriMedicale(
  supabase: ServerSupabase
): Promise<readonly Tables<'medical_leave_codes'>[]> {
  const azi = todayInBucharest();
  const { data, error } = await supabase
    .from('medical_leave_codes')
    .select('*')
    .is('deleted_at', null)
    .lte('valabil_de_la', azi)
    .or(`valabil_pana_la.is.null,valabil_pana_la.gte.${azi}`)
    .order('cod');
  if (error) throw error;
  return data ?? [];
}
```

```ts
// src/app/(app)/concedii/actions.ts
'use server';

import { meetsScope } from '@/config/permissions';
import { createAction } from '@/lib/actions/create-action';
import { businessRule, forbidden, isPostgrestError, mapPostgrestError, notFound } from '@/lib/actions/errors';
import type { ActionContext } from '@/lib/actions/types';
import { obtineAngajatCurent } from '@/lib/queries/leave';
import type { RezultatCreeazaCerere } from '@/lib/queries/leave';
import {
  schemaAnuleazaCerere,
  schemaAprobaCerere,
  schemaCreeazaCerere,
  schemaRespingeCerere,
  schemaTrimiteSpreAprobare,
} from '@/schemas/leave';
import type { Tables } from '@/types/database';

export const creeazaCerere = createAction<typeof schemaCreeazaCerere, RezultatCreeazaCerere>({
  name: 'concedii.creeazaCerere',
  input: schemaCreeazaCerere,
  feature: 'leave',
  permission: 'leave:create',
  minScope: 'own',
  audit: {
    action: 'create',
    entityType: 'leave_request',
    entityId: (_input, data) => data.cerere.id,
    allow: ['leave_type_id', 'data_inceput', 'data_sfarsit', 'status', 'employee_id'],
  },
  revalidate: ['/concedii'],
  handler: async (ctx, input) => {
    const angajatPropriu = await obtineAngajatCurent(ctx.supabase, ctx.tenant.organizationId, ctx.user.id);
    const employeeId = input.employeeId ?? angajatPropriu?.id;

    if (!employeeId) {
      throw businessRule('Contul dumneavoastră nu este asociat unui angajat activ în această organizație.');
    }
    if (
      input.employeeId &&
      input.employeeId !== angajatPropriu?.id &&
      !meetsScope(ctx.scope ?? undefined, 'team')
    ) {
      throw forbidden('Nu aveți dreptul să creați o cerere de concediu pentru alt angajat.');
    }

    const { data: tip, error: eroareTip } = await ctx.supabase
      .from('leave_types')
      .select('id, activ')
      .eq('id', input.leaveTypeId)
      .eq('organization_id', ctx.tenant.organizationId)
      .is('deleted_at', null)
      .maybeSingle();
    if (eroareTip) throw mapPostgrestError(eroareTip);
    if (!tip || !tip.activ) {
      throw notFound('Tipul de concediu selectat nu există sau a fost dezactivat.');
    }

    const { data: cerere, error: eroareInsert } = await ctx.supabase
      .from('leave_requests')
      .insert({
        organization_id: ctx.tenant.organizationId,
        employee_id: employeeId,
        leave_type_id: input.leaveTypeId,
        data_inceput: input.dataInceput,
        data_sfarsit: input.dataSfarsit,
        portiune_inceput: input.portiuneInceput,
        portiune_sfarsit: input.portiuneSfarsit,
        zile_lucratoare: 0,
        zile_calendaristice: 0,
        status: 'ciorna',
        motiv: input.motiv ?? null,
        atasament_path: input.atasamentPath ?? null,
        medical_code_id: input.medicalCodeId ?? null,
        serie_certificat: input.serieCertificat ?? null,
        numar_certificat: input.numarCertificat ?? null,
        created_by: ctx.user.id,
      })
      .select('*')
      .single();
    if (eroareInsert) {
      if (isPostgrestError(eroareInsert) && eroareInsert.code === '23P01') {
        throw businessRule('Există deja o cerere activă a acestui angajat care se suprapune cu perioada aleasă.');
      }
      throw mapPostgrestError(eroareInsert);
    }

    const { data: conflicte, error: eroareConflicte } = await ctx.supabase
      .from('leave_requests')
      .select('data_inceput, data_sfarsit')
      .eq('organization_id', ctx.tenant.organizationId)
      .neq('employee_id', employeeId)
      .neq('id', cerere.id)
      .in('status', ['trimisa', 'in_aprobare', 'aprobata'])
      .is('deleted_at', null)
      .lte('data_inceput', input.dataSfarsit)
      .gte('data_sfarsit', input.dataInceput);
    if (eroareConflicte) throw mapPostgrestError(eroareConflicte);

    const listaConflicte = conflicte ?? [];
    return {
      cerere,
      conflicteEchipa: listaConflicte
        .slice(0, 5)
        .map((c) => ({ dataInceput: c.data_inceput, dataSfarsit: c.data_sfarsit })),
      totalConflicte: listaConflicte.length,
    };
  },
});

export const trimiteSpreAprobare = createAction<typeof schemaTrimiteSpreAprobare, Tables<'leave_requests'>>({
  name: 'concedii.trimiteSpreAprobare',
  input: schemaTrimiteSpreAprobare,
  feature: 'leave',
  permission: 'leave:create',
  minScope: 'own',
  audit: {
    action: 'update',
    entityType: 'leave_request',
    entityId: (input) => input.leaveRequestId,
    allow: ['status', 'trimisa_la'],
  },
  revalidate: ['/concedii', '/concedii/aprobari'],
  handler: async (ctx, input) => {
    const { data: existenta, error: eroareCitire } = await ctx.supabase
      .from('leave_requests')
      .select('id, status')
      .eq('id', input.leaveRequestId)
      .eq('organization_id', ctx.tenant.organizationId)
      .is('deleted_at', null)
      .maybeSingle();
    if (eroareCitire) throw mapPostgrestError(eroareCitire);
    if (!existenta) throw notFound('Cererea de concediu nu a fost găsită.');
    if (existenta.status !== 'ciorna') {
      throw businessRule('Doar cererile aflate în ciornă pot fi trimise spre aprobare.');
    }

    const { data: actualizata, error: eroareUpdate } = await ctx.supabase
      .from('leave_requests')
      .update({ status: 'trimisa' })
      .eq('id', input.leaveRequestId)
      .eq('organization_id', ctx.tenant.organizationId)
      .select('*')
      .single();
    if (eroareUpdate) throw mapPostgrestError(eroareUpdate);
    return actualizata;
  },
});

async function gasesteSarcinaValida(ctx: ActionContext, approvalTaskId: string) {
  const { data: sarcina, error } = await ctx.supabase
    .from('approval_tasks')
    .select('id, entity_id, status, ordine, approver_user_id, delegat_catre')
    .eq('id', approvalTaskId)
    .eq('organization_id', ctx.tenant.organizationId)
    .eq('entity_type', 'leave_request')
    .is('deleted_at', null)
    .maybeSingle();
  if (error) throw mapPostgrestError(error);
  if (!sarcina) throw notFound('Sarcina de aprobare nu a fost găsită.');
  if (sarcina.status !== 'in_asteptare') {
    throw businessRule('Această sarcină de aprobare a fost deja soluționată.');
  }
  if (
    sarcina.approver_user_id !== ctx.user.id &&
    sarcina.delegat_catre !== ctx.user.id &&
    !meetsScope(ctx.scope ?? undefined, 'all')
  ) {
    throw forbidden('Nu sunteți aprobatorul desemnat pentru această cerere.');
  }
  return sarcina;
}

export const aproba = createAction<typeof schemaAprobaCerere, Tables<'leave_requests'>>({
  name: 'concedii.aproba',
  input: schemaAprobaCerere,
  feature: 'leave',
  permission: 'leave:approve',
  minScope: 'team',
  audit: {
    action: 'update',
    entityType: 'leave_request',
    entityId: (_input, data) => data.id,
    allow: ['status', 'decis_de', 'pas_curent'],
  },
  revalidate: ['/concedii', '/concedii/aprobari', '/concedii/calendar'],
  handler: async (ctx, input) => {
    const sarcina = await gasesteSarcinaValida(ctx, input.approvalTaskId);

    const { error: eroareSarcinaUpdate } = await ctx.supabase
      .from('approval_tasks')
      .update({ status: 'aprobata', decis_la: ctx.now, comentariu: input.comentariu ?? null })
      .eq('id', sarcina.id)
      .eq('organization_id', ctx.tenant.organizationId);
    if (eroareSarcinaUpdate) throw mapPostgrestError(eroareSarcinaUpdate);

    const { data: restante, error: eroareRestante } = await ctx.supabase
      .from('approval_tasks')
      .select('id')
      .eq('entity_type', 'leave_request')
      .eq('entity_id', sarcina.entity_id)
      .eq('status', 'in_asteptare')
      .is('deleted_at', null);
    if (eroareRestante) throw mapPostgrestError(eroareRestante);

    const statusNou = (restante?.length ?? 0) > 0 ? 'in_aprobare' : 'aprobata';

    const { data: cerere, error: eroareCerere } = await ctx.supabase
      .from('leave_requests')
      .update({
        status: statusNou,
        pas_curent: sarcina.ordine,
        ...(statusNou === 'aprobata' ? { decis_de: ctx.user.id } : {}),
      })
      .eq('id', sarcina.entity_id)
      .eq('organization_id', ctx.tenant.organizationId)
      .select('*')
      .single();
    if (eroareCerere) throw mapPostgrestError(eroareCerere);
    return cerere;
  },
});

export const respinge = createAction<typeof schemaRespingeCerere, Tables<'leave_requests'>>({
  name: 'concedii.respinge',
  input: schemaRespingeCerere,
  feature: 'leave',
  permission: 'leave:approve',
  minScope: 'team',
  audit: {
    action: 'update',
    entityType: 'leave_request',
    entityId: (_input, data) => data.id,
    allow: ['status', 'motiv_respingere', 'decis_de'],
  },
  revalidate: ['/concedii', '/concedii/aprobari', '/concedii/calendar'],
  handler: async (ctx, input) => {
    const sarcina = await gasesteSarcinaValida(ctx, input.approvalTaskId);

    const { error: eroareSarcinaUpdate } = await ctx.supabase
      .from('approval_tasks')
      .update({ status: 'respinsa', decis_la: ctx.now, comentariu: input.motiv })
      .eq('id', sarcina.id)
      .eq('organization_id', ctx.tenant.organizationId);
    if (eroareSarcinaUpdate) throw mapPostgrestError(eroareSarcinaUpdate);

    const { error: eroareAnulareRestante } = await ctx.supabase
      .from('approval_tasks')
      .update({ status: 'anulata' })
      .eq('entity_type', 'leave_request')
      .eq('entity_id', sarcina.entity_id)
      .eq('status', 'in_asteptare')
      .is('deleted_at', null);
    if (eroareAnulareRestante) throw mapPostgrestError(eroareAnulareRestante);

    const { data: cerere, error: eroareCerere } = await ctx.supabase
      .from('leave_requests')
      .update({ status: 'respinsa', motiv_respingere: input.motiv, decis_de: ctx.user.id })
      .eq('id', sarcina.entity_id)
      .eq('organization_id', ctx.tenant.organizationId)
      .select('*')
      .single();
    if (eroareCerere) throw mapPostgrestError(eroareCerere);
    return cerere;
  },
});

export const anuleaza = createAction<typeof schemaAnuleazaCerere, Tables<'leave_requests'>>({
  name: 'concedii.anuleaza',
  input: schemaAnuleazaCerere,
  feature: 'leave',
  permission: 'leave:create',
  minScope: 'own',
  audit: {
    action: 'update',
    entityType: 'leave_request',
    entityId: (input) => input.leaveRequestId,
    allow: ['status'],
  },
  revalidate: ['/concedii', '/concedii/aprobari', '/concedii/calendar'],
  handler: async (ctx, input) => {
    const angajatPropriu = await obtineAngajatCurent(ctx.supabase, ctx.tenant.organizationId, ctx.user.id);
    const { data: existenta, error: eroareCitire } = await ctx.supabase
      .from('leave_requests')
      .select('id, status, employee_id')
      .eq('id', input.leaveRequestId)
      .eq('organization_id', ctx.tenant.organizationId)
      .is('deleted_at', null)
      .maybeSingle();
    if (eroareCitire) throw mapPostgrestError(eroareCitire);
    if (!existenta) throw notFound('Cererea de concediu nu a fost găsită.');
    if (!(['ciorna', 'trimisa', 'in_aprobare', 'aprobata'] as const).includes(existenta.status)) {
      throw businessRule('Această cerere nu mai poate fi anulată din starea curentă.');
    }
    if (existenta.employee_id !== angajatPropriu?.id && !meetsScope(ctx.scope ?? undefined, 'team')) {
      throw forbidden('Nu aveți dreptul să anulați cererea de concediu a altui angajat.');
    }

    const { error: eroareAnulareSarcini } = await ctx.supabase
      .from('approval_tasks')
      .update({ status: 'anulata' })
      .eq('entity_type', 'leave_request')
      .eq('entity_id', existenta.id)
      .eq('status', 'in_asteptare')
      .is('deleted_at', null);
    if (eroareAnulareSarcini) throw mapPostgrestError(eroareAnulareSarcini);

    const { data: cerere, error: eroareUpdate } = await ctx.supabase
      .from('leave_requests')
      .update({
        status: 'anulata',
        ...(input.motiv === undefined ? {} : { motiv: input.motiv }),
      })
      .eq('id', existenta.id)
      .eq('organization_id', ctx.tenant.organizationId)
      .select('*')
      .single();
    if (eroareUpdate) throw mapPostgrestError(eroareUpdate);
    return cerere;
  },
});
```

Restul fișierelor (paginile și componentele client) urmează în răspunsul următor — le-am tăiat aici deliberat ca să nu mai lovesc limita de tokeni per mesaj.