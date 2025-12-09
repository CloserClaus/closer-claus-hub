export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      call_logs: {
        Row: {
          call_status: string
          caller_id: string
          callhippo_call_id: string | null
          created_at: string
          duration_seconds: number | null
          ended_at: string | null
          id: string
          lead_id: string | null
          notes: string | null
          phone_number: string
          workspace_id: string
        }
        Insert: {
          call_status?: string
          caller_id: string
          callhippo_call_id?: string | null
          created_at?: string
          duration_seconds?: number | null
          ended_at?: string | null
          id?: string
          lead_id?: string | null
          notes?: string | null
          phone_number: string
          workspace_id: string
        }
        Update: {
          call_status?: string
          caller_id?: string
          callhippo_call_id?: string | null
          created_at?: string
          duration_seconds?: number | null
          ended_at?: string | null
          id?: string
          lead_id?: string | null
          notes?: string | null
          phone_number?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "call_logs_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "call_logs_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      commissions: {
        Row: {
          amount: number
          created_at: string
          deal_id: string
          id: string
          paid_at: string | null
          rake_amount: number
          sdr_id: string
          status: string
          stripe_payment_intent_id: string | null
          updated_at: string
          workspace_id: string
        }
        Insert: {
          amount?: number
          created_at?: string
          deal_id: string
          id?: string
          paid_at?: string | null
          rake_amount?: number
          sdr_id: string
          status?: string
          stripe_payment_intent_id?: string | null
          updated_at?: string
          workspace_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          deal_id?: string
          id?: string
          paid_at?: string | null
          rake_amount?: number
          sdr_id?: string
          status?: string
          stripe_payment_intent_id?: string | null
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "commissions_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commissions_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      contract_signatures: {
        Row: {
          contract_id: string
          id: string
          ip_address: string | null
          signature_data: string | null
          signed_at: string
          signer_email: string
          signer_name: string
          user_agent: string | null
        }
        Insert: {
          contract_id: string
          id?: string
          ip_address?: string | null
          signature_data?: string | null
          signed_at?: string
          signer_email: string
          signer_name: string
          user_agent?: string | null
        }
        Update: {
          contract_id?: string
          id?: string
          ip_address?: string | null
          signature_data?: string | null
          signed_at?: string
          signer_email?: string
          signer_name?: string
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "contract_signatures_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "contracts"
            referencedColumns: ["id"]
          },
        ]
      }
      contracts: {
        Row: {
          content: string
          created_at: string
          created_by: string
          custom_pdf_url: string | null
          deal_id: string
          id: string
          sent_at: string | null
          signed_at: string | null
          status: string
          template_type: string
          title: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          content: string
          created_at?: string
          created_by: string
          custom_pdf_url?: string | null
          deal_id: string
          id?: string
          sent_at?: string | null
          signed_at?: string | null
          status?: string
          template_type?: string
          title: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          content?: string
          created_at?: string
          created_by?: string
          custom_pdf_url?: string | null
          deal_id?: string
          id?: string
          sent_at?: string | null
          signed_at?: string | null
          status?: string
          template_type?: string
          title?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "contracts_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contracts_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      conversation_participants: {
        Row: {
          conversation_id: string
          id: string
          is_read_only: boolean
          joined_at: string
          left_at: string | null
          user_id: string
        }
        Insert: {
          conversation_id: string
          id?: string
          is_read_only?: boolean
          joined_at?: string
          left_at?: string | null
          user_id: string
        }
        Update: {
          conversation_id?: string
          id?: string
          is_read_only?: boolean
          joined_at?: string
          left_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversation_participants_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      conversations: {
        Row: {
          created_at: string
          id: string
          is_group: boolean
          name: string | null
          updated_at: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_group?: boolean
          name?: string | null
          updated_at?: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_group?: boolean
          name?: string | null
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversations_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      credit_purchases: {
        Row: {
          created_at: string
          credits_amount: number
          id: string
          price_paid: number
          purchased_by: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          credits_amount: number
          id?: string
          price_paid: number
          purchased_by: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          credits_amount?: number
          id?: string
          price_paid?: number
          purchased_by?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "credit_purchases_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      deal_activities: {
        Row: {
          activity_type: string
          created_at: string
          deal_id: string
          description: string
          id: string
          user_id: string
        }
        Insert: {
          activity_type: string
          created_at?: string
          deal_id: string
          description: string
          id?: string
          user_id: string
        }
        Update: {
          activity_type?: string
          created_at?: string
          deal_id?: string
          description?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "deal_activities_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
        ]
      }
      deals: {
        Row: {
          assigned_to: string
          closed_at: string | null
          created_at: string
          expected_close_date: string | null
          id: string
          lead_id: string | null
          notes: string | null
          stage: Database["public"]["Enums"]["pipeline_stage"]
          title: string
          updated_at: string
          value: number
          workspace_id: string
        }
        Insert: {
          assigned_to: string
          closed_at?: string | null
          created_at?: string
          expected_close_date?: string | null
          id?: string
          lead_id?: string | null
          notes?: string | null
          stage?: Database["public"]["Enums"]["pipeline_stage"]
          title: string
          updated_at?: string
          value?: number
          workspace_id: string
        }
        Update: {
          assigned_to?: string
          closed_at?: string | null
          created_at?: string
          expected_close_date?: string | null
          id?: string
          lead_id?: string | null
          notes?: string | null
          stage?: Database["public"]["Enums"]["pipeline_stage"]
          title?: string
          updated_at?: string
          value?: number
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "deals_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deals_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      disputes: {
        Row: {
          admin_notes: string | null
          created_at: string
          deal_id: string
          id: string
          raised_by: string
          reason: string
          resolved_at: string | null
          resolved_by: string | null
          status: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          admin_notes?: string | null
          created_at?: string
          deal_id: string
          id?: string
          raised_by: string
          reason: string
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          admin_notes?: string | null
          created_at?: string
          deal_id?: string
          id?: string
          raised_by?: string
          reason?: string
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "disputes_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "disputes_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      job_applications: {
        Row: {
          applied_at: string
          cover_letter: string | null
          id: string
          job_id: string
          status: Database["public"]["Enums"]["application_status"]
          updated_at: string
          user_id: string
        }
        Insert: {
          applied_at?: string
          cover_letter?: string | null
          id?: string
          job_id: string
          status?: Database["public"]["Enums"]["application_status"]
          updated_at?: string
          user_id: string
        }
        Update: {
          applied_at?: string
          cover_letter?: string | null
          id?: string
          job_id?: string
          status?: Database["public"]["Enums"]["application_status"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "job_applications_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      jobs: {
        Row: {
          commission_percentage: number | null
          created_at: string
          description: string
          employment_type: Database["public"]["Enums"]["employment_type"]
          id: string
          is_active: boolean
          requirements: string[] | null
          salary_amount: number | null
          title: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          commission_percentage?: number | null
          created_at?: string
          description: string
          employment_type?: Database["public"]["Enums"]["employment_type"]
          id?: string
          is_active?: boolean
          requirements?: string[] | null
          salary_amount?: number | null
          title: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          commission_percentage?: number | null
          created_at?: string
          description?: string
          employment_type?: Database["public"]["Enums"]["employment_type"]
          id?: string
          is_active?: boolean
          requirements?: string[] | null
          salary_amount?: number | null
          title?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "jobs_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      leads: {
        Row: {
          company: string | null
          created_at: string
          created_by: string
          email: string | null
          first_name: string
          id: string
          last_contacted_at: string | null
          last_name: string
          notes: string | null
          phone: string | null
          title: string | null
          updated_at: string
          workspace_id: string
        }
        Insert: {
          company?: string | null
          created_at?: string
          created_by: string
          email?: string | null
          first_name: string
          id?: string
          last_contacted_at?: string | null
          last_name: string
          notes?: string | null
          phone?: string | null
          title?: string | null
          updated_at?: string
          workspace_id: string
        }
        Update: {
          company?: string | null
          created_at?: string
          created_by?: string
          email?: string | null
          first_name?: string
          id?: string
          last_contacted_at?: string | null
          last_name?: string
          notes?: string | null
          phone?: string | null
          title?: string | null
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "leads_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          content: string
          conversation_id: string
          created_at: string
          id: string
          sender_id: string
          updated_at: string
        }
        Insert: {
          content: string
          conversation_id: string
          created_at?: string
          id?: string
          sender_id: string
          updated_at?: string
        }
        Update: {
          content?: string
          conversation_id?: string
          created_at?: string
          id?: string
          sender_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          created_at: string
          data: Json | null
          id: string
          is_read: boolean
          message: string
          title: string
          type: string
          user_id: string
          workspace_id: string | null
        }
        Insert: {
          created_at?: string
          data?: Json | null
          id?: string
          is_read?: boolean
          message: string
          title: string
          type: string
          user_id: string
          workspace_id?: string | null
        }
        Update: {
          created_at?: string
          data?: Json | null
          id?: string
          is_read?: boolean
          message?: string
          title?: string
          type?: string
          user_id?: string
          workspace_id?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string | null
          email: string
          full_name: string | null
          id: string
          onboarding_completed: boolean | null
          phone: string | null
          updated_at: string | null
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string | null
          email: string
          full_name?: string | null
          id: string
          onboarding_completed?: boolean | null
          phone?: string | null
          updated_at?: string | null
        }
        Update: {
          avatar_url?: string | null
          created_at?: string | null
          email?: string
          full_name?: string | null
          id?: string
          onboarding_completed?: boolean | null
          phone?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      training_materials: {
        Row: {
          content_type: string
          created_at: string
          created_by: string
          description: string | null
          file_size: number | null
          file_type: string | null
          file_url: string | null
          id: string
          title: string
          updated_at: string
          video_url: string | null
          workspace_id: string
        }
        Insert: {
          content_type?: string
          created_at?: string
          created_by: string
          description?: string | null
          file_size?: number | null
          file_type?: string | null
          file_url?: string | null
          id?: string
          title: string
          updated_at?: string
          video_url?: string | null
          workspace_id: string
        }
        Update: {
          content_type?: string
          created_at?: string
          created_by?: string
          description?: string | null
          file_size?: number | null
          file_type?: string | null
          file_url?: string | null
          id?: string
          title?: string
          updated_at?: string
          video_url?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "training_materials_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string | null
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      workspace_credits: {
        Row: {
          created_at: string
          credits_balance: number
          id: string
          last_purchased_at: string | null
          updated_at: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          credits_balance?: number
          id?: string
          last_purchased_at?: string | null
          updated_at?: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          credits_balance?: number
          id?: string
          last_purchased_at?: string | null
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workspace_credits_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: true
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      workspace_members: {
        Row: {
          cooldown_until: string | null
          id: string
          is_salary_exclusive: boolean | null
          joined_at: string | null
          removed_at: string | null
          user_id: string
          workspace_id: string
        }
        Insert: {
          cooldown_until?: string | null
          id?: string
          is_salary_exclusive?: boolean | null
          joined_at?: string | null
          removed_at?: string | null
          user_id: string
          workspace_id: string
        }
        Update: {
          cooldown_until?: string | null
          id?: string
          is_salary_exclusive?: boolean | null
          joined_at?: string | null
          removed_at?: string | null
          user_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workspace_members_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      workspace_phone_numbers: {
        Row: {
          callhippo_number_id: string | null
          country_code: string
          created_at: string
          id: string
          is_active: boolean
          monthly_cost: number
          phone_number: string
          purchased_at: string
          workspace_id: string
        }
        Insert: {
          callhippo_number_id?: string | null
          country_code?: string
          created_at?: string
          id?: string
          is_active?: boolean
          monthly_cost?: number
          phone_number: string
          purchased_at?: string
          workspace_id: string
        }
        Update: {
          callhippo_number_id?: string | null
          country_code?: string
          created_at?: string
          id?: string
          is_active?: boolean
          monthly_cost?: number
          phone_number?: string
          purchased_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workspace_phone_numbers_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      workspaces: {
        Row: {
          created_at: string | null
          id: string
          is_locked: boolean | null
          max_sdrs: number | null
          name: string
          owner_id: string
          rake_percentage: number | null
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          subscription_tier:
            | Database["public"]["Enums"]["subscription_tier"]
            | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_locked?: boolean | null
          max_sdrs?: number | null
          name: string
          owner_id: string
          rake_percentage?: number | null
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          subscription_tier?:
            | Database["public"]["Enums"]["subscription_tier"]
            | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          is_locked?: boolean | null
          max_sdrs?: number | null
          name?: string
          owner_id?: string
          rake_percentage?: number | null
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          subscription_tier?:
            | Database["public"]["Enums"]["subscription_tier"]
            | null
          updated_at?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_first_user: { Args: never; Returns: boolean }
      is_workspace_member: {
        Args: { _user_id: string; _workspace_id: string }
        Returns: boolean
      }
      is_workspace_owner: {
        Args: { _user_id: string; _workspace_id: string }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "platform_admin" | "agency_owner" | "sdr"
      application_status:
        | "applied"
        | "shortlisted"
        | "interviewing"
        | "hired"
        | "rejected"
      employment_type: "commission_only" | "salary"
      pipeline_stage:
        | "new"
        | "contacted"
        | "discovery"
        | "meeting"
        | "proposal"
        | "closed_won"
        | "closed_lost"
      subscription_tier: "omega" | "beta" | "alpha"
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
      app_role: ["platform_admin", "agency_owner", "sdr"],
      application_status: [
        "applied",
        "shortlisted",
        "interviewing",
        "hired",
        "rejected",
      ],
      employment_type: ["commission_only", "salary"],
      pipeline_stage: [
        "new",
        "contacted",
        "discovery",
        "meeting",
        "proposal",
        "closed_won",
        "closed_lost",
      ],
      subscription_tier: ["omega", "beta", "alpha"],
    },
  },
} as const
