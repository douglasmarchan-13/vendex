export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  public: {
    Tables: {
      activities: {
        Row: {
          at: string;
          author_id: string | null;
          company_id: string;
          contact_id: string;
          created_at: string;
          id: string;
          text: string;
          type: string;
        };
        ComputedFields: never;
        Insert: {
          at?: string;
          author_id?: string | null;
          company_id: string;
          contact_id: string;
          created_at?: string;
          id?: string;
          text: string;
          type: string;
        };
        Update: {
          at?: string;
          author_id?: string | null;
          company_id?: string;
          contact_id?: string;
          created_at?: string;
          id?: string;
          text?: string;
          type?: string;
        };
        Relationships: [
          {
            foreignKeyName: "activities_author_id_fkey";
            columns: ["author_id"];
            isOneToOne: false;
            referencedRelation: "sellers";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "activities_company_id_fkey";
            columns: ["company_id"];
            isOneToOne: false;
            referencedRelation: "companies";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "activities_contact_id_fkey";
            columns: ["contact_id"];
            isOneToOne: false;
            referencedRelation: "contacts";
            referencedColumns: ["id"];
          },
        ];
      };
      alerts: {
        Row: {
          actions: string[];
          body: string;
          company_id: string;
          contact_id: string | null;
          created_at: string;
          id: string;
          kind: string;
          title: string;
        };
        ComputedFields: never;
        Insert: {
          actions?: string[];
          body?: string;
          company_id: string;
          contact_id?: string | null;
          created_at?: string;
          id?: string;
          kind: string;
          title: string;
        };
        Update: {
          actions?: string[];
          body?: string;
          company_id?: string;
          contact_id?: string | null;
          created_at?: string;
          id?: string;
          kind?: string;
          title?: string;
        };
        Relationships: [
          {
            foreignKeyName: "alerts_company_id_fkey";
            columns: ["company_id"];
            isOneToOne: false;
            referencedRelation: "companies";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "alerts_contact_id_fkey";
            columns: ["contact_id"];
            isOneToOne: false;
            referencedRelation: "contacts";
            referencedColumns: ["id"];
          },
        ];
      };
      app_settings: {
        Row: {
          calls_per_lead: number;
          close_rate: number;
          goal_usd: number;
          id: number;
          quote_rate: number;
          ticket_usd: number;
          timezone: string;
          updated_at: string;
          work_days: number;
        };
        ComputedFields: never;
        Insert: {
          calls_per_lead?: number;
          close_rate?: number;
          goal_usd?: number;
          id?: number;
          quote_rate?: number;
          ticket_usd?: number;
          timezone?: string;
          updated_at?: string;
          work_days?: number;
        };
        Update: {
          calls_per_lead?: number;
          close_rate?: number;
          goal_usd?: number;
          id?: number;
          quote_rate?: number;
          ticket_usd?: number;
          timezone?: string;
          updated_at?: string;
          work_days?: number;
        };
        Relationships: [];
      };
      channels: {
        Row: {
          name: string;
          position: number;
        };
        ComputedFields: never;
        Insert: {
          name: string;
          position?: number;
        };
        Update: {
          name?: string;
          position?: number;
        };
        Relationships: [];
      };
      companies: {
        Row: {
          country_code: string | null;
          created_at: string;
          id: string;
          industry: string;
          legal_name: string;
          name: string;
          notes: string;
          plan: string;
          seats: number;
          status: string;
          tax_id: string;
          trial_ends_at: string | null;
          updated_at: string;
          user_onboarding: string;
        };
        ComputedFields: never;
        Insert: {
          country_code?: string | null;
          created_at?: string;
          id?: string;
          industry?: string;
          legal_name?: string;
          name: string;
          notes?: string;
          plan?: string;
          seats?: number;
          status?: string;
          tax_id?: string;
          trial_ends_at?: string | null;
          updated_at?: string;
          user_onboarding?: string;
        };
        Update: {
          country_code?: string | null;
          created_at?: string;
          id?: string;
          industry?: string;
          legal_name?: string;
          name?: string;
          notes?: string;
          plan?: string;
          seats?: number;
          status?: string;
          tax_id?: string;
          trial_ends_at?: string | null;
          updated_at?: string;
          user_onboarding?: string;
        };
        Relationships: [
          {
            foreignKeyName: "companies_country_code_fkey";
            columns: ["country_code"];
            isOneToOne: false;
            referencedRelation: "countries";
            referencedColumns: ["code"];
          },
        ];
      };
      company_currency_rates: {
        Row: {
          code: string;
          company_id: string;
          rate_per_usd: number;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          code: string;
          company_id: string;
          rate_per_usd: number;
          updated_at?: string;
        };
        Update: {
          code?: string;
          company_id?: string;
          rate_per_usd?: number;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "company_currency_rates_code_fkey";
            columns: ["code"];
            isOneToOne: false;
            referencedRelation: "currencies";
            referencedColumns: ["code"];
          },
          {
            foreignKeyName: "company_currency_rates_company_id_fkey";
            columns: ["company_id"];
            isOneToOne: false;
            referencedRelation: "companies";
            referencedColumns: ["id"];
          },
        ];
      };
      company_settings: {
        Row: {
          calls_per_lead: number;
          close_rate: number;
          company_id: string;
          goal_usd: number;
          quote_rate: number;
          ticket_usd: number;
          timezone: string;
          updated_at: string;
          work_days: number;
        };
        ComputedFields: never;
        Insert: {
          calls_per_lead?: number;
          close_rate?: number;
          company_id: string;
          goal_usd?: number;
          quote_rate?: number;
          ticket_usd?: number;
          timezone?: string;
          updated_at?: string;
          work_days?: number;
        };
        Update: {
          calls_per_lead?: number;
          close_rate?: number;
          company_id?: string;
          goal_usd?: number;
          quote_rate?: number;
          ticket_usd?: number;
          timezone?: string;
          updated_at?: string;
          work_days?: number;
        };
        Relationships: [
          {
            foreignKeyName: "company_settings_company_id_fkey";
            columns: ["company_id"];
            isOneToOne: true;
            referencedRelation: "companies";
            referencedColumns: ["id"];
          },
        ];
      };
      contact_files: {
        Row: {
          company_id: string;
          contact_id: string;
          created_at: string;
          deal_id: string | null;
          file_name: string;
          id: string;
          kind: string;
          note: string;
          size_bytes: number;
          storage_path: string;
          uploaded_by: string | null;
        };
        ComputedFields: never;
        Insert: {
          company_id: string;
          contact_id: string;
          created_at?: string;
          deal_id?: string | null;
          file_name: string;
          id?: string;
          kind?: string;
          note?: string;
          size_bytes: number;
          storage_path: string;
          uploaded_by?: string | null;
        };
        Update: {
          company_id?: string;
          contact_id?: string;
          created_at?: string;
          deal_id?: string | null;
          file_name?: string;
          id?: string;
          kind?: string;
          note?: string;
          size_bytes?: number;
          storage_path?: string;
          uploaded_by?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "contact_files_company_id_fkey";
            columns: ["company_id"];
            isOneToOne: false;
            referencedRelation: "companies";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "contact_files_contact_id_fkey";
            columns: ["contact_id"];
            isOneToOne: false;
            referencedRelation: "contacts";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "contact_files_deal_id_fkey";
            columns: ["deal_id"];
            isOneToOne: false;
            referencedRelation: "deals";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "contact_files_uploaded_by_fkey";
            columns: ["uploaded_by"];
            isOneToOne: false;
            referencedRelation: "sellers";
            referencedColumns: ["id"];
          },
        ];
      };
      contacts: {
        Row: {
          channel: string | null;
          city: string;
          company: string;
          company_id: string;
          country_code: string;
          created_at: string;
          doc: string;
          email: string;
          id: string;
          name: string;
          owner_id: string | null;
          phone: string;
          region: string;
          temp: string;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          channel?: string | null;
          city?: string;
          company?: string;
          company_id?: string;
          country_code: string;
          created_at?: string;
          doc?: string;
          email?: string;
          id?: string;
          name: string;
          owner_id?: string | null;
          phone?: string;
          region?: string;
          temp?: string;
          updated_at?: string;
        };
        Update: {
          channel?: string | null;
          city?: string;
          company?: string;
          company_id?: string;
          country_code?: string;
          created_at?: string;
          doc?: string;
          email?: string;
          id?: string;
          name?: string;
          owner_id?: string | null;
          phone?: string;
          region?: string;
          temp?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "contacts_channel_fkey";
            columns: ["channel"];
            isOneToOne: false;
            referencedRelation: "channels";
            referencedColumns: ["name"];
          },
          {
            foreignKeyName: "contacts_company_id_fkey";
            columns: ["company_id"];
            isOneToOne: false;
            referencedRelation: "companies";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "contacts_country_code_fkey";
            columns: ["country_code"];
            isOneToOne: false;
            referencedRelation: "countries";
            referencedColumns: ["code"];
          },
          {
            foreignKeyName: "contacts_owner_id_fkey";
            columns: ["owner_id"];
            isOneToOne: false;
            referencedRelation: "sellers";
            referencedColumns: ["id"];
          },
        ];
      };
      countries: {
        Row: {
          code: string;
          display_currency: string;
          doc_label: string;
          goal_share: number;
          local_currency: string;
          name: string;
          phone_prefix: string;
        };
        ComputedFields: never;
        Insert: {
          code: string;
          display_currency: string;
          doc_label: string;
          goal_share?: number;
          local_currency: string;
          name: string;
          phone_prefix: string;
        };
        Update: {
          code?: string;
          display_currency?: string;
          doc_label?: string;
          goal_share?: number;
          local_currency?: string;
          name?: string;
          phone_prefix?: string;
        };
        Relationships: [
          {
            foreignKeyName: "countries_display_currency_fkey";
            columns: ["display_currency"];
            isOneToOne: false;
            referencedRelation: "currencies";
            referencedColumns: ["code"];
          },
          {
            foreignKeyName: "countries_local_currency_fkey";
            columns: ["local_currency"];
            isOneToOne: false;
            referencedRelation: "currencies";
            referencedColumns: ["code"];
          },
        ];
      };
      currencies: {
        Row: {
          code: string;
          locale: string;
          name: string;
          rate_per_usd: number;
          symbol: string;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          code: string;
          locale: string;
          name: string;
          rate_per_usd: number;
          symbol: string;
          updated_at?: string;
        };
        Update: {
          code?: string;
          locale?: string;
          name?: string;
          rate_per_usd?: number;
          symbol?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      import_batches: {
        Row: {
          company_id: string;
          created_at: string;
          file_name: string;
          id: string;
          kind: string;
          seller_id: string | null;
          summary: Json;
          undone_at: string | null;
        };
        ComputedFields: never;
        Insert: {
          company_id: string;
          created_at?: string;
          file_name: string;
          id?: string;
          kind?: string;
          seller_id?: string | null;
          summary?: Json;
          undone_at?: string | null;
        };
        Update: {
          company_id?: string;
          created_at?: string;
          file_name?: string;
          id?: string;
          kind?: string;
          seller_id?: string | null;
          summary?: Json;
          undone_at?: string | null;
        };
        Relationships: [];
      };
      deals: {
        Row: {
          amount: number;
          closed_at: string | null;
          company_id: string;
          contact_id: string;
          created_at: string;
          currency: string;
          id: string;
          next_action: string;
          next_at: string | null;
          product: string;
          stage: string;
          temp: string;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          amount?: number;
          closed_at?: string | null;
          company_id: string;
          contact_id: string;
          created_at?: string;
          currency: string;
          id?: string;
          next_action?: string;
          next_at?: string | null;
          product: string;
          stage?: string;
          temp?: string;
          updated_at?: string;
        };
        Update: {
          amount?: number;
          closed_at?: string | null;
          company_id?: string;
          contact_id?: string;
          created_at?: string;
          currency?: string;
          id?: string;
          next_action?: string;
          next_at?: string | null;
          product?: string;
          stage?: string;
          temp?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "deals_company_id_fkey";
            columns: ["company_id"];
            isOneToOne: false;
            referencedRelation: "companies";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "deals_contact_id_fkey";
            columns: ["contact_id"];
            isOneToOne: false;
            referencedRelation: "contacts";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "deals_currency_fkey";
            columns: ["currency"];
            isOneToOne: false;
            referencedRelation: "currencies";
            referencedColumns: ["code"];
          },
          {
            foreignKeyName: "deals_stage_fkey";
            columns: ["stage"];
            isOneToOne: false;
            referencedRelation: "stages";
            referencedColumns: ["id"];
          },
        ];
      };
      invitations: {
        Row: {
          accepted_at: string | null;
          accepted_user_id: string | null;
          company_id: string;
          country_code: string | null;
          created_at: string;
          email: string;
          expires_at: string;
          id: string;
          invited_by: string | null;
          name: string;
          revoked_at: string | null;
          role: string;
          seller_id: string | null;
          token_hash: string;
        };
        ComputedFields: never;
        Insert: {
          accepted_at?: string | null;
          accepted_user_id?: string | null;
          company_id: string;
          country_code?: string | null;
          created_at?: string;
          email: string;
          expires_at?: string;
          id?: string;
          invited_by?: string | null;
          name?: string;
          revoked_at?: string | null;
          role: string;
          seller_id?: string | null;
          token_hash: string;
        };
        Update: {
          accepted_at?: string | null;
          accepted_user_id?: string | null;
          company_id?: string;
          country_code?: string | null;
          created_at?: string;
          email?: string;
          expires_at?: string;
          id?: string;
          invited_by?: string | null;
          name?: string;
          revoked_at?: string | null;
          role?: string;
          seller_id?: string | null;
          token_hash?: string;
        };
        Relationships: [
          {
            foreignKeyName: "invitations_accepted_user_id_fkey";
            columns: ["accepted_user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "invitations_company_id_fkey";
            columns: ["company_id"];
            isOneToOne: false;
            referencedRelation: "companies";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "invitations_country_code_fkey";
            columns: ["country_code"];
            isOneToOne: false;
            referencedRelation: "countries";
            referencedColumns: ["code"];
          },
          {
            foreignKeyName: "invitations_invited_by_fkey";
            columns: ["invited_by"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "invitations_seller_id_fkey";
            columns: ["seller_id"];
            isOneToOne: false;
            referencedRelation: "sellers";
            referencedColumns: ["id"];
          },
        ];
      };
      message_templates: {
        Row: {
          body: string;
          company_id: string;
          created_at: string;
          key: string;
          kind: string;
          label: string;
          seller_id: string;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          body: string;
          company_id: string;
          created_at?: string;
          key: string;
          kind?: string;
          label: string;
          seller_id: string;
          updated_at?: string;
        };
        Update: {
          body?: string;
          company_id?: string;
          created_at?: string;
          key?: string;
          kind?: string;
          label?: string;
          seller_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "message_templates_company_id_fkey";
            columns: ["company_id"];
            isOneToOne: false;
            referencedRelation: "companies";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "message_templates_seller_id_fkey";
            columns: ["seller_id"];
            isOneToOne: false;
            referencedRelation: "sellers";
            referencedColumns: ["id"];
          },
        ];
      };
      password_resets: {
        Row: {
          created_at: string;
          expires_at: string;
          id: string;
          requested_ip: unknown;
          token_hash: string;
          used_at: string | null;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          expires_at?: string;
          id?: string;
          requested_ip?: unknown;
          token_hash: string;
          used_at?: string | null;
          user_id: string;
        };
        Update: {
          created_at?: string;
          expires_at?: string;
          id?: string;
          requested_ip?: unknown;
          token_hash?: string;
          used_at?: string | null;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "password_resets_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      pay_methods: {
        Row: {
          company_id: string;
          country_code: string;
          name: string;
          position: number;
        };
        ComputedFields: never;
        Insert: {
          company_id?: string;
          country_code: string;
          name: string;
          position?: number;
        };
        Update: {
          company_id?: string;
          country_code?: string;
          name?: string;
          position?: number;
        };
        Relationships: [
          {
            foreignKeyName: "pay_methods_company_id_fkey";
            columns: ["company_id"];
            isOneToOne: false;
            referencedRelation: "companies";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "pay_methods_country_code_fkey";
            columns: ["country_code"];
            isOneToOne: false;
            referencedRelation: "countries";
            referencedColumns: ["code"];
          },
        ];
      };
      payments: {
        Row: {
          amount: number;
          company_id: string;
          contact_id: string;
          created_at: string;
          currency: string;
          deal_id: string;
          due_at: string;
          id: string;
          label: string;
          method: string | null;
          n: number;
          of_total: number;
          paid_at: string | null;
          ref: string;
        };
        ComputedFields: never;
        Insert: {
          amount: number;
          company_id: string;
          contact_id: string;
          created_at?: string;
          currency: string;
          deal_id: string;
          due_at: string;
          id?: string;
          label: string;
          method?: string | null;
          n?: number;
          of_total?: number;
          paid_at?: string | null;
          ref?: string;
        };
        Update: {
          amount?: number;
          company_id?: string;
          contact_id?: string;
          created_at?: string;
          currency?: string;
          deal_id?: string;
          due_at?: string;
          id?: string;
          label?: string;
          method?: string | null;
          n?: number;
          of_total?: number;
          paid_at?: string | null;
          ref?: string;
        };
        Relationships: [
          {
            foreignKeyName: "payments_company_id_fkey";
            columns: ["company_id"];
            isOneToOne: false;
            referencedRelation: "companies";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "payments_contact_id_fkey";
            columns: ["contact_id"];
            isOneToOne: false;
            referencedRelation: "contacts";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "payments_currency_fkey";
            columns: ["currency"];
            isOneToOne: false;
            referencedRelation: "currencies";
            referencedColumns: ["code"];
          },
          {
            foreignKeyName: "payments_deal_id_fkey";
            columns: ["deal_id"];
            isOneToOne: false;
            referencedRelation: "deals";
            referencedColumns: ["id"];
          },
        ];
      };
      products: {
        Row: {
          active: boolean;
          company_id: string;
          id: string;
          name: string;
          position: number;
          price_usd: number;
        };
        ComputedFields: never;
        Insert: {
          active?: boolean;
          company_id?: string;
          id?: string;
          name: string;
          position?: number;
          price_usd: number;
        };
        Update: {
          active?: boolean;
          company_id?: string;
          id?: string;
          name?: string;
          position?: number;
          price_usd?: number;
        };
        Relationships: [
          {
            foreignKeyName: "products_company_id_fkey";
            columns: ["company_id"];
            isOneToOne: false;
            referencedRelation: "companies";
            referencedColumns: ["id"];
          },
        ];
      };
      sellers: {
        Row: {
          active: boolean;
          auth_user_id: string | null;
          company_id: string;
          country_code: string;
          created_at: string;
          email: string | null;
          id: string;
          name: string;
          short_name: string;
          user_id: string | null;
        };
        ComputedFields: never;
        Insert: {
          active?: boolean;
          auth_user_id?: string | null;
          company_id?: string;
          country_code: string;
          created_at?: string;
          email?: string | null;
          id: string;
          name: string;
          short_name: string;
          user_id?: string | null;
        };
        Update: {
          active?: boolean;
          auth_user_id?: string | null;
          company_id?: string;
          country_code?: string;
          created_at?: string;
          email?: string | null;
          id?: string;
          name?: string;
          short_name?: string;
          user_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "sellers_company_id_fkey";
            columns: ["company_id"];
            isOneToOne: false;
            referencedRelation: "companies";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "sellers_country_code_fkey";
            columns: ["country_code"];
            isOneToOne: false;
            referencedRelation: "countries";
            referencedColumns: ["code"];
          },
          {
            foreignKeyName: "sellers_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: true;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      snoozes: {
        Row: {
          company_id: string;
          item_id: string;
          until: string;
        };
        ComputedFields: never;
        Insert: {
          company_id?: string;
          item_id: string;
          until: string;
        };
        Update: {
          company_id?: string;
          item_id?: string;
          until?: string;
        };
        Relationships: [
          {
            foreignKeyName: "snoozes_company_id_fkey";
            columns: ["company_id"];
            isOneToOne: false;
            referencedRelation: "companies";
            referencedColumns: ["id"];
          },
        ];
      };
      stages: {
        Row: {
          dot: string;
          id: string;
          is_pipeline: boolean;
          name: string;
          position: number;
        };
        ComputedFields: never;
        Insert: {
          dot?: string;
          id: string;
          is_pipeline?: boolean;
          name: string;
          position: number;
        };
        Update: {
          dot?: string;
          id?: string;
          is_pipeline?: boolean;
          name?: string;
          position?: number;
        };
        Relationships: [];
      };
      strategy_cards: {
        Row: {
          body: string;
          company_id: string;
          created_at: string;
          id: string;
          kind: string;
          position: number;
          title: string;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          body?: string;
          company_id?: string;
          created_at?: string;
          id?: string;
          kind?: string;
          position?: number;
          title: string;
          updated_at?: string;
        };
        Update: {
          body?: string;
          company_id?: string;
          created_at?: string;
          id?: string;
          kind?: string;
          position?: number;
          title?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "strategy_cards_company_id_fkey";
            columns: ["company_id"];
            isOneToOne: false;
            referencedRelation: "companies";
            referencedColumns: ["id"];
          },
        ];
      };
      tasks: {
        Row: {
          at: string;
          company_id: string;
          contact_id: string | null;
          created_at: string;
          done: boolean;
          id: string;
          seller_id: string | null;
          title: string;
          type: string;
        };
        ComputedFields: never;
        Insert: {
          at: string;
          company_id: string;
          contact_id?: string | null;
          created_at?: string;
          done?: boolean;
          id?: string;
          seller_id?: string | null;
          title: string;
          type: string;
        };
        Update: {
          at?: string;
          company_id?: string;
          contact_id?: string | null;
          created_at?: string;
          done?: boolean;
          id?: string;
          seller_id?: string | null;
          title?: string;
          type?: string;
        };
        Relationships: [
          {
            foreignKeyName: "tasks_company_id_fkey";
            columns: ["company_id"];
            isOneToOne: false;
            referencedRelation: "companies";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "tasks_contact_id_fkey";
            columns: ["contact_id"];
            isOneToOne: false;
            referencedRelation: "contacts";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "tasks_seller_id_fkey";
            columns: ["seller_id"];
            isOneToOne: false;
            referencedRelation: "sellers";
            referencedColumns: ["id"];
          },
        ];
      };
      users: {
        Row: {
          company_id: string | null;
          created_at: string;
          email: string;
          failed_login_attempts: number;
          id: string;
          last_login_at: string | null;
          locked_until: string | null;
          must_change_password: boolean;
          name: string;
          password_changed_at: string;
          password_hash: string;
          role: string;
          status: string;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          company_id?: string | null;
          created_at?: string;
          email: string;
          failed_login_attempts?: number;
          id?: string;
          last_login_at?: string | null;
          locked_until?: string | null;
          must_change_password?: boolean;
          name: string;
          password_changed_at?: string;
          password_hash: string;
          role: string;
          status?: string;
          updated_at?: string;
        };
        Update: {
          company_id?: string | null;
          created_at?: string;
          email?: string;
          failed_login_attempts?: number;
          id?: string;
          last_login_at?: string | null;
          locked_until?: string | null;
          must_change_password?: boolean;
          name?: string;
          password_changed_at?: string;
          password_hash?: string;
          role?: string;
          status?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "users_company_id_fkey";
            columns: ["company_id"];
            isOneToOne: false;
            referencedRelation: "companies";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      accept_invitation: {
        Args: { p_name: string; p_password_hash: string; p_token_hash: string };
        Returns: Json;
      };
      complete_password_reset: {
        Args: { p_password_hash: string; p_token_hash: string };
        Returns: string;
      };
      create_member_direct: {
        Args: {
          p_company_id: string;
          p_country_code: string | null;
          p_email: string;
          p_name: string;
          p_password_hash: string;
          p_role: string;
          p_seller_id: string | null;
        };
        Returns: Json;
      };
      create_payment_plan: {
        Args: { p_deal_id: string; p_first_paid_method?: string; p_items: Json };
        Returns: {
          amount: number;
          company_id: string;
          contact_id: string;
          created_at: string;
          currency: string;
          deal_id: string;
          due_at: string;
          id: string;
          label: string;
          method: string | null;
          n: number;
          of_total: number;
          paid_at: string | null;
          ref: string;
        }[];
        SetofOptions: {
          from: "*";
          to: "payments";
          isOneToOne: false;
          isSetofReturn: true;
        };
      };
      create_super_admin: {
        Args: { p_email: string; p_name?: string; p_password: string };
        Returns: string;
      };
      dearmor: { Args: { "": string }; Returns: string };
      gen_random_uuid: { Args: Record<PropertyKey, never>; Returns: string };
      gen_salt: { Args: { "": string }; Returns: string };
      import_contacts: {
        Args: { p_company: string; p_file: string; p_items: Json; p_kind?: string; p_seller: string; p_summary: Json };
        Returns: Json;
      };
      import_undo: {
        Args: { p_batch: string; p_company: string };
        Returns: Json;
      };
      move_deal: {
        Args: { p_author?: string; p_deal_id: string; p_stage: string };
        Returns: {
          amount: number;
          closed_at: string | null;
          company_id: string;
          contact_id: string;
          created_at: string;
          currency: string;
          id: string;
          next_action: string;
          next_at: string | null;
          product: string;
          stage: string;
          temp: string;
          updated_at: string;
        };
        SetofOptions: {
          from: "*";
          to: "deals";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      pgp_armor_headers: { Args: { "": string }; Returns: Record<string, unknown>[] };
      register_payment: {
        Args: {
          p_amount: number;
          p_author?: string;
          p_method: string;
          p_paid_at?: string;
          p_payment_id: string;
          p_ref?: string;
        };
        Returns: Json;
      };
      seed_demo_data: { Args: Record<PropertyKey, never>; Returns: undefined };
      set_contact_temp: {
        Args: { p_contact_id: string; p_temp: string };
        Returns: {
          channel: string | null;
          city: string;
          company: string;
          company_id: string;
          country_code: string;
          created_at: string;
          doc: string;
          email: string;
          id: string;
          name: string;
          owner_id: string | null;
          phone: string;
          region: string;
          temp: string;
          updated_at: string;
        };
        SetofOptions: {
          from: "*";
          to: "contacts";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      vx_at: { Args: { p_days?: number; p_hour?: number; p_min?: number }; Returns: string };
      vx_money: { Args: { p_amount: number; p_currency: string }; Returns: string };
      vx_month_offset: { Args: { p_n: number }; Returns: number };
      vx_session_company: { Args: Record<PropertyKey, never>; Returns: string };
      vx_today: { Args: Record<PropertyKey, never>; Returns: string };
      vx_tz: { Args: Record<PropertyKey, never>; Returns: string };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {},
  },
} as const;
