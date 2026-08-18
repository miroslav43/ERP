// src/domain/calendar/zile-lucratoare.ts

/**
 * Numără zilele LUCRĂTOARE dintr-un interval închis [start, sfârșit],
 * excluzând weekendul (sâmbătă/duminică), sărbătorile legale primite ca
 * parametru și zilele libere proprii organizației.
 *
 * Funcție PURĂ: sărbătorile și zilele firmei sunt primite ca date, nu
 * calculate aici — apelantul le obține din `sarbatoriAnului`, respectiv
 * din `organization_holidays`. Comparațiile se fac pe zi calendaristică
 * (UTC), ignorând ora, ca să nu depindă de fusul orar al mediului de rulare.
 */
export function calculeazaZileLucratoare(
  start: Date,
  sfarsit: Date,
  sarbatori: readonly Date[] = [],
  zileFirmei: readonly Date[] = [],
): number {
  if (sfarsit.getTime() < start.getTime()) {
    throw new RangeError('Intervalul este invalid: data de sfârșit este anterioară datei de început.');
  }

  let curent = normalizeazaZi(start);
  const limita = normalizeazaZi(sfarsit);

  let numarZile = 0;
  while (curent.getTime() <= limita.getTime()) {
    if (esteZiLucratoare(curent, sarbatori, zileFirmei)) {
      numarZile += 1;
    }
    curent = adaugaOZi(curent);
  }
  return numarZile;
}

function esteZiLucratoare(zi: Date, sarbatori: readonly Date[], zileFirmei: readonly Date[]): boolean {
  if (esteWeekend(zi)) {
    return false;
  }
  if (contineData(sarbatori, zi)) {
    return false;
  }
  if (contineData(zileFirmei, zi)) {
    return false;
  }
  return true;
}

function esteWeekend(data: Date): boolean {
  const ziuaSaptamanii = data.getUTCDay(); // 0 = duminică, 6 = sâmbătă
  return ziuaSaptamanii === 0 || ziuaSaptamanii === 6;
}

function contineData(lista: readonly Date[], data: Date): boolean {
  return lista.some((element) => esteAceeasiZi(element, data));
}

function esteAceeasiZi(a: Date, b: Date): boolean {
  return (
    a.getUTCFullYear() === b.getUTCFullYear() &&
    a.getUTCMonth() === b.getUTCMonth() &&
    a.getUTCDate() === b.getUTCDate()
  );
}

function normalizeazaZi(data: Date): Date {
  return new Date(Date.UTC(data.getUTCFullYear(), data.getUTCMonth(), data.getUTCDate()));
}

function adaugaOZi(data: Date): Date {
  return new Date(Date.UTC(data.getUTCFullYear(), data.getUTCMonth(), data.getUTCDate() + 1));
}
