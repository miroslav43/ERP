// GENERAT AUTOMAT — nu edita manual.
//
// Regenerare: `.claude/.../altoieste-tipuri.py` peste ieșirea lui
// `supabase gen types typescript --db-url <bancul local>`. Bancul se ridică cu
// `banc-migrare.sh --pastreaza`, deci tipurile ies din MIGRĂRILE din repo, nu
// din starea cloud-ului — care poate avea drift.
//
// Trei funcții RPC (hr_write_sensitive, log_audit_event, submit_demo_request)
// primesc înapoi `| null` pe argumentele opționale: generatorul curent le
// tipează doar `?: T` (omisibil), dar parametrii SQL au `default null` —
// apelanții existenți trimit explicit `null`, nu omit cheia. Fără patch,
// regenerarea rupe fișierele care apelează aceste RPC-uri fără nicio schimbare
// reală de schemă. Patch-ul e mecanic, aplicat de script.
//
// Generatorul CLI adaugă și schema `graphql_public`; e eliminată tot acolo,
// pentru că `src/lib/supabase/server.ts` tipează clientul strict pe `public`.

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      alert_notifications: {
        Row: {
          alert_id: string
          canal: string
          created_at: string
          deleted_at: string | null
          destinatar_cheie: string | null
          email_log_id: string | null
          eroare: string | null
          id: string
          notification_id: string | null
          organization_id: string
          recipient_employee_id: string | null
          recipient_user_id: string | null
          sent_at: string | null
          status: string
          updated_at: string
        }
        Insert: {
          alert_id: string
          canal: string
          created_at?: string
          deleted_at?: string | null
          destinatar_cheie?: string | null
          email_log_id?: string | null
          eroare?: string | null
          id?: string
          notification_id?: string | null
          organization_id: string
          recipient_employee_id?: string | null
          recipient_user_id?: string | null
          sent_at?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          alert_id?: string
          canal?: string
          created_at?: string
          deleted_at?: string | null
          destinatar_cheie?: string | null
          email_log_id?: string | null
          eroare?: string | null
          id?: string
          notification_id?: string | null
          organization_id?: string
          recipient_employee_id?: string | null
          recipient_user_id?: string | null
          sent_at?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "alert_notifications_alert_id_fkey"
            columns: ["alert_id"]
            isOneToOne: false
            referencedRelation: "compliance_alerts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "alert_notifications_email_log_id_fkey"
            columns: ["email_log_id"]
            isOneToOne: false
            referencedRelation: "email_log"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "alert_notifications_notification_id_fkey"
            columns: ["notification_id"]
            isOneToOne: false
            referencedRelation: "notifications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "alert_notifications_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "alert_notifications_recipient_employee_id_fkey"
            columns: ["recipient_employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "alert_notifications_recipient_user_id_fkey"
            columns: ["recipient_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      alert_rules: {
        Row: {
          alerteaza_la_depasire: boolean
          created_at: string
          deleted_at: string | null
          entity_type: string
          id: string
          kind: string
          organization_id: string
          praguri_zile: number[]
          updated_at: string
          valabil_de_la: string
        }
        Insert: {
          alerteaza_la_depasire?: boolean
          created_at?: string
          deleted_at?: string | null
          entity_type?: string
          id?: string
          kind?: string
          organization_id: string
          praguri_zile?: number[]
          updated_at?: string
          valabil_de_la?: string
        }
        Update: {
          alerteaza_la_depasire?: boolean
          created_at?: string
          deleted_at?: string | null
          entity_type?: string
          id?: string
          kind?: string
          organization_id?: string
          praguri_zile?: number[]
          updated_at?: string
          valabil_de_la?: string
        }
        Relationships: [
          {
            foreignKeyName: "alert_rules_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      announcement_reads: {
        Row: {
          announcement_id: string
          citit_la: string
          created_at: string
          employee_id: string
          id: string
          organization_id: string
          user_id: string
        }
        Insert: {
          announcement_id: string
          citit_la?: string
          created_at?: string
          employee_id: string
          id?: string
          organization_id: string
          user_id: string
        }
        Update: {
          announcement_id?: string
          citit_la?: string
          created_at?: string
          employee_id?: string
          id?: string
          organization_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "announcement_reads_announcement_id_fkey"
            columns: ["announcement_id"]
            isOneToOne: false
            referencedRelation: "announcements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "announcement_reads_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "announcement_reads_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      announcements: {
        Row: {
          continut: string
          created_at: string
          created_by: string | null
          deleted_at: string | null
          expira_la: string | null
          fixat: boolean
          id: string
          organization_id: string
          publicat_la: string | null
          titlu: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          continut: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          expira_la?: string | null
          fixat?: boolean
          id?: string
          organization_id: string
          publicat_la?: string | null
          titlu: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          continut?: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          expira_la?: string | null
          fixat?: boolean
          id?: string
          organization_id?: string
          publicat_la?: string | null
          titlu?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "announcements_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      approval_flows: {
        Row: {
          activ: boolean
          created_at: string
          deleted_at: string | null
          denumire: string
          entity_type: string
          id: string
          organization_id: string
          updated_at: string
          valabil_de_la: string
        }
        Insert: {
          activ?: boolean
          created_at?: string
          deleted_at?: string | null
          denumire: string
          entity_type: string
          id?: string
          organization_id: string
          updated_at?: string
          valabil_de_la?: string
        }
        Update: {
          activ?: boolean
          created_at?: string
          deleted_at?: string | null
          denumire?: string
          entity_type?: string
          id?: string
          organization_id?: string
          updated_at?: string
          valabil_de_la?: string
        }
        Relationships: [
          {
            foreignKeyName: "approval_flows_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      approval_steps: {
        Row: {
          approver_user_id: string | null
          created_at: string
          deleted_at: string | null
          flow_id: string
          id: string
          optional: boolean
          ordine: number
          organization_id: string
          permission_key: string | null
          rol: Database["public"]["Enums"]["app_role"] | null
          sla_ore: number | null
          tip: Database["public"]["Enums"]["approval_step_kind"]
          updated_at: string
        }
        Insert: {
          approver_user_id?: string | null
          created_at?: string
          deleted_at?: string | null
          flow_id: string
          id?: string
          optional?: boolean
          ordine: number
          organization_id: string
          permission_key?: string | null
          rol?: Database["public"]["Enums"]["app_role"] | null
          sla_ore?: number | null
          tip: Database["public"]["Enums"]["approval_step_kind"]
          updated_at?: string
        }
        Update: {
          approver_user_id?: string | null
          created_at?: string
          deleted_at?: string | null
          flow_id?: string
          id?: string
          optional?: boolean
          ordine?: number
          organization_id?: string
          permission_key?: string | null
          rol?: Database["public"]["Enums"]["app_role"] | null
          sla_ore?: number | null
          tip?: Database["public"]["Enums"]["approval_step_kind"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "approval_steps_flow_id_fkey"
            columns: ["flow_id"]
            isOneToOne: false
            referencedRelation: "approval_flows"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "approval_steps_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      approval_tasks: {
        Row: {
          approver_employee_id: string | null
          approver_user_id: string | null
          comentariu: string | null
          created_at: string
          decis_la: string | null
          delegat_catre: string | null
          deleted_at: string | null
          entity_id: string
          entity_type: string
          flow_id: string
          id: string
          ordine: number
          organization_id: string
          status: Database["public"]["Enums"]["approval_task_status"]
          step_id: string
          termen_la: string | null
          updated_at: string
        }
        Insert: {
          approver_employee_id?: string | null
          approver_user_id?: string | null
          comentariu?: string | null
          created_at?: string
          decis_la?: string | null
          delegat_catre?: string | null
          deleted_at?: string | null
          entity_id: string
          entity_type: string
          flow_id: string
          id?: string
          ordine: number
          organization_id: string
          status?: Database["public"]["Enums"]["approval_task_status"]
          step_id: string
          termen_la?: string | null
          updated_at?: string
        }
        Update: {
          approver_employee_id?: string | null
          approver_user_id?: string | null
          comentariu?: string | null
          created_at?: string
          decis_la?: string | null
          delegat_catre?: string | null
          deleted_at?: string | null
          entity_id?: string
          entity_type?: string
          flow_id?: string
          id?: string
          ordine?: number
          organization_id?: string
          status?: Database["public"]["Enums"]["approval_task_status"]
          step_id?: string
          termen_la?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "approval_tasks_approver_employee_id_fkey"
            columns: ["approver_employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "approval_tasks_flow_id_fkey"
            columns: ["flow_id"]
            isOneToOne: false
            referencedRelation: "approval_flows"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "approval_tasks_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "approval_tasks_step_id_fkey"
            columns: ["step_id"]
            isOneToOne: false
            referencedRelation: "approval_steps"
            referencedColumns: ["id"]
          },
        ]
      }
      attendance_approval_batches: {
        Row: {
          aprobat_de: string | null
          aprobat_la: string
          created_at: string
          created_by: string | null
          deleted_at: string | null
          department_id: string | null
          id: string
          linii_aprobate: number
          manager_employee_id: string | null
          observatii: string | null
          organization_id: string
          period_id: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          aprobat_de?: string | null
          aprobat_la?: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          department_id?: string | null
          id?: string
          linii_aprobate?: number
          manager_employee_id?: string | null
          observatii?: string | null
          organization_id: string
          period_id: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          aprobat_de?: string | null
          aprobat_la?: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          department_id?: string | null
          id?: string
          linii_aprobate?: number
          manager_employee_id?: string | null
          observatii?: string | null
          organization_id?: string
          period_id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "attendance_approval_batches_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_approval_batches_manager_employee_id_fkey"
            columns: ["manager_employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_approval_batches_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_approval_batches_period_id_fkey"
            columns: ["period_id"]
            isOneToOne: false
            referencedRelation: "attendance_periods"
            referencedColumns: ["id"]
          },
        ]
      }
      attendance_entries: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          batch_id: string | null
          created_at: string
          created_by: string | null
          data: string
          deleted_at: string | null
          employee_id: string
          id: string
          leave_request_id: string | null
          motiv_respingere: string | null
          observatii: string | null
          ora_inceput: string | null
          ora_sfarsit: string | null
          ore_lucrate: number
          ore_noapte: number
          ore_suplimentare: number
          organization_id: string
          period_id: string
          respins_de: string | null
          respins_la: string | null
          sursa: Database["public"]["Enums"]["attendance_entry_source"]
          tip_zi: Database["public"]["Enums"]["attendance_day_type"]
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          batch_id?: string | null
          created_at?: string
          created_by?: string | null
          data: string
          deleted_at?: string | null
          employee_id: string
          id?: string
          leave_request_id?: string | null
          motiv_respingere?: string | null
          observatii?: string | null
          ora_inceput?: string | null
          ora_sfarsit?: string | null
          ore_lucrate?: number
          ore_noapte?: number
          ore_suplimentare?: number
          organization_id: string
          period_id: string
          respins_de?: string | null
          respins_la?: string | null
          sursa?: Database["public"]["Enums"]["attendance_entry_source"]
          tip_zi: Database["public"]["Enums"]["attendance_day_type"]
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          batch_id?: string | null
          created_at?: string
          created_by?: string | null
          data?: string
          deleted_at?: string | null
          employee_id?: string
          id?: string
          leave_request_id?: string | null
          motiv_respingere?: string | null
          observatii?: string | null
          ora_inceput?: string | null
          ora_sfarsit?: string | null
          ore_lucrate?: number
          ore_noapte?: number
          ore_suplimentare?: number
          organization_id?: string
          period_id?: string
          respins_de?: string | null
          respins_la?: string | null
          sursa?: Database["public"]["Enums"]["attendance_entry_source"]
          tip_zi?: Database["public"]["Enums"]["attendance_day_type"]
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "attendance_entries_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "attendance_approval_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_entries_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_entries_leave_request_id_fkey"
            columns: ["leave_request_id"]
            isOneToOne: false
            referencedRelation: "leave_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_entries_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_entries_period_id_fkey"
            columns: ["period_id"]
            isOneToOne: false
            referencedRelation: "attendance_periods"
            referencedColumns: ["id"]
          },
        ]
      }
      attendance_periods: {
        Row: {
          an: number
          blocata_de: string | null
          blocata_la: string | null
          created_at: string
          created_by: string | null
          data_inceput: string
          data_sfarsit: string
          deleted_at: string | null
          id: string
          luna: number
          observatii: string | null
          organization_id: string
          status: Database["public"]["Enums"]["attendance_period_status"]
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          an: number
          blocata_de?: string | null
          blocata_la?: string | null
          created_at?: string
          created_by?: string | null
          data_inceput: string
          data_sfarsit: string
          deleted_at?: string | null
          id?: string
          luna: number
          observatii?: string | null
          organization_id: string
          status?: Database["public"]["Enums"]["attendance_period_status"]
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          an?: number
          blocata_de?: string | null
          blocata_la?: string | null
          created_at?: string
          created_by?: string | null
          data_inceput?: string
          data_sfarsit?: string
          deleted_at?: string | null
          id?: string
          luna?: number
          observatii?: string | null
          organization_id?: string
          status?: Database["public"]["Enums"]["attendance_period_status"]
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "attendance_periods_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      attendance_settings: {
        Row: {
          admite_ore_suplimentare: boolean
          created_at: string
          created_by: string | null
          deleted_at: string | null
          id: string
          lucreaza_noaptea: boolean
          lucreaza_sarbatori: boolean
          lucreaza_weekend: boolean
          noapte_sfarsit: string
          noapte_start: string
          observatii_juridice: string | null
          ore_maxime_saptamanale: number
          ore_pe_saptamana: number
          ore_pe_zi: number
          organization_id: string
          pauza_masa_inclusa_in_program: boolean
          pauza_masa_minute: number
          pauza_obligatorie_peste_ore: number
          perioada_referinta_luni: number
          prag_ore_noapte: number
          repaus_saptamanal_minim_ore: number
          repaus_zilnic_minim_ore: number
          spor_noapte_procent: number
          spor_sarbatoare_procent: number
          spor_suplimentare_procent: number
          spor_weekend_procent: number
          termen_compensare_sarbatoare_zile: number
          termen_compensare_suplimentare_zile: number
          updated_at: string
          updated_by: string | null
          valabil_de_la: string
        }
        Insert: {
          admite_ore_suplimentare?: boolean
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          id?: string
          lucreaza_noaptea?: boolean
          lucreaza_sarbatori?: boolean
          lucreaza_weekend?: boolean
          noapte_sfarsit: string
          noapte_start: string
          observatii_juridice?: string | null
          ore_maxime_saptamanale: number
          ore_pe_saptamana: number
          ore_pe_zi: number
          organization_id: string
          pauza_masa_inclusa_in_program: boolean
          pauza_masa_minute: number
          pauza_obligatorie_peste_ore: number
          perioada_referinta_luni: number
          prag_ore_noapte?: number
          repaus_saptamanal_minim_ore: number
          repaus_zilnic_minim_ore: number
          spor_noapte_procent?: number
          spor_sarbatoare_procent?: number
          spor_suplimentare_procent?: number
          spor_weekend_procent?: number
          termen_compensare_sarbatoare_zile: number
          termen_compensare_suplimentare_zile: number
          updated_at?: string
          updated_by?: string | null
          valabil_de_la: string
        }
        Update: {
          admite_ore_suplimentare?: boolean
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          id?: string
          lucreaza_noaptea?: boolean
          lucreaza_sarbatori?: boolean
          lucreaza_weekend?: boolean
          noapte_sfarsit?: string
          noapte_start?: string
          observatii_juridice?: string | null
          ore_maxime_saptamanale?: number
          ore_pe_saptamana?: number
          ore_pe_zi?: number
          organization_id?: string
          pauza_masa_inclusa_in_program?: boolean
          pauza_masa_minute?: number
          pauza_obligatorie_peste_ore?: number
          perioada_referinta_luni?: number
          prag_ore_noapte?: number
          repaus_saptamanal_minim_ore?: number
          repaus_zilnic_minim_ore?: number
          spor_noapte_procent?: number
          spor_sarbatoare_procent?: number
          spor_suplimentare_procent?: number
          spor_weekend_procent?: number
          termen_compensare_sarbatoare_zile?: number
          termen_compensare_suplimentare_zile?: number
          updated_at?: string
          updated_by?: string | null
          valabil_de_la?: string
        }
        Relationships: [
          {
            foreignKeyName: "attendance_settings_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      attendance_week_submission_days: {
        Row: {
          created_at: string
          data: string
          id: string
          observatii: string | null
          ora_inceput: string | null
          ora_sfarsit: string | null
          ore_planificate: number
          organization_id: string
          submission_id: string
          tip_prezenta: Database["public"]["Enums"]["attendance_presence_kind"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          data: string
          id?: string
          observatii?: string | null
          ora_inceput?: string | null
          ora_sfarsit?: string | null
          ore_planificate?: number
          organization_id: string
          submission_id: string
          tip_prezenta?: Database["public"]["Enums"]["attendance_presence_kind"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          data?: string
          id?: string
          observatii?: string | null
          ora_inceput?: string | null
          ora_sfarsit?: string | null
          ore_planificate?: number
          organization_id?: string
          submission_id?: string
          tip_prezenta?: Database["public"]["Enums"]["attendance_presence_kind"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "attendance_week_submission_days_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_week_submission_days_submission_id_fkey"
            columns: ["submission_id"]
            isOneToOne: false
            referencedRelation: "attendance_week_submissions"
            referencedColumns: ["id"]
          },
        ]
      }
      attendance_week_submissions: {
        Row: {
          created_at: string
          created_by: string | null
          decis_de: string | null
          decis_la: string | null
          deleted_at: string | null
          employee_id: string
          id: string
          lucreaza_weekend: boolean
          motiv_respingere: string | null
          organization_id: string
          saptamana_start: string
          status: Database["public"]["Enums"]["attendance_week_status"]
          trimisa_la: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          decis_de?: string | null
          decis_la?: string | null
          deleted_at?: string | null
          employee_id: string
          id?: string
          lucreaza_weekend?: boolean
          motiv_respingere?: string | null
          organization_id: string
          saptamana_start: string
          status?: Database["public"]["Enums"]["attendance_week_status"]
          trimisa_la?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          decis_de?: string | null
          decis_la?: string | null
          deleted_at?: string | null
          employee_id?: string
          id?: string
          lucreaza_weekend?: boolean
          motiv_respingere?: string | null
          organization_id?: string
          saptamana_start?: string
          status?: Database["public"]["Enums"]["attendance_week_status"]
          trimisa_la?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "attendance_week_submissions_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_week_submissions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          action: Database["public"]["Enums"]["audit_action"]
          actor_id: string | null
          after: Json | null
          before: Json | null
          created_at: string
          entity_id: string | null
          entity_type: string | null
          error_code: string | null
          id: string
          ip: unknown
          organization_id: string | null
          request_id: string | null
          status: Database["public"]["Enums"]["audit_status"]
          user_agent: string | null
        }
        Insert: {
          action: Database["public"]["Enums"]["audit_action"]
          actor_id?: string | null
          after?: Json | null
          before?: Json | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          error_code?: string | null
          id?: string
          ip?: unknown
          organization_id?: string | null
          request_id?: string | null
          status?: Database["public"]["Enums"]["audit_status"]
          user_agent?: string | null
        }
        Update: {
          action?: Database["public"]["Enums"]["audit_action"]
          actor_id?: string | null
          after?: Json | null
          before?: Json | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          error_code?: string | null
          id?: string
          ip?: unknown
          organization_id?: string | null
          request_id?: string | null
          status?: Database["public"]["Enums"]["audit_status"]
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      business_trip_legs: {
        Row: {
          business_trip_id: string
          created_at: string
          created_by: string | null
          deleted_at: string | null
          from_country_id: string
          id: string
          localitate_sosire: string | null
          mijloc_transport:
            | Database["public"]["Enums"]["business_trip_transport"]
            | null
          observatii: string | null
          ordine: number
          organization_id: string
          plecare_la: string
          sosire_la: string
          to_country_id: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          business_trip_id: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          from_country_id: string
          id?: string
          localitate_sosire?: string | null
          mijloc_transport?:
            | Database["public"]["Enums"]["business_trip_transport"]
            | null
          observatii?: string | null
          ordine: number
          organization_id: string
          plecare_la: string
          sosire_la: string
          to_country_id: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          business_trip_id?: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          from_country_id?: string
          id?: string
          localitate_sosire?: string | null
          mijloc_transport?:
            | Database["public"]["Enums"]["business_trip_transport"]
            | null
          observatii?: string | null
          ordine?: number
          organization_id?: string
          plecare_la?: string
          sosire_la?: string
          to_country_id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "business_trip_legs_business_trip_id_fkey"
            columns: ["business_trip_id"]
            isOneToOne: false
            referencedRelation: "business_trips"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "business_trip_legs_from_country_id_fkey"
            columns: ["from_country_id"]
            isOneToOne: false
            referencedRelation: "countries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "business_trip_legs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "business_trip_legs_to_country_id_fkey"
            columns: ["to_country_id"]
            isOneToOne: false
            referencedRelation: "countries"
            referencedColumns: ["id"]
          },
        ]
      }
      business_trips: {
        Row: {
          approval_task_id: string | null
          avans_acordat: number
          country_id: string | null
          created_at: string
          created_by: string | null
          curs_diurna: number | null
          declaratie_detasare_numar: string | null
          deleted_at: string | null
          detasare_transnationala: boolean
          employee_id: string
          formular_a1_numar: string | null
          formular_a1_solicitat: boolean
          formular_a1_valabil_de_la: string | null
          formular_a1_valabil_pana: string | null
          id: string
          km_parcursi: number | null
          localitate: string | null
          mijloc_transport: Database["public"]["Enums"]["business_trip_transport"]
          moneda_avans: string | null
          moneda_salariu_minim: string | null
          numar_document: string | null
          observatii: string | null
          organization_id: string
          plecare_efectiva_la: string | null
          plecare_la: string
          salariu_minim_stat_gazda: number | null
          scop: string
          sosire_efectiva_la: string | null
          sosire_la: string
          stat_gazda_country_id: string | null
          status: Database["public"]["Enums"]["business_trip_status"]
          updated_at: string
          updated_by: string | null
          vehicle_id: string | null
        }
        Insert: {
          approval_task_id?: string | null
          avans_acordat?: number
          country_id?: string | null
          created_at?: string
          created_by?: string | null
          curs_diurna?: number | null
          declaratie_detasare_numar?: string | null
          deleted_at?: string | null
          detasare_transnationala?: boolean
          employee_id: string
          formular_a1_numar?: string | null
          formular_a1_solicitat?: boolean
          formular_a1_valabil_de_la?: string | null
          formular_a1_valabil_pana?: string | null
          id?: string
          km_parcursi?: number | null
          localitate?: string | null
          mijloc_transport: Database["public"]["Enums"]["business_trip_transport"]
          moneda_avans?: string | null
          moneda_salariu_minim?: string | null
          numar_document?: string | null
          observatii?: string | null
          organization_id: string
          plecare_efectiva_la?: string | null
          plecare_la: string
          salariu_minim_stat_gazda?: number | null
          scop: string
          sosire_efectiva_la?: string | null
          sosire_la: string
          stat_gazda_country_id?: string | null
          status?: Database["public"]["Enums"]["business_trip_status"]
          updated_at?: string
          updated_by?: string | null
          vehicle_id?: string | null
        }
        Update: {
          approval_task_id?: string | null
          avans_acordat?: number
          country_id?: string | null
          created_at?: string
          created_by?: string | null
          curs_diurna?: number | null
          declaratie_detasare_numar?: string | null
          deleted_at?: string | null
          detasare_transnationala?: boolean
          employee_id?: string
          formular_a1_numar?: string | null
          formular_a1_solicitat?: boolean
          formular_a1_valabil_de_la?: string | null
          formular_a1_valabil_pana?: string | null
          id?: string
          km_parcursi?: number | null
          localitate?: string | null
          mijloc_transport?: Database["public"]["Enums"]["business_trip_transport"]
          moneda_avans?: string | null
          moneda_salariu_minim?: string | null
          numar_document?: string | null
          observatii?: string | null
          organization_id?: string
          plecare_efectiva_la?: string | null
          plecare_la?: string
          salariu_minim_stat_gazda?: number | null
          scop?: string
          sosire_efectiva_la?: string | null
          sosire_la?: string
          stat_gazda_country_id?: string | null
          status?: Database["public"]["Enums"]["business_trip_status"]
          updated_at?: string
          updated_by?: string | null
          vehicle_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "business_trips_approval_task_fk"
            columns: ["approval_task_id"]
            isOneToOne: false
            referencedRelation: "approval_tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "business_trips_country_id_fkey"
            columns: ["country_id"]
            isOneToOne: false
            referencedRelation: "countries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "business_trips_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "business_trips_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "business_trips_stat_gazda_country_id_fkey"
            columns: ["stat_gazda_country_id"]
            isOneToOne: false
            referencedRelation: "countries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "business_trips_vehicle_fk"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      checklist_completion_records: {
        Row: {
          ciclu: number
          continut: Json
          continut_checksum: string
          created_at: string
          created_by: string | null
          employee_id: string
          finalizat_de: string | null
          finalizata_la: string
          id: string
          instance_id: string
          organization_id: string
          pasi_bifati: number
          pasi_obligatorii: number
          tip: Database["public"]["Enums"]["checklist_tip"]
          total_pasi: number
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          ciclu: number
          continut: Json
          continut_checksum: string
          created_at?: string
          created_by?: string | null
          employee_id: string
          finalizat_de?: string | null
          finalizata_la: string
          id?: string
          instance_id: string
          organization_id: string
          pasi_bifati: number
          pasi_obligatorii: number
          tip: Database["public"]["Enums"]["checklist_tip"]
          total_pasi: number
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          ciclu?: number
          continut?: Json
          continut_checksum?: string
          created_at?: string
          created_by?: string | null
          employee_id?: string
          finalizat_de?: string | null
          finalizata_la?: string
          id?: string
          instance_id?: string
          organization_id?: string
          pasi_bifati?: number
          pasi_obligatorii?: number
          tip?: Database["public"]["Enums"]["checklist_tip"]
          total_pasi?: number
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "checklist_completion_records_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "checklist_completion_records_instance_id_fkey"
            columns: ["instance_id"]
            isOneToOne: true
            referencedRelation: "checklist_instances"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "checklist_completion_records_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      checklist_instance_items: {
        Row: {
          bifat_automat: boolean
          bifat_de: string | null
          bifat_la: string | null
          created_at: string
          created_by: string | null
          curs_id: string | null
          deleted_at: string | null
          descriere: string | null
          dovada: string | null
          dovada_document_id: string | null
          employee_id: string
          id: string
          instance_id: string
          obligatoriu: boolean
          observatii: string | null
          ordine: number
          organization_id: string
          responsabil_employee_id: string | null
          responsabil_rol: Database["public"]["Enums"]["app_role"] | null
          responsabil_tip: Database["public"]["Enums"]["checklist_responsabil_tip"]
          status: Database["public"]["Enums"]["checklist_item_status"]
          template_item_id: string | null
          termen: string | null
          tip_dovada: Database["public"]["Enums"]["checklist_tip_dovada"]
          titlu: string
          updated_at: string
          updated_by: string | null
          verificare_automata:
            | Database["public"]["Enums"]["checklist_verificare"]
            | null
        }
        Insert: {
          bifat_automat?: boolean
          bifat_de?: string | null
          bifat_la?: string | null
          created_at?: string
          created_by?: string | null
          curs_id?: string | null
          deleted_at?: string | null
          descriere?: string | null
          dovada?: string | null
          dovada_document_id?: string | null
          employee_id: string
          id?: string
          instance_id: string
          obligatoriu: boolean
          observatii?: string | null
          ordine: number
          organization_id: string
          responsabil_employee_id?: string | null
          responsabil_rol?: Database["public"]["Enums"]["app_role"] | null
          responsabil_tip: Database["public"]["Enums"]["checklist_responsabil_tip"]
          status?: Database["public"]["Enums"]["checklist_item_status"]
          template_item_id?: string | null
          termen?: string | null
          tip_dovada: Database["public"]["Enums"]["checklist_tip_dovada"]
          titlu: string
          updated_at?: string
          updated_by?: string | null
          verificare_automata?:
            | Database["public"]["Enums"]["checklist_verificare"]
            | null
        }
        Update: {
          bifat_automat?: boolean
          bifat_de?: string | null
          bifat_la?: string | null
          created_at?: string
          created_by?: string | null
          curs_id?: string | null
          deleted_at?: string | null
          descriere?: string | null
          dovada?: string | null
          dovada_document_id?: string | null
          employee_id?: string
          id?: string
          instance_id?: string
          obligatoriu?: boolean
          observatii?: string | null
          ordine?: number
          organization_id?: string
          responsabil_employee_id?: string | null
          responsabil_rol?: Database["public"]["Enums"]["app_role"] | null
          responsabil_tip?: Database["public"]["Enums"]["checklist_responsabil_tip"]
          status?: Database["public"]["Enums"]["checklist_item_status"]
          template_item_id?: string | null
          termen?: string | null
          tip_dovada?: Database["public"]["Enums"]["checklist_tip_dovada"]
          titlu?: string
          updated_at?: string
          updated_by?: string | null
          verificare_automata?:
            | Database["public"]["Enums"]["checklist_verificare"]
            | null
        }
        Relationships: [
          {
            foreignKeyName: "checklist_instance_items_curs_fk"
            columns: ["curs_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id", "organization_id"]
          },
          {
            foreignKeyName: "checklist_instance_items_dovada_document_id_fkey"
            columns: ["dovada_document_id"]
            isOneToOne: false
            referencedRelation: "employee_documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "checklist_instance_items_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "checklist_instance_items_instance_fk"
            columns: ["instance_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "checklist_instances"
            referencedColumns: ["id", "organization_id"]
          },
          {
            foreignKeyName: "checklist_instance_items_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "checklist_instance_items_responsabil_employee_id_fkey"
            columns: ["responsabil_employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "checklist_instance_items_template_item_id_fkey"
            columns: ["template_item_id"]
            isOneToOne: false
            referencedRelation: "checklist_template_items"
            referencedColumns: ["id"]
          },
        ]
      }
      checklist_instances: {
        Row: {
          anulata_la: string | null
          ciclu: number
          created_at: string
          created_by: string | null
          data_referinta: string
          deleted_at: string | null
          employee_id: string
          finalizata_de: string | null
          finalizata_la: string | null
          id: string
          motiv_anulare: string | null
          observatii: string | null
          organization_id: string
          status: Database["public"]["Enums"]["checklist_instanta_status"]
          template_id: string
          tip: Database["public"]["Enums"]["checklist_tip"]
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          anulata_la?: string | null
          ciclu?: number
          created_at?: string
          created_by?: string | null
          data_referinta: string
          deleted_at?: string | null
          employee_id: string
          finalizata_de?: string | null
          finalizata_la?: string | null
          id?: string
          motiv_anulare?: string | null
          observatii?: string | null
          organization_id: string
          status?: Database["public"]["Enums"]["checklist_instanta_status"]
          template_id: string
          tip: Database["public"]["Enums"]["checklist_tip"]
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          anulata_la?: string | null
          ciclu?: number
          created_at?: string
          created_by?: string | null
          data_referinta?: string
          deleted_at?: string | null
          employee_id?: string
          finalizata_de?: string | null
          finalizata_la?: string | null
          id?: string
          motiv_anulare?: string | null
          observatii?: string | null
          organization_id?: string
          status?: Database["public"]["Enums"]["checklist_instanta_status"]
          template_id?: string
          tip?: Database["public"]["Enums"]["checklist_tip"]
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "checklist_instances_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "checklist_instances_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "checklist_instances_template_fk"
            columns: ["template_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "checklist_templates"
            referencedColumns: ["id", "organization_id"]
          },
        ]
      }
      checklist_template_items: {
        Row: {
          created_at: string
          created_by: string | null
          curs_id: string | null
          deleted_at: string | null
          descriere: string | null
          id: string
          obligatoriu: boolean
          ordine: number
          organization_id: string
          responsabil_employee_id: string | null
          responsabil_rol: Database["public"]["Enums"]["app_role"] | null
          responsabil_tip: Database["public"]["Enums"]["checklist_responsabil_tip"]
          template_id: string
          termen_zile_relativ: number
          tip_dovada: Database["public"]["Enums"]["checklist_tip_dovada"]
          titlu: string
          updated_at: string
          updated_by: string | null
          verificare_automata:
            | Database["public"]["Enums"]["checklist_verificare"]
            | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          curs_id?: string | null
          deleted_at?: string | null
          descriere?: string | null
          id?: string
          obligatoriu?: boolean
          ordine: number
          organization_id: string
          responsabil_employee_id?: string | null
          responsabil_rol?: Database["public"]["Enums"]["app_role"] | null
          responsabil_tip?: Database["public"]["Enums"]["checklist_responsabil_tip"]
          template_id: string
          termen_zile_relativ?: number
          tip_dovada?: Database["public"]["Enums"]["checklist_tip_dovada"]
          titlu: string
          updated_at?: string
          updated_by?: string | null
          verificare_automata?:
            | Database["public"]["Enums"]["checklist_verificare"]
            | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          curs_id?: string | null
          deleted_at?: string | null
          descriere?: string | null
          id?: string
          obligatoriu?: boolean
          ordine?: number
          organization_id?: string
          responsabil_employee_id?: string | null
          responsabil_rol?: Database["public"]["Enums"]["app_role"] | null
          responsabil_tip?: Database["public"]["Enums"]["checklist_responsabil_tip"]
          template_id?: string
          termen_zile_relativ?: number
          tip_dovada?: Database["public"]["Enums"]["checklist_tip_dovada"]
          titlu?: string
          updated_at?: string
          updated_by?: string | null
          verificare_automata?:
            | Database["public"]["Enums"]["checklist_verificare"]
            | null
        }
        Relationships: [
          {
            foreignKeyName: "checklist_template_items_curs_fk"
            columns: ["curs_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id", "organization_id"]
          },
          {
            foreignKeyName: "checklist_template_items_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "checklist_template_items_responsabil_employee_id_fkey"
            columns: ["responsabil_employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "checklist_template_items_template_fk"
            columns: ["template_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "checklist_templates"
            referencedColumns: ["id", "organization_id"]
          },
        ]
      }
      checklist_templates: {
        Row: {
          activ: boolean
          created_at: string
          created_by: string | null
          deleted_at: string | null
          denumire: string
          department_id: string | null
          descriere: string | null
          id: string
          job_position_id: string | null
          organization_id: string
          tip: Database["public"]["Enums"]["checklist_tip"]
          updated_at: string
          updated_by: string | null
          valabil_de_la: string
          valabil_pana_la: string | null
        }
        Insert: {
          activ?: boolean
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          denumire: string
          department_id?: string | null
          descriere?: string | null
          id?: string
          job_position_id?: string | null
          organization_id: string
          tip: Database["public"]["Enums"]["checklist_tip"]
          updated_at?: string
          updated_by?: string | null
          valabil_de_la?: string
          valabil_pana_la?: string | null
        }
        Update: {
          activ?: boolean
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          denumire?: string
          department_id?: string | null
          descriere?: string | null
          id?: string
          job_position_id?: string | null
          organization_id?: string
          tip?: Database["public"]["Enums"]["checklist_tip"]
          updated_at?: string
          updated_by?: string | null
          valabil_de_la?: string
          valabil_pana_la?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "checklist_templates_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "checklist_templates_job_position_id_fkey"
            columns: ["job_position_id"]
            isOneToOne: false
            referencedRelation: "job_positions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "checklist_templates_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      compliance_alerts: {
        Row: {
          acknowledged_at: string | null
          acknowledged_by: string | null
          created_at: string
          deleted_at: string | null
          due_date: string
          expirable_id: string
          id: string
          nota: string | null
          organization_id: string
          prag_zile: number
          resolved_at: string | null
          resolved_by: string | null
          status: string
          updated_at: string
        }
        Insert: {
          acknowledged_at?: string | null
          acknowledged_by?: string | null
          created_at?: string
          deleted_at?: string | null
          due_date: string
          expirable_id: string
          id?: string
          nota?: string | null
          organization_id: string
          prag_zile: number
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          acknowledged_at?: string | null
          acknowledged_by?: string | null
          created_at?: string
          deleted_at?: string | null
          due_date?: string
          expirable_id?: string
          id?: string
          nota?: string | null
          organization_id?: string
          prag_zile?: number
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "compliance_alerts_acknowledged_by_fkey"
            columns: ["acknowledged_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "compliance_alerts_expirable_id_fkey"
            columns: ["expirable_id"]
            isOneToOne: false
            referencedRelation: "expirables"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "compliance_alerts_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "compliance_alerts_resolved_by_fkey"
            columns: ["resolved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      countries: {
        Row: {
          cod_alpha2: string
          cod_alpha3: string
          created_at: string
          created_by: string | null
          deleted_at: string | null
          denumire: string
          denumire_oficiala: string | null
          este_see: boolean
          este_ue: boolean
          id: string
          moneda: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          cod_alpha2: string
          cod_alpha3: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          denumire: string
          denumire_oficiala?: string | null
          este_see?: boolean
          este_ue?: boolean
          id?: string
          moneda: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          cod_alpha2?: string
          cod_alpha3?: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          denumire?: string
          denumire_oficiala?: string | null
          este_see?: boolean
          este_ue?: boolean
          id?: string
          moneda?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      course_answer_keys: {
        Row: {
          chei: Json
          created_at: string
          created_by: string | null
          id: string
          organization_id: string
          updated_at: string
          updated_by: string | null
          version_id: string
        }
        Insert: {
          chei: Json
          created_at?: string
          created_by?: string | null
          id?: string
          organization_id: string
          updated_at?: string
          updated_by?: string | null
          version_id: string
        }
        Update: {
          chei?: Json
          created_at?: string
          created_by?: string | null
          id?: string
          organization_id?: string
          updated_at?: string
          updated_by?: string | null
          version_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "course_answer_keys_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "course_answer_keys_version_id_organization_id_fkey"
            columns: ["version_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "course_material_versions"
            referencedColumns: ["id", "organization_id"]
          },
        ]
      }
      course_assignment_rules: {
        Row: {
          activ: boolean
          course_id: string
          created_at: string
          created_by: string | null
          criteriu: Database["public"]["Enums"]["curs_criteriu"]
          decalaj_zile: number
          deleted_at: string | null
          department_id: string | null
          employee_id: string | null
          id: string
          job_position_id: string | null
          organization_id: string
          rol: Database["public"]["Enums"]["app_role"] | null
          termen_zile: number | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          activ?: boolean
          course_id: string
          created_at?: string
          created_by?: string | null
          criteriu: Database["public"]["Enums"]["curs_criteriu"]
          decalaj_zile?: number
          deleted_at?: string | null
          department_id?: string | null
          employee_id?: string | null
          id?: string
          job_position_id?: string | null
          organization_id: string
          rol?: Database["public"]["Enums"]["app_role"] | null
          termen_zile?: number | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          activ?: boolean
          course_id?: string
          created_at?: string
          created_by?: string | null
          criteriu?: Database["public"]["Enums"]["curs_criteriu"]
          decalaj_zile?: number
          deleted_at?: string | null
          department_id?: string | null
          employee_id?: string | null
          id?: string
          job_position_id?: string | null
          organization_id?: string
          rol?: Database["public"]["Enums"]["app_role"] | null
          termen_zile?: number | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "course_assignment_rules_course_id_organization_id_fkey"
            columns: ["course_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id", "organization_id"]
          },
          {
            foreignKeyName: "course_assignment_rules_department_id_organization_id_fkey"
            columns: ["department_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id", "organization_id"]
          },
          {
            foreignKeyName: "course_assignment_rules_employee_id_organization_id_fkey"
            columns: ["employee_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id", "organization_id"]
          },
          {
            foreignKeyName: "course_assignment_rules_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      course_completion_records: {
        Row: {
          ciclu: number
          continut: Json
          continut_checksum: string
          course_id: string
          created_at: string
          created_by: string | null
          employee_id: string
          enrollment_id: string
          expira_la: string | null
          finalizat_la: string
          id: string
          materiale_finalizate: number
          organization_id: string
          total_materiale: number
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          ciclu: number
          continut: Json
          continut_checksum: string
          course_id: string
          created_at?: string
          created_by?: string | null
          employee_id: string
          enrollment_id: string
          expira_la?: string | null
          finalizat_la: string
          id?: string
          materiale_finalizate: number
          organization_id: string
          total_materiale: number
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          ciclu?: number
          continut?: Json
          continut_checksum?: string
          course_id?: string
          created_at?: string
          created_by?: string | null
          employee_id?: string
          enrollment_id?: string
          expira_la?: string | null
          finalizat_la?: string
          id?: string
          materiale_finalizate?: number
          organization_id?: string
          total_materiale?: number
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "course_completion_records_enrollment_id_organization_id_fkey"
            columns: ["enrollment_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "course_enrollments"
            referencedColumns: ["id", "organization_id"]
          },
          {
            foreignKeyName: "course_completion_records_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      course_enrollment_items: {
        Row: {
          course_item_id: string | null
          created_at: string
          created_by: string | null
          declaratie_text: string | null
          deleted_at: string | null
          deschis_la: string | null
          durata_secunde: number | null
          employee_id: string
          enrollment_id: string
          fel: Database["public"]["Enums"]["curs_material_fel"]
          finalizat_la: string | null
          heartbeat_la: string | null
          id: string
          material_id: string
          obligatoriu: boolean
          observatii: string | null
          ordine: number
          organization_id: string
          pozitie_secunde: number
          prag_test: number | null
          procent_minim: number | null
          secunde_vizionate: number
          semnat_la: string | null
          semnatura_ip: unknown
          semnatura_nume: string | null
          status: Database["public"]["Enums"]["curs_item_status"]
          titlu: string
          treapta_dovada: Database["public"]["Enums"]["curs_treapta_dovada"]
          updated_at: string
          updated_by: string | null
          version_id: string | null
        }
        Insert: {
          course_item_id?: string | null
          created_at?: string
          created_by?: string | null
          declaratie_text?: string | null
          deleted_at?: string | null
          deschis_la?: string | null
          durata_secunde?: number | null
          employee_id: string
          enrollment_id: string
          fel: Database["public"]["Enums"]["curs_material_fel"]
          finalizat_la?: string | null
          heartbeat_la?: string | null
          id?: string
          material_id: string
          obligatoriu?: boolean
          observatii?: string | null
          ordine: number
          organization_id: string
          pozitie_secunde?: number
          prag_test?: number | null
          procent_minim?: number | null
          secunde_vizionate?: number
          semnat_la?: string | null
          semnatura_ip?: unknown
          semnatura_nume?: string | null
          status?: Database["public"]["Enums"]["curs_item_status"]
          titlu: string
          treapta_dovada: Database["public"]["Enums"]["curs_treapta_dovada"]
          updated_at?: string
          updated_by?: string | null
          version_id?: string | null
        }
        Update: {
          course_item_id?: string | null
          created_at?: string
          created_by?: string | null
          declaratie_text?: string | null
          deleted_at?: string | null
          deschis_la?: string | null
          durata_secunde?: number | null
          employee_id?: string
          enrollment_id?: string
          fel?: Database["public"]["Enums"]["curs_material_fel"]
          finalizat_la?: string | null
          heartbeat_la?: string | null
          id?: string
          material_id?: string
          obligatoriu?: boolean
          observatii?: string | null
          ordine?: number
          organization_id?: string
          pozitie_secunde?: number
          prag_test?: number | null
          procent_minim?: number | null
          secunde_vizionate?: number
          semnat_la?: string | null
          semnatura_ip?: unknown
          semnatura_nume?: string | null
          status?: Database["public"]["Enums"]["curs_item_status"]
          titlu?: string
          treapta_dovada?: Database["public"]["Enums"]["curs_treapta_dovada"]
          updated_at?: string
          updated_by?: string | null
          version_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "course_enrollment_items_course_item_id_organization_id_fkey"
            columns: ["course_item_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "course_items"
            referencedColumns: ["id", "organization_id"]
          },
          {
            foreignKeyName: "course_enrollment_items_employee_id_organization_id_fkey"
            columns: ["employee_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id", "organization_id"]
          },
          {
            foreignKeyName: "course_enrollment_items_enrollment_id_organization_id_fkey"
            columns: ["enrollment_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "course_enrollments"
            referencedColumns: ["id", "organization_id"]
          },
          {
            foreignKeyName: "course_enrollment_items_material_id_organization_id_fkey"
            columns: ["material_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "course_materials"
            referencedColumns: ["id", "organization_id"]
          },
          {
            foreignKeyName: "course_enrollment_items_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "course_enrollment_items_version_id_organization_id_fkey"
            columns: ["version_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "course_material_versions"
            referencedColumns: ["id", "organization_id"]
          },
        ]
      }
      course_enrollments: {
        Row: {
          anulat_la: string | null
          atribuit_la: string
          ciclu: number
          course_id: string
          created_at: string
          created_by: string | null
          deleted_at: string | null
          employee_id: string
          expira_la: string | null
          finalizat_la: string | null
          id: string
          inceput_la: string | null
          materiale_finalizate: number
          materiale_total: number
          motiv: Database["public"]["Enums"]["curs_motiv"]
          motiv_anulare: string | null
          organization_id: string
          status: Database["public"]["Enums"]["curs_status"]
          termen: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          anulat_la?: string | null
          atribuit_la?: string
          ciclu?: number
          course_id: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          employee_id: string
          expira_la?: string | null
          finalizat_la?: string | null
          id?: string
          inceput_la?: string | null
          materiale_finalizate?: number
          materiale_total?: number
          motiv?: Database["public"]["Enums"]["curs_motiv"]
          motiv_anulare?: string | null
          organization_id: string
          status?: Database["public"]["Enums"]["curs_status"]
          termen?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          anulat_la?: string | null
          atribuit_la?: string
          ciclu?: number
          course_id?: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          employee_id?: string
          expira_la?: string | null
          finalizat_la?: string | null
          id?: string
          inceput_la?: string | null
          materiale_finalizate?: number
          materiale_total?: number
          motiv?: Database["public"]["Enums"]["curs_motiv"]
          motiv_anulare?: string | null
          organization_id?: string
          status?: Database["public"]["Enums"]["curs_status"]
          termen?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "course_enrollments_course_id_organization_id_fkey"
            columns: ["course_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id", "organization_id"]
          },
          {
            foreignKeyName: "course_enrollments_employee_id_organization_id_fkey"
            columns: ["employee_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id", "organization_id"]
          },
          {
            foreignKeyName: "course_enrollments_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      course_items: {
        Row: {
          course_id: string
          created_at: string
          created_by: string | null
          deleted_at: string | null
          id: string
          material_id: string
          obligatoriu: boolean
          ordine: number
          organization_id: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          course_id: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          id?: string
          material_id: string
          obligatoriu?: boolean
          ordine: number
          organization_id: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          course_id?: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          id?: string
          material_id?: string
          obligatoriu?: boolean
          ordine?: number
          organization_id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "course_items_course_id_organization_id_fkey"
            columns: ["course_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id", "organization_id"]
          },
          {
            foreignKeyName: "course_items_material_id_organization_id_fkey"
            columns: ["material_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "course_materials"
            referencedColumns: ["id", "organization_id"]
          },
          {
            foreignKeyName: "course_items_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      course_material_versions: {
        Row: {
          created_at: string
          created_by: string | null
          deleted_at: string | null
          durata_secunde: number | null
          fisier_checksum: string | null
          fisier_marime_bytes: number | null
          fisier_mime: string | null
          fisier_nume: string | null
          fisier_path: string | null
          id: string
          intrebari: Json | null
          link_cod_privat: string | null
          link_furnizor:
            | Database["public"]["Enums"]["curs_link_furnizor"]
            | null
          link_id: string | null
          material_id: string
          nota_versiune: string | null
          numar_pagini: number | null
          organization_id: string
          publicata_la: string | null
          retrasa_la: string | null
          subtitrare_path: string | null
          updated_at: string
          updated_by: string | null
          versiune: number
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          durata_secunde?: number | null
          fisier_checksum?: string | null
          fisier_marime_bytes?: number | null
          fisier_mime?: string | null
          fisier_nume?: string | null
          fisier_path?: string | null
          id?: string
          intrebari?: Json | null
          link_cod_privat?: string | null
          link_furnizor?:
            | Database["public"]["Enums"]["curs_link_furnizor"]
            | null
          link_id?: string | null
          material_id: string
          nota_versiune?: string | null
          numar_pagini?: number | null
          organization_id: string
          publicata_la?: string | null
          retrasa_la?: string | null
          subtitrare_path?: string | null
          updated_at?: string
          updated_by?: string | null
          versiune: number
        }
        Update: {
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          durata_secunde?: number | null
          fisier_checksum?: string | null
          fisier_marime_bytes?: number | null
          fisier_mime?: string | null
          fisier_nume?: string | null
          fisier_path?: string | null
          id?: string
          intrebari?: Json | null
          link_cod_privat?: string | null
          link_furnizor?:
            | Database["public"]["Enums"]["curs_link_furnizor"]
            | null
          link_id?: string | null
          material_id?: string
          nota_versiune?: string | null
          numar_pagini?: number | null
          organization_id?: string
          publicata_la?: string | null
          retrasa_la?: string | null
          subtitrare_path?: string | null
          updated_at?: string
          updated_by?: string | null
          versiune?: number
        }
        Relationships: [
          {
            foreignKeyName: "course_material_versions_material_id_organization_id_fkey"
            columns: ["material_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "course_materials"
            referencedColumns: ["id", "organization_id"]
          },
          {
            foreignKeyName: "course_material_versions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      course_materials: {
        Row: {
          activ: boolean
          cod: string
          created_at: string
          created_by: string | null
          declaratie_text: string | null
          deleted_at: string | null
          descriere: string | null
          fel: Database["public"]["Enums"]["curs_material_fel"]
          id: string
          organization_id: string
          prag_test: number | null
          procent_minim: number | null
          sursa: Database["public"]["Enums"]["curs_material_sursa"]
          titlu: string
          transcriere: string | null
          treapta_dovada: Database["public"]["Enums"]["curs_treapta_dovada"]
          updated_at: string
          updated_by: string | null
          versiune_curenta_id: string | null
        }
        Insert: {
          activ?: boolean
          cod: string
          created_at?: string
          created_by?: string | null
          declaratie_text?: string | null
          deleted_at?: string | null
          descriere?: string | null
          fel: Database["public"]["Enums"]["curs_material_fel"]
          id?: string
          organization_id: string
          prag_test?: number | null
          procent_minim?: number | null
          sursa: Database["public"]["Enums"]["curs_material_sursa"]
          titlu: string
          transcriere?: string | null
          treapta_dovada?: Database["public"]["Enums"]["curs_treapta_dovada"]
          updated_at?: string
          updated_by?: string | null
          versiune_curenta_id?: string | null
        }
        Update: {
          activ?: boolean
          cod?: string
          created_at?: string
          created_by?: string | null
          declaratie_text?: string | null
          deleted_at?: string | null
          descriere?: string | null
          fel?: Database["public"]["Enums"]["curs_material_fel"]
          id?: string
          organization_id?: string
          prag_test?: number | null
          procent_minim?: number | null
          sursa?: Database["public"]["Enums"]["curs_material_sursa"]
          titlu?: string
          transcriere?: string | null
          treapta_dovada?: Database["public"]["Enums"]["curs_treapta_dovada"]
          updated_at?: string
          updated_by?: string | null
          versiune_curenta_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "course_materials_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "course_materials_versiune_curenta_fk"
            columns: ["versiune_curenta_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "course_material_versions"
            referencedColumns: ["id", "organization_id"]
          },
        ]
      }
      course_quiz_attempts: {
        Row: {
          created_at: string
          created_by: string | null
          employee_id: string
          enrollment_item_id: string
          id: string
          numar: number
          organization_id: string
          promovat: boolean
          raspunsuri: Json
          scor: number
          trimis_la: string
          version_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          employee_id: string
          enrollment_item_id: string
          id?: string
          numar?: number
          organization_id: string
          promovat?: boolean
          raspunsuri: Json
          scor?: number
          trimis_la?: string
          version_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          employee_id?: string
          enrollment_item_id?: string
          id?: string
          numar?: number
          organization_id?: string
          promovat?: boolean
          raspunsuri?: Json
          scor?: number
          trimis_la?: string
          version_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "course_quiz_attempts_employee_id_organization_id_fkey"
            columns: ["employee_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id", "organization_id"]
          },
          {
            foreignKeyName: "course_quiz_attempts_enrollment_item_id_organization_id_fkey"
            columns: ["enrollment_item_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "course_enrollment_items"
            referencedColumns: ["id", "organization_id"]
          },
          {
            foreignKeyName: "course_quiz_attempts_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "course_quiz_attempts_version_id_organization_id_fkey"
            columns: ["version_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "course_material_versions"
            referencedColumns: ["id", "organization_id"]
          },
        ]
      }
      courses: {
        Row: {
          activ: boolean
          cod: string
          created_at: string
          created_by: string | null
          deleted_at: string | null
          denumire: string
          descriere: string | null
          id: string
          obligatoriu: boolean
          organization_id: string
          prag_avertizare_zile: number
          publicat: boolean
          publicat_la: string | null
          termen_zile: number | null
          updated_at: string
          updated_by: string | null
          valabilitate_luni: number | null
        }
        Insert: {
          activ?: boolean
          cod: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          denumire: string
          descriere?: string | null
          id?: string
          obligatoriu?: boolean
          organization_id: string
          prag_avertizare_zile?: number
          publicat?: boolean
          publicat_la?: string | null
          termen_zile?: number | null
          updated_at?: string
          updated_by?: string | null
          valabilitate_luni?: number | null
        }
        Update: {
          activ?: boolean
          cod?: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          denumire?: string
          descriere?: string | null
          id?: string
          obligatoriu?: boolean
          organization_id?: string
          prag_avertizare_zile?: number
          publicat?: boolean
          publicat_la?: string | null
          termen_zile?: number | null
          updated_at?: string
          updated_by?: string | null
          valabilitate_luni?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "courses_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      dangerous_incidents: {
        Row: {
          cauze: string | null
          comunicat_la_itm_la: string | null
          created_at: string
          created_by: string | null
          data_producerii: string
          deleted_at: string | null
          descriere: string
          employee_id: string | null
          id: string
          locul: string
          masuri: string | null
          numar_intern: string | null
          ora_producerii: string | null
          organization_id: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          cauze?: string | null
          comunicat_la_itm_la?: string | null
          created_at?: string
          created_by?: string | null
          data_producerii: string
          deleted_at?: string | null
          descriere: string
          employee_id?: string | null
          id?: string
          locul: string
          masuri?: string | null
          numar_intern?: string | null
          ora_producerii?: string | null
          organization_id: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          cauze?: string | null
          comunicat_la_itm_la?: string | null
          created_at?: string
          created_by?: string | null
          data_producerii?: string
          deleted_at?: string | null
          descriere?: string
          employee_id?: string | null
          id?: string
          locul?: string
          masuri?: string | null
          numar_intern?: string | null
          ora_producerii?: string | null
          organization_id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "dangerous_incidents_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dangerous_incidents_org_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      demo_requests: {
        Row: {
          created_at: string
          created_by: string | null
          created_day: string | null
          deleted_at: string | null
          email: string
          firma: string
          id: string
          ip: unknown
          mesaj: string | null
          nr_angajati: Database["public"]["Enums"]["employee_band"] | null
          nume: string
          status: Database["public"]["Enums"]["demo_request_status"]
          telefon: string | null
          updated_at: string
          updated_by: string | null
          user_agent: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          created_day?: string | null
          deleted_at?: string | null
          email: string
          firma: string
          id?: string
          ip?: unknown
          mesaj?: string | null
          nr_angajati?: Database["public"]["Enums"]["employee_band"] | null
          nume: string
          status?: Database["public"]["Enums"]["demo_request_status"]
          telefon?: string | null
          updated_at?: string
          updated_by?: string | null
          user_agent?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          created_day?: string | null
          deleted_at?: string | null
          email?: string
          firma?: string
          id?: string
          ip?: unknown
          mesaj?: string | null
          nr_angajati?: Database["public"]["Enums"]["employee_band"] | null
          nume?: string
          status?: Database["public"]["Enums"]["demo_request_status"]
          telefon?: string | null
          updated_at?: string
          updated_by?: string | null
          user_agent?: string | null
        }
        Relationships: []
      }
      departments: {
        Row: {
          activ: boolean
          cod: string
          cost_center: string | null
          created_at: string
          created_by: string | null
          deleted_at: string | null
          denumire: string
          depth: number
          descriere: string | null
          id: string
          manager_employee_id: string | null
          organization_id: string
          parent_id: string | null
          path: string[]
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          activ?: boolean
          cod: string
          cost_center?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          denumire: string
          depth?: number
          descriere?: string | null
          id?: string
          manager_employee_id?: string | null
          organization_id: string
          parent_id?: string | null
          path?: string[]
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          activ?: boolean
          cod?: string
          cost_center?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          denumire?: string
          depth?: number
          descriere?: string | null
          id?: string
          manager_employee_id?: string | null
          organization_id?: string
          parent_id?: string | null
          path?: string[]
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "departments_manager_fk"
            columns: ["manager_employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "departments_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "departments_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
        ]
      }
      document_sequences: {
        Row: {
          created_at: string
          created_by: string | null
          document_type: string
          id: string
          next_number: number
          organization_id: string
          padding: number
          prefix: string
          updated_at: string
          updated_by: string | null
          year: number
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          document_type: string
          id?: string
          next_number?: number
          organization_id: string
          padding?: number
          prefix?: string
          updated_at?: string
          updated_by?: string | null
          year: number
        }
        Update: {
          created_at?: string
          created_by?: string | null
          document_type?: string
          id?: string
          next_number?: number
          organization_id?: string
          padding?: number
          prefix?: string
          updated_at?: string
          updated_by?: string | null
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "document_sequences_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      email_log: {
        Row: {
          created_at: string
          destinatar: string
          error: string | null
          id: string
          organization_id: string | null
          provider_id: string | null
          sent_at: string | null
          status: Database["public"]["Enums"]["email_status"]
          subiect: string
          template: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          destinatar: string
          error?: string | null
          id?: string
          organization_id?: string | null
          provider_id?: string | null
          sent_at?: string | null
          status?: Database["public"]["Enums"]["email_status"]
          subiect: string
          template: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          destinatar?: string
          error?: string | null
          id?: string
          organization_id?: string | null
          provider_id?: string | null
          sent_at?: string | null
          status?: Database["public"]["Enums"]["email_status"]
          subiect?: string
          template?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "email_log_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      employee_dependents: {
        Row: {
          created_at: string
          created_by: string | null
          data_nasterii: string | null
          deleted_at: string | null
          employee_id: string
          id: string
          in_intretinere_de_la: string
          in_intretinere_pana_la: string | null
          nume: string
          observatii: string | null
          organization_id: string
          relatie: Database["public"]["Enums"]["dependent_relation"]
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          data_nasterii?: string | null
          deleted_at?: string | null
          employee_id: string
          id?: string
          in_intretinere_de_la: string
          in_intretinere_pana_la?: string | null
          nume: string
          observatii?: string | null
          organization_id: string
          relatie: Database["public"]["Enums"]["dependent_relation"]
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          data_nasterii?: string | null
          deleted_at?: string | null
          employee_id?: string
          id?: string
          in_intretinere_de_la?: string
          in_intretinere_pana_la?: string | null
          nume?: string
          observatii?: string | null
          organization_id?: string
          relatie?: Database["public"]["Enums"]["dependent_relation"]
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "employee_dependents_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employee_dependents_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      employee_document_types: {
        Row: {
          activ: boolean
          cere_valabilitate: boolean
          cod: string
          confidential_implicit: boolean
          created_at: string
          created_by: string | null
          deleted_at: string | null
          denumire: string
          id: string
          ordine: number
          organization_id: string | null
          updated_at: string
          updated_by: string | null
          vizibil_angajatului_implicit: boolean
        }
        Insert: {
          activ?: boolean
          cere_valabilitate?: boolean
          cod: string
          confidential_implicit?: boolean
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          denumire: string
          id?: string
          ordine?: number
          organization_id?: string | null
          updated_at?: string
          updated_by?: string | null
          vizibil_angajatului_implicit?: boolean
        }
        Update: {
          activ?: boolean
          cere_valabilitate?: boolean
          cod?: string
          confidential_implicit?: boolean
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          denumire?: string
          id?: string
          ordine?: number
          organization_id?: string | null
          updated_at?: string
          updated_by?: string | null
          vizibil_angajatului_implicit?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "employee_document_types_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      employee_documents: {
        Row: {
          confidential: boolean
          contract_id: string | null
          created_at: string
          created_by: string | null
          data_document: string | null
          deleted_at: string | null
          document_type_id: string
          employee_id: string
          fisier_checksum: string | null
          fisier_marime_bytes: number | null
          fisier_mime: string | null
          fisier_nume: string
          fisier_path: string
          id: string
          numar_document: string | null
          observatii: string | null
          organization_id: string
          titlu: string
          updated_at: string
          updated_by: string | null
          valabil_de_la: string | null
          valabil_pana: string | null
          vizibil_angajatului: boolean
        }
        Insert: {
          confidential?: boolean
          contract_id?: string | null
          created_at?: string
          created_by?: string | null
          data_document?: string | null
          deleted_at?: string | null
          document_type_id: string
          employee_id: string
          fisier_checksum?: string | null
          fisier_marime_bytes?: number | null
          fisier_mime?: string | null
          fisier_nume: string
          fisier_path: string
          id?: string
          numar_document?: string | null
          observatii?: string | null
          organization_id: string
          titlu: string
          updated_at?: string
          updated_by?: string | null
          valabil_de_la?: string | null
          valabil_pana?: string | null
          vizibil_angajatului?: boolean
        }
        Update: {
          confidential?: boolean
          contract_id?: string | null
          created_at?: string
          created_by?: string | null
          data_document?: string | null
          deleted_at?: string | null
          document_type_id?: string
          employee_id?: string
          fisier_checksum?: string | null
          fisier_marime_bytes?: number | null
          fisier_mime?: string | null
          fisier_nume?: string
          fisier_path?: string
          id?: string
          numar_document?: string | null
          observatii?: string | null
          organization_id?: string
          titlu?: string
          updated_at?: string
          updated_by?: string | null
          valabil_de_la?: string | null
          valabil_pana?: string | null
          vizibil_angajatului?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "employee_documents_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "employment_contracts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employee_documents_document_type_id_fkey"
            columns: ["document_type_id"]
            isOneToOne: false
            referencedRelation: "employee_document_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employee_documents_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employee_documents_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      employee_evaluations: {
        Row: {
          concluzie: string | null
          created_at: string
          created_by: string | null
          criterii_sablon: Json
          data_evaluarii: string
          deleted_at: string | null
          employee_id: string
          evaluator_id: string | null
          id: string
          organization_id: string
          raspunsuri: Json
          status: Database["public"]["Enums"]["evaluation_status"]
          template_id: string
          updated_at: string
          updated_by: string | null
          versiune_sablon: number | null
        }
        Insert: {
          concluzie?: string | null
          created_at?: string
          created_by?: string | null
          criterii_sablon?: Json
          data_evaluarii: string
          deleted_at?: string | null
          employee_id: string
          evaluator_id?: string | null
          id?: string
          organization_id: string
          raspunsuri?: Json
          status?: Database["public"]["Enums"]["evaluation_status"]
          template_id: string
          updated_at?: string
          updated_by?: string | null
          versiune_sablon?: number | null
        }
        Update: {
          concluzie?: string | null
          created_at?: string
          created_by?: string | null
          criterii_sablon?: Json
          data_evaluarii?: string
          deleted_at?: string | null
          employee_id?: string
          evaluator_id?: string | null
          id?: string
          organization_id?: string
          raspunsuri?: Json
          status?: Database["public"]["Enums"]["evaluation_status"]
          template_id?: string
          updated_at?: string
          updated_by?: string | null
          versiune_sablon?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "employee_evaluations_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employee_evaluations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employee_evaluations_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "evaluation_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      employee_marca_counters: {
        Row: {
          created_at: string
          created_by: string | null
          next_marca: number
          organization_id: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          next_marca?: number
          organization_id: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          next_marca?: number
          organization_id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "employee_marca_counters_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: true
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      employee_sensitive_data: {
        Row: {
          banca: string | null
          cnp_ciphertext: string | null
          cnp_hash: string | null
          cnp_iv: string | null
          cnp_key_version: number | null
          cnp_last4: string | null
          cnp_tag: string | null
          created_at: string
          created_by: string | null
          deleted_at: string | null
          employee_id: string
          iban_ciphertext: string | null
          iban_hash: string | null
          iban_iv: string | null
          iban_key_version: number | null
          iban_last4: string | null
          iban_tag: string | null
          organization_id: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          banca?: string | null
          cnp_ciphertext?: string | null
          cnp_hash?: string | null
          cnp_iv?: string | null
          cnp_key_version?: number | null
          cnp_last4?: string | null
          cnp_tag?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          employee_id: string
          iban_ciphertext?: string | null
          iban_hash?: string | null
          iban_iv?: string | null
          iban_key_version?: number | null
          iban_last4?: string | null
          iban_tag?: string | null
          organization_id: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          banca?: string | null
          cnp_ciphertext?: string | null
          cnp_hash?: string | null
          cnp_iv?: string | null
          cnp_key_version?: number | null
          cnp_last4?: string | null
          cnp_tag?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          employee_id?: string
          iban_ciphertext?: string | null
          iban_hash?: string | null
          iban_iv?: string | null
          iban_key_version?: number | null
          iban_last4?: string | null
          iban_tag?: string | null
          organization_id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "employee_sensitive_data_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: true
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employee_sensitive_data_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      employee_tax_exemptions: {
        Row: {
          contract_id: string | null
          created_at: string
          created_by: string | null
          deleted_at: string | null
          document_id: string | null
          employee_id: string
          exemption_type: Database["public"]["Enums"]["exemption_type"]
          id: string
          observatii: string | null
          organization_id: string
          plafon_lunar: number | null
          procent_scutire: number | null
          temei_legal: string | null
          updated_at: string
          updated_by: string | null
          valabil_de_la: string
          valabil_pana: string | null
        }
        Insert: {
          contract_id?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          document_id?: string | null
          employee_id: string
          exemption_type: Database["public"]["Enums"]["exemption_type"]
          id?: string
          observatii?: string | null
          organization_id: string
          plafon_lunar?: number | null
          procent_scutire?: number | null
          temei_legal?: string | null
          updated_at?: string
          updated_by?: string | null
          valabil_de_la: string
          valabil_pana?: string | null
        }
        Update: {
          contract_id?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          document_id?: string | null
          employee_id?: string
          exemption_type?: Database["public"]["Enums"]["exemption_type"]
          id?: string
          observatii?: string | null
          organization_id?: string
          plafon_lunar?: number | null
          procent_scutire?: number | null
          temei_legal?: string | null
          updated_at?: string
          updated_by?: string | null
          valabil_de_la?: string
          valabil_pana?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "employee_tax_exemptions_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "employment_contracts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employee_tax_exemptions_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "employee_documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employee_tax_exemptions_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employee_tax_exemptions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      employee_work_restrictions: {
        Row: {
          created_at: string
          created_by: string | null
          deleted_at: string | null
          employee_id: string
          exam_id: string | null
          generata_automat: boolean
          id: string
          observatii: string | null
          organization_id: string
          restrictie: string
          ridicata_la: string | null
          sursa: string
          updated_at: string
          updated_by: string | null
          valabil_de_la: string
          valabil_pana: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          employee_id: string
          exam_id?: string | null
          generata_automat?: boolean
          id?: string
          observatii?: string | null
          organization_id: string
          restrictie: string
          ridicata_la?: string | null
          sursa?: string
          updated_at?: string
          updated_by?: string | null
          valabil_de_la: string
          valabil_pana?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          employee_id?: string
          exam_id?: string | null
          generata_automat?: boolean
          id?: string
          observatii?: string | null
          organization_id?: string
          restrictie?: string
          ridicata_la?: string | null
          sursa?: string
          updated_at?: string
          updated_by?: string | null
          valabil_de_la?: string
          valabil_pana?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "employee_work_restrictions_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employee_work_restrictions_exam_id_fkey"
            columns: ["exam_id"]
            isOneToOne: false
            referencedRelation: "occupational_health_exams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employee_work_restrictions_org_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      employees: {
        Row: {
          act_eliberat_de: string | null
          act_valabil_pana: string | null
          adresa_cod_postal: string | null
          adresa_judet: string | null
          adresa_oras: string | null
          adresa_resedinta_cod_postal: string | null
          adresa_resedinta_judet: string | null
          adresa_resedinta_oras: string | null
          adresa_resedinta_strada: string | null
          adresa_strada: string | null
          adresa_tara: string
          cetatenie: string
          conditii_munca: Database["public"]["Enums"]["conditii_munca"]
          contact_urgenta_nume: string | null
          contact_urgenta_relatie: string | null
          contact_urgenta_telefon: string | null
          created_at: string
          created_by: string | null
          data_nasterii: string | null
          deleted_at: string | null
          department_id: string | null
          email_personal: string | null
          email_serviciu: string | null
          first_name: string
          full_name: string | null
          gen: Database["public"]["Enums"]["gen"]
          grad_handicap: string | null
          hired_on: string | null
          id: string
          is_primary: boolean
          job_position_id: string | null
          last_name: string
          manager_employee_id: string | null
          manager_path: string[]
          marca: string
          nr_persoane_intretinere: number
          numar_act: string | null
          observatii: string | null
          optiune_pilon_ii: boolean
          organization_id: string
          serie_act: string | null
          stare_civila: Database["public"]["Enums"]["stare_civila"] | null
          status: Database["public"]["Enums"]["employee_status"]
          telefon: string | null
          telefon_serviciu: string | null
          terminated_on: string | null
          tip_act_identitate: string | null
          updated_at: string
          updated_by: string | null
          user_id: string | null
        }
        Insert: {
          act_eliberat_de?: string | null
          act_valabil_pana?: string | null
          adresa_cod_postal?: string | null
          adresa_judet?: string | null
          adresa_oras?: string | null
          adresa_resedinta_cod_postal?: string | null
          adresa_resedinta_judet?: string | null
          adresa_resedinta_oras?: string | null
          adresa_resedinta_strada?: string | null
          adresa_strada?: string | null
          adresa_tara?: string
          cetatenie?: string
          conditii_munca?: Database["public"]["Enums"]["conditii_munca"]
          contact_urgenta_nume?: string | null
          contact_urgenta_relatie?: string | null
          contact_urgenta_telefon?: string | null
          created_at?: string
          created_by?: string | null
          data_nasterii?: string | null
          deleted_at?: string | null
          department_id?: string | null
          email_personal?: string | null
          email_serviciu?: string | null
          first_name: string
          full_name?: string | null
          gen?: Database["public"]["Enums"]["gen"]
          grad_handicap?: string | null
          hired_on?: string | null
          id?: string
          is_primary?: boolean
          job_position_id?: string | null
          last_name: string
          manager_employee_id?: string | null
          manager_path?: string[]
          marca: string
          nr_persoane_intretinere?: number
          numar_act?: string | null
          observatii?: string | null
          optiune_pilon_ii?: boolean
          organization_id: string
          serie_act?: string | null
          stare_civila?: Database["public"]["Enums"]["stare_civila"] | null
          status?: Database["public"]["Enums"]["employee_status"]
          telefon?: string | null
          telefon_serviciu?: string | null
          terminated_on?: string | null
          tip_act_identitate?: string | null
          updated_at?: string
          updated_by?: string | null
          user_id?: string | null
        }
        Update: {
          act_eliberat_de?: string | null
          act_valabil_pana?: string | null
          adresa_cod_postal?: string | null
          adresa_judet?: string | null
          adresa_oras?: string | null
          adresa_resedinta_cod_postal?: string | null
          adresa_resedinta_judet?: string | null
          adresa_resedinta_oras?: string | null
          adresa_resedinta_strada?: string | null
          adresa_strada?: string | null
          adresa_tara?: string
          cetatenie?: string
          conditii_munca?: Database["public"]["Enums"]["conditii_munca"]
          contact_urgenta_nume?: string | null
          contact_urgenta_relatie?: string | null
          contact_urgenta_telefon?: string | null
          created_at?: string
          created_by?: string | null
          data_nasterii?: string | null
          deleted_at?: string | null
          department_id?: string | null
          email_personal?: string | null
          email_serviciu?: string | null
          first_name?: string
          full_name?: string | null
          gen?: Database["public"]["Enums"]["gen"]
          grad_handicap?: string | null
          hired_on?: string | null
          id?: string
          is_primary?: boolean
          job_position_id?: string | null
          last_name?: string
          manager_employee_id?: string | null
          manager_path?: string[]
          marca?: string
          nr_persoane_intretinere?: number
          numar_act?: string | null
          observatii?: string | null
          optiune_pilon_ii?: boolean
          organization_id?: string
          serie_act?: string | null
          stare_civila?: Database["public"]["Enums"]["stare_civila"] | null
          status?: Database["public"]["Enums"]["employee_status"]
          telefon?: string | null
          telefon_serviciu?: string | null
          terminated_on?: string | null
          tip_act_identitate?: string | null
          updated_at?: string
          updated_by?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "employees_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employees_job_position_id_fkey"
            columns: ["job_position_id"]
            isOneToOne: false
            referencedRelation: "job_positions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employees_manager_employee_id_fkey"
            columns: ["manager_employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employees_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      employment_contracts: {
        Row: {
          cod_revisal: string | null
          conditii_munca: Database["public"]["Enums"]["conditii_munca"]
          contract_duration: Database["public"]["Enums"]["contract_duration"]
          cost_center: string | null
          created_at: string
          created_by: string | null
          data_contract: string
          deleted_at: string | null
          department_id: string | null
          employee_id: string
          este_act_aditional: boolean
          fisier_path: string | null
          id: string
          incetat_la: string | null
          job_position_id: string | null
          loc_munca: string | null
          loc_telemunca: string | null
          moneda: string
          motiv_determinat: string | null
          motiv_incetare: string | null
          nivel_incadrare: string | null
          norma_ore_saptamana: number
          norma_ore_zi: number
          numar: string
          organization_id: string
          parent_contract_id: string | null
          perioada_proba_zile: number | null
          preaviz_zile: number | null
          salariu_baza: number
          special_regime: Database["public"]["Enums"]["special_regime"] | null
          status: Database["public"]["Enums"]["contract_status"]
          temei_incetare: string | null
          updated_at: string
          updated_by: string | null
          valabil_de_la: string
          valabil_pana: string | null
          work_mode: Database["public"]["Enums"]["work_mode"]
          zile_concediu_anual: number
        }
        Insert: {
          cod_revisal?: string | null
          conditii_munca?: Database["public"]["Enums"]["conditii_munca"]
          contract_duration?: Database["public"]["Enums"]["contract_duration"]
          cost_center?: string | null
          created_at?: string
          created_by?: string | null
          data_contract: string
          deleted_at?: string | null
          department_id?: string | null
          employee_id: string
          este_act_aditional?: boolean
          fisier_path?: string | null
          id?: string
          incetat_la?: string | null
          job_position_id?: string | null
          loc_munca?: string | null
          loc_telemunca?: string | null
          moneda?: string
          motiv_determinat?: string | null
          motiv_incetare?: string | null
          nivel_incadrare?: string | null
          norma_ore_saptamana?: number
          norma_ore_zi?: number
          numar: string
          organization_id: string
          parent_contract_id?: string | null
          perioada_proba_zile?: number | null
          preaviz_zile?: number | null
          salariu_baza: number
          special_regime?: Database["public"]["Enums"]["special_regime"] | null
          status?: Database["public"]["Enums"]["contract_status"]
          temei_incetare?: string | null
          updated_at?: string
          updated_by?: string | null
          valabil_de_la: string
          valabil_pana?: string | null
          work_mode?: Database["public"]["Enums"]["work_mode"]
          zile_concediu_anual?: number
        }
        Update: {
          cod_revisal?: string | null
          conditii_munca?: Database["public"]["Enums"]["conditii_munca"]
          contract_duration?: Database["public"]["Enums"]["contract_duration"]
          cost_center?: string | null
          created_at?: string
          created_by?: string | null
          data_contract?: string
          deleted_at?: string | null
          department_id?: string | null
          employee_id?: string
          este_act_aditional?: boolean
          fisier_path?: string | null
          id?: string
          incetat_la?: string | null
          job_position_id?: string | null
          loc_munca?: string | null
          loc_telemunca?: string | null
          moneda?: string
          motiv_determinat?: string | null
          motiv_incetare?: string | null
          nivel_incadrare?: string | null
          norma_ore_saptamana?: number
          norma_ore_zi?: number
          numar?: string
          organization_id?: string
          parent_contract_id?: string | null
          perioada_proba_zile?: number | null
          preaviz_zile?: number | null
          salariu_baza?: number
          special_regime?: Database["public"]["Enums"]["special_regime"] | null
          status?: Database["public"]["Enums"]["contract_status"]
          temei_incetare?: string | null
          updated_at?: string
          updated_by?: string | null
          valabil_de_la?: string
          valabil_pana?: string | null
          work_mode?: Database["public"]["Enums"]["work_mode"]
          zile_concediu_anual?: number
        }
        Relationships: [
          {
            foreignKeyName: "employment_contracts_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employment_contracts_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employment_contracts_job_position_id_fkey"
            columns: ["job_position_id"]
            isOneToOne: false
            referencedRelation: "job_positions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employment_contracts_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employment_contracts_parent_contract_id_fkey"
            columns: ["parent_contract_id"]
            isOneToOne: false
            referencedRelation: "employment_contracts"
            referencedColumns: ["id"]
          },
        ]
      }
      environmental_permits: {
        Row: {
          conditii: string | null
          created_at: string
          created_by: string | null
          deleted_at: string | null
          emis_la: string | null
          emitent: string
          id: string
          numar: string
          obiect: string | null
          organization_id: string
          responsabil_employee_id: string | null
          tip: string
          updated_at: string
          updated_by: string | null
          valabil_pana: string
        }
        Insert: {
          conditii?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          emis_la?: string | null
          emitent: string
          id?: string
          numar: string
          obiect?: string | null
          organization_id: string
          responsabil_employee_id?: string | null
          tip: string
          updated_at?: string
          updated_by?: string | null
          valabil_pana: string
        }
        Update: {
          conditii?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          emis_la?: string | null
          emitent?: string
          id?: string
          numar?: string
          obiect?: string | null
          organization_id?: string
          responsabil_employee_id?: string | null
          tip?: string
          updated_at?: string
          updated_by?: string | null
          valabil_pana?: string
        }
        Relationships: [
          {
            foreignKeyName: "environmental_permits_org_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "environmental_permits_responsabil_employee_id_fkey"
            columns: ["responsabil_employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      equipment: {
        Row: {
          an_fabricatie: number | null
          cod: string
          created_at: string
          created_by: string | null
          data_punerii_in_functiune: string | null
          deleted_at: string | null
          denumire: string
          department_id: string | null
          derogare_acordata_de: string | null
          derogare_acordata_la: string | null
          derogare_motiv: string | null
          este_iscir: boolean
          id: string
          locatie: string | null
          model: string | null
          organization_id: string
          producator: string | null
          responsabil_employee_id: string | null
          serie: string | null
          status: Database["public"]["Enums"]["equipment_status"]
          tip_autorizare_necesara: string | null
          updated_at: string
          updated_by: string | null
          valoare_achizitie: number | null
        }
        Insert: {
          an_fabricatie?: number | null
          cod: string
          created_at?: string
          created_by?: string | null
          data_punerii_in_functiune?: string | null
          deleted_at?: string | null
          denumire: string
          department_id?: string | null
          derogare_acordata_de?: string | null
          derogare_acordata_la?: string | null
          derogare_motiv?: string | null
          este_iscir?: boolean
          id?: string
          locatie?: string | null
          model?: string | null
          organization_id: string
          producator?: string | null
          responsabil_employee_id?: string | null
          serie?: string | null
          status?: Database["public"]["Enums"]["equipment_status"]
          tip_autorizare_necesara?: string | null
          updated_at?: string
          updated_by?: string | null
          valoare_achizitie?: number | null
        }
        Update: {
          an_fabricatie?: number | null
          cod?: string
          created_at?: string
          created_by?: string | null
          data_punerii_in_functiune?: string | null
          deleted_at?: string | null
          denumire?: string
          department_id?: string | null
          derogare_acordata_de?: string | null
          derogare_acordata_la?: string | null
          derogare_motiv?: string | null
          este_iscir?: boolean
          id?: string
          locatie?: string | null
          model?: string | null
          organization_id?: string
          producator?: string | null
          responsabil_employee_id?: string | null
          serie?: string | null
          status?: Database["public"]["Enums"]["equipment_status"]
          tip_autorizare_necesara?: string | null
          updated_at?: string
          updated_by?: string | null
          valoare_achizitie?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "equipment_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "equipment_org_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "equipment_responsabil_employee_id_fkey"
            columns: ["responsabil_employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      equipment_meters: {
        Row: {
          citire: number
          citit_de_employee_id: string | null
          created_at: string
          created_by: string | null
          data_citirii: string
          deleted_at: string | null
          equipment_id: string
          id: string
          observatii: string | null
          organization_id: string
          resetare_contor: boolean
          sursa: string
          tip: Database["public"]["Enums"]["meter_kind"]
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          citire: number
          citit_de_employee_id?: string | null
          created_at?: string
          created_by?: string | null
          data_citirii: string
          deleted_at?: string | null
          equipment_id: string
          id?: string
          observatii?: string | null
          organization_id: string
          resetare_contor?: boolean
          sursa?: string
          tip: Database["public"]["Enums"]["meter_kind"]
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          citire?: number
          citit_de_employee_id?: string | null
          created_at?: string
          created_by?: string | null
          data_citirii?: string
          deleted_at?: string | null
          equipment_id?: string
          id?: string
          observatii?: string | null
          organization_id?: string
          resetare_contor?: boolean
          sursa?: string
          tip?: Database["public"]["Enums"]["meter_kind"]
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "equipment_meters_citit_de_employee_id_fkey"
            columns: ["citit_de_employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "equipment_meters_equipment_id_fkey"
            columns: ["equipment_id"]
            isOneToOne: false
            referencedRelation: "equipment"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "equipment_meters_org_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      evacuation_drills: {
        Row: {
          created_at: string
          created_by: string | null
          data: string
          deficiente: string | null
          deleted_at: string | null
          durata_minute: number | null
          id: string
          numar_participanti: number | null
          observatii: string | null
          ora_start: string | null
          organization_id: string
          responsabil_employee_id: string | null
          scenariu: string
          timp_evacuare_secunde: number | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          data: string
          deficiente?: string | null
          deleted_at?: string | null
          durata_minute?: number | null
          id?: string
          numar_participanti?: number | null
          observatii?: string | null
          ora_start?: string | null
          organization_id: string
          responsabil_employee_id?: string | null
          scenariu: string
          timp_evacuare_secunde?: number | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          data?: string
          deficiente?: string | null
          deleted_at?: string | null
          durata_minute?: number | null
          id?: string
          numar_participanti?: number | null
          observatii?: string | null
          ora_start?: string | null
          organization_id?: string
          responsabil_employee_id?: string | null
          scenariu?: string
          timp_evacuare_secunde?: number | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "evacuation_drills_org_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "evacuation_drills_responsabil_employee_id_fkey"
            columns: ["responsabil_employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      evaluation_templates: {
        Row: {
          activ: boolean
          created_at: string
          created_by: string | null
          criterii: Json
          deleted_at: string | null
          denumire: string
          descriere: string | null
          id: string
          organization_id: string | null
          updated_at: string
          updated_by: string | null
          versiune: number
        }
        Insert: {
          activ?: boolean
          created_at?: string
          created_by?: string | null
          criterii?: Json
          deleted_at?: string | null
          denumire: string
          descriere?: string | null
          id?: string
          organization_id?: string | null
          updated_at?: string
          updated_by?: string | null
          versiune?: number
        }
        Update: {
          activ?: boolean
          created_at?: string
          created_by?: string | null
          criterii?: Json
          deleted_at?: string | null
          denumire?: string
          descriere?: string | null
          id?: string
          organization_id?: string | null
          updated_at?: string
          updated_by?: string | null
          versiune?: number
        }
        Relationships: [
          {
            foreignKeyName: "evaluation_templates_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      expirables: {
        Row: {
          created_at: string
          deleted_at: string | null
          entity_id: string
          entity_type: string
          expires_at: string
          id: string
          is_active: boolean
          kind: string
          label: string
          notes: string | null
          organization_id: string
          responsible_employee_id: string | null
          source_table: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          entity_id: string
          entity_type: string
          expires_at: string
          id?: string
          is_active?: boolean
          kind: string
          label: string
          notes?: string | null
          organization_id: string
          responsible_employee_id?: string | null
          source_table: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          entity_id?: string
          entity_type?: string
          expires_at?: string
          id?: string
          is_active?: boolean
          kind?: string
          label?: string
          notes?: string | null
          organization_id?: string
          responsible_employee_id?: string | null
          source_table?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "expirables_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expirables_responsible_employee_id_fkey"
            columns: ["responsible_employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      fault_reports: {
        Row: {
          created_at: string
          created_by: string | null
          deleted_at: string | null
          descriere: string
          equipment_id: string
          id: string
          intervention_id: string | null
          motiv_respingere: string | null
          opreste_functionarea: boolean
          organization_id: string
          raportat_de_employee_id: string | null
          raportat_la: string
          rezolvat_la: string | null
          status: Database["public"]["Enums"]["fault_status"]
          updated_at: string
          updated_by: string | null
          urgenta: Database["public"]["Enums"]["fault_urgency"]
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          descriere: string
          equipment_id: string
          id?: string
          intervention_id?: string | null
          motiv_respingere?: string | null
          opreste_functionarea?: boolean
          organization_id: string
          raportat_de_employee_id?: string | null
          raportat_la?: string
          rezolvat_la?: string | null
          status?: Database["public"]["Enums"]["fault_status"]
          updated_at?: string
          updated_by?: string | null
          urgenta?: Database["public"]["Enums"]["fault_urgency"]
        }
        Update: {
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          descriere?: string
          equipment_id?: string
          id?: string
          intervention_id?: string | null
          motiv_respingere?: string | null
          opreste_functionarea?: boolean
          organization_id?: string
          raportat_de_employee_id?: string | null
          raportat_la?: string
          rezolvat_la?: string | null
          status?: Database["public"]["Enums"]["fault_status"]
          updated_at?: string
          updated_by?: string | null
          urgenta?: Database["public"]["Enums"]["fault_urgency"]
        }
        Relationships: [
          {
            foreignKeyName: "fault_reports_equipment_id_fkey"
            columns: ["equipment_id"]
            isOneToOne: false
            referencedRelation: "equipment"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fault_reports_intervention_id_fkey"
            columns: ["intervention_id"]
            isOneToOne: false
            referencedRelation: "maintenance_interventions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fault_reports_org_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fault_reports_raportat_de_employee_id_fkey"
            columns: ["raportat_de_employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      features: {
        Row: {
          created_at: string
          denumire: string
          descriere: string | null
          feature_key: string
          grup: Database["public"]["Enums"]["feature_group"]
          icon: string
          is_core: boolean
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          denumire: string
          descriere?: string | null
          feature_key: string
          grup: Database["public"]["Enums"]["feature_group"]
          icon?: string
          is_core?: boolean
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          denumire?: string
          descriere?: string | null
          feature_key?: string
          grup?: Database["public"]["Enums"]["feature_group"]
          icon?: string
          is_core?: boolean
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      fire_extinguisher_checks: {
        Row: {
          cost: number | null
          created_at: string
          created_by: string | null
          data: string
          deleted_at: string | null
          executant: string | null
          extinguisher_id: string
          firma_autorizata: string | null
          id: string
          observatii: string | null
          organization_id: string
          rezultat: string
          tip_verificare: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          cost?: number | null
          created_at?: string
          created_by?: string | null
          data: string
          deleted_at?: string | null
          executant?: string | null
          extinguisher_id: string
          firma_autorizata?: string | null
          id?: string
          observatii?: string | null
          organization_id: string
          rezultat?: string
          tip_verificare: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          cost?: number | null
          created_at?: string
          created_by?: string | null
          data?: string
          deleted_at?: string | null
          executant?: string | null
          extinguisher_id?: string
          firma_autorizata?: string | null
          id?: string
          observatii?: string | null
          organization_id?: string
          rezultat?: string
          tip_verificare?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fire_extinguisher_checks_extinguisher_id_fkey"
            columns: ["extinguisher_id"]
            isOneToOne: false
            referencedRelation: "fire_extinguishers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fire_extinguisher_checks_org_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      fire_extinguishers: {
        Row: {
          cladire: string | null
          cod: string
          created_at: string
          created_by: string | null
          data_punerii_in_functiune: string | null
          deleted_at: string | null
          id: string
          locatie: string
          masa_kg: number | null
          organization_id: string
          producator: string | null
          scadenta_proba_presiune: string | null
          scadenta_reincarcare: string | null
          scadenta_verificare: string | null
          serie: string | null
          status: string
          tip: string
          ultima_proba_presiune: string | null
          ultima_reincarcare: string | null
          ultima_verificare: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          cladire?: string | null
          cod: string
          created_at?: string
          created_by?: string | null
          data_punerii_in_functiune?: string | null
          deleted_at?: string | null
          id?: string
          locatie: string
          masa_kg?: number | null
          organization_id: string
          producator?: string | null
          scadenta_proba_presiune?: string | null
          scadenta_reincarcare?: string | null
          scadenta_verificare?: string | null
          serie?: string | null
          status?: string
          tip: string
          ultima_proba_presiune?: string | null
          ultima_reincarcare?: string | null
          ultima_verificare?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          cladire?: string | null
          cod?: string
          created_at?: string
          created_by?: string | null
          data_punerii_in_functiune?: string | null
          deleted_at?: string | null
          id?: string
          locatie?: string
          masa_kg?: number | null
          organization_id?: string
          producator?: string | null
          scadenta_proba_presiune?: string | null
          scadenta_reincarcare?: string | null
          scadenta_verificare?: string | null
          serie?: string | null
          status?: string
          tip?: string
          ultima_proba_presiune?: string | null
          ultima_reincarcare?: string | null
          ultima_verificare?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fire_extinguishers_org_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      fuel_entries: {
        Row: {
          alimentat_la: string
          cost: number
          created_at: string
          created_by: string | null
          deleted_at: string | null
          fisier_bon_path: string | null
          id: string
          litri: number
          numar_bon: string | null
          observatii: string | null
          organization_id: string
          plin: boolean
          pret_litru: number | null
          statie: string | null
          trip_sheet_id: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          alimentat_la: string
          cost: number
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          fisier_bon_path?: string | null
          id?: string
          litri: number
          numar_bon?: string | null
          observatii?: string | null
          organization_id: string
          plin?: boolean
          pret_litru?: number | null
          statie?: string | null
          trip_sheet_id: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          alimentat_la?: string
          cost?: number
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          fisier_bon_path?: string | null
          id?: string
          litri?: number
          numar_bon?: string | null
          observatii?: string | null
          organization_id?: string
          plin?: boolean
          pret_litru?: number | null
          statie?: string | null
          trip_sheet_id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fuel_entries_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fuel_entries_trip_sheet_id_fkey"
            columns: ["trip_sheet_id"]
            isOneToOne: false
            referencedRelation: "trip_sheets"
            referencedColumns: ["id"]
          },
        ]
      }
      holiday_compensation: {
        Row: {
          acordata: boolean
          acordata_la: string | null
          created_at: string
          created_by: string | null
          data_sarbatorii: string
          data_zilei_libere: string | null
          deleted_at: string | null
          employee_id: string
          entry_id: string | null
          id: string
          observatii: string | null
          ore_lucrate: number
          organization_id: string
          spor_procent: number | null
          spor_valoare: number | null
          termen_acordare: string
          tip: Database["public"]["Enums"]["holiday_compensation_type"]
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          acordata?: boolean
          acordata_la?: string | null
          created_at?: string
          created_by?: string | null
          data_sarbatorii: string
          data_zilei_libere?: string | null
          deleted_at?: string | null
          employee_id: string
          entry_id?: string | null
          id?: string
          observatii?: string | null
          ore_lucrate: number
          organization_id: string
          spor_procent?: number | null
          spor_valoare?: number | null
          termen_acordare: string
          tip?: Database["public"]["Enums"]["holiday_compensation_type"]
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          acordata?: boolean
          acordata_la?: string | null
          created_at?: string
          created_by?: string | null
          data_sarbatorii?: string
          data_zilei_libere?: string | null
          deleted_at?: string | null
          employee_id?: string
          entry_id?: string | null
          id?: string
          observatii?: string | null
          ore_lucrate?: number
          organization_id?: string
          spor_procent?: number | null
          spor_valoare?: number | null
          termen_acordare?: string
          tip?: Database["public"]["Enums"]["holiday_compensation_type"]
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "holiday_compensation_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "holiday_compensation_entry_id_fkey"
            columns: ["entry_id"]
            isOneToOne: false
            referencedRelation: "attendance_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "holiday_compensation_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      hot_work_permits: {
        Row: {
          created_at: string
          created_by: string | null
          deleted_at: string | null
          emitent_employee_id: string | null
          executant_employee_id: string | null
          executant_extern: string | null
          id: string
          incheiat_la: string | null
          locul: string
          lucrare: string
          masuri: string
          numar: string
          organization_id: string
          status: string
          supraveghetor: string | null
          updated_at: string
          updated_by: string | null
          valabil_de_la: string
          valabil_pana: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          emitent_employee_id?: string | null
          executant_employee_id?: string | null
          executant_extern?: string | null
          id?: string
          incheiat_la?: string | null
          locul: string
          lucrare: string
          masuri: string
          numar: string
          organization_id: string
          status?: string
          supraveghetor?: string | null
          updated_at?: string
          updated_by?: string | null
          valabil_de_la: string
          valabil_pana: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          emitent_employee_id?: string | null
          executant_employee_id?: string | null
          executant_extern?: string | null
          id?: string
          incheiat_la?: string | null
          locul?: string
          lucrare?: string
          masuri?: string
          numar?: string
          organization_id?: string
          status?: string
          supraveghetor?: string | null
          updated_at?: string
          updated_by?: string | null
          valabil_de_la?: string
          valabil_pana?: string
        }
        Relationships: [
          {
            foreignKeyName: "hot_work_permits_emitent_employee_id_fkey"
            columns: ["emitent_employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hot_work_permits_executant_employee_id_fkey"
            columns: ["executant_employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hot_work_permits_org_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      hr_document_templates: {
        Row: {
          activ: boolean
          cod: string
          continut_html: string
          created_at: string
          created_by: string | null
          deleted_at: string | null
          denumire: string
          descriere: string | null
          id: string
          necesita_aprobare: boolean
          organization_id: string | null
          serie: string
          updated_at: string
          updated_by: string | null
          variabile: Json
        }
        Insert: {
          activ?: boolean
          cod: string
          continut_html: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          denumire: string
          descriere?: string | null
          id?: string
          necesita_aprobare?: boolean
          organization_id?: string | null
          serie?: string
          updated_at?: string
          updated_by?: string | null
          variabile?: Json
        }
        Update: {
          activ?: boolean
          cod?: string
          continut_html?: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          denumire?: string
          descriere?: string | null
          id?: string
          necesita_aprobare?: boolean
          organization_id?: string | null
          serie?: string
          updated_at?: string
          updated_by?: string | null
          variabile?: Json
        }
        Relationships: [
          {
            foreignKeyName: "hr_document_templates_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      hr_issued_documents: {
        Row: {
          anulat_la: string | null
          cod_verificare: string | null
          continut_checksum: string
          continut_html: string | null
          contract_id: string | null
          created_at: string
          created_by: string | null
          date_document: Json
          deleted_at: string | null
          emis_de: string | null
          emis_la: string
          employee_id: string
          fisier_path: string | null
          id: string
          motiv_anulare: string | null
          numar: number
          numar_afisat: string
          organization_id: string
          scop: string | null
          serie: string
          template_id: string | null
          titlu: string
          updated_at: string
          updated_by: string | null
          valabil_pana: string | null
        }
        Insert: {
          anulat_la?: string | null
          cod_verificare?: string | null
          continut_checksum: string
          continut_html?: string | null
          contract_id?: string | null
          created_at?: string
          created_by?: string | null
          date_document?: Json
          deleted_at?: string | null
          emis_de?: string | null
          emis_la?: string
          employee_id: string
          fisier_path?: string | null
          id?: string
          motiv_anulare?: string | null
          numar: number
          numar_afisat: string
          organization_id: string
          scop?: string | null
          serie: string
          template_id?: string | null
          titlu: string
          updated_at?: string
          updated_by?: string | null
          valabil_pana?: string | null
        }
        Update: {
          anulat_la?: string | null
          cod_verificare?: string | null
          continut_checksum?: string
          continut_html?: string | null
          contract_id?: string | null
          created_at?: string
          created_by?: string | null
          date_document?: Json
          deleted_at?: string | null
          emis_de?: string | null
          emis_la?: string
          employee_id?: string
          fisier_path?: string | null
          id?: string
          motiv_anulare?: string | null
          numar?: number
          numar_afisat?: string
          organization_id?: string
          scop?: string | null
          serie?: string
          template_id?: string | null
          titlu?: string
          updated_at?: string
          updated_by?: string | null
          valabil_pana?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "hr_issued_documents_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "employment_contracts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hr_issued_documents_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hr_issued_documents_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hr_issued_documents_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "hr_document_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_allocations: {
        Row: {
          confirmat_de_angajat_la: string | null
          created_at: string
          created_by: string | null
          deleted_at: string | null
          employee_id: string
          id: string
          item_id: string
          observatii: string | null
          organization_id: string
          predat_la: string
          pv_document_path: string | null
          returnat_la: string | null
          stare_la_predare: Database["public"]["Enums"]["inventory_item_stare"]
          stare_la_returnare:
            | Database["public"]["Enums"]["inventory_item_stare"]
            | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          confirmat_de_angajat_la?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          employee_id: string
          id?: string
          item_id: string
          observatii?: string | null
          organization_id: string
          predat_la?: string
          pv_document_path?: string | null
          returnat_la?: string | null
          stare_la_predare?: Database["public"]["Enums"]["inventory_item_stare"]
          stare_la_returnare?:
            | Database["public"]["Enums"]["inventory_item_stare"]
            | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          confirmat_de_angajat_la?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          employee_id?: string
          id?: string
          item_id?: string
          observatii?: string | null
          organization_id?: string
          predat_la?: string
          pv_document_path?: string | null
          returnat_la?: string | null
          stare_la_predare?: Database["public"]["Enums"]["inventory_item_stare"]
          stare_la_returnare?:
            | Database["public"]["Enums"]["inventory_item_stare"]
            | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "inventory_allocations_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_allocations_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "inventory_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_allocations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_categories: {
        Row: {
          activ: boolean
          cod: string
          created_at: string
          created_by: string | null
          deleted_at: string | null
          denumire: string
          descriere: string | null
          id: string
          ordine: number
          organization_id: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          activ?: boolean
          cod: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          denumire: string
          descriere?: string | null
          id?: string
          ordine?: number
          organization_id?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          activ?: boolean
          cod?: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          denumire?: string
          descriere?: string | null
          id?: string
          ordine?: number
          organization_id?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "inventory_categories_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_import_batches: {
        Row: {
          created_at: string
          created_by: string | null
          deleted_at: string | null
          erori: Json
          fisier_nume: string
          fisier_path: string | null
          id: string
          importat_de: string | null
          importat_la: string
          motiv_revocare: string | null
          organization_id: string
          randuri_esuate: number
          randuri_importate: number
          randuri_total: number
          revocat_de: string | null
          revocat_la: string | null
          status: Database["public"]["Enums"]["inventory_import_status"]
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          erori?: Json
          fisier_nume: string
          fisier_path?: string | null
          id?: string
          importat_de?: string | null
          importat_la?: string
          motiv_revocare?: string | null
          organization_id: string
          randuri_esuate?: number
          randuri_importate?: number
          randuri_total?: number
          revocat_de?: string | null
          revocat_la?: string | null
          status?: Database["public"]["Enums"]["inventory_import_status"]
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          erori?: Json
          fisier_nume?: string
          fisier_path?: string | null
          id?: string
          importat_de?: string | null
          importat_la?: string
          motiv_revocare?: string | null
          organization_id?: string
          randuri_esuate?: number
          randuri_importate?: number
          randuri_total?: number
          revocat_de?: string | null
          revocat_la?: string | null
          status?: Database["public"]["Enums"]["inventory_import_status"]
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "inventory_import_batches_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_items: {
        Row: {
          category_id: string | null
          created_at: string
          created_by: string | null
          data_achizitie: string | null
          denumire: string
          garantie_expira: string | null
          id: string
          import_batch_id: string | null
          locatie: string | null
          model: string | null
          numar_inventar: string
          observatii: string | null
          organization_id: string
          producator: string | null
          serie: string | null
          stare: Database["public"]["Enums"]["inventory_item_stare"]
          status: Database["public"]["Enums"]["inventory_item_status"]
          updated_at: string
          updated_by: string | null
          valoare: number | null
        }
        Insert: {
          category_id?: string | null
          created_at?: string
          created_by?: string | null
          data_achizitie?: string | null
          denumire: string
          garantie_expira?: string | null
          id?: string
          import_batch_id?: string | null
          locatie?: string | null
          model?: string | null
          numar_inventar: string
          observatii?: string | null
          organization_id: string
          producator?: string | null
          serie?: string | null
          stare?: Database["public"]["Enums"]["inventory_item_stare"]
          status?: Database["public"]["Enums"]["inventory_item_status"]
          updated_at?: string
          updated_by?: string | null
          valoare?: number | null
        }
        Update: {
          category_id?: string | null
          created_at?: string
          created_by?: string | null
          data_achizitie?: string | null
          denumire?: string
          garantie_expira?: string | null
          id?: string
          import_batch_id?: string | null
          locatie?: string | null
          model?: string | null
          numar_inventar?: string
          observatii?: string | null
          organization_id?: string
          producator?: string | null
          serie?: string | null
          stare?: Database["public"]["Enums"]["inventory_item_stare"]
          status?: Database["public"]["Enums"]["inventory_item_status"]
          updated_at?: string
          updated_by?: string | null
          valoare?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "inventory_items_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "inventory_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_items_import_batch_id_fkey"
            columns: ["import_batch_id"]
            isOneToOne: false
            referencedRelation: "inventory_import_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_items_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      invitations: {
        Row: {
          accepted_at: string | null
          accepted_by: string | null
          created_at: string
          created_by: string | null
          deleted_at: string | null
          email: string
          expires_at: string
          id: string
          invited_by: string | null
          nume: string | null
          organization_id: string
          prenume: string | null
          role: Database["public"]["Enums"]["app_role"]
          status: Database["public"]["Enums"]["invitation_status"]
          telefon: string | null
          token_hash: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          accepted_at?: string | null
          accepted_by?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          email: string
          expires_at: string
          id?: string
          invited_by?: string | null
          nume?: string | null
          organization_id: string
          prenume?: string | null
          role?: Database["public"]["Enums"]["app_role"]
          status?: Database["public"]["Enums"]["invitation_status"]
          telefon?: string | null
          token_hash: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          accepted_at?: string | null
          accepted_by?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          email?: string
          expires_at?: string
          id?: string
          invited_by?: string | null
          nume?: string | null
          organization_id?: string
          prenume?: string | null
          role?: Database["public"]["Enums"]["app_role"]
          status?: Database["public"]["Enums"]["invitation_status"]
          telefon?: string | null
          token_hash?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "invitations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      iscir_authorizations: {
        Row: {
          conditii: string | null
          created_at: string
          created_by: string | null
          deleted_at: string | null
          emis_la: string | null
          emitent: string
          equipment_id: string
          id: string
          numar: string
          organization_id: string
          scadenta_verificare_tehnica: string | null
          suspendata_la: string | null
          tip: string
          updated_at: string
          updated_by: string | null
          valabil_pana: string
        }
        Insert: {
          conditii?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          emis_la?: string | null
          emitent?: string
          equipment_id: string
          id?: string
          numar: string
          organization_id: string
          scadenta_verificare_tehnica?: string | null
          suspendata_la?: string | null
          tip: string
          updated_at?: string
          updated_by?: string | null
          valabil_pana: string
        }
        Update: {
          conditii?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          emis_la?: string | null
          emitent?: string
          equipment_id?: string
          id?: string
          numar?: string
          organization_id?: string
          scadenta_verificare_tehnica?: string | null
          suspendata_la?: string | null
          tip?: string
          updated_at?: string
          updated_by?: string | null
          valabil_pana?: string
        }
        Relationships: [
          {
            foreignKeyName: "iscir_authorizations_equipment_id_fkey"
            columns: ["equipment_id"]
            isOneToOne: false
            referencedRelation: "equipment"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "iscir_authorizations_org_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      job_descriptions: {
        Row: {
          activ: boolean
          atributii: Json
          competente: Json
          continut: string | null
          contract_id: string | null
          created_at: string
          created_by: string | null
          deleted_at: string | null
          employee_id: string | null
          fisier_path: string | null
          id: string
          job_position_id: string | null
          organization_id: string
          semnat_de_angajat: boolean
          semnat_la: string | null
          semnatura_ip: string | null
          subordonare: string | null
          titlu: string
          updated_at: string
          updated_by: string | null
          valabil_de_la: string
          valabil_pana: string | null
          versiune: number
        }
        Insert: {
          activ?: boolean
          atributii?: Json
          competente?: Json
          continut?: string | null
          contract_id?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          employee_id?: string | null
          fisier_path?: string | null
          id?: string
          job_position_id?: string | null
          organization_id: string
          semnat_de_angajat?: boolean
          semnat_la?: string | null
          semnatura_ip?: string | null
          subordonare?: string | null
          titlu: string
          updated_at?: string
          updated_by?: string | null
          valabil_de_la: string
          valabil_pana?: string | null
          versiune?: number
        }
        Update: {
          activ?: boolean
          atributii?: Json
          competente?: Json
          continut?: string | null
          contract_id?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          employee_id?: string | null
          fisier_path?: string | null
          id?: string
          job_position_id?: string | null
          organization_id?: string
          semnat_de_angajat?: boolean
          semnat_la?: string | null
          semnatura_ip?: string | null
          subordonare?: string | null
          titlu?: string
          updated_at?: string
          updated_by?: string | null
          valabil_de_la?: string
          valabil_pana?: string | null
          versiune?: number
        }
        Relationships: [
          {
            foreignKeyName: "job_descriptions_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "employment_contracts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_descriptions_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_descriptions_job_position_id_fkey"
            columns: ["job_position_id"]
            isOneToOne: false
            referencedRelation: "job_positions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_descriptions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      job_positions: {
        Row: {
          activ: boolean
          cod: string
          cod_cor: string | null
          created_at: string
          created_by: string | null
          deleted_at: string | null
          denumire: string
          descriere: string | null
          id: string
          nivel_studii: string | null
          organization_id: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          activ?: boolean
          cod: string
          cod_cor?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          denumire: string
          descriere?: string | null
          id?: string
          nivel_studii?: string | null
          organization_id: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          activ?: boolean
          cod?: string
          cod_cor?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          denumire?: string
          descriere?: string | null
          id?: string
          nivel_studii?: string | null
          organization_id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "job_positions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      leave_accruals: {
        Row: {
          an: number
          created_at: string
          created_by: string | null
          data_eveniment: string
          delta: number
          employee_id: string
          eveniment: Database["public"]["Enums"]["leave_accrual_event"]
          id: string
          leave_request_id: string | null
          leave_type_id: string
          motiv: string
          organization_id: string
          sold_dupa: number | null
        }
        Insert: {
          an: number
          created_at?: string
          created_by?: string | null
          data_eveniment?: string
          delta: number
          employee_id: string
          eveniment: Database["public"]["Enums"]["leave_accrual_event"]
          id?: string
          leave_request_id?: string | null
          leave_type_id: string
          motiv: string
          organization_id: string
          sold_dupa?: number | null
        }
        Update: {
          an?: number
          created_at?: string
          created_by?: string | null
          data_eveniment?: string
          delta?: number
          employee_id?: string
          eveniment?: Database["public"]["Enums"]["leave_accrual_event"]
          id?: string
          leave_request_id?: string | null
          leave_type_id?: string
          motiv?: string
          organization_id?: string
          sold_dupa?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "leave_accruals_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leave_accruals_leave_request_id_fkey"
            columns: ["leave_request_id"]
            isOneToOne: false
            referencedRelation: "leave_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leave_accruals_leave_type_id_fkey"
            columns: ["leave_type_id"]
            isOneToOne: false
            referencedRelation: "leave_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leave_accruals_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      leave_balances: {
        Row: {
          an: number
          created_at: string
          deleted_at: string | null
          drept_anual: number
          employee_id: string
          folosite: number
          id: string
          in_asteptare: number
          leave_type_id: string
          organization_id: string
          ramase: number | null
          reportate: number
          termen_folosire_reportate: string | null
          updated_at: string
        }
        Insert: {
          an: number
          created_at?: string
          deleted_at?: string | null
          drept_anual?: number
          employee_id: string
          folosite?: number
          id?: string
          in_asteptare?: number
          leave_type_id: string
          organization_id: string
          ramase?: number | null
          reportate?: number
          termen_folosire_reportate?: string | null
          updated_at?: string
        }
        Update: {
          an?: number
          created_at?: string
          deleted_at?: string | null
          drept_anual?: number
          employee_id?: string
          folosite?: number
          id?: string
          in_asteptare?: number
          leave_type_id?: string
          organization_id?: string
          ramase?: number | null
          reportate?: number
          termen_folosire_reportate?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "leave_balances_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leave_balances_leave_type_id_fkey"
            columns: ["leave_type_id"]
            isOneToOne: false
            referencedRelation: "leave_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leave_balances_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      leave_entitlement_rules: {
        Row: {
          activ: boolean
          categorie: string | null
          created_at: string
          deleted_at: string | null
          denumire: string
          department_id: string | null
          id: string
          job_position_id: string | null
          leave_type_id: string
          organization_id: string
          temei_legal: string | null
          tip_criteriu: Database["public"]["Enums"]["leave_rule_criterion"]
          updated_at: string
          valabil_de_la: string
          valabil_pana_la: string | null
          valoare_text: string | null
          vechime_ani_min: number | null
          zile_suplimentare: number
        }
        Insert: {
          activ?: boolean
          categorie?: string | null
          created_at?: string
          deleted_at?: string | null
          denumire: string
          department_id?: string | null
          id?: string
          job_position_id?: string | null
          leave_type_id: string
          organization_id: string
          temei_legal?: string | null
          tip_criteriu: Database["public"]["Enums"]["leave_rule_criterion"]
          updated_at?: string
          valabil_de_la?: string
          valabil_pana_la?: string | null
          valoare_text?: string | null
          vechime_ani_min?: number | null
          zile_suplimentare: number
        }
        Update: {
          activ?: boolean
          categorie?: string | null
          created_at?: string
          deleted_at?: string | null
          denumire?: string
          department_id?: string | null
          id?: string
          job_position_id?: string | null
          leave_type_id?: string
          organization_id?: string
          temei_legal?: string | null
          tip_criteriu?: Database["public"]["Enums"]["leave_rule_criterion"]
          updated_at?: string
          valabil_de_la?: string
          valabil_pana_la?: string | null
          valoare_text?: string | null
          vechime_ani_min?: number | null
          zile_suplimentare?: number
        }
        Relationships: [
          {
            foreignKeyName: "leave_entitlement_rules_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leave_entitlement_rules_job_position_id_fkey"
            columns: ["job_position_id"]
            isOneToOne: false
            referencedRelation: "job_positions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leave_entitlement_rules_leave_type_id_fkey"
            columns: ["leave_type_id"]
            isOneToOne: false
            referencedRelation: "leave_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leave_entitlement_rules_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      leave_request_days: {
        Row: {
          created_at: string
          data: string
          este_lucratoare: boolean
          id: string
          leave_request_id: string
          organization_id: string
          portiune: Database["public"]["Enums"]["leave_day_portion"]
          status: Database["public"]["Enums"]["leave_request_status"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          data: string
          este_lucratoare?: boolean
          id?: string
          leave_request_id: string
          organization_id: string
          portiune?: Database["public"]["Enums"]["leave_day_portion"]
          status?: Database["public"]["Enums"]["leave_request_status"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          data?: string
          este_lucratoare?: boolean
          id?: string
          leave_request_id?: string
          organization_id?: string
          portiune?: Database["public"]["Enums"]["leave_day_portion"]
          status?: Database["public"]["Enums"]["leave_request_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "leave_request_days_leave_request_id_fkey"
            columns: ["leave_request_id"]
            isOneToOne: false
            referencedRelation: "leave_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leave_request_days_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      leave_requests: {
        Row: {
          atasament_path: string | null
          created_at: string
          created_by: string | null
          data_inceput: string
          data_sfarsit: string
          decis_de: string | null
          decis_la: string | null
          deleted_at: string | null
          employee_id: string
          flow_id: string | null
          id: string
          intrerupe_alte_concedii: boolean
          leave_type_id: string
          leave_variant_id: string | null
          medical_code_id: string | null
          motiv: string | null
          motiv_respingere: string | null
          numar_certificat: string | null
          organization_id: string
          pas_curent: number
          portiune_inceput: Database["public"]["Enums"]["leave_day_portion"]
          portiune_sfarsit: Database["public"]["Enums"]["leave_day_portion"]
          serie_certificat: string | null
          status: Database["public"]["Enums"]["leave_request_status"]
          trimisa_la: string | null
          updated_at: string
          zile_calendaristice: number
          zile_lucratoare: number
        }
        Insert: {
          atasament_path?: string | null
          created_at?: string
          created_by?: string | null
          data_inceput: string
          data_sfarsit: string
          decis_de?: string | null
          decis_la?: string | null
          deleted_at?: string | null
          employee_id: string
          flow_id?: string | null
          id?: string
          intrerupe_alte_concedii?: boolean
          leave_type_id: string
          leave_variant_id?: string | null
          medical_code_id?: string | null
          motiv?: string | null
          motiv_respingere?: string | null
          numar_certificat?: string | null
          organization_id: string
          pas_curent?: number
          portiune_inceput?: Database["public"]["Enums"]["leave_day_portion"]
          portiune_sfarsit?: Database["public"]["Enums"]["leave_day_portion"]
          serie_certificat?: string | null
          status?: Database["public"]["Enums"]["leave_request_status"]
          trimisa_la?: string | null
          updated_at?: string
          zile_calendaristice?: number
          zile_lucratoare?: number
        }
        Update: {
          atasament_path?: string | null
          created_at?: string
          created_by?: string | null
          data_inceput?: string
          data_sfarsit?: string
          decis_de?: string | null
          decis_la?: string | null
          deleted_at?: string | null
          employee_id?: string
          flow_id?: string | null
          id?: string
          intrerupe_alte_concedii?: boolean
          leave_type_id?: string
          leave_variant_id?: string | null
          medical_code_id?: string | null
          motiv?: string | null
          motiv_respingere?: string | null
          numar_certificat?: string | null
          organization_id?: string
          pas_curent?: number
          portiune_inceput?: Database["public"]["Enums"]["leave_day_portion"]
          portiune_sfarsit?: Database["public"]["Enums"]["leave_day_portion"]
          serie_certificat?: string | null
          status?: Database["public"]["Enums"]["leave_request_status"]
          trimisa_la?: string | null
          updated_at?: string
          zile_calendaristice?: number
          zile_lucratoare?: number
        }
        Relationships: [
          {
            foreignKeyName: "leave_requests_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leave_requests_flow_id_fkey"
            columns: ["flow_id"]
            isOneToOne: false
            referencedRelation: "approval_flows"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leave_requests_leave_type_id_fkey"
            columns: ["leave_type_id"]
            isOneToOne: false
            referencedRelation: "leave_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leave_requests_leave_variant_id_fkey"
            columns: ["leave_variant_id"]
            isOneToOne: false
            referencedRelation: "leave_type_variants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leave_requests_medical_code_id_fkey"
            columns: ["medical_code_id"]
            isOneToOne: false
            referencedRelation: "medical_leave_codes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leave_requests_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      leave_type_variants: {
        Row: {
          activ: boolean
          cod: string
          conditie_descriere: string
          conditie_tip: Database["public"]["Enums"]["leave_variant_condition"]
          created_at: string
          created_by: string | null
          deleted_at: string | null
          denumire: string
          id: string
          leave_type_key: string
          necesita_document: boolean
          ordine: number
          organization_id: string | null
          temei_legal: string | null
          updated_at: string
          updated_by: string | null
          zile: number
        }
        Insert: {
          activ?: boolean
          cod: string
          conditie_descriere: string
          conditie_tip: Database["public"]["Enums"]["leave_variant_condition"]
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          denumire: string
          id?: string
          leave_type_key: string
          necesita_document?: boolean
          ordine?: number
          organization_id?: string | null
          temei_legal?: string | null
          updated_at?: string
          updated_by?: string | null
          zile: number
        }
        Update: {
          activ?: boolean
          cod?: string
          conditie_descriere?: string
          conditie_tip?: Database["public"]["Enums"]["leave_variant_condition"]
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          denumire?: string
          id?: string
          leave_type_key?: string
          necesita_document?: boolean
          ordine?: number
          organization_id?: string | null
          temei_legal?: string | null
          updated_at?: string
          updated_by?: string | null
          zile?: number
        }
        Relationships: [
          {
            foreignKeyName: "leave_type_variants_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      leave_types: {
        Row: {
          activ: boolean
          created_at: string
          culoare: string
          deleted_at: string | null
          denumire: string
          id: string
          intrerupe_alte_concedii: boolean
          key: string
          mod_rotunjire_acumulare: Database["public"]["Enums"]["leave_rounding_mode"]
          necesita_document: boolean
          organization_id: string
          plafon_anual_zile: number | null
          plafon_reportare_zile: number | null
          reglementat: boolean
          scade_din_sold: boolean
          se_reporteaza: boolean
          temei_legal: string | null
          termen_reportare: number | null
          tip_zi_pontaj: Database["public"]["Enums"]["attendance_day_type"]
          updated_at: string
          valabil_de_la: string
          zile_implicite: number
        }
        Insert: {
          activ?: boolean
          created_at?: string
          culoare?: string
          deleted_at?: string | null
          denumire: string
          id?: string
          intrerupe_alte_concedii?: boolean
          key: string
          mod_rotunjire_acumulare?: Database["public"]["Enums"]["leave_rounding_mode"]
          necesita_document?: boolean
          organization_id: string
          plafon_anual_zile?: number | null
          plafon_reportare_zile?: number | null
          reglementat?: boolean
          scade_din_sold?: boolean
          se_reporteaza?: boolean
          temei_legal?: string | null
          termen_reportare?: number | null
          tip_zi_pontaj?: Database["public"]["Enums"]["attendance_day_type"]
          updated_at?: string
          valabil_de_la?: string
          zile_implicite?: number
        }
        Update: {
          activ?: boolean
          created_at?: string
          culoare?: string
          deleted_at?: string | null
          denumire?: string
          id?: string
          intrerupe_alte_concedii?: boolean
          key?: string
          mod_rotunjire_acumulare?: Database["public"]["Enums"]["leave_rounding_mode"]
          necesita_document?: boolean
          organization_id?: string
          plafon_anual_zile?: number | null
          plafon_reportare_zile?: number | null
          reglementat?: boolean
          scade_din_sold?: boolean
          se_reporteaza?: boolean
          temei_legal?: string | null
          termen_reportare?: number | null
          tip_zi_pontaj?: Database["public"]["Enums"]["attendance_day_type"]
          updated_at?: string
          valabil_de_la?: string
          zile_implicite?: number
        }
        Relationships: [
          {
            foreignKeyName: "leave_types_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      maintenance_interventions: {
        Row: {
          citire_contor: number | null
          cost_manopera: number
          cost_piese: number
          cost_total: number | null
          created_at: string
          created_by: string | null
          data: string
          deleted_at: string | null
          descriere: string
          durata_ore: number | null
          equipment_id: string
          executant_employee_id: string | null
          executant_extern: string | null
          id: string
          observatii: string | null
          oprire_minute: number | null
          ora_start: string | null
          organization_id: string
          piese: string | null
          plan_id: string | null
          rezultat: Database["public"]["Enums"]["maintenance_result"]
          tip: Database["public"]["Enums"]["maintenance_kind"]
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          citire_contor?: number | null
          cost_manopera?: number
          cost_piese?: number
          cost_total?: number | null
          created_at?: string
          created_by?: string | null
          data: string
          deleted_at?: string | null
          descriere: string
          durata_ore?: number | null
          equipment_id: string
          executant_employee_id?: string | null
          executant_extern?: string | null
          id?: string
          observatii?: string | null
          oprire_minute?: number | null
          ora_start?: string | null
          organization_id: string
          piese?: string | null
          plan_id?: string | null
          rezultat?: Database["public"]["Enums"]["maintenance_result"]
          tip?: Database["public"]["Enums"]["maintenance_kind"]
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          citire_contor?: number | null
          cost_manopera?: number
          cost_piese?: number
          cost_total?: number | null
          created_at?: string
          created_by?: string | null
          data?: string
          deleted_at?: string | null
          descriere?: string
          durata_ore?: number | null
          equipment_id?: string
          executant_employee_id?: string | null
          executant_extern?: string | null
          id?: string
          observatii?: string | null
          oprire_minute?: number | null
          ora_start?: string | null
          organization_id?: string
          piese?: string | null
          plan_id?: string | null
          rezultat?: Database["public"]["Enums"]["maintenance_result"]
          tip?: Database["public"]["Enums"]["maintenance_kind"]
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "maintenance_interventions_equipment_id_fkey"
            columns: ["equipment_id"]
            isOneToOne: false
            referencedRelation: "equipment"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "maintenance_interventions_executant_employee_id_fkey"
            columns: ["executant_employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "maintenance_interventions_org_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "maintenance_interventions_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "maintenance_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      maintenance_plans: {
        Row: {
          activ: boolean
          created_at: string
          created_by: string | null
          deleted_at: string | null
          denumire: string
          equipment_id: string
          id: string
          instructiuni: string | null
          organization_id: string
          periodicitate_contor: number | null
          periodicitate_zile: number | null
          responsabil_employee_id: string | null
          tip: Database["public"]["Enums"]["maintenance_kind"]
          tip_contor: Database["public"]["Enums"]["meter_kind"] | null
          ultima_citire_contor: number | null
          ultima_executie: string | null
          updated_at: string
          updated_by: string | null
          urmatoarea_scadenta: string | null
          urmatoarea_scadenta_contor: number | null
        }
        Insert: {
          activ?: boolean
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          denumire: string
          equipment_id: string
          id?: string
          instructiuni?: string | null
          organization_id: string
          periodicitate_contor?: number | null
          periodicitate_zile?: number | null
          responsabil_employee_id?: string | null
          tip?: Database["public"]["Enums"]["maintenance_kind"]
          tip_contor?: Database["public"]["Enums"]["meter_kind"] | null
          ultima_citire_contor?: number | null
          ultima_executie?: string | null
          updated_at?: string
          updated_by?: string | null
          urmatoarea_scadenta?: string | null
          urmatoarea_scadenta_contor?: number | null
        }
        Update: {
          activ?: boolean
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          denumire?: string
          equipment_id?: string
          id?: string
          instructiuni?: string | null
          organization_id?: string
          periodicitate_contor?: number | null
          periodicitate_zile?: number | null
          responsabil_employee_id?: string | null
          tip?: Database["public"]["Enums"]["maintenance_kind"]
          tip_contor?: Database["public"]["Enums"]["meter_kind"] | null
          ultima_citire_contor?: number | null
          ultima_executie?: string | null
          updated_at?: string
          updated_by?: string | null
          urmatoarea_scadenta?: string | null
          urmatoarea_scadenta_contor?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "maintenance_plans_equipment_id_fkey"
            columns: ["equipment_id"]
            isOneToOne: false
            referencedRelation: "equipment"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "maintenance_plans_org_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "maintenance_plans_responsabil_employee_id_fkey"
            columns: ["responsabil_employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      medical_leave_codes: {
        Row: {
          cod: string
          created_at: string
          deleted_at: string | null
          denumire: string
          id: string
          luni_baza_calcul: number
          plafon_salarii_minime: number | null
          platitor: Database["public"]["Enums"]["medical_payer"]
          procent: number
          temei_legal: string | null
          updated_at: string
          valabil_de_la: string
          valabil_pana_la: string | null
          zile_angajator: number
        }
        Insert: {
          cod: string
          created_at?: string
          deleted_at?: string | null
          denumire: string
          id?: string
          luni_baza_calcul?: number
          plafon_salarii_minime?: number | null
          platitor: Database["public"]["Enums"]["medical_payer"]
          procent: number
          temei_legal?: string | null
          updated_at?: string
          valabil_de_la: string
          valabil_pana_la?: string | null
          zile_angajator?: number
        }
        Update: {
          cod?: string
          created_at?: string
          deleted_at?: string | null
          denumire?: string
          id?: string
          luni_baza_calcul?: number
          plafon_salarii_minime?: number | null
          platitor?: Database["public"]["Enums"]["medical_payer"]
          procent?: number
          temei_legal?: string | null
          updated_at?: string
          valabil_de_la?: string
          valabil_pana_la?: string | null
          zile_angajator?: number
        }
        Relationships: []
      }
      notification_preferences: {
        Row: {
          created_at: string
          created_by: string | null
          deleted_at: string | null
          email: boolean
          id: string
          in_app: boolean
          kind: Database["public"]["Enums"]["notification_kind"]
          organization_id: string
          updated_at: string
          updated_by: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          email?: boolean
          id?: string
          in_app?: boolean
          kind: Database["public"]["Enums"]["notification_kind"]
          organization_id: string
          updated_at?: string
          updated_by?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          email?: boolean
          id?: string
          in_app?: boolean
          kind?: Database["public"]["Enums"]["notification_kind"]
          organization_id?: string
          updated_at?: string
          updated_by?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notification_preferences_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          body: string | null
          created_at: string
          created_by: string | null
          deleted_at: string | null
          entity_id: string | null
          entity_type: string | null
          id: string
          kind: Database["public"]["Enums"]["notification_kind"]
          link: string | null
          organization_id: string
          read_at: string | null
          sent_email_at: string | null
          title: string
          updated_at: string
          updated_by: string | null
          user_id: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          kind?: Database["public"]["Enums"]["notification_kind"]
          link?: string | null
          organization_id: string
          read_at?: string | null
          sent_email_at?: string | null
          title: string
          updated_at?: string
          updated_by?: string | null
          user_id: string
        }
        Update: {
          body?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          kind?: Database["public"]["Enums"]["notification_kind"]
          link?: string | null
          organization_id?: string
          read_at?: string | null
          sent_email_at?: string | null
          title?: string
          updated_at?: string
          updated_by?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      occupational_diseases: {
        Row: {
          created_at: string
          created_by: string | null
          data_confirmarii: string | null
          data_semnalarii: string
          deleted_at: string | null
          denumire_boala: string | null
          employee_id: string
          id: string
          masuri: string | null
          noxa_profesionala: string
          numar_fisa_bp: string | null
          organization_id: string
          unitate_sanitara: string | null
          updated_at: string
          updated_by: string | null
          zile_incapacitate: number
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          data_confirmarii?: string | null
          data_semnalarii: string
          deleted_at?: string | null
          denumire_boala?: string | null
          employee_id: string
          id?: string
          masuri?: string | null
          noxa_profesionala: string
          numar_fisa_bp?: string | null
          organization_id: string
          unitate_sanitara?: string | null
          updated_at?: string
          updated_by?: string | null
          zile_incapacitate?: number
        }
        Update: {
          created_at?: string
          created_by?: string | null
          data_confirmarii?: string | null
          data_semnalarii?: string
          deleted_at?: string | null
          denumire_boala?: string | null
          employee_id?: string
          id?: string
          masuri?: string | null
          noxa_profesionala?: string
          numar_fisa_bp?: string | null
          organization_id?: string
          unitate_sanitara?: string | null
          updated_at?: string
          updated_by?: string | null
          zile_incapacitate?: number
        }
        Relationships: [
          {
            foreignKeyName: "occupational_diseases_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "occupational_diseases_org_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      occupational_health_exams: {
        Row: {
          cost: number | null
          created_at: string
          created_by: string | null
          data_examinarii: string
          deleted_at: string | null
          employee_id: string
          id: string
          medic: string | null
          numar_fisa: string | null
          observatii: string | null
          organization_id: string
          rezultat: Database["public"]["Enums"]["ssm_exam_result"]
          tip: Database["public"]["Enums"]["ssm_exam_type"]
          unitate_medicala: string | null
          updated_at: string
          updated_by: string | null
          valabil_pana: string | null
        }
        Insert: {
          cost?: number | null
          created_at?: string
          created_by?: string | null
          data_examinarii: string
          deleted_at?: string | null
          employee_id: string
          id?: string
          medic?: string | null
          numar_fisa?: string | null
          observatii?: string | null
          organization_id: string
          rezultat: Database["public"]["Enums"]["ssm_exam_result"]
          tip: Database["public"]["Enums"]["ssm_exam_type"]
          unitate_medicala?: string | null
          updated_at?: string
          updated_by?: string | null
          valabil_pana?: string | null
        }
        Update: {
          cost?: number | null
          created_at?: string
          created_by?: string | null
          data_examinarii?: string
          deleted_at?: string | null
          employee_id?: string
          id?: string
          medic?: string | null
          numar_fisa?: string | null
          observatii?: string | null
          organization_id?: string
          rezultat?: Database["public"]["Enums"]["ssm_exam_result"]
          tip?: Database["public"]["Enums"]["ssm_exam_type"]
          unitate_medicala?: string | null
          updated_at?: string
          updated_by?: string | null
          valabil_pana?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "occupational_health_exams_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "occupational_health_exams_org_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      odometer_anomalies: {
        Row: {
          confirmat_de: string | null
          confirmat_la: string | null
          created_at: string
          deleted_at: string | null
          diferenta: number | null
          explicatie: string | null
          id: string
          km_asteptat: number
          km_declarat: number
          nota: string | null
          organization_id: string
          tip: Database["public"]["Enums"]["odometer_anomaly_type"]
          trip_sheet_id: string | null
          updated_at: string
          updated_by: string | null
          vehicle_id: string
        }
        Insert: {
          confirmat_de?: string | null
          confirmat_la?: string | null
          created_at?: string
          deleted_at?: string | null
          diferenta?: number | null
          explicatie?: string | null
          id?: string
          km_asteptat: number
          km_declarat: number
          nota?: string | null
          organization_id: string
          tip: Database["public"]["Enums"]["odometer_anomaly_type"]
          trip_sheet_id?: string | null
          updated_at?: string
          updated_by?: string | null
          vehicle_id: string
        }
        Update: {
          confirmat_de?: string | null
          confirmat_la?: string | null
          created_at?: string
          deleted_at?: string | null
          diferenta?: number | null
          explicatie?: string | null
          id?: string
          km_asteptat?: number
          km_declarat?: number
          nota?: string | null
          organization_id?: string
          tip?: Database["public"]["Enums"]["odometer_anomaly_type"]
          trip_sheet_id?: string | null
          updated_at?: string
          updated_by?: string | null
          vehicle_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "odometer_anomalies_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "odometer_anomalies_trip_sheet_id_fkey"
            columns: ["trip_sheet_id"]
            isOneToOne: false
            referencedRelation: "trip_sheets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "odometer_anomalies_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_bank_accounts: {
        Row: {
          activ: boolean
          banca: string
          created_at: string
          created_by: string | null
          deleted_at: string | null
          este_principal: boolean
          iban: string
          id: string
          moneda: string
          observatii: string | null
          organization_id: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          activ?: boolean
          banca: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          este_principal?: boolean
          iban: string
          id?: string
          moneda?: string
          observatii?: string | null
          organization_id: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          activ?: boolean
          banca?: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          este_principal?: boolean
          iban?: string
          id?: string
          moneda?: string
          observatii?: string | null
          organization_id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "organization_bank_accounts_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_branding: {
        Row: {
          created_at: string
          created_by: string | null
          deleted_at: string | null
          denumire_afisata: string | null
          favicon_path: string | null
          logo_dark_path: string | null
          logo_light_path: string | null
          organization_id: string
          primary_color: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          denumire_afisata?: string | null
          favicon_path?: string | null
          logo_dark_path?: string | null
          logo_light_path?: string | null
          organization_id: string
          primary_color?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          denumire_afisata?: string | null
          favicon_path?: string | null
          logo_dark_path?: string | null
          logo_light_path?: string | null
          organization_id?: string
          primary_color?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "organization_branding_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: true
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_features: {
        Row: {
          activated_at: string | null
          activated_by: string | null
          created_at: string
          created_by: string | null
          deleted_at: string | null
          enabled: boolean
          feature_key: string
          id: string
          organization_id: string
          settings: Json
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          activated_at?: string | null
          activated_by?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          enabled?: boolean
          feature_key: string
          id?: string
          organization_id: string
          settings?: Json
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          activated_at?: string | null
          activated_by?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          enabled?: boolean
          feature_key?: string
          id?: string
          organization_id?: string
          settings?: Json
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "organization_features_feature_key_fkey"
            columns: ["feature_key"]
            isOneToOne: false
            referencedRelation: "features"
            referencedColumns: ["feature_key"]
          },
          {
            foreignKeyName: "organization_features_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_holidays: {
        Row: {
          created_at: string
          created_by: string | null
          data: string
          deleted_at: string | null
          denumire: string
          id: string
          observatii: string | null
          organization_id: string
          tip: Database["public"]["Enums"]["org_holiday_kind"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          data: string
          deleted_at?: string | null
          denumire: string
          id?: string
          observatii?: string | null
          organization_id: string
          tip?: Database["public"]["Enums"]["org_holiday_kind"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          data?: string
          deleted_at?: string | null
          denumire?: string
          id?: string
          observatii?: string | null
          organization_id?: string
          tip?: Database["public"]["Enums"]["org_holiday_kind"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_holidays_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_members: {
        Row: {
          created_at: string
          created_by: string | null
          deactivated_at: string | null
          deactivated_by: string | null
          deleted_at: string | null
          id: string
          invitation_id: string | null
          invited_by: string | null
          job_title: string | null
          joined_at: string
          organization_id: string
          role: Database["public"]["Enums"]["app_role"]
          status: Database["public"]["Enums"]["member_status"]
          updated_at: string
          updated_by: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          deactivated_at?: string | null
          deactivated_by?: string | null
          deleted_at?: string | null
          id?: string
          invitation_id?: string | null
          invited_by?: string | null
          job_title?: string | null
          joined_at?: string
          organization_id: string
          role?: Database["public"]["Enums"]["app_role"]
          status?: Database["public"]["Enums"]["member_status"]
          updated_at?: string
          updated_by?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          deactivated_at?: string | null
          deactivated_by?: string | null
          deleted_at?: string | null
          id?: string
          invitation_id?: string | null
          invited_by?: string | null
          job_title?: string | null
          joined_at?: string
          organization_id?: string
          role?: Database["public"]["Enums"]["app_role"]
          status?: Database["public"]["Enums"]["member_status"]
          updated_at?: string
          updated_by?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_members_invitation_id_fkey"
            columns: ["invitation_id"]
            isOneToOne: false
            referencedRelation: "invitations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organization_members_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_sensitive_data: {
        Row: {
          cnp_ciphertext: string | null
          cnp_hash: string | null
          cnp_iv: string | null
          cnp_key_version: number | null
          cnp_last4: string | null
          cnp_tag: string | null
          created_at: string
          created_by: string | null
          deleted_at: string | null
          organization_id: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          cnp_ciphertext?: string | null
          cnp_hash?: string | null
          cnp_iv?: string | null
          cnp_key_version?: number | null
          cnp_last4?: string | null
          cnp_tag?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          organization_id: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          cnp_ciphertext?: string | null
          cnp_hash?: string | null
          cnp_iv?: string | null
          cnp_key_version?: number | null
          cnp_last4?: string | null
          cnp_tag?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          organization_id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "organization_sensitive_data_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: true
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          activated_at: string | null
          adresa: string | null
          capital_social: number | null
          cod_caen: string | null
          cod_caen_secundare: string[]
          cod_postal: string | null
          created_at: string
          created_by: string | null
          cui: string
          cui_normalizat: string | null
          deleted_at: string | null
          email_contact: string | null
          forma_juridica: string | null
          functie_reprezentant_legal: string | null
          id: string
          judet: string | null
          legal_name: string | null
          locale: Database["public"]["Enums"]["locale_code"]
          moneda: string
          name: string
          oras: string | null
          plan: Database["public"]["Enums"]["plan_type"]
          platitor_tva: boolean
          reg_com: string | null
          reprezentant_legal: string | null
          seats_limit: number
          sector: string | null
          slug: string
          ssm_furnizor_extern: string | null
          ssm_persoana_responsabila: string | null
          status: Database["public"]["Enums"]["organization_status"]
          subscription_status: Database["public"]["Enums"]["subscription_status_type"]
          suspended_at: string | null
          suspended_reason: string | null
          tara: string
          telefon_contact: string | null
          timezone: string
          trial_ends_at: string | null
          updated_at: string
          updated_by: string | null
          website: string | null
          zile_concediu_anual_implicit: number
        }
        Insert: {
          activated_at?: string | null
          adresa?: string | null
          capital_social?: number | null
          cod_caen?: string | null
          cod_caen_secundare?: string[]
          cod_postal?: string | null
          created_at?: string
          created_by?: string | null
          cui: string
          cui_normalizat?: string | null
          deleted_at?: string | null
          email_contact?: string | null
          forma_juridica?: string | null
          functie_reprezentant_legal?: string | null
          id?: string
          judet?: string | null
          legal_name?: string | null
          locale?: Database["public"]["Enums"]["locale_code"]
          moneda?: string
          name: string
          oras?: string | null
          plan?: Database["public"]["Enums"]["plan_type"]
          platitor_tva?: boolean
          reg_com?: string | null
          reprezentant_legal?: string | null
          seats_limit?: number
          sector?: string | null
          slug: string
          ssm_furnizor_extern?: string | null
          ssm_persoana_responsabila?: string | null
          status?: Database["public"]["Enums"]["organization_status"]
          subscription_status?: Database["public"]["Enums"]["subscription_status_type"]
          suspended_at?: string | null
          suspended_reason?: string | null
          tara?: string
          telefon_contact?: string | null
          timezone?: string
          trial_ends_at?: string | null
          updated_at?: string
          updated_by?: string | null
          website?: string | null
          zile_concediu_anual_implicit?: number
        }
        Update: {
          activated_at?: string | null
          adresa?: string | null
          capital_social?: number | null
          cod_caen?: string | null
          cod_caen_secundare?: string[]
          cod_postal?: string | null
          created_at?: string
          created_by?: string | null
          cui?: string
          cui_normalizat?: string | null
          deleted_at?: string | null
          email_contact?: string | null
          forma_juridica?: string | null
          functie_reprezentant_legal?: string | null
          id?: string
          judet?: string | null
          legal_name?: string | null
          locale?: Database["public"]["Enums"]["locale_code"]
          moneda?: string
          name?: string
          oras?: string | null
          plan?: Database["public"]["Enums"]["plan_type"]
          platitor_tva?: boolean
          reg_com?: string | null
          reprezentant_legal?: string | null
          seats_limit?: number
          sector?: string | null
          slug?: string
          ssm_furnizor_extern?: string | null
          ssm_persoana_responsabila?: string | null
          status?: Database["public"]["Enums"]["organization_status"]
          subscription_status?: Database["public"]["Enums"]["subscription_status_type"]
          suspended_at?: string | null
          suspended_reason?: string | null
          tara?: string
          telefon_contact?: string | null
          timezone?: string
          trial_ends_at?: string | null
          updated_at?: string
          updated_by?: string | null
          website?: string | null
          zile_concediu_anual_implicit?: number
        }
        Relationships: []
      }
      overtime_compensation: {
        Row: {
          created_at: string
          created_by: string | null
          data_generarii: string
          deleted_at: string | null
          employee_id: string
          entry_id: string | null
          id: string
          leave_request_id: string | null
          observatii: string | null
          ore: number
          ore_expirate: number
          ore_folosite: number
          organization_id: string
          termen_folosire: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          data_generarii: string
          deleted_at?: string | null
          employee_id: string
          entry_id?: string | null
          id?: string
          leave_request_id?: string | null
          observatii?: string | null
          ore: number
          ore_expirate?: number
          ore_folosite?: number
          organization_id: string
          termen_folosire: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          data_generarii?: string
          deleted_at?: string | null
          employee_id?: string
          entry_id?: string | null
          id?: string
          leave_request_id?: string | null
          observatii?: string | null
          ore?: number
          ore_expirate?: number
          ore_folosite?: number
          organization_id?: string
          termen_folosire?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "overtime_compensation_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "overtime_compensation_entry_id_fkey"
            columns: ["entry_id"]
            isOneToOne: false
            referencedRelation: "attendance_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "overtime_compensation_leave_request_id_fkey"
            columns: ["leave_request_id"]
            isOneToOne: false
            referencedRelation: "leave_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "overtime_compensation_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      payroll_bonus_rules: {
        Row: {
          activ: boolean
          bonus_type: Database["public"]["Enums"]["payroll_bonus_type"]
          cod: string
          created_at: string
          created_by: string | null
          deleted_at: string | null
          denumire: string
          department_id: string | null
          id: string
          impozabil: boolean
          job_position_id: string | null
          kind: Database["public"]["Enums"]["bonus_rule_kind"]
          luni: number[]
          nivel_incadrare: string | null
          organization_id: string
          procent: number | null
          suma: number | null
          supus_contributii: boolean
          tip_criteriu: Database["public"]["Enums"]["bonus_rule_criterion"]
          updated_at: string
          updated_by: string | null
          valabil_de_la: string
          valabil_pana: string | null
          vechime_ani_min: number | null
        }
        Insert: {
          activ?: boolean
          bonus_type?: Database["public"]["Enums"]["payroll_bonus_type"]
          cod: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          denumire: string
          department_id?: string | null
          id?: string
          impozabil?: boolean
          job_position_id?: string | null
          kind: Database["public"]["Enums"]["bonus_rule_kind"]
          luni?: number[]
          nivel_incadrare?: string | null
          organization_id: string
          procent?: number | null
          suma?: number | null
          supus_contributii?: boolean
          tip_criteriu?: Database["public"]["Enums"]["bonus_rule_criterion"]
          updated_at?: string
          updated_by?: string | null
          valabil_de_la: string
          valabil_pana?: string | null
          vechime_ani_min?: number | null
        }
        Update: {
          activ?: boolean
          bonus_type?: Database["public"]["Enums"]["payroll_bonus_type"]
          cod?: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          denumire?: string
          department_id?: string | null
          id?: string
          impozabil?: boolean
          job_position_id?: string | null
          kind?: Database["public"]["Enums"]["bonus_rule_kind"]
          luni?: number[]
          nivel_incadrare?: string | null
          organization_id?: string
          procent?: number | null
          suma?: number | null
          supus_contributii?: boolean
          tip_criteriu?: Database["public"]["Enums"]["bonus_rule_criterion"]
          updated_at?: string
          updated_by?: string | null
          valabil_de_la?: string
          valabil_pana?: string | null
          vechime_ani_min?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "payroll_bonus_rules_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payroll_bonus_rules_job_position_id_fkey"
            columns: ["job_position_id"]
            isOneToOne: false
            referencedRelation: "job_positions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payroll_bonus_rules_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      payroll_bonuses: {
        Row: {
          created_at: string
          created_by: string | null
          deleted_at: string | null
          employee_id: string
          id: string
          impozabil: boolean
          motiv: string
          organization_id: string
          period_id: string
          suma: number
          supus_contributii: boolean
          tip: Database["public"]["Enums"]["payroll_bonus_type"]
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          employee_id: string
          id?: string
          impozabil?: boolean
          motiv: string
          organization_id: string
          period_id: string
          suma: number
          supus_contributii?: boolean
          tip: Database["public"]["Enums"]["payroll_bonus_type"]
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          employee_id?: string
          id?: string
          impozabil?: boolean
          motiv?: string
          organization_id?: string
          period_id?: string
          suma?: number
          supus_contributii?: boolean
          tip?: Database["public"]["Enums"]["payroll_bonus_type"]
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payroll_bonuses_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payroll_bonuses_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payroll_bonuses_period_id_fkey"
            columns: ["period_id"]
            isOneToOne: false
            referencedRelation: "payroll_periods"
            referencedColumns: ["id"]
          },
        ]
      }
      payroll_deductions: {
        Row: {
          created_at: string
          created_by: string | null
          deleted_at: string | null
          employee_id: string
          garnishment_id: string | null
          id: string
          motiv: string
          organization_id: string
          period_id: string
          procent_maxim_din_net: number | null
          suma: number
          tip: Database["public"]["Enums"]["payroll_deduction_type"]
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          employee_id: string
          garnishment_id?: string | null
          id?: string
          motiv: string
          organization_id: string
          period_id: string
          procent_maxim_din_net?: number | null
          suma: number
          tip: Database["public"]["Enums"]["payroll_deduction_type"]
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          employee_id?: string
          garnishment_id?: string | null
          id?: string
          motiv?: string
          organization_id?: string
          period_id?: string
          procent_maxim_din_net?: number | null
          suma?: number
          tip?: Database["public"]["Enums"]["payroll_deduction_type"]
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payroll_deductions_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payroll_deductions_garnishment_id_fkey"
            columns: ["garnishment_id"]
            isOneToOne: false
            referencedRelation: "payroll_garnishments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payroll_deductions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payroll_deductions_period_id_fkey"
            columns: ["period_id"]
            isOneToOne: false
            referencedRelation: "payroll_periods"
            referencedColumns: ["id"]
          },
        ]
      }
      payroll_entries: {
        Row: {
          avantaje_natura: number
          baza_cas: number
          baza_cas_cass: number
          baza_cass: number
          baza_impozit: number
          baza_salariu: number
          baza_zilnica_cm: number
          brut: number
          calc_breakdown: Json
          calc_warnings: Json
          calculat_la: string | null
          cam_angajator: number
          cas: number
          cass: number
          contract_id: string | null
          cost_total_angajator: number
          created_at: string
          created_by: string | null
          deducere_personala: number
          deleted_at: string | null
          diurna_impozabila: number
          diurna_neimpozabila: number
          employee_id: string
          id: string
          impozit: number
          indemnizatie_cm_angajator: number
          indemnizatie_cm_fnuass: number
          indemnizatie_co: number
          net: number
          net_de_plata: number
          nr_tichete: number
          ore_lucrate: number
          ore_noapte: number
          ore_repaus: number
          ore_sarbatoare: number
          ore_supl_compensate: number
          ore_suplimentare: number
          organization_id: string
          period_id: string
          prime_total: number
          rest_de_plata: number
          retineri_total: number
          scutire_fiscala: number
          settings_snapshot: Json
          spor_noapte: number
          spor_repaus: number
          spor_sarbatoare: number
          status: Database["public"]["Enums"]["payroll_entry_status"]
          suma_ore_suplimentare: number
          updated_at: string
          updated_by: string | null
          valoare_tichete: number
          zile_absenta_nemotivata: number
          zile_cm_angajator: number
          zile_cm_fnuass: number
          zile_concediu_medical: number
          zile_concediu_odihna: number
          zile_lucrate: number
          zile_lucratoare_luna: number
          zile_repaus_lucrate: number
          zile_sarbatoare_lucrate: number
        }
        Insert: {
          avantaje_natura?: number
          baza_cas?: number
          baza_cas_cass?: number
          baza_cass?: number
          baza_impozit?: number
          baza_salariu?: number
          baza_zilnica_cm?: number
          brut?: number
          calc_breakdown?: Json
          calc_warnings?: Json
          calculat_la?: string | null
          cam_angajator?: number
          cas?: number
          cass?: number
          contract_id?: string | null
          cost_total_angajator?: number
          created_at?: string
          created_by?: string | null
          deducere_personala?: number
          deleted_at?: string | null
          diurna_impozabila?: number
          diurna_neimpozabila?: number
          employee_id: string
          id?: string
          impozit?: number
          indemnizatie_cm_angajator?: number
          indemnizatie_cm_fnuass?: number
          indemnizatie_co?: number
          net?: number
          net_de_plata?: number
          nr_tichete?: number
          ore_lucrate?: number
          ore_noapte?: number
          ore_repaus?: number
          ore_sarbatoare?: number
          ore_supl_compensate?: number
          ore_suplimentare?: number
          organization_id: string
          period_id: string
          prime_total?: number
          rest_de_plata?: number
          retineri_total?: number
          scutire_fiscala?: number
          settings_snapshot: Json
          spor_noapte?: number
          spor_repaus?: number
          spor_sarbatoare?: number
          status?: Database["public"]["Enums"]["payroll_entry_status"]
          suma_ore_suplimentare?: number
          updated_at?: string
          updated_by?: string | null
          valoare_tichete?: number
          zile_absenta_nemotivata?: number
          zile_cm_angajator?: number
          zile_cm_fnuass?: number
          zile_concediu_medical?: number
          zile_concediu_odihna?: number
          zile_lucrate?: number
          zile_lucratoare_luna: number
          zile_repaus_lucrate?: number
          zile_sarbatoare_lucrate?: number
        }
        Update: {
          avantaje_natura?: number
          baza_cas?: number
          baza_cas_cass?: number
          baza_cass?: number
          baza_impozit?: number
          baza_salariu?: number
          baza_zilnica_cm?: number
          brut?: number
          calc_breakdown?: Json
          calc_warnings?: Json
          calculat_la?: string | null
          cam_angajator?: number
          cas?: number
          cass?: number
          contract_id?: string | null
          cost_total_angajator?: number
          created_at?: string
          created_by?: string | null
          deducere_personala?: number
          deleted_at?: string | null
          diurna_impozabila?: number
          diurna_neimpozabila?: number
          employee_id?: string
          id?: string
          impozit?: number
          indemnizatie_cm_angajator?: number
          indemnizatie_cm_fnuass?: number
          indemnizatie_co?: number
          net?: number
          net_de_plata?: number
          nr_tichete?: number
          ore_lucrate?: number
          ore_noapte?: number
          ore_repaus?: number
          ore_sarbatoare?: number
          ore_supl_compensate?: number
          ore_suplimentare?: number
          organization_id?: string
          period_id?: string
          prime_total?: number
          rest_de_plata?: number
          retineri_total?: number
          scutire_fiscala?: number
          settings_snapshot?: Json
          spor_noapte?: number
          spor_repaus?: number
          spor_sarbatoare?: number
          status?: Database["public"]["Enums"]["payroll_entry_status"]
          suma_ore_suplimentare?: number
          updated_at?: string
          updated_by?: string | null
          valoare_tichete?: number
          zile_absenta_nemotivata?: number
          zile_cm_angajator?: number
          zile_cm_fnuass?: number
          zile_concediu_medical?: number
          zile_concediu_odihna?: number
          zile_lucrate?: number
          zile_lucratoare_luna?: number
          zile_repaus_lucrate?: number
          zile_sarbatoare_lucrate?: number
        }
        Relationships: [
          {
            foreignKeyName: "payroll_entries_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "employment_contracts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payroll_entries_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payroll_entries_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payroll_entries_period_id_fkey"
            columns: ["period_id"]
            isOneToOne: false
            referencedRelation: "payroll_periods"
            referencedColumns: ["id"]
          },
        ]
      }
      payroll_garnishments: {
        Row: {
          activa: boolean
          created_at: string
          created_by: string | null
          creditor: string
          data_inceput: string
          data_sfarsit: string | null
          deleted_at: string | null
          dosar: string
          employee_id: string
          executor: string | null
          id: string
          observatii: string | null
          organization_id: string
          prioritate: number
          sold_ramas: number | null
          suma_lunara: number
          suma_recuperata: number
          suma_totala: number
          tip_creanta: Database["public"]["Enums"]["garnishment_claim_type"]
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          activa?: boolean
          created_at?: string
          created_by?: string | null
          creditor: string
          data_inceput: string
          data_sfarsit?: string | null
          deleted_at?: string | null
          dosar: string
          employee_id: string
          executor?: string | null
          id?: string
          observatii?: string | null
          organization_id: string
          prioritate?: number
          sold_ramas?: number | null
          suma_lunara: number
          suma_recuperata?: number
          suma_totala: number
          tip_creanta?: Database["public"]["Enums"]["garnishment_claim_type"]
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          activa?: boolean
          created_at?: string
          created_by?: string | null
          creditor?: string
          data_inceput?: string
          data_sfarsit?: string | null
          deleted_at?: string | null
          dosar?: string
          employee_id?: string
          executor?: string | null
          id?: string
          observatii?: string | null
          organization_id?: string
          prioritate?: number
          sold_ramas?: number | null
          suma_lunara?: number
          suma_recuperata?: number
          suma_totala?: number
          tip_creanta?: Database["public"]["Enums"]["garnishment_claim_type"]
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payroll_garnishments_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payroll_garnishments_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      payroll_periods: {
        Row: {
          an: number
          aprobat_de: string | null
          aprobat_la: string | null
          attendance_period_id: string
          calculat_de: string | null
          calculat_la: string | null
          created_at: string
          created_by: string | null
          data_plata: string | null
          deleted_at: string | null
          id: string
          inchis_de: string | null
          inchis_la: string | null
          luna: number
          observatii: string | null
          organization_id: string
          settings_id: string
          status: Database["public"]["Enums"]["payroll_period_status"]
          total_brut: number
          total_cost_angajator: number
          total_net: number
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          an: number
          aprobat_de?: string | null
          aprobat_la?: string | null
          attendance_period_id: string
          calculat_de?: string | null
          calculat_la?: string | null
          created_at?: string
          created_by?: string | null
          data_plata?: string | null
          deleted_at?: string | null
          id?: string
          inchis_de?: string | null
          inchis_la?: string | null
          luna: number
          observatii?: string | null
          organization_id: string
          settings_id: string
          status?: Database["public"]["Enums"]["payroll_period_status"]
          total_brut?: number
          total_cost_angajator?: number
          total_net?: number
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          an?: number
          aprobat_de?: string | null
          aprobat_la?: string | null
          attendance_period_id?: string
          calculat_de?: string | null
          calculat_la?: string | null
          created_at?: string
          created_by?: string | null
          data_plata?: string | null
          deleted_at?: string | null
          id?: string
          inchis_de?: string | null
          inchis_la?: string | null
          luna?: number
          observatii?: string | null
          organization_id?: string
          settings_id?: string
          status?: Database["public"]["Enums"]["payroll_period_status"]
          total_brut?: number
          total_cost_angajator?: number
          total_net?: number
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payroll_periods_attendance_period_id_fkey"
            columns: ["attendance_period_id"]
            isOneToOne: false
            referencedRelation: "attendance_periods"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payroll_periods_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payroll_periods_settings_id_fkey"
            columns: ["settings_id"]
            isOneToOne: false
            referencedRelation: "payroll_settings"
            referencedColumns: ["id"]
          },
        ]
      }
      payroll_personal_deduction_brackets: {
        Row: {
          created_at: string
          created_by: string | null
          deleted_at: string | null
          id: string
          nr_persoane_intretinere_max: number | null
          nr_persoane_intretinere_min: number
          ordine: number
          organization_id: string
          settings_id: string
          updated_at: string
          updated_by: string | null
          valoare: number
          venit_brut_max: number
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          id?: string
          nr_persoane_intretinere_max?: number | null
          nr_persoane_intretinere_min: number
          ordine?: number
          organization_id: string
          settings_id: string
          updated_at?: string
          updated_by?: string | null
          valoare: number
          venit_brut_max: number
        }
        Update: {
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          id?: string
          nr_persoane_intretinere_max?: number | null
          nr_persoane_intretinere_min?: number
          ordine?: number
          organization_id?: string
          settings_id?: string
          updated_at?: string
          updated_by?: string | null
          valoare?: number
          venit_brut_max?: number
        }
        Relationships: [
          {
            foreignKeyName: "payroll_personal_deduction_brackets_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payroll_personal_deduction_brackets_settings_id_fkey"
            columns: ["settings_id"]
            isOneToOne: false
            referencedRelation: "payroll_settings"
            referencedColumns: ["id"]
          },
        ]
      }
      payroll_prior_income: {
        Row: {
          an: number
          created_at: string
          created_by: string | null
          deleted_at: string | null
          drepturi_salariale: number
          employee_id: string
          id: string
          luna: number
          organization_id: string
          sursa: string | null
          updated_at: string
          updated_by: string | null
          venit_brut: number
          zile_lucrate: number
        }
        Insert: {
          an: number
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          drepturi_salariale?: number
          employee_id: string
          id?: string
          luna: number
          organization_id: string
          sursa?: string | null
          updated_at?: string
          updated_by?: string | null
          venit_brut?: number
          zile_lucrate?: number
        }
        Update: {
          an?: number
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          drepturi_salariale?: number
          employee_id?: string
          id?: string
          luna?: number
          organization_id?: string
          sursa?: string | null
          updated_at?: string
          updated_by?: string | null
          venit_brut?: number
          zile_lucrate?: number
        }
        Relationships: [
          {
            foreignKeyName: "payroll_prior_income_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payroll_prior_income_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      payroll_settings: {
        Row: {
          aplica_minim_contributii: boolean
          casa_sanatate_angajator: string | null
          cont_avansuri: string
          cont_cas_retinut: string
          cont_cass_retinut: string
          cont_cheltuiala_contributie_angajator: string
          cont_cheltuiala_salarii: string
          cont_impozit: string
          cont_retineri_terti: string
          cont_salarii_datorate: string
          cota_cam_angajator: number
          cota_cas: number
          cota_cass: number
          cota_impozit: number
          created_at: string
          created_by: string | null
          deleted_at: string | null
          functie_declarant: string
          id: string
          luni_medie_indemnizatie_co: number
          mod_calcul_indemnizatie_co: string
          norma_zilnica_ore: number
          note: string | null
          organization_id: string
          plafon_poprire_unica: number
          plafon_popriri_concurente: number
          plata_avans: boolean
          procent_ore_suplimentare: number
          procent_spor_noapte: number
          procent_spor_sarbatoare: number
          procent_spor_weekend: number
          rotunjire_lei: boolean
          salariu_minim_brut: number
          tichete_furnizor: string | null
          tichete_impozabile: boolean
          tichete_supuse_cass: boolean
          updated_at: string
          updated_by: string | null
          valabil_de_la: string
          valoare_tichet_masa: number
          verificat_de_contabil: boolean
          verificat_la: string | null
          zile_avertizare_termen_compensare: number
          ziua_plata_avans: number | null
          ziua_plata_lichidare: number | null
        }
        Insert: {
          aplica_minim_contributii?: boolean
          casa_sanatate_angajator?: string | null
          cont_avansuri?: string
          cont_cas_retinut?: string
          cont_cass_retinut?: string
          cont_cheltuiala_contributie_angajator?: string
          cont_cheltuiala_salarii?: string
          cont_impozit?: string
          cont_retineri_terti?: string
          cont_salarii_datorate?: string
          cota_cam_angajator: number
          cota_cas: number
          cota_cass: number
          cota_impozit: number
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          functie_declarant?: string
          id?: string
          luni_medie_indemnizatie_co?: number
          mod_calcul_indemnizatie_co?: string
          norma_zilnica_ore?: number
          note?: string | null
          organization_id: string
          plafon_poprire_unica?: number
          plafon_popriri_concurente?: number
          plata_avans?: boolean
          procent_ore_suplimentare?: number
          procent_spor_noapte?: number
          procent_spor_sarbatoare?: number
          procent_spor_weekend?: number
          rotunjire_lei?: boolean
          salariu_minim_brut?: number
          tichete_furnizor?: string | null
          tichete_impozabile?: boolean
          tichete_supuse_cass?: boolean
          updated_at?: string
          updated_by?: string | null
          valabil_de_la: string
          valoare_tichet_masa?: number
          verificat_de_contabil?: boolean
          verificat_la?: string | null
          zile_avertizare_termen_compensare?: number
          ziua_plata_avans?: number | null
          ziua_plata_lichidare?: number | null
        }
        Update: {
          aplica_minim_contributii?: boolean
          casa_sanatate_angajator?: string | null
          cont_avansuri?: string
          cont_cas_retinut?: string
          cont_cass_retinut?: string
          cont_cheltuiala_contributie_angajator?: string
          cont_cheltuiala_salarii?: string
          cont_impozit?: string
          cont_retineri_terti?: string
          cont_salarii_datorate?: string
          cota_cam_angajator?: number
          cota_cas?: number
          cota_cass?: number
          cota_impozit?: number
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          functie_declarant?: string
          id?: string
          luni_medie_indemnizatie_co?: number
          mod_calcul_indemnizatie_co?: string
          norma_zilnica_ore?: number
          note?: string | null
          organization_id?: string
          plafon_poprire_unica?: number
          plafon_popriri_concurente?: number
          plata_avans?: boolean
          procent_ore_suplimentare?: number
          procent_spor_noapte?: number
          procent_spor_sarbatoare?: number
          procent_spor_weekend?: number
          rotunjire_lei?: boolean
          salariu_minim_brut?: number
          tichete_furnizor?: string | null
          tichete_impozabile?: boolean
          tichete_supuse_cass?: boolean
          updated_at?: string
          updated_by?: string | null
          valabil_de_la?: string
          valoare_tichet_masa?: number
          verificat_de_contabil?: boolean
          verificat_la?: string | null
          zile_avertizare_termen_compensare?: number
          ziua_plata_avans?: number | null
          ziua_plata_lichidare?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "payroll_settings_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      per_diem_calculations: {
        Row: {
          business_trip_id: string
          calculat_la: string
          created_at: string
          curs_incomplet: boolean
          detalii: Json
          id: string
          organization_id: string
          parte_impozabila_lei: number | null
          parte_neimpozabila_lei: number | null
          plafon_neimpozabil_lei: number | null
          policy_id: string
          updated_at: string
          valoare_lei: number | null
          zile_total: number
        }
        Insert: {
          business_trip_id: string
          calculat_la?: string
          created_at?: string
          curs_incomplet?: boolean
          detalii?: Json
          id?: string
          organization_id: string
          parte_impozabila_lei?: number | null
          parte_neimpozabila_lei?: number | null
          plafon_neimpozabil_lei?: number | null
          policy_id: string
          updated_at?: string
          valoare_lei?: number | null
          zile_total: number
        }
        Update: {
          business_trip_id?: string
          calculat_la?: string
          created_at?: string
          curs_incomplet?: boolean
          detalii?: Json
          id?: string
          organization_id?: string
          parte_impozabila_lei?: number | null
          parte_neimpozabila_lei?: number | null
          plafon_neimpozabil_lei?: number | null
          policy_id?: string
          updated_at?: string
          valoare_lei?: number | null
          zile_total?: number
        }
        Relationships: [
          {
            foreignKeyName: "per_diem_calculations_business_trip_id_fkey"
            columns: ["business_trip_id"]
            isOneToOne: true
            referencedRelation: "business_trips"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "per_diem_calculations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "per_diem_calculations_policy_id_fkey"
            columns: ["policy_id"]
            isOneToOne: false
            referencedRelation: "per_diem_policies"
            referencedColumns: ["id"]
          },
        ]
      }
      per_diem_country_rates: {
        Row: {
          categorie: string
          country_id: string
          created_at: string
          created_by: string | null
          de_verificat_de_jurist: boolean
          deleted_at: string | null
          id: string
          moneda: string
          observatii: string | null
          sursa: string
          updated_at: string
          updated_by: string | null
          valabil_de_la: string
          valabil_pana: string | null
          valoare: number
        }
        Insert: {
          categorie?: string
          country_id: string
          created_at?: string
          created_by?: string | null
          de_verificat_de_jurist?: boolean
          deleted_at?: string | null
          id?: string
          moneda: string
          observatii?: string | null
          sursa?: string
          updated_at?: string
          updated_by?: string | null
          valabil_de_la: string
          valabil_pana?: string | null
          valoare: number
        }
        Update: {
          categorie?: string
          country_id?: string
          created_at?: string
          created_by?: string | null
          de_verificat_de_jurist?: boolean
          deleted_at?: string | null
          id?: string
          moneda?: string
          observatii?: string | null
          sursa?: string
          updated_at?: string
          updated_by?: string | null
          valabil_de_la?: string
          valabil_pana?: string | null
          valoare?: number
        }
        Relationships: [
          {
            foreignKeyName: "per_diem_country_rates_country_id_fkey"
            columns: ["country_id"]
            isOneToOne: false
            referencedRelation: "countries"
            referencedColumns: ["id"]
          },
        ]
      }
      per_diem_policies: {
        Row: {
          acorda_diurna_ziua_trecerii: boolean
          categorie_barem: string
          country_id_intern: string
          created_at: string
          created_by: string | null
          deleted_at: string | null
          denumire: string
          diurna_baza_legala_interna: number
          diurna_interna_zi: number
          fractiune_zi_partiala: number
          id: string
          moneda_interna: string
          moneda_tarif_km: string
          multiplu_diurna_externa: number
          multiplu_plafon_neimpozabil: number
          observatii: string | null
          organization_id: string
          plafon_salarii_baza_luna: number
          prag_ore_minim: number
          prag_ore_zi_intreaga: number
          regula_tara_trecere: Database["public"]["Enums"]["per_diem_border_rule"]
          tarif_km_auto_personal: number
          updated_at: string
          updated_by: string | null
          valabil_de_la: string
          valabil_pana: string | null
        }
        Insert: {
          acorda_diurna_ziua_trecerii?: boolean
          categorie_barem?: string
          country_id_intern: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          denumire: string
          diurna_baza_legala_interna: number
          diurna_interna_zi: number
          fractiune_zi_partiala: number
          id?: string
          moneda_interna: string
          moneda_tarif_km: string
          multiplu_diurna_externa: number
          multiplu_plafon_neimpozabil: number
          observatii?: string | null
          organization_id: string
          plafon_salarii_baza_luna: number
          prag_ore_minim: number
          prag_ore_zi_intreaga: number
          regula_tara_trecere?: Database["public"]["Enums"]["per_diem_border_rule"]
          tarif_km_auto_personal: number
          updated_at?: string
          updated_by?: string | null
          valabil_de_la: string
          valabil_pana?: string | null
        }
        Update: {
          acorda_diurna_ziua_trecerii?: boolean
          categorie_barem?: string
          country_id_intern?: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          denumire?: string
          diurna_baza_legala_interna?: number
          diurna_interna_zi?: number
          fractiune_zi_partiala?: number
          id?: string
          moneda_interna?: string
          moneda_tarif_km?: string
          multiplu_diurna_externa?: number
          multiplu_plafon_neimpozabil?: number
          observatii?: string | null
          organization_id?: string
          plafon_salarii_baza_luna?: number
          prag_ore_minim?: number
          prag_ore_zi_intreaga?: number
          regula_tara_trecere?: Database["public"]["Enums"]["per_diem_border_rule"]
          tarif_km_auto_personal?: number
          updated_at?: string
          updated_by?: string | null
          valabil_de_la?: string
          valabil_pana?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "per_diem_policies_country_id_intern_fkey"
            columns: ["country_id_intern"]
            isOneToOne: false
            referencedRelation: "countries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "per_diem_policies_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      personnel_authorizations: {
        Row: {
          created_at: string
          created_by: string | null
          deleted_at: string | null
          emis_la: string | null
          emitent: string
          employee_id: string
          grupa: string | null
          id: string
          numar: string
          observatii: string | null
          organization_id: string
          suspendata_la: string | null
          tip: string
          updated_at: string
          updated_by: string | null
          valabil_pana: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          emis_la?: string | null
          emitent: string
          employee_id: string
          grupa?: string | null
          id?: string
          numar: string
          observatii?: string | null
          organization_id: string
          suspendata_la?: string | null
          tip: string
          updated_at?: string
          updated_by?: string | null
          valabil_pana: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          emis_la?: string | null
          emitent?: string
          employee_id?: string
          grupa?: string | null
          id?: string
          numar?: string
          observatii?: string | null
          organization_id?: string
          suspendata_la?: string | null
          tip?: string
          updated_at?: string
          updated_by?: string | null
          valabil_pana?: string
        }
        Relationships: [
          {
            foreignKeyName: "personnel_authorizations_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "personnel_authorizations_org_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      platform_admins: {
        Row: {
          created_at: string
          granted_at: string
          granted_by: string | null
          id: string
          motiv: string | null
          revoked_at: string | null
          revoked_by: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          granted_at?: string
          granted_by?: string | null
          id?: string
          motiv?: string | null
          revoked_at?: string | null
          revoked_by?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          granted_at?: string
          granted_by?: string | null
          id?: string
          motiv?: string | null
          revoked_at?: string | null
          revoked_by?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      ppe_issuances: {
        Row: {
          articol: string
          cantitate: number
          cod_articol: string | null
          created_at: string
          created_by: string | null
          data_inlocuirii: string | null
          data_predarii: string
          deleted_at: string | null
          durata_utilizare_luni: number | null
          employee_id: string
          id: string
          observatii: string | null
          organization_id: string
          returnat_la: string | null
          semnatura_confirmata: boolean
          unitate: string
          updated_at: string
          updated_by: string | null
          valoare: number | null
        }
        Insert: {
          articol: string
          cantitate?: number
          cod_articol?: string | null
          created_at?: string
          created_by?: string | null
          data_inlocuirii?: string | null
          data_predarii: string
          deleted_at?: string | null
          durata_utilizare_luni?: number | null
          employee_id: string
          id?: string
          observatii?: string | null
          organization_id: string
          returnat_la?: string | null
          semnatura_confirmata?: boolean
          unitate?: string
          updated_at?: string
          updated_by?: string | null
          valoare?: number | null
        }
        Update: {
          articol?: string
          cantitate?: number
          cod_articol?: string | null
          created_at?: string
          created_by?: string | null
          data_inlocuirii?: string | null
          data_predarii?: string
          deleted_at?: string | null
          durata_utilizare_luni?: number | null
          employee_id?: string
          id?: string
          observatii?: string | null
          organization_id?: string
          returnat_la?: string | null
          semnatura_confirmata?: boolean
          unitate?: string
          updated_at?: string
          updated_by?: string | null
          valoare?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "ppe_issuances_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ppe_issuances_org_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      prevention_plan_measures: {
        Row: {
          assessment_id: string | null
          cost_estimat: number | null
          cost_realizat: number | null
          created_at: string
          created_by: string | null
          deleted_at: string | null
          id: string
          masura: string
          observatii: string | null
          organization_id: string
          realizat_la: string | null
          responsabil_employee_id: string | null
          status: Database["public"]["Enums"]["ssm_measure_status"]
          termen: string
          tip: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          assessment_id?: string | null
          cost_estimat?: number | null
          cost_realizat?: number | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          id?: string
          masura: string
          observatii?: string | null
          organization_id: string
          realizat_la?: string | null
          responsabil_employee_id?: string | null
          status?: Database["public"]["Enums"]["ssm_measure_status"]
          termen: string
          tip?: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          assessment_id?: string | null
          cost_estimat?: number | null
          cost_realizat?: number | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          id?: string
          masura?: string
          observatii?: string | null
          organization_id?: string
          realizat_la?: string | null
          responsabil_employee_id?: string | null
          status?: Database["public"]["Enums"]["ssm_measure_status"]
          termen?: string
          tip?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "prevention_plan_measures_assessment_id_fkey"
            columns: ["assessment_id"]
            isOneToOne: false
            referencedRelation: "risk_assessments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prevention_plan_measures_org_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prevention_plan_measures_responsabil_employee_id_fkey"
            columns: ["responsabil_employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_path: string | null
          created_at: string
          deleted_at: string | null
          email: string
          full_name: string | null
          id: string
          last_organization_id: string | null
          last_seen_at: string | null
          locale: Database["public"]["Enums"]["locale_code"]
          phone: string | null
          timezone: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          avatar_path?: string | null
          created_at?: string
          deleted_at?: string | null
          email: string
          full_name?: string | null
          id: string
          last_organization_id?: string | null
          last_seen_at?: string | null
          locale?: Database["public"]["Enums"]["locale_code"]
          phone?: string | null
          timezone?: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          avatar_path?: string | null
          created_at?: string
          deleted_at?: string | null
          email?: string
          full_name?: string | null
          id?: string
          last_organization_id?: string | null
          last_seen_at?: string | null
          locale?: Database["public"]["Enums"]["locale_code"]
          phone?: string | null
          timezone?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_last_organization_id_fkey"
            columns: ["last_organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      public_holidays: {
        Row: {
          an: number
          created_at: string
          data: string
          deleted_at: string | null
          denumire: string
          id: string
          tara: string
          temei_legal: string | null
          tip: Database["public"]["Enums"]["holiday_type"]
          updated_at: string
        }
        Insert: {
          an: number
          created_at?: string
          data: string
          deleted_at?: string | null
          denumire: string
          id?: string
          tara?: string
          temei_legal?: string | null
          tip: Database["public"]["Enums"]["holiday_type"]
          updated_at?: string
        }
        Update: {
          an?: number
          created_at?: string
          data?: string
          deleted_at?: string | null
          denumire?: string
          id?: string
          tara?: string
          temei_legal?: string | null
          tip?: Database["public"]["Enums"]["holiday_type"]
          updated_at?: string
        }
        Relationships: []
      }
      puncte_lucru: {
        Row: {
          activ: boolean
          adresa: string | null
          cod_postal: string | null
          created_at: string
          created_by: string | null
          deleted_at: string | null
          denumire: string
          id: string
          judet: string | null
          observatii: string | null
          oras: string | null
          organization_id: string
          sediu_principal: boolean
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          activ?: boolean
          adresa?: string | null
          cod_postal?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          denumire: string
          id?: string
          judet?: string | null
          observatii?: string | null
          oras?: string | null
          organization_id: string
          sediu_principal?: boolean
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          activ?: boolean
          adresa?: string | null
          cod_postal?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          denumire?: string
          id?: string
          judet?: string | null
          observatii?: string | null
          oras?: string | null
          organization_id?: string
          sediu_principal?: boolean
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "puncte_lucru_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      rate_limits: {
        Row: {
          count: number
          created_at: string
          key: string
          updated_at: string
          window_start: string
        }
        Insert: {
          count?: number
          created_at?: string
          key: string
          updated_at?: string
          window_start: string
        }
        Update: {
          count?: number
          created_at?: string
          key?: string
          updated_at?: string
          window_start?: string
        }
        Relationships: []
      }
      retention_policies: {
        Row: {
          anonymize_only: boolean
          created_at: string
          created_by: string | null
          deleted_at: string | null
          enabled: boolean
          entity_type: string
          id: string
          legal_basis: string | null
          organization_id: string | null
          retention_months: number
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          anonymize_only?: boolean
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          enabled?: boolean
          entity_type: string
          id?: string
          legal_basis?: string | null
          organization_id?: string | null
          retention_months: number
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          anonymize_only?: boolean
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          enabled?: boolean
          entity_type?: string
          id?: string
          legal_basis?: string | null
          organization_id?: string | null
          retention_months?: number
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "retention_policies_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      revisal_config: {
        Row: {
          cod_revisal: string | null
          created_at: string
          created_by: string | null
          deleted_at: string | null
          descriere: string | null
          event_type: Database["public"]["Enums"]["revisal_event_type"]
          id: string
          organization_id: string | null
          reper: string
          termen_zile: number
          updated_at: string
          updated_by: string | null
          valabil_de_la: string
          valabil_pana: string | null
          zile_lucratoare: boolean
        }
        Insert: {
          cod_revisal?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          descriere?: string | null
          event_type: Database["public"]["Enums"]["revisal_event_type"]
          id?: string
          organization_id?: string | null
          reper?: string
          termen_zile: number
          updated_at?: string
          updated_by?: string | null
          valabil_de_la: string
          valabil_pana?: string | null
          zile_lucratoare?: boolean
        }
        Update: {
          cod_revisal?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          descriere?: string | null
          event_type?: Database["public"]["Enums"]["revisal_event_type"]
          id?: string
          organization_id?: string | null
          reper?: string
          termen_zile?: number
          updated_at?: string
          updated_by?: string | null
          valabil_de_la?: string
          valabil_pana?: string | null
          zile_lucratoare?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "revisal_config_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      revisal_events: {
        Row: {
          contract_id: string | null
          created_at: string
          created_by: string | null
          data_evenimentului: string
          deleted_at: string | null
          employee_id: string
          eroare: string | null
          event_type: Database["public"]["Enums"]["revisal_event_type"]
          export_checksum: string | null
          export_path: string | null
          id: string
          numar_inregistrare: string | null
          observatii: string | null
          organization_id: string
          payload: Json
          status: Database["public"]["Enums"]["revisal_status"]
          termen_transmitere: string
          transmis_de: string | null
          transmis_la: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          contract_id?: string | null
          created_at?: string
          created_by?: string | null
          data_evenimentului: string
          deleted_at?: string | null
          employee_id: string
          eroare?: string | null
          event_type: Database["public"]["Enums"]["revisal_event_type"]
          export_checksum?: string | null
          export_path?: string | null
          id?: string
          numar_inregistrare?: string | null
          observatii?: string | null
          organization_id: string
          payload?: Json
          status?: Database["public"]["Enums"]["revisal_status"]
          termen_transmitere: string
          transmis_de?: string | null
          transmis_la?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          contract_id?: string | null
          created_at?: string
          created_by?: string | null
          data_evenimentului?: string
          deleted_at?: string | null
          employee_id?: string
          eroare?: string | null
          event_type?: Database["public"]["Enums"]["revisal_event_type"]
          export_checksum?: string | null
          export_path?: string | null
          id?: string
          numar_inregistrare?: string | null
          observatii?: string | null
          organization_id?: string
          payload?: Json
          status?: Database["public"]["Enums"]["revisal_status"]
          termen_transmitere?: string
          transmis_de?: string | null
          transmis_la?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "revisal_events_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "employment_contracts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "revisal_events_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "revisal_events_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      risk_assessment_items: {
        Row: {
          assessment_id: string
          consecinta: string | null
          created_at: string
          created_by: string | null
          deleted_at: string | null
          factor_risc: string
          gravitate: number
          id: string
          masuri: string | null
          nivel_risc: number | null
          organization_id: string
          pericol: string
          probabilitate: number
          responsabil_employee_id: string | null
          termen: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          assessment_id: string
          consecinta?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          factor_risc: string
          gravitate: number
          id?: string
          masuri?: string | null
          nivel_risc?: number | null
          organization_id: string
          pericol: string
          probabilitate: number
          responsabil_employee_id?: string | null
          termen?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          assessment_id?: string
          consecinta?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          factor_risc?: string
          gravitate?: number
          id?: string
          masuri?: string | null
          nivel_risc?: number | null
          organization_id?: string
          pericol?: string
          probabilitate?: number
          responsabil_employee_id?: string | null
          termen?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "risk_assessment_items_assessment_id_fkey"
            columns: ["assessment_id"]
            isOneToOne: false
            referencedRelation: "risk_assessments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "risk_assessment_items_org_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "risk_assessment_items_responsabil_employee_id_fkey"
            columns: ["responsabil_employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      risk_assessments: {
        Row: {
          aprobat_de: string | null
          aprobat_la: string | null
          cod: string
          created_at: string
          created_by: string | null
          data_evaluarii: string
          deleted_at: string | null
          denumire: string
          department_id: string | null
          evaluator: string | null
          id: string
          job_position_id: string | null
          locatie: string | null
          metoda: string
          organization_id: string
          status: string
          updated_at: string
          updated_by: string | null
          valabil_pana: string | null
        }
        Insert: {
          aprobat_de?: string | null
          aprobat_la?: string | null
          cod: string
          created_at?: string
          created_by?: string | null
          data_evaluarii: string
          deleted_at?: string | null
          denumire: string
          department_id?: string | null
          evaluator?: string | null
          id?: string
          job_position_id?: string | null
          locatie?: string | null
          metoda?: string
          organization_id: string
          status?: string
          updated_at?: string
          updated_by?: string | null
          valabil_pana?: string | null
        }
        Update: {
          aprobat_de?: string | null
          aprobat_la?: string | null
          cod?: string
          created_at?: string
          created_by?: string | null
          data_evaluarii?: string
          deleted_at?: string | null
          denumire?: string
          department_id?: string | null
          evaluator?: string | null
          id?: string
          job_position_id?: string | null
          locatie?: string | null
          metoda?: string
          organization_id?: string
          status?: string
          updated_at?: string
          updated_by?: string | null
          valabil_pana?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "risk_assessments_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "risk_assessments_job_position_id_fkey"
            columns: ["job_position_id"]
            isOneToOne: false
            referencedRelation: "job_positions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "risk_assessments_org_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      role_permissions: {
        Row: {
          action: string
          created_at: string
          created_by: string | null
          deleted_at: string | null
          id: string
          member_id: string | null
          organization_id: string | null
          resource: string
          role: Database["public"]["Enums"]["app_role"]
          scope: Database["public"]["Enums"]["permission_scope"]
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          action: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          id?: string
          member_id?: string | null
          organization_id?: string | null
          resource: string
          role: Database["public"]["Enums"]["app_role"]
          scope?: Database["public"]["Enums"]["permission_scope"]
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          id?: string
          member_id?: string | null
          organization_id?: string | null
          resource?: string
          role?: Database["public"]["Enums"]["app_role"]
          scope?: Database["public"]["Enums"]["permission_scope"]
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "role_permissions_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "organization_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "role_permissions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      safety_committee_meetings: {
        Row: {
          created_at: string
          created_by: string | null
          data: string
          deleted_at: string | null
          hotarari: string | null
          id: string
          numar_lucratori_la_data: number | null
          numar_proces_verbal: string | null
          ora: string | null
          ordine_de_zi: string
          organization_id: string
          participanti: string | null
          prag_obligativitate: number | null
          presedinte_employee_id: string | null
          secretar_employee_id: string | null
          tip: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          data: string
          deleted_at?: string | null
          hotarari?: string | null
          id?: string
          numar_lucratori_la_data?: number | null
          numar_proces_verbal?: string | null
          ora?: string | null
          ordine_de_zi: string
          organization_id: string
          participanti?: string | null
          prag_obligativitate?: number | null
          presedinte_employee_id?: string | null
          secretar_employee_id?: string | null
          tip?: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          data?: string
          deleted_at?: string | null
          hotarari?: string | null
          id?: string
          numar_lucratori_la_data?: number | null
          numar_proces_verbal?: string | null
          ora?: string | null
          ordine_de_zi?: string
          organization_id?: string
          participanti?: string | null
          prag_obligativitate?: number | null
          presedinte_employee_id?: string | null
          secretar_employee_id?: string | null
          tip?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "safety_committee_meetings_org_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "safety_committee_meetings_presedinte_employee_id_fkey"
            columns: ["presedinte_employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "safety_committee_meetings_secretar_employee_id_fkey"
            columns: ["secretar_employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      salary_component_types: {
        Row: {
          activ: boolean
          cod: string
          cod_revisal: string | null
          created_at: string
          created_by: string | null
          deleted_at: string | null
          denumire: string
          id: string
          impozabil: boolean
          intra_in_baza_cas: boolean
          intra_in_baza_cass: boolean
          kind: Database["public"]["Enums"]["salary_component_kind"]
          ordine: number
          organization_id: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          activ?: boolean
          cod: string
          cod_revisal?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          denumire: string
          id?: string
          impozabil?: boolean
          intra_in_baza_cas?: boolean
          intra_in_baza_cass?: boolean
          kind: Database["public"]["Enums"]["salary_component_kind"]
          ordine?: number
          organization_id?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          activ?: boolean
          cod?: string
          cod_revisal?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          denumire?: string
          id?: string
          impozabil?: boolean
          intra_in_baza_cas?: boolean
          intra_in_baza_cass?: boolean
          kind?: Database["public"]["Enums"]["salary_component_kind"]
          ordine?: number
          organization_id?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "salary_component_types_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      salary_components: {
        Row: {
          component_type_id: string
          contract_id: string | null
          created_at: string
          created_by: string | null
          deleted_at: string | null
          employee_id: string
          id: string
          kind: Database["public"]["Enums"]["salary_component_kind"]
          moneda: string
          observatii: string | null
          organization_id: string
          procent: number | null
          suma: number | null
          updated_at: string
          updated_by: string | null
          valabil_de_la: string
          valabil_pana: string | null
        }
        Insert: {
          component_type_id: string
          contract_id?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          employee_id: string
          id?: string
          kind: Database["public"]["Enums"]["salary_component_kind"]
          moneda?: string
          observatii?: string | null
          organization_id: string
          procent?: number | null
          suma?: number | null
          updated_at?: string
          updated_by?: string | null
          valabil_de_la: string
          valabil_pana?: string | null
        }
        Update: {
          component_type_id?: string
          contract_id?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          employee_id?: string
          id?: string
          kind?: Database["public"]["Enums"]["salary_component_kind"]
          moneda?: string
          observatii?: string | null
          organization_id?: string
          procent?: number | null
          suma?: number | null
          updated_at?: string
          updated_by?: string | null
          valabil_de_la?: string
          valabil_pana?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "salary_components_component_type_id_fkey"
            columns: ["component_type_id"]
            isOneToOne: false
            referencedRelation: "salary_component_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "salary_components_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "employment_contracts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "salary_components_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "salary_components_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      ssm_legal_parameters: {
        Row: {
          cod: string
          created_at: string
          created_by: string | null
          de_verificat_de_jurist: boolean
          deleted_at: string | null
          denumire: string
          id: string
          observatii: string | null
          organization_id: string
          temei_legal: string | null
          unitate: string
          updated_at: string
          updated_by: string | null
          valabil_de_la: string
          valoare: number
        }
        Insert: {
          cod: string
          created_at?: string
          created_by?: string | null
          de_verificat_de_jurist?: boolean
          deleted_at?: string | null
          denumire: string
          id?: string
          observatii?: string | null
          organization_id: string
          temei_legal?: string | null
          unitate: string
          updated_at?: string
          updated_by?: string | null
          valabil_de_la: string
          valoare: number
        }
        Update: {
          cod?: string
          created_at?: string
          created_by?: string | null
          de_verificat_de_jurist?: boolean
          deleted_at?: string | null
          denumire?: string
          id?: string
          observatii?: string | null
          organization_id?: string
          temei_legal?: string | null
          unitate?: string
          updated_at?: string
          updated_by?: string | null
          valabil_de_la?: string
          valoare?: number
        }
        Relationships: [
          {
            foreignKeyName: "ssm_legal_parameters_org_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      ssm_training_type_periods: {
        Row: {
          created_at: string
          created_by: string | null
          de_verificat_de_jurist: boolean
          deleted_at: string | null
          durata_minima_ore: number
          id: string
          organization_id: string
          periodicitate_luni: number | null
          temei_legal: string | null
          training_type_id: string
          updated_at: string
          updated_by: string | null
          valabil_de_la: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          de_verificat_de_jurist?: boolean
          deleted_at?: string | null
          durata_minima_ore?: number
          id?: string
          organization_id: string
          periodicitate_luni?: number | null
          temei_legal?: string | null
          training_type_id: string
          updated_at?: string
          updated_by?: string | null
          valabil_de_la: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          de_verificat_de_jurist?: boolean
          deleted_at?: string | null
          durata_minima_ore?: number
          id?: string
          organization_id?: string
          periodicitate_luni?: number | null
          temei_legal?: string | null
          training_type_id?: string
          updated_at?: string
          updated_by?: string | null
          valabil_de_la?: string
        }
        Relationships: [
          {
            foreignKeyName: "ssm_training_type_periods_org_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ssm_training_type_periods_training_type_id_fkey"
            columns: ["training_type_id"]
            isOneToOne: false
            referencedRelation: "ssm_training_types"
            referencedColumns: ["id"]
          },
        ]
      }
      ssm_training_types: {
        Row: {
          activ: boolean
          cine_poate_instrui: string
          cod: string
          created_at: string
          created_by: string | null
          deleted_at: string | null
          denumire: string
          domeniu: Database["public"]["Enums"]["ssm_domain"]
          id: string
          obligatoriu: boolean
          organization_id: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          activ?: boolean
          cine_poate_instrui?: string
          cod: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          denumire: string
          domeniu: Database["public"]["Enums"]["ssm_domain"]
          id?: string
          obligatoriu?: boolean
          organization_id: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          activ?: boolean
          cine_poate_instrui?: string
          cod?: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          denumire?: string
          domeniu?: Database["public"]["Enums"]["ssm_domain"]
          id?: string
          obligatoriu?: boolean
          organization_id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ssm_training_types_org_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      ssm_trainings: {
        Row: {
          created_at: string
          created_by: string | null
          data_instruirii: string
          deleted_at: string | null
          durata_ore: number
          employee_id: string
          id: string
          lector_employee_id: string | null
          lector_extern: string | null
          materiale: string | null
          observatii: string | null
          organization_id: string
          semnat_la: string | null
          semnatura_confirmata: boolean
          tematica: string | null
          test_punctaj: number | null
          training_type_id: string
          updated_at: string
          updated_by: string | null
          urmatoarea_scadenta: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          data_instruirii: string
          deleted_at?: string | null
          durata_ore?: number
          employee_id: string
          id?: string
          lector_employee_id?: string | null
          lector_extern?: string | null
          materiale?: string | null
          observatii?: string | null
          organization_id: string
          semnat_la?: string | null
          semnatura_confirmata?: boolean
          tematica?: string | null
          test_punctaj?: number | null
          training_type_id: string
          updated_at?: string
          updated_by?: string | null
          urmatoarea_scadenta?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          data_instruirii?: string
          deleted_at?: string | null
          durata_ore?: number
          employee_id?: string
          id?: string
          lector_employee_id?: string | null
          lector_extern?: string | null
          materiale?: string | null
          observatii?: string | null
          organization_id?: string
          semnat_la?: string | null
          semnatura_confirmata?: boolean
          tematica?: string | null
          test_punctaj?: number | null
          training_type_id?: string
          updated_at?: string
          updated_by?: string | null
          urmatoarea_scadenta?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ssm_trainings_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ssm_trainings_lector_employee_id_fkey"
            columns: ["lector_employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ssm_trainings_org_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ssm_trainings_training_type_id_fkey"
            columns: ["training_type_id"]
            isOneToOne: false
            referencedRelation: "ssm_training_types"
            referencedColumns: ["id"]
          },
        ]
      }
      ticket_attachments: {
        Row: {
          created_at: string
          created_by: string | null
          deleted_at: string | null
          denumire: string
          id: string
          marime_bytes: number | null
          mime: string | null
          organization_id: string
          storage_path: string
          ticket_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          denumire: string
          id?: string
          marime_bytes?: number | null
          mime?: string | null
          organization_id: string
          storage_path: string
          ticket_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          denumire?: string
          id?: string
          marime_bytes?: number | null
          mime?: string | null
          organization_id?: string
          storage_path?: string
          ticket_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ticket_attachments_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ticket_attachments_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      ticket_comments: {
        Row: {
          autor_employee_id: string | null
          continut: string
          created_at: string
          created_by: string | null
          deleted_at: string | null
          id: string
          intern: boolean
          organization_id: string
          ticket_id: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          autor_employee_id?: string | null
          continut: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          id?: string
          intern?: boolean
          organization_id: string
          ticket_id: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          autor_employee_id?: string | null
          continut?: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          id?: string
          intern?: boolean
          organization_id?: string
          ticket_id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ticket_comments_autor_employee_id_fkey"
            columns: ["autor_employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ticket_comments_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ticket_comments_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      ticket_history: {
        Row: {
          actor_user_id: string | null
          camp: string
          created_at: string
          id: string
          motiv: string | null
          organization_id: string
          ticket_id: string
          valoare_noua: string | null
          valoare_veche: string | null
        }
        Insert: {
          actor_user_id?: string | null
          camp: string
          created_at?: string
          id?: string
          motiv?: string | null
          organization_id: string
          ticket_id: string
          valoare_noua?: string | null
          valoare_veche?: string | null
        }
        Update: {
          actor_user_id?: string | null
          camp?: string
          created_at?: string
          id?: string
          motiv?: string | null
          organization_id?: string
          ticket_id?: string
          valoare_noua?: string | null
          valoare_veche?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ticket_history_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ticket_history_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      ticket_watchers: {
        Row: {
          created_at: string
          created_by: string | null
          deleted_at: string | null
          employee_id: string
          id: string
          organization_id: string
          ticket_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          employee_id: string
          id?: string
          organization_id: string
          ticket_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          employee_id?: string
          id?: string
          organization_id?: string
          ticket_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ticket_watchers_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ticket_watchers_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ticket_watchers_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      tickets: {
        Row: {
          adresa_livrare: string | null
          aplicatie: string | null
          aprobare_ceruta: boolean
          aprobat_de_employee_id: string | null
          asignat_employee_id: string | null
          blocheaza_activitatea: boolean | null
          closed_at: string | null
          context: Json | null
          cost_estimat: number | null
          created_at: string
          created_by: string | null
          decizie_la: string | null
          deleted_at: string | null
          denumire_hardware: string | null
          department_id: string | null
          descriere: string
          id: string
          inventory_item_id: string | null
          loc_livrare: Database["public"]["Enums"]["ticket_delivery"] | null
          locatie: string | null
          modul: string | null
          motiv_necesitate: string | null
          motiv_respingere: string | null
          numar_afisat: string
          numar_licente: number | null
          organization_id: string
          parent_ticket_id: string | null
          pasi_efectuati: string | null
          prioritate: Database["public"]["Enums"]["ticket_priority"]
          prioritate_manuala: boolean
          prioritate_motiv: string | null
          rezultat_asteptat: string | null
          rezultat_obtinut: string | null
          sla_policy_id: string | null
          solicitant_employee_id: string
          status: Database["public"]["Enums"]["ticket_status"]
          tip: Database["public"]["Enums"]["ticket_type"]
          titlu: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          adresa_livrare?: string | null
          aplicatie?: string | null
          aprobare_ceruta?: boolean
          aprobat_de_employee_id?: string | null
          asignat_employee_id?: string | null
          blocheaza_activitatea?: boolean | null
          closed_at?: string | null
          context?: Json | null
          cost_estimat?: number | null
          created_at?: string
          created_by?: string | null
          decizie_la?: string | null
          deleted_at?: string | null
          denumire_hardware?: string | null
          department_id?: string | null
          descriere: string
          id?: string
          inventory_item_id?: string | null
          loc_livrare?: Database["public"]["Enums"]["ticket_delivery"] | null
          locatie?: string | null
          modul?: string | null
          motiv_necesitate?: string | null
          motiv_respingere?: string | null
          numar_afisat: string
          numar_licente?: number | null
          organization_id: string
          parent_ticket_id?: string | null
          pasi_efectuati?: string | null
          prioritate?: Database["public"]["Enums"]["ticket_priority"]
          prioritate_manuala?: boolean
          prioritate_motiv?: string | null
          rezultat_asteptat?: string | null
          rezultat_obtinut?: string | null
          sla_policy_id?: string | null
          solicitant_employee_id: string
          status?: Database["public"]["Enums"]["ticket_status"]
          tip: Database["public"]["Enums"]["ticket_type"]
          titlu: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          adresa_livrare?: string | null
          aplicatie?: string | null
          aprobare_ceruta?: boolean
          aprobat_de_employee_id?: string | null
          asignat_employee_id?: string | null
          blocheaza_activitatea?: boolean | null
          closed_at?: string | null
          context?: Json | null
          cost_estimat?: number | null
          created_at?: string
          created_by?: string | null
          decizie_la?: string | null
          deleted_at?: string | null
          denumire_hardware?: string | null
          department_id?: string | null
          descriere?: string
          id?: string
          inventory_item_id?: string | null
          loc_livrare?: Database["public"]["Enums"]["ticket_delivery"] | null
          locatie?: string | null
          modul?: string | null
          motiv_necesitate?: string | null
          motiv_respingere?: string | null
          numar_afisat?: string
          numar_licente?: number | null
          organization_id?: string
          parent_ticket_id?: string | null
          pasi_efectuati?: string | null
          prioritate?: Database["public"]["Enums"]["ticket_priority"]
          prioritate_manuala?: boolean
          prioritate_motiv?: string | null
          rezultat_asteptat?: string | null
          rezultat_obtinut?: string | null
          sla_policy_id?: string | null
          solicitant_employee_id?: string
          status?: Database["public"]["Enums"]["ticket_status"]
          tip?: Database["public"]["Enums"]["ticket_type"]
          titlu?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tickets_aprobat_de_employee_id_fkey"
            columns: ["aprobat_de_employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tickets_asignat_employee_id_fkey"
            columns: ["asignat_employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tickets_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tickets_inventory_item_id_fkey"
            columns: ["inventory_item_id"]
            isOneToOne: false
            referencedRelation: "inventory_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tickets_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tickets_parent_ticket_id_fkey"
            columns: ["parent_ticket_id"]
            isOneToOne: false
            referencedRelation: "tickets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tickets_solicitant_employee_id_fkey"
            columns: ["solicitant_employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      trip_expenses: {
        Row: {
          aprobata: boolean
          aprobata_de: string | null
          aprobata_la: string | null
          business_trip_id: string
          created_at: string
          created_by: string | null
          curs_valutar: number
          data_cheltuielii: string
          deleted_at: string | null
          descriere: string | null
          document_cale: string | null
          document_numar: string | null
          document_tip: string | null
          id: string
          moneda: string
          motiv_respingere: string | null
          organization_id: string
          suma: number
          suma_lei: number | null
          tip: Database["public"]["Enums"]["trip_expense_type"]
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          aprobata?: boolean
          aprobata_de?: string | null
          aprobata_la?: string | null
          business_trip_id: string
          created_at?: string
          created_by?: string | null
          curs_valutar: number
          data_cheltuielii: string
          deleted_at?: string | null
          descriere?: string | null
          document_cale?: string | null
          document_numar?: string | null
          document_tip?: string | null
          id?: string
          moneda: string
          motiv_respingere?: string | null
          organization_id: string
          suma: number
          suma_lei?: number | null
          tip: Database["public"]["Enums"]["trip_expense_type"]
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          aprobata?: boolean
          aprobata_de?: string | null
          aprobata_la?: string | null
          business_trip_id?: string
          created_at?: string
          created_by?: string | null
          curs_valutar?: number
          data_cheltuielii?: string
          deleted_at?: string | null
          descriere?: string | null
          document_cale?: string | null
          document_numar?: string | null
          document_tip?: string | null
          id?: string
          moneda?: string
          motiv_respingere?: string | null
          organization_id?: string
          suma?: number
          suma_lei?: number | null
          tip?: Database["public"]["Enums"]["trip_expense_type"]
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "trip_expenses_business_trip_id_fkey"
            columns: ["business_trip_id"]
            isOneToOne: false
            referencedRelation: "business_trips"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trip_expenses_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      trip_sheets: {
        Row: {
          aprobat_de: string | null
          aprobat_la: string | null
          created_at: string
          created_by: string | null
          deleted_at: string | null
          employee_id: string
          id: string
          km_parcursi: number | null
          km_plecare: number
          km_sosire: number | null
          motiv_respingere: string | null
          numar: string | null
          observatii: string | null
          organization_id: string
          plecare_la: string
          scop: string | null
          sosire_la: string | null
          status: Database["public"]["Enums"]["trip_sheet_status"]
          traseu: string | null
          trimis_la: string | null
          updated_at: string
          updated_by: string | null
          vehicle_id: string
        }
        Insert: {
          aprobat_de?: string | null
          aprobat_la?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          employee_id: string
          id?: string
          km_parcursi?: number | null
          km_plecare: number
          km_sosire?: number | null
          motiv_respingere?: string | null
          numar?: string | null
          observatii?: string | null
          organization_id: string
          plecare_la: string
          scop?: string | null
          sosire_la?: string | null
          status?: Database["public"]["Enums"]["trip_sheet_status"]
          traseu?: string | null
          trimis_la?: string | null
          updated_at?: string
          updated_by?: string | null
          vehicle_id: string
        }
        Update: {
          aprobat_de?: string | null
          aprobat_la?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          employee_id?: string
          id?: string
          km_parcursi?: number | null
          km_plecare?: number
          km_sosire?: number | null
          motiv_respingere?: string | null
          numar?: string | null
          observatii?: string | null
          organization_id?: string
          plecare_la?: string
          scop?: string | null
          sosire_la?: string | null
          status?: Database["public"]["Enums"]["trip_sheet_status"]
          traseu?: string | null
          trimis_la?: string | null
          updated_at?: string
          updated_by?: string | null
          vehicle_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "trip_sheets_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trip_sheets_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trip_sheets_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      vehicle_document_types: {
        Row: {
          activ: boolean
          cere_expirare: boolean
          cod: string
          created_at: string
          created_by: string | null
          deleted_at: string | null
          denumire: string
          descriere: string | null
          id: string
          obligatoriu: boolean
          ordine: number
          organization_id: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          activ?: boolean
          cere_expirare?: boolean
          cod: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          denumire: string
          descriere?: string | null
          id?: string
          obligatoriu?: boolean
          ordine?: number
          organization_id?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          activ?: boolean
          cere_expirare?: boolean
          cod?: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          denumire?: string
          descriere?: string | null
          id?: string
          obligatoriu?: boolean
          ordine?: number
          organization_id?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "vehicle_document_types_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      vehicle_documents: {
        Row: {
          cost: number | null
          created_at: string
          created_by: string | null
          deleted_at: string | null
          document_type_id: string
          emitent: string | null
          este_curent: boolean
          expira_la: string | null
          fisier_checksum: string | null
          fisier_nume: string | null
          fisier_path: string | null
          id: string
          numar: string | null
          observatii: string | null
          organization_id: string
          updated_at: string
          updated_by: string | null
          valabil_de_la: string | null
          vehicle_id: string
        }
        Insert: {
          cost?: number | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          document_type_id: string
          emitent?: string | null
          este_curent?: boolean
          expira_la?: string | null
          fisier_checksum?: string | null
          fisier_nume?: string | null
          fisier_path?: string | null
          id?: string
          numar?: string | null
          observatii?: string | null
          organization_id: string
          updated_at?: string
          updated_by?: string | null
          valabil_de_la?: string | null
          vehicle_id: string
        }
        Update: {
          cost?: number | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          document_type_id?: string
          emitent?: string | null
          este_curent?: boolean
          expira_la?: string | null
          fisier_checksum?: string | null
          fisier_nume?: string | null
          fisier_path?: string | null
          id?: string
          numar?: string | null
          observatii?: string | null
          organization_id?: string
          updated_at?: string
          updated_by?: string | null
          valabil_de_la?: string | null
          vehicle_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vehicle_documents_document_type_id_fkey"
            columns: ["document_type_id"]
            isOneToOne: false
            referencedRelation: "vehicle_document_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vehicle_documents_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vehicle_documents_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      vehicles: {
        Row: {
          an_fabricatie: number | null
          capacitate_cilindrica: number | null
          categorie: Database["public"]["Enums"]["vehicle_category"]
          consum_mediu_declarat: number | null
          created_at: string
          created_by: string | null
          culoare: string | null
          data_achizitie: string | null
          data_iesire: string | null
          deleted_at: string | null
          department_id: string | null
          employee_id: string | null
          id: string
          km_curent: number
          marca: string
          masa_maxima_kg: number | null
          model: string
          motiv_iesire: string | null
          nr_inmatriculare: string
          numar_locuri: number | null
          observatii: string | null
          organization_id: string
          prag_salt_km: number | null
          status: Database["public"]["Enums"]["vehicle_status"]
          tip_combustibil: Database["public"]["Enums"]["fuel_type"]
          updated_at: string
          updated_by: string | null
          valoare_achizitie: number | null
          vin: string | null
        }
        Insert: {
          an_fabricatie?: number | null
          capacitate_cilindrica?: number | null
          categorie?: Database["public"]["Enums"]["vehicle_category"]
          consum_mediu_declarat?: number | null
          created_at?: string
          created_by?: string | null
          culoare?: string | null
          data_achizitie?: string | null
          data_iesire?: string | null
          deleted_at?: string | null
          department_id?: string | null
          employee_id?: string | null
          id?: string
          km_curent?: number
          marca: string
          masa_maxima_kg?: number | null
          model: string
          motiv_iesire?: string | null
          nr_inmatriculare: string
          numar_locuri?: number | null
          observatii?: string | null
          organization_id: string
          prag_salt_km?: number | null
          status?: Database["public"]["Enums"]["vehicle_status"]
          tip_combustibil?: Database["public"]["Enums"]["fuel_type"]
          updated_at?: string
          updated_by?: string | null
          valoare_achizitie?: number | null
          vin?: string | null
        }
        Update: {
          an_fabricatie?: number | null
          capacitate_cilindrica?: number | null
          categorie?: Database["public"]["Enums"]["vehicle_category"]
          consum_mediu_declarat?: number | null
          created_at?: string
          created_by?: string | null
          culoare?: string | null
          data_achizitie?: string | null
          data_iesire?: string | null
          deleted_at?: string | null
          department_id?: string | null
          employee_id?: string | null
          id?: string
          km_curent?: number
          marca?: string
          masa_maxima_kg?: number | null
          model?: string
          motiv_iesire?: string | null
          nr_inmatriculare?: string
          numar_locuri?: number | null
          observatii?: string | null
          organization_id?: string
          prag_salt_km?: number | null
          status?: Database["public"]["Enums"]["vehicle_status"]
          tip_combustibil?: Database["public"]["Enums"]["fuel_type"]
          updated_at?: string
          updated_by?: string | null
          valoare_achizitie?: number | null
          vin?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "vehicles_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vehicles_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vehicles_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      work_accidents: {
        Row: {
          cercetare_finalizata_la: string | null
          comunicat_la_itm_la: string | null
          created_at: string
          created_by: string | null
          data_producerii: string
          deleted_at: string | null
          employee_id: string | null
          id: string
          imprejurari: string
          locul: string
          numar_intern: string | null
          numar_proces_verbal: string | null
          ora_producerii: string | null
          organization_id: string
          termen_comunicare_ore: number | null
          tip: Database["public"]["Enums"]["ssm_accident_type"]
          updated_at: string
          updated_by: string | null
          urmari: string | null
          zile_incapacitate: number
        }
        Insert: {
          cercetare_finalizata_la?: string | null
          comunicat_la_itm_la?: string | null
          created_at?: string
          created_by?: string | null
          data_producerii: string
          deleted_at?: string | null
          employee_id?: string | null
          id?: string
          imprejurari: string
          locul: string
          numar_intern?: string | null
          numar_proces_verbal?: string | null
          ora_producerii?: string | null
          organization_id: string
          termen_comunicare_ore?: number | null
          tip: Database["public"]["Enums"]["ssm_accident_type"]
          updated_at?: string
          updated_by?: string | null
          urmari?: string | null
          zile_incapacitate?: number
        }
        Update: {
          cercetare_finalizata_la?: string | null
          comunicat_la_itm_la?: string | null
          created_at?: string
          created_by?: string | null
          data_producerii?: string
          deleted_at?: string | null
          employee_id?: string | null
          id?: string
          imprejurari?: string
          locul?: string
          numar_intern?: string | null
          numar_proces_verbal?: string | null
          ora_producerii?: string | null
          organization_id?: string
          termen_comunicare_ore?: number | null
          tip?: Database["public"]["Enums"]["ssm_accident_type"]
          updated_at?: string
          updated_by?: string | null
          urmari?: string | null
          zile_incapacitate?: number
        }
        Relationships: [
          {
            foreignKeyName: "work_accidents_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_accidents_org_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      work_permits: {
        Row: {
          cetatenie: string
          created_at: string
          created_by: string | null
          deleted_at: string | null
          document_id: string | null
          emis_de: string | null
          emis_la: string | null
          employee_id: string
          id: string
          notificat_la: string | null
          numar: string
          numar_pasaport: string | null
          observatii: string | null
          organization_id: string
          tip_permis: string
          updated_at: string
          updated_by: string | null
          valabil_de_la: string
          valabil_pana: string
        }
        Insert: {
          cetatenie: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          document_id?: string | null
          emis_de?: string | null
          emis_la?: string | null
          employee_id: string
          id?: string
          notificat_la?: string | null
          numar: string
          numar_pasaport?: string | null
          observatii?: string | null
          organization_id: string
          tip_permis: string
          updated_at?: string
          updated_by?: string | null
          valabil_de_la: string
          valabil_pana: string
        }
        Update: {
          cetatenie?: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          document_id?: string | null
          emis_de?: string | null
          emis_la?: string | null
          employee_id?: string
          id?: string
          notificat_la?: string | null
          numar?: string
          numar_pasaport?: string | null
          observatii?: string | null
          organization_id?: string
          tip_permis?: string
          updated_at?: string
          updated_by?: string | null
          valabil_de_la?: string
          valabil_pana?: string
        }
        Relationships: [
          {
            foreignKeyName: "work_permits_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "employee_documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_permits_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_permits_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      accept_invitation: { Args: { p_token: string }; Returns: string }
      aloca_numar_tichet: {
        Args: { p_organization_id: string }
        Returns: string
      }
      aplica_drepturi_concediu: {
        Args: { p_an: number; p_organization_id: string; p_simulare?: boolean }
        Returns: {
          drept_nou: number
          drept_vechi: number
          employee_id: string
          leave_type_id: string
          ramase_dupa: number
        }[]
      }
      consume_rate_limit: {
        Args: { p_key: string; p_limit: number; p_window_seconds: number }
        Returns: boolean
      }
      decide_zi_pontaj: {
        Args: {
          p_aproba: boolean
          p_entry_id: string
          p_motiv?: string
          p_organization_id: string
        }
        Returns: string
      }
      hr_read_sensitive: {
        Args: { p_employee: string }
        Returns: {
          banca: string
          cnp_ciphertext: string
          cnp_iv: string
          cnp_key_version: number
          cnp_last4: string
          cnp_tag: string
          employee_id: string
          iban_ciphertext: string
          iban_iv: string
          iban_key_version: number
          iban_last4: string
          iban_tag: string
          organization_id: string
        }[]
      }
      hr_write_sensitive: {
        Args: {
          p_banca?: string | null
          p_cnp_ciphertext?: string | null
          p_cnp_hash?: string | null
          p_cnp_iv?: string | null
          p_cnp_key_version?: number | null
          p_cnp_last4?: string | null
          p_cnp_tag?: string | null
          p_employee: string
          p_iban_ciphertext?: string | null
          p_iban_hash?: string | null
          p_iban_iv?: string | null
          p_iban_key_version?: number | null
          p_iban_last4?: string | null
          p_iban_tag?: string | null
        }
        Returns: string
      }
      log_audit_event: {
        Args: {
          p_action: Database["public"]["Enums"]["audit_action"]
          p_after?: Json | null
          p_before?: Json | null
          p_entity_id?: string | null
          p_entity_type?: string | null
          p_error_code?: string | null
          p_ip?: string | null
          p_organization_id?: string | null
          p_request_id?: string | null
          p_status?: Database["public"]["Enums"]["audit_status"] | null
          p_user_agent?: string | null
        }
        Returns: string
      }
      org_read_sensitive: {
        Args: { p_organization_id: string }
        Returns: {
          cnp_ciphertext: string
          cnp_iv: string
          cnp_key_version: number
          cnp_last4: string
          cnp_tag: string
          organization_id: string
        }[]
      }
      org_write_sensitive: {
        Args: {
          p_cnp_ciphertext?: string
          p_cnp_hash?: string
          p_cnp_iv?: string
          p_cnp_key_version?: number
          p_cnp_last4?: string
          p_cnp_tag?: string
          p_organization_id: string
        }
        Returns: string
      }
      payroll_scrie_popriri: {
        Args: { p_period_id: string; p_randuri: Json }
        Returns: {
          inserate: number
          sterse: number
        }[]
      }
      payroll_scrie_rezultate: {
        Args: { p_period_id: string; p_randuri: Json }
        Returns: {
          actualizate: number
          inserate: number
        }[]
      }
      peek_invitation: { Args: { p_token: string }; Returns: Json }
      pontaj_agregat_salarizare: {
        Args: { p_period_id: string }
        Returns: {
          employee_id: string
          ore_lucrate: number
          ore_noapte: number
          ore_normale_repaus: number
          ore_normale_sarbatoare: number
          ore_normale_zi: number
          ore_suplimentare_repaus: number
          ore_suplimentare_sarbatoare: number
          ore_suplimentare_zi: number
          zile_absenta_nemotivata: number
          zile_concediu_medical: number
          zile_concediu_odihna: number
          zile_fara_plata: number
          zile_lucrate: number
          zile_repaus_lucrate: number
          zile_sarbatoare_lucrate: number
        }[]
      }
      seed_leave_balances: {
        Args: {
          p_an: number
          p_employee: string
          p_zile_odihna_override?: number
        }
        Returns: undefined
      }
      set_member_avatar: {
        Args: {
          p_avatar_path: string
          p_organization_id: string
          p_user_id: string
        }
        Returns: undefined
      }
      seteaza_zile_concediu_implicit: {
        Args: { p_organization_id: string; p_zile: number }
        Returns: undefined
      }
      submit_demo_request: {
        Args: {
          p_email: string
          p_firma: string
          p_mesaj?: string | null
          p_nr_angajati?: Database["public"]["Enums"]["employee_band"] | null
          p_nume: string
          p_telefon?: string | null
        }
        Returns: string
      }
      trimite_saptamana_pontaj: {
        Args: {
          p_employee_id?: string | null
          p_lucreaza_weekend?: boolean
          p_organization_id: string
          p_saptamana_start: string
          p_status: Database["public"]["Enums"]["attendance_week_status"]
          p_zile: Json
        }
        Returns: string
      }
      urmatoarea_marca: { Args: { p_organization_id: string }; Returns: string }
    }
    Enums: {
      app_role: "super_admin" | "org_admin" | "manager" | "hr" | "employee"
      approval_step_kind: "manager_direct" | "rol" | "permisiune" | "utilizator"
      approval_task_status:
        | "in_asteptare"
        | "aprobata"
        | "respinsa"
        | "delegata"
        | "expirata"
        | "anulata"
      attendance_day_type:
        | "lucratoare"
        | "weekend"
        | "sarbatoare"
        | "concediu"
        | "medical"
        | "absenta_nemotivata"
        | "delegatie"
        | "fara_plata"
      attendance_entry_source: "manuala" | "import" | "sincronizare_concedii"
      attendance_period_status: "deschisa" | "in_aprobare" | "blocata"
      attendance_presence_kind:
        | "birou"
        | "homeoffice"
        | "deplasare"
        | "delegatie"
      attendance_week_status: "ciorna" | "trimisa" | "aprobata" | "respinsa"
      audit_action:
        | "create"
        | "update"
        | "delete"
        | "restore"
        | "view"
        | "export"
        | "import"
        | "login"
        | "logout"
        | "login_failed"
        | "password_reset"
        | "invite_sent"
        | "invite_accepted"
        | "invite_revoked"
        | "member_added"
        | "member_removed"
        | "role_changed"
        | "permission_changed"
        | "feature_toggled"
        | "org_created"
        | "org_activated"
        | "org_suspended"
        | "tenant_switch"
        | "tenant_forged"
        | "rate_limited"
        | "email_sent"
        | "demo_requested"
        | "impersonation_start"
        | "impersonation_end"
      audit_status: "success" | "failure" | "denied"
      bonus_rule_criterion:
        | "toti"
        | "departament"
        | "functie"
        | "vechime"
        | "nivel_incadrare"
      bonus_rule_kind: "procent_din_baza" | "suma_fixa"
      business_trip_status:
        | "ciorna"
        | "in_aprobare"
        | "aprobata"
        | "respinsa"
        | "anulata"
        | "incheiata"
        | "decontata"
      business_trip_transport:
        | "auto_serviciu"
        | "auto_personal"
        | "tren"
        | "avion"
        | "autocar"
        | "naval"
        | "mixt"
        | "altul"
      checklist_instanta_status: "in_curs" | "finalizata" | "anulata"
      checklist_item_status: "de_facut" | "in_lucru" | "bifat" | "neaplicabil"
      checklist_responsabil_tip: "rol" | "angajat" | "manager_direct"
      checklist_tip: "onboarding" | "offboarding" | "transfer" | "altul"
      checklist_tip_dovada: "niciuna" | "bifa" | "document" | "semnatura"
      checklist_verificare:
        | "inventar_returnat"
        | "acces_revocat"
        | "documente_semnate"
        | "curs_finalizat"
      conditii_munca: "normale" | "deosebite" | "speciale"
      contract_duration: "nedeterminat" | "determinat"
      contract_status: "proiect" | "activ" | "suspendat" | "incetat" | "anulat"
      curs_criteriu: "toti" | "departament" | "functie" | "rol" | "angajat"
      curs_item_status: "neinceput" | "in_curs" | "finalizat"
      curs_link_furnizor: "youtube" | "vimeo" | "loom"
      curs_material_fel: "pdf" | "video"
      curs_material_sursa: "fisier" | "link"
      curs_motiv: "manual" | "regula" | "recertificare"
      curs_status: "neinceput" | "in_curs" | "finalizat" | "expirat" | "anulat"
      curs_treapta_dovada: "bifa" | "parcurgere" | "test" | "declaratie"
      demo_request_status:
        | "new"
        | "contacted"
        | "qualified"
        | "converted"
        | "rejected"
        | "spam"
      dependent_relation: "copil" | "sot_sotie" | "parinte" | "alta_ruda"
      email_status:
        | "queued"
        | "sent"
        | "delivered"
        | "bounced"
        | "complained"
        | "failed"
      employee_band: "1-9" | "10-49" | "50-249" | "250+"
      employee_status:
        | "candidat"
        | "activ"
        | "suspendat"
        | "preaviz"
        | "incetat"
        | "arhivat"
      equipment_status:
        | "in_functiune"
        | "in_reparatie"
        | "in_conservare"
        | "casat"
      evaluation_status: "draft" | "finalizat"
      exemption_type:
        | "it"
        | "constructii"
        | "agricultura"
        | "industrie_alimentara"
        | "persoana_handicap"
        | "cercetare_dezvoltare"
      fault_status: "nou" | "in_analiza" | "in_lucru" | "rezolvat" | "respins"
      fault_urgency: "scazuta" | "medie" | "ridicata" | "critica"
      feature_group:
        | "core"
        | "hr"
        | "operations"
        | "finance"
        | "communication"
        | "portal"
      fuel_type:
        | "benzina"
        | "motorina"
        | "gpl"
        | "gnc"
        | "electric"
        | "hibrid"
        | "hibrid_plugin"
        | "altul"
      garnishment_claim_type: "intretinere" | "alta"
      gen: "masculin" | "feminin" | "nedeclarat"
      holiday_compensation_type: "zi_libera" | "spor"
      holiday_type: "fix" | "mobil"
      inventory_import_status: "in_lucru" | "finalizat" | "esuat" | "revocat"
      inventory_item_stare: "nou" | "bun" | "uzat" | "defect"
      inventory_item_status: "in_stoc" | "alocat" | "in_reparatie" | "casat"
      invitation_status: "pending" | "accepted" | "expired" | "revoked"
      leave_accrual_event:
        | "drept_initial"
        | "acumulare_lunara"
        | "reportare"
        | "expirare_reportate"
        | "consum"
        | "restituire"
        | "ajustare_manuala"
        | "corectie_incadrare"
      leave_day_portion: "zi_intreaga" | "prima_jumatate" | "a_doua_jumatate"
      leave_request_status:
        | "ciorna"
        | "trimisa"
        | "in_aprobare"
        | "aprobata"
        | "respinsa"
        | "anulata"
        | "intrerupta"
      leave_rounding_mode:
        | "fara_rotunjire"
        | "jumatate_in_sus"
        | "jumatate_in_jos"
        | "zi_in_sus"
        | "zi_in_jos"
        | "matematic"
      leave_rule_criterion:
        | "vechime"
        | "conditii_munca"
        | "grad_handicap"
        | "varsta_sub_18"
        | "departament"
        | "functie"
      leave_variant_condition:
        | "atestat"
        | "grad_handicap"
        | "grad_rudenie"
        | "varsta_copil"
        | "alta"
      locale_code: "ro-RO" | "en-US"
      maintenance_kind: "preventiva" | "predictiva" | "corectiva"
      maintenance_result: "reusita" | "partiala" | "esuata" | "amanata"
      medical_payer: "angajator" | "fnuass" | "mixt"
      member_status: "active" | "suspended" | "inactive"
      meter_kind: "ore" | "km" | "cicluri"
      notification_kind:
        | "info"
        | "success"
        | "warning"
        | "error"
        | "task"
        | "reminder"
        | "approval"
        | "announcement"
      odometer_anomaly_type: "regres" | "salt"
      org_holiday_kind: "liber_suplimentar" | "zi_recuperare"
      organization_status: "pending" | "active" | "suspended" | "archived"
      payroll_bonus_type:
        | "prima_performanta"
        | "prima_proiect"
        | "prima_vacanta"
        | "spor_conditii"
        | "alta"
      payroll_deduction_type:
        | "avans"
        | "poprire"
        | "imputatie"
        | "rata_interna"
        | "retinere_sindicat"
        | "alta"
      payroll_entry_status: "draft" | "calculat"
      payroll_period_status: "draft" | "calculat" | "aprobat" | "inchis"
      per_diem_border_rule:
        | "tara_plecare"
        | "tara_sosire"
        | "tara_cu_valoare_mai_mare"
        | "durata_maxima"
      permission_scope: "none" | "own" | "team" | "all"
      plan_type: "trial" | "starter" | "professional" | "enterprise"
      revisal_event_type:
        | "angajare"
        | "modificare_salariu"
        | "modificare_functie"
        | "modificare_norma"
        | "modificare_durata"
        | "suspendare"
        | "reluare_activitate"
        | "detasare"
        | "incetare"
        | "corectie"
      revisal_status:
        | "de_pregatit"
        | "pregatit"
        | "transmis"
        | "confirmat"
        | "respins"
        | "anulat"
      salary_component_kind:
        | "spor_procent"
        | "spor_suma"
        | "indemnizatie"
        | "prima_recurenta"
        | "beneficiu_natura"
      special_regime: "ucenicie" | "internship" | "zilier"
      ssm_accident_type: "usor" | "grav" | "mortal" | "colectiv"
      ssm_domain: "ssm" | "psi"
      ssm_exam_result: "apt" | "apt_conditionat" | "inapt_temporar" | "inapt"
      ssm_exam_type: "angajare" | "periodic" | "reluare" | "adaptare"
      ssm_measure_status:
        | "planificata"
        | "in_lucru"
        | "realizata"
        | "amanata"
        | "anulata"
      stare_civila: "necasatorit" | "casatorit" | "divortat" | "vaduv"
      subscription_status_type:
        | "trialing"
        | "active"
        | "past_due"
        | "canceled"
        | "expired"
      ticket_delivery: "birou" | "domiciliu"
      ticket_priority: "scazuta" | "normala" | "ridicata" | "critica"
      ticket_status:
        | "nou"
        | "in_aprobare"
        | "respins"
        | "in_lucru"
        | "in_asteptare"
        | "rezolvat"
        | "inchis"
        | "anulat"
        | "redeschis"
      ticket_type: "software" | "hardware" | "defectiune" | "bug_erp"
      trip_expense_type:
        | "cazare"
        | "transport"
        | "combustibil"
        | "taxa_drum"
        | "parcare"
        | "alta"
      trip_sheet_status: "draft" | "trimis" | "aprobat" | "respins"
      vehicle_category:
        | "autoturism"
        | "autoutilitara"
        | "camion"
        | "autobuz"
        | "microbuz"
        | "remorca"
        | "semiremorca"
        | "utilaj"
        | "motocicleta"
        | "altele"
      vehicle_status: "activ" | "in_service" | "vandut" | "casat"
      work_mode: "sediu" | "telemunca" | "domiciliu" | "mixt"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["super_admin", "org_admin", "manager", "hr", "employee"],
      approval_step_kind: ["manager_direct", "rol", "permisiune", "utilizator"],
      approval_task_status: [
        "in_asteptare",
        "aprobata",
        "respinsa",
        "delegata",
        "expirata",
        "anulata",
      ],
      attendance_day_type: [
        "lucratoare",
        "weekend",
        "sarbatoare",
        "concediu",
        "medical",
        "absenta_nemotivata",
        "delegatie",
        "fara_plata",
      ],
      attendance_entry_source: ["manuala", "import", "sincronizare_concedii"],
      attendance_period_status: ["deschisa", "in_aprobare", "blocata"],
      attendance_presence_kind: [
        "birou",
        "homeoffice",
        "deplasare",
        "delegatie",
      ],
      attendance_week_status: ["ciorna", "trimisa", "aprobata", "respinsa"],
      audit_action: [
        "create",
        "update",
        "delete",
        "restore",
        "view",
        "export",
        "import",
        "login",
        "logout",
        "login_failed",
        "password_reset",
        "invite_sent",
        "invite_accepted",
        "invite_revoked",
        "member_added",
        "member_removed",
        "role_changed",
        "permission_changed",
        "feature_toggled",
        "org_created",
        "org_activated",
        "org_suspended",
        "tenant_switch",
        "tenant_forged",
        "rate_limited",
        "email_sent",
        "demo_requested",
        "impersonation_start",
        "impersonation_end",
      ],
      audit_status: ["success", "failure", "denied"],
      bonus_rule_criterion: [
        "toti",
        "departament",
        "functie",
        "vechime",
        "nivel_incadrare",
      ],
      bonus_rule_kind: ["procent_din_baza", "suma_fixa"],
      business_trip_status: [
        "ciorna",
        "in_aprobare",
        "aprobata",
        "respinsa",
        "anulata",
        "incheiata",
        "decontata",
      ],
      business_trip_transport: [
        "auto_serviciu",
        "auto_personal",
        "tren",
        "avion",
        "autocar",
        "naval",
        "mixt",
        "altul",
      ],
      checklist_instanta_status: ["in_curs", "finalizata", "anulata"],
      checklist_item_status: ["de_facut", "in_lucru", "bifat", "neaplicabil"],
      checklist_responsabil_tip: ["rol", "angajat", "manager_direct"],
      checklist_tip: ["onboarding", "offboarding", "transfer", "altul"],
      checklist_tip_dovada: ["niciuna", "bifa", "document", "semnatura"],
      checklist_verificare: [
        "inventar_returnat",
        "acces_revocat",
        "documente_semnate",
        "curs_finalizat",
      ],
      conditii_munca: ["normale", "deosebite", "speciale"],
      contract_duration: ["nedeterminat", "determinat"],
      contract_status: ["proiect", "activ", "suspendat", "incetat", "anulat"],
      curs_criteriu: ["toti", "departament", "functie", "rol", "angajat"],
      curs_item_status: ["neinceput", "in_curs", "finalizat"],
      curs_link_furnizor: ["youtube", "vimeo", "loom"],
      curs_material_fel: ["pdf", "video"],
      curs_material_sursa: ["fisier", "link"],
      curs_motiv: ["manual", "regula", "recertificare"],
      curs_status: ["neinceput", "in_curs", "finalizat", "expirat", "anulat"],
      curs_treapta_dovada: ["bifa", "parcurgere", "test", "declaratie"],
      demo_request_status: [
        "new",
        "contacted",
        "qualified",
        "converted",
        "rejected",
        "spam",
      ],
      dependent_relation: ["copil", "sot_sotie", "parinte", "alta_ruda"],
      email_status: [
        "queued",
        "sent",
        "delivered",
        "bounced",
        "complained",
        "failed",
      ],
      employee_band: ["1-9", "10-49", "50-249", "250+"],
      employee_status: [
        "candidat",
        "activ",
        "suspendat",
        "preaviz",
        "incetat",
        "arhivat",
      ],
      equipment_status: [
        "in_functiune",
        "in_reparatie",
        "in_conservare",
        "casat",
      ],
      evaluation_status: ["draft", "finalizat"],
      exemption_type: [
        "it",
        "constructii",
        "agricultura",
        "industrie_alimentara",
        "persoana_handicap",
        "cercetare_dezvoltare",
      ],
      fault_status: ["nou", "in_analiza", "in_lucru", "rezolvat", "respins"],
      fault_urgency: ["scazuta", "medie", "ridicata", "critica"],
      feature_group: [
        "core",
        "hr",
        "operations",
        "finance",
        "communication",
        "portal",
      ],
      fuel_type: [
        "benzina",
        "motorina",
        "gpl",
        "gnc",
        "electric",
        "hibrid",
        "hibrid_plugin",
        "altul",
      ],
      garnishment_claim_type: ["intretinere", "alta"],
      gen: ["masculin", "feminin", "nedeclarat"],
      holiday_compensation_type: ["zi_libera", "spor"],
      holiday_type: ["fix", "mobil"],
      inventory_import_status: ["in_lucru", "finalizat", "esuat", "revocat"],
      inventory_item_stare: ["nou", "bun", "uzat", "defect"],
      inventory_item_status: ["in_stoc", "alocat", "in_reparatie", "casat"],
      invitation_status: ["pending", "accepted", "expired", "revoked"],
      leave_accrual_event: [
        "drept_initial",
        "acumulare_lunara",
        "reportare",
        "expirare_reportate",
        "consum",
        "restituire",
        "ajustare_manuala",
        "corectie_incadrare",
      ],
      leave_day_portion: ["zi_intreaga", "prima_jumatate", "a_doua_jumatate"],
      leave_request_status: [
        "ciorna",
        "trimisa",
        "in_aprobare",
        "aprobata",
        "respinsa",
        "anulata",
        "intrerupta",
      ],
      leave_rounding_mode: [
        "fara_rotunjire",
        "jumatate_in_sus",
        "jumatate_in_jos",
        "zi_in_sus",
        "zi_in_jos",
        "matematic",
      ],
      leave_rule_criterion: [
        "vechime",
        "conditii_munca",
        "grad_handicap",
        "varsta_sub_18",
        "departament",
        "functie",
      ],
      leave_variant_condition: [
        "atestat",
        "grad_handicap",
        "grad_rudenie",
        "varsta_copil",
        "alta",
      ],
      locale_code: ["ro-RO", "en-US"],
      maintenance_kind: ["preventiva", "predictiva", "corectiva"],
      maintenance_result: ["reusita", "partiala", "esuata", "amanata"],
      medical_payer: ["angajator", "fnuass", "mixt"],
      member_status: ["active", "suspended", "inactive"],
      meter_kind: ["ore", "km", "cicluri"],
      notification_kind: [
        "info",
        "success",
        "warning",
        "error",
        "task",
        "reminder",
        "approval",
        "announcement",
      ],
      odometer_anomaly_type: ["regres", "salt"],
      org_holiday_kind: ["liber_suplimentar", "zi_recuperare"],
      organization_status: ["pending", "active", "suspended", "archived"],
      payroll_bonus_type: [
        "prima_performanta",
        "prima_proiect",
        "prima_vacanta",
        "spor_conditii",
        "alta",
      ],
      payroll_deduction_type: [
        "avans",
        "poprire",
        "imputatie",
        "rata_interna",
        "retinere_sindicat",
        "alta",
      ],
      payroll_entry_status: ["draft", "calculat"],
      payroll_period_status: ["draft", "calculat", "aprobat", "inchis"],
      per_diem_border_rule: [
        "tara_plecare",
        "tara_sosire",
        "tara_cu_valoare_mai_mare",
        "durata_maxima",
      ],
      permission_scope: ["none", "own", "team", "all"],
      plan_type: ["trial", "starter", "professional", "enterprise"],
      revisal_event_type: [
        "angajare",
        "modificare_salariu",
        "modificare_functie",
        "modificare_norma",
        "modificare_durata",
        "suspendare",
        "reluare_activitate",
        "detasare",
        "incetare",
        "corectie",
      ],
      revisal_status: [
        "de_pregatit",
        "pregatit",
        "transmis",
        "confirmat",
        "respins",
        "anulat",
      ],
      salary_component_kind: [
        "spor_procent",
        "spor_suma",
        "indemnizatie",
        "prima_recurenta",
        "beneficiu_natura",
      ],
      special_regime: ["ucenicie", "internship", "zilier"],
      ssm_accident_type: ["usor", "grav", "mortal", "colectiv"],
      ssm_domain: ["ssm", "psi"],
      ssm_exam_result: ["apt", "apt_conditionat", "inapt_temporar", "inapt"],
      ssm_exam_type: ["angajare", "periodic", "reluare", "adaptare"],
      ssm_measure_status: [
        "planificata",
        "in_lucru",
        "realizata",
        "amanata",
        "anulata",
      ],
      stare_civila: ["necasatorit", "casatorit", "divortat", "vaduv"],
      subscription_status_type: [
        "trialing",
        "active",
        "past_due",
        "canceled",
        "expired",
      ],
      ticket_delivery: ["birou", "domiciliu"],
      ticket_priority: ["scazuta", "normala", "ridicata", "critica"],
      ticket_status: [
        "nou",
        "in_aprobare",
        "respins",
        "in_lucru",
        "in_asteptare",
        "rezolvat",
        "inchis",
        "anulat",
        "redeschis",
      ],
      ticket_type: ["software", "hardware", "defectiune", "bug_erp"],
      trip_expense_type: [
        "cazare",
        "transport",
        "combustibil",
        "taxa_drum",
        "parcare",
        "alta",
      ],
      trip_sheet_status: ["draft", "trimis", "aprobat", "respins"],
      vehicle_category: [
        "autoturism",
        "autoutilitara",
        "camion",
        "autobuz",
        "microbuz",
        "remorca",
        "semiremorca",
        "utilaj",
        "motocicleta",
        "altele",
      ],
      vehicle_status: ["activ", "in_service", "vandut", "casat"],
      work_mode: ["sediu", "telemunca", "domiciliu", "mixt"],
    },
  },
} as const

