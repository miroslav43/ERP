// GENERAT AUTOMAT — nu edita manual.
//
// Regenerare din schema locală:
//   node scripts/gen-types.mjs "postgresql://$USER@localhost:5433/adm_v" > src/types/database.ts
//
// Odată ce proiectul Supabase este conectat, calea preferată devine:
//   pnpm db:types

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  public: {
    Tables: {
      audit_logs: {
        Row: {
          id: string;
          organization_id: string | null;
          actor_id: string | null;
          action: Database["public"]["Enums"]["audit_action"];
          status: Database["public"]["Enums"]["audit_status"];
          entity_type: string | null;
          entity_id: string | null;
          before: Json | null;
          after: Json | null;
          ip: string | null;
          user_agent: string | null;
          request_id: string | null;
          error_code: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          organization_id?: string | null;
          actor_id?: string | null;
          action: Database["public"]["Enums"]["audit_action"];
          status?: Database["public"]["Enums"]["audit_status"];
          entity_type?: string | null;
          entity_id?: string | null;
          before?: Json | null;
          after?: Json | null;
          ip?: string | null;
          user_agent?: string | null;
          request_id?: string | null;
          error_code?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          organization_id?: string | null;
          actor_id?: string | null;
          action?: Database["public"]["Enums"]["audit_action"];
          status?: Database["public"]["Enums"]["audit_status"];
          entity_type?: string | null;
          entity_id?: string | null;
          before?: Json | null;
          after?: Json | null;
          ip?: string | null;
          user_agent?: string | null;
          request_id?: string | null;
          error_code?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      demo_requests: {
        Row: {
          id: string;
          nume: string;
          firma: string;
          email: string;
          telefon: string | null;
          nr_angajati: Database["public"]["Enums"]["employee_band"] | null;
          mesaj: string | null;
          status: Database["public"]["Enums"]["demo_request_status"];
          ip: string | null;
          user_agent: string | null;
          created_at: string;
          created_day: string | null;
          created_by: string | null;
          updated_at: string;
          updated_by: string | null;
          deleted_at: string | null;
        };
        Insert: {
          id?: string;
          nume: string;
          firma: string;
          email: string;
          telefon?: string | null;
          nr_angajati?: Database["public"]["Enums"]["employee_band"] | null;
          mesaj?: string | null;
          status?: Database["public"]["Enums"]["demo_request_status"];
          ip?: string | null;
          user_agent?: string | null;
          created_at?: string;
          created_by?: string | null;
          updated_at?: string;
          updated_by?: string | null;
          deleted_at?: string | null;
        };
        Update: {
          id?: string;
          nume?: string;
          firma?: string;
          email?: string;
          telefon?: string | null;
          nr_angajati?: Database["public"]["Enums"]["employee_band"] | null;
          mesaj?: string | null;
          status?: Database["public"]["Enums"]["demo_request_status"];
          ip?: string | null;
          user_agent?: string | null;
          created_at?: string;
          created_by?: string | null;
          updated_at?: string;
          updated_by?: string | null;
          deleted_at?: string | null;
        };
        Relationships: [];
      };
      document_sequences: {
        Row: {
          id: string;
          organization_id: string;
          document_type: string;
          year: number;
          prefix: string;
          next_number: number;
          padding: number;
          created_at: string;
          created_by: string | null;
          updated_at: string;
          updated_by: string | null;
        };
        Insert: {
          id?: string;
          organization_id: string;
          document_type: string;
          year: number;
          prefix?: string;
          next_number?: number;
          padding?: number;
          created_at?: string;
          created_by?: string | null;
          updated_at?: string;
          updated_by?: string | null;
        };
        Update: {
          id?: string;
          organization_id?: string;
          document_type?: string;
          year?: number;
          prefix?: string;
          next_number?: number;
          padding?: number;
          created_at?: string;
          created_by?: string | null;
          updated_at?: string;
          updated_by?: string | null;
        };
        Relationships: [];
      };
      email_log: {
        Row: {
          id: string;
          organization_id: string | null;
          destinatar: string;
          subiect: string;
          template: string;
          status: Database["public"]["Enums"]["email_status"];
          provider_id: string | null;
          error: string | null;
          sent_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          organization_id?: string | null;
          destinatar: string;
          subiect: string;
          template: string;
          status?: Database["public"]["Enums"]["email_status"];
          provider_id?: string | null;
          error?: string | null;
          sent_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          organization_id?: string | null;
          destinatar?: string;
          subiect?: string;
          template?: string;
          status?: Database["public"]["Enums"]["email_status"];
          provider_id?: string | null;
          error?: string | null;
          sent_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      features: {
        Row: {
          feature_key: string;
          denumire: string;
          descriere: string | null;
          icon: string;
          grup: Database["public"]["Enums"]["feature_group"];
          is_core: boolean;
          sort_order: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          feature_key: string;
          denumire: string;
          descriere?: string | null;
          icon?: string;
          grup: Database["public"]["Enums"]["feature_group"];
          is_core?: boolean;
          sort_order?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          feature_key?: string;
          denumire?: string;
          descriere?: string | null;
          icon?: string;
          grup?: Database["public"]["Enums"]["feature_group"];
          is_core?: boolean;
          sort_order?: number;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      invitations: {
        Row: {
          id: string;
          organization_id: string;
          email: string;
          role: Database["public"]["Enums"]["app_role"];
          token_hash: string;
          expires_at: string;
          status: Database["public"]["Enums"]["invitation_status"];
          invited_by: string | null;
          accepted_at: string | null;
          accepted_by: string | null;
          created_at: string;
          created_by: string | null;
          updated_at: string;
          updated_by: string | null;
          deleted_at: string | null;
        };
        Insert: {
          id?: string;
          organization_id: string;
          email: string;
          role?: Database["public"]["Enums"]["app_role"];
          token_hash: string;
          expires_at: string;
          status?: Database["public"]["Enums"]["invitation_status"];
          invited_by?: string | null;
          accepted_at?: string | null;
          accepted_by?: string | null;
          created_at?: string;
          created_by?: string | null;
          updated_at?: string;
          updated_by?: string | null;
          deleted_at?: string | null;
        };
        Update: {
          id?: string;
          organization_id?: string;
          email?: string;
          role?: Database["public"]["Enums"]["app_role"];
          token_hash?: string;
          expires_at?: string;
          status?: Database["public"]["Enums"]["invitation_status"];
          invited_by?: string | null;
          accepted_at?: string | null;
          accepted_by?: string | null;
          created_at?: string;
          created_by?: string | null;
          updated_at?: string;
          updated_by?: string | null;
          deleted_at?: string | null;
        };
        Relationships: [];
      };
      notification_preferences: {
        Row: {
          id: string;
          user_id: string;
          organization_id: string;
          kind: Database["public"]["Enums"]["notification_kind"];
          in_app: boolean;
          email: boolean;
          created_at: string;
          created_by: string | null;
          updated_at: string;
          updated_by: string | null;
          deleted_at: string | null;
        };
        Insert: {
          id?: string;
          user_id: string;
          organization_id: string;
          kind: Database["public"]["Enums"]["notification_kind"];
          in_app?: boolean;
          email?: boolean;
          created_at?: string;
          created_by?: string | null;
          updated_at?: string;
          updated_by?: string | null;
          deleted_at?: string | null;
        };
        Update: {
          id?: string;
          user_id?: string;
          organization_id?: string;
          kind?: Database["public"]["Enums"]["notification_kind"];
          in_app?: boolean;
          email?: boolean;
          created_at?: string;
          created_by?: string | null;
          updated_at?: string;
          updated_by?: string | null;
          deleted_at?: string | null;
        };
        Relationships: [];
      };
      notifications: {
        Row: {
          id: string;
          user_id: string;
          organization_id: string;
          kind: Database["public"]["Enums"]["notification_kind"];
          title: string;
          body: string | null;
          link: string | null;
          entity_type: string | null;
          entity_id: string | null;
          read_at: string | null;
          sent_email_at: string | null;
          created_at: string;
          created_by: string | null;
          updated_at: string;
          updated_by: string | null;
          deleted_at: string | null;
        };
        Insert: {
          id?: string;
          user_id: string;
          organization_id: string;
          kind?: Database["public"]["Enums"]["notification_kind"];
          title: string;
          body?: string | null;
          link?: string | null;
          entity_type?: string | null;
          entity_id?: string | null;
          read_at?: string | null;
          sent_email_at?: string | null;
          created_at?: string;
          created_by?: string | null;
          updated_at?: string;
          updated_by?: string | null;
          deleted_at?: string | null;
        };
        Update: {
          id?: string;
          user_id?: string;
          organization_id?: string;
          kind?: Database["public"]["Enums"]["notification_kind"];
          title?: string;
          body?: string | null;
          link?: string | null;
          entity_type?: string | null;
          entity_id?: string | null;
          read_at?: string | null;
          sent_email_at?: string | null;
          created_at?: string;
          created_by?: string | null;
          updated_at?: string;
          updated_by?: string | null;
          deleted_at?: string | null;
        };
        Relationships: [];
      };
      organization_branding: {
        Row: {
          organization_id: string;
          denumire_afisata: string | null;
          primary_color: string | null;
          logo_light_path: string | null;
          logo_dark_path: string | null;
          favicon_path: string | null;
          created_at: string;
          created_by: string | null;
          updated_at: string;
          updated_by: string | null;
          deleted_at: string | null;
        };
        Insert: {
          organization_id: string;
          denumire_afisata?: string | null;
          primary_color?: string | null;
          logo_light_path?: string | null;
          logo_dark_path?: string | null;
          favicon_path?: string | null;
          created_at?: string;
          created_by?: string | null;
          updated_at?: string;
          updated_by?: string | null;
          deleted_at?: string | null;
        };
        Update: {
          organization_id?: string;
          denumire_afisata?: string | null;
          primary_color?: string | null;
          logo_light_path?: string | null;
          logo_dark_path?: string | null;
          favicon_path?: string | null;
          created_at?: string;
          created_by?: string | null;
          updated_at?: string;
          updated_by?: string | null;
          deleted_at?: string | null;
        };
        Relationships: [];
      };
      organization_features: {
        Row: {
          id: string;
          organization_id: string;
          feature_key: string;
          enabled: boolean;
          activated_at: string | null;
          activated_by: string | null;
          settings: Json;
          created_at: string;
          created_by: string | null;
          updated_at: string;
          updated_by: string | null;
          deleted_at: string | null;
        };
        Insert: {
          id?: string;
          organization_id: string;
          feature_key: string;
          enabled?: boolean;
          activated_at?: string | null;
          activated_by?: string | null;
          settings?: Json;
          created_at?: string;
          created_by?: string | null;
          updated_at?: string;
          updated_by?: string | null;
          deleted_at?: string | null;
        };
        Update: {
          id?: string;
          organization_id?: string;
          feature_key?: string;
          enabled?: boolean;
          activated_at?: string | null;
          activated_by?: string | null;
          settings?: Json;
          created_at?: string;
          created_by?: string | null;
          updated_at?: string;
          updated_by?: string | null;
          deleted_at?: string | null;
        };
        Relationships: [];
      };
      organization_members: {
        Row: {
          id: string;
          organization_id: string;
          user_id: string;
          role: Database["public"]["Enums"]["app_role"];
          status: Database["public"]["Enums"]["member_status"];
          job_title: string | null;
          joined_at: string;
          invited_by: string | null;
          invitation_id: string | null;
          deactivated_at: string | null;
          deactivated_by: string | null;
          created_at: string;
          created_by: string | null;
          updated_at: string;
          updated_by: string | null;
          deleted_at: string | null;
        };
        Insert: {
          id?: string;
          organization_id: string;
          user_id: string;
          role?: Database["public"]["Enums"]["app_role"];
          status?: Database["public"]["Enums"]["member_status"];
          job_title?: string | null;
          joined_at?: string;
          invited_by?: string | null;
          invitation_id?: string | null;
          deactivated_at?: string | null;
          deactivated_by?: string | null;
          created_at?: string;
          created_by?: string | null;
          updated_at?: string;
          updated_by?: string | null;
          deleted_at?: string | null;
        };
        Update: {
          id?: string;
          organization_id?: string;
          user_id?: string;
          role?: Database["public"]["Enums"]["app_role"];
          status?: Database["public"]["Enums"]["member_status"];
          job_title?: string | null;
          joined_at?: string;
          invited_by?: string | null;
          invitation_id?: string | null;
          deactivated_at?: string | null;
          deactivated_by?: string | null;
          created_at?: string;
          created_by?: string | null;
          updated_at?: string;
          updated_by?: string | null;
          deleted_at?: string | null;
        };
        Relationships: [];
      };
      organizations: {
        Row: {
          id: string;
          slug: string;
          name: string;
          legal_name: string | null;
          forma_juridica: string | null;
          cui: string;
          cui_normalizat: string | null;
          platitor_tva: boolean;
          reg_com: string | null;
          adresa: string | null;
          judet: string | null;
          oras: string | null;
          cod_postal: string | null;
          tara: string;
          email_contact: string | null;
          telefon_contact: string | null;
          website: string | null;
          reprezentant_legal: string | null;
          status: Database["public"]["Enums"]["organization_status"];
          plan: Database["public"]["Enums"]["plan_type"];
          seats_limit: number;
          subscription_status: Database["public"]["Enums"]["subscription_status_type"];
          trial_ends_at: string | null;
          timezone: string;
          locale: Database["public"]["Enums"]["locale_code"];
          moneda: string;
          activated_at: string | null;
          suspended_at: string | null;
          suspended_reason: string | null;
          created_at: string;
          created_by: string | null;
          updated_at: string;
          updated_by: string | null;
          deleted_at: string | null;
        };
        Insert: {
          id?: string;
          slug: string;
          name: string;
          legal_name?: string | null;
          forma_juridica?: string | null;
          cui: string;
          platitor_tva?: boolean;
          reg_com?: string | null;
          adresa?: string | null;
          judet?: string | null;
          oras?: string | null;
          cod_postal?: string | null;
          tara?: string;
          email_contact?: string | null;
          telefon_contact?: string | null;
          website?: string | null;
          reprezentant_legal?: string | null;
          status?: Database["public"]["Enums"]["organization_status"];
          plan?: Database["public"]["Enums"]["plan_type"];
          seats_limit?: number;
          subscription_status?: Database["public"]["Enums"]["subscription_status_type"];
          trial_ends_at?: string | null;
          timezone?: string;
          locale?: Database["public"]["Enums"]["locale_code"];
          moneda?: string;
          activated_at?: string | null;
          suspended_at?: string | null;
          suspended_reason?: string | null;
          created_at?: string;
          created_by?: string | null;
          updated_at?: string;
          updated_by?: string | null;
          deleted_at?: string | null;
        };
        Update: {
          id?: string;
          slug?: string;
          name?: string;
          legal_name?: string | null;
          forma_juridica?: string | null;
          cui?: string;
          platitor_tva?: boolean;
          reg_com?: string | null;
          adresa?: string | null;
          judet?: string | null;
          oras?: string | null;
          cod_postal?: string | null;
          tara?: string;
          email_contact?: string | null;
          telefon_contact?: string | null;
          website?: string | null;
          reprezentant_legal?: string | null;
          status?: Database["public"]["Enums"]["organization_status"];
          plan?: Database["public"]["Enums"]["plan_type"];
          seats_limit?: number;
          subscription_status?: Database["public"]["Enums"]["subscription_status_type"];
          trial_ends_at?: string | null;
          timezone?: string;
          locale?: Database["public"]["Enums"]["locale_code"];
          moneda?: string;
          activated_at?: string | null;
          suspended_at?: string | null;
          suspended_reason?: string | null;
          created_at?: string;
          created_by?: string | null;
          updated_at?: string;
          updated_by?: string | null;
          deleted_at?: string | null;
        };
        Relationships: [];
      };
      platform_admins: {
        Row: {
          id: string;
          user_id: string;
          granted_by: string | null;
          granted_at: string;
          revoked_at: string | null;
          revoked_by: string | null;
          motiv: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          granted_by?: string | null;
          granted_at?: string;
          revoked_at?: string | null;
          revoked_by?: string | null;
          motiv?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          granted_by?: string | null;
          granted_at?: string;
          revoked_at?: string | null;
          revoked_by?: string | null;
          motiv?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      profiles: {
        Row: {
          id: string;
          email: string;
          full_name: string | null;
          avatar_path: string | null;
          phone: string | null;
          locale: Database["public"]["Enums"]["locale_code"];
          timezone: string;
          last_seen_at: string | null;
          last_organization_id: string | null;
          created_at: string;
          updated_at: string;
          updated_by: string | null;
          deleted_at: string | null;
        };
        Insert: {
          id: string;
          email: string;
          full_name?: string | null;
          avatar_path?: string | null;
          phone?: string | null;
          locale?: Database["public"]["Enums"]["locale_code"];
          timezone?: string;
          last_seen_at?: string | null;
          last_organization_id?: string | null;
          created_at?: string;
          updated_at?: string;
          updated_by?: string | null;
          deleted_at?: string | null;
        };
        Update: {
          id?: string;
          email?: string;
          full_name?: string | null;
          avatar_path?: string | null;
          phone?: string | null;
          locale?: Database["public"]["Enums"]["locale_code"];
          timezone?: string;
          last_seen_at?: string | null;
          last_organization_id?: string | null;
          created_at?: string;
          updated_at?: string;
          updated_by?: string | null;
          deleted_at?: string | null;
        };
        Relationships: [];
      };
      rate_limits: {
        Row: {
          key: string;
          window_start: string;
          count: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          key: string;
          window_start: string;
          count?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          key?: string;
          window_start?: string;
          count?: number;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      retention_policies: {
        Row: {
          id: string;
          organization_id: string | null;
          entity_type: string;
          retention_months: number;
          anonymize_only: boolean;
          enabled: boolean;
          legal_basis: string | null;
          created_at: string;
          created_by: string | null;
          updated_at: string;
          updated_by: string | null;
          deleted_at: string | null;
        };
        Insert: {
          id?: string;
          organization_id?: string | null;
          entity_type: string;
          retention_months: number;
          anonymize_only?: boolean;
          enabled?: boolean;
          legal_basis?: string | null;
          created_at?: string;
          created_by?: string | null;
          updated_at?: string;
          updated_by?: string | null;
          deleted_at?: string | null;
        };
        Update: {
          id?: string;
          organization_id?: string | null;
          entity_type?: string;
          retention_months?: number;
          anonymize_only?: boolean;
          enabled?: boolean;
          legal_basis?: string | null;
          created_at?: string;
          created_by?: string | null;
          updated_at?: string;
          updated_by?: string | null;
          deleted_at?: string | null;
        };
        Relationships: [];
      };
      role_permissions: {
        Row: {
          id: string;
          organization_id: string | null;
          role: Database["public"]["Enums"]["app_role"];
          resource: string;
          action: string;
          scope: Database["public"]["Enums"]["permission_scope"];
          created_at: string;
          created_by: string | null;
          updated_at: string;
          updated_by: string | null;
          deleted_at: string | null;
        };
        Insert: {
          id?: string;
          organization_id?: string | null;
          role: Database["public"]["Enums"]["app_role"];
          resource: string;
          action: string;
          scope?: Database["public"]["Enums"]["permission_scope"];
          created_at?: string;
          created_by?: string | null;
          updated_at?: string;
          updated_by?: string | null;
          deleted_at?: string | null;
        };
        Update: {
          id?: string;
          organization_id?: string | null;
          role?: Database["public"]["Enums"]["app_role"];
          resource?: string;
          action?: string;
          scope?: Database["public"]["Enums"]["permission_scope"];
          created_at?: string;
          created_by?: string | null;
          updated_at?: string;
          updated_by?: string | null;
          deleted_at?: string | null;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      accept_invitation: {
        Args: {
          p_token: string;
        };
        Returns: string;
      };
      consume_rate_limit: {
        Args: {
          p_key: string;
          p_limit: unknown;
          p_window_seconds: unknown;
        };
        Returns: boolean;
      };
      log_audit_event: {
        Args: {
          p_action: Database["public"]["Enums"]["audit_action"];
          p_status?: Database["public"]["Enums"]["audit_status"] | null;
          p_organization_id?: string | null;
          p_entity_type?: string | null;
          p_entity_id?: string | null;
          p_before?: Json | null;
          p_after?: Json | null;
          p_ip?: string | null;
          p_user_agent?: string | null;
          p_request_id?: string | null;
          p_error_code?: string | null;
        };
        Returns: string;
      };
      peek_invitation: {
        Args: {
          p_token: string;
        };
        Returns: Json;
      };
      submit_demo_request: {
        Args: {
          p_nume: string;
          p_firma: string;
          p_email: string;
          p_telefon?: string | null;
          p_nr_angajati?: Database["public"]["Enums"]["employee_band"] | null;
          p_mesaj?: string | null;
        };
        Returns: string;
      };
    };
    Enums: {
      app_role: "super_admin" | "org_admin" | "manager" | "hr" | "employee";
      audit_action: "create" | "update" | "delete" | "restore" | "view" | "export" | "import" | "login" | "logout" | "login_failed" | "password_reset" | "invite_sent" | "invite_accepted" | "invite_revoked" | "member_added" | "member_removed" | "role_changed" | "permission_changed" | "feature_toggled" | "org_created" | "org_activated" | "org_suspended" | "tenant_switch" | "tenant_forged" | "rate_limited" | "email_sent" | "demo_requested" | "impersonation_start" | "impersonation_end";
      audit_status: "success" | "failure" | "denied";
      demo_request_status: "new" | "contacted" | "qualified" | "converted" | "rejected" | "spam";
      email_status: "queued" | "sent" | "delivered" | "bounced" | "complained" | "failed";
      employee_band: "1-9" | "10-49" | "50-249" | "250+";
      feature_group: "core" | "hr" | "operations" | "finance" | "communication" | "portal";
      invitation_status: "pending" | "accepted" | "expired" | "revoked";
      locale_code: "ro-RO" | "en-US";
      member_status: "active" | "suspended" | "inactive";
      notification_kind: "info" | "success" | "warning" | "error" | "task" | "reminder" | "approval" | "announcement";
      organization_status: "pending" | "active" | "suspended" | "archived";
      permission_scope: "none" | "own" | "team" | "all";
      plan_type: "trial" | "starter" | "professional" | "enterprise";
      subscription_status_type: "trialing" | "active" | "past_due" | "canceled" | "expired";
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

export type Tables<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Row"];
export type Enums<T extends keyof Database["public"]["Enums"]> =
  Database["public"]["Enums"][T];
