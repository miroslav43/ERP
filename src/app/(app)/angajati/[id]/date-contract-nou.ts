// src/app/(app)/angajati/[id]/date-contract-nou.ts
//
// Traducerea `FormData` → intrarea lui `creeazaContract`, scoasă din
// componenta client ca să poată fi testată fără server și fără randare.

/**
 * Cheile obiectului sunt EXACT cele din `creeazaContractSchema`.
 *
 * Câmpurile numerice opționale pleacă la server ca ȘIR, nu prin `Number()`:
 * `Number("") === 0`, iar coerciția pe client s-ar face înainte ca Zod să vadă
 * golul. Un „Zile de concediu” golit devenea astfel tăcut 0 zile pe contract și
 * un sold de odihnă 0 (W2-10). Ca șir, `numarOptional` îl citește drept „lipsă”
 * (`null`), iar `creeazaContract` ia implicitul firmei.
 */
export function dateContractNou(employeeId: string, date: FormData) {
  return {
    employee_id: employeeId,
    numar: String(date.get("numar") ?? ""),
    data_contract: String(date.get("data_contract") ?? ""),
    valabil_de_la: String(date.get("valabil_de_la") ?? ""),
    salariu_baza: Number(date.get("salariu_baza")),
    zile_concediu_anual: String(date.get("zile_concediu_anual") ?? ""),
  };
}
