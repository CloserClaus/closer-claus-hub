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
      apollo_leads: {
        Row: {
          apollo_id: string
          city: string | null
          company_domain: string | null
          company_linkedin_url: string | null
          company_name: string | null
          country: string | null
          created_at: string | null
          credits_used: number | null
          department: string | null
          email: string | null
          email_status: string | null
          employee_count: string | null
          enriched_at: string | null
          enriched_by: string | null
          enrichment_status: string
          first_name: string | null
          id: string
          industry: string | null
          last_name: string | null
          linkedin_url: string | null
          phone: string | null
          phone_status: string | null
          search_filters: Json | null
          seniority: string | null
          state: string | null
          title: string | null
          workspace_id: string
        }
        Insert: {
          apollo_id: string
          city?: string | null
          company_domain?: string | null
          company_linkedin_url?: string | null
          company_name?: string | null
          country?: string | null
          created_at?: string | null
          credits_used?: number | null
          department?: string | null
          email?: string | null
          email_status?: string | null
          employee_count?: string | null
          enriched_at?: string | null
          enriched_by?: string | null
          enrichment_status?: string
          first_name?: string | null
          id?: string
          industry?: string | null
          last_name?: string | null
          linkedin_url?: string | null
          phone?: string | null
          phone_status?: string | null
          search_filters?: Json | null
          seniority?: string | null
          state?: string | null
          title?: string | null
          workspace_id: string
        }
        Update: {
          apollo_id?: string
          city?: string | null
          company_domain?: string | null
          company_linkedin_url?: string | null
          company_name?: string | null
          country?: string | null
          created_at?: string | null
          credits_used?: number | null
          department?: string | null
          email?: string | null
          email_status?: string | null
          employee_count?: string | null
          enriched_at?: string | null
          enriched_by?: string | null
          enrichment_status?: string
          first_name?: string | null
          id?: string
          industry?: string | null
          last_name?: string | null
          linkedin_url?: string | null
          phone?: string | null
          phone_status?: string | null
          search_filters?: Json | null
          seniority?: string | null
          state?: string | null
          title?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "apollo_leads_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      bug_reports: {
        Row: {
          admin_notes: string | null
          attachment_urls: string[] | null
          created_at: string
          description: string
          id: string
          resolved_at: string | null
          resolved_by: string | null
          status: string
          title: string
          updated_at: string
          user_id: string
          user_role: string
        }
        Insert: {
          admin_notes?: string | null
          attachment_urls?: string[] | null
          created_at?: string
          description: string
          id?: string
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string
          title: string
          updated_at?: string
          user_id: string
          user_role: string
        }
        Update: {
          admin_notes?: string | null
          attachment_urls?: string[] | null
          created_at?: string
          description?: string
          id?: string
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string
          title?: string
          updated_at?: string
          user_id?: string
          user_role?: string
        }
        Relationships: []
      }
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
          recording_url: string | null
          twilio_call_sid: string | null
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
          recording_url?: string | null
          twilio_call_sid?: string | null
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
          recording_url?: string | null
          twilio_call_sid?: string | null
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
      call_scripts: {
        Row: {
          content: string
          created_at: string
          created_by: string
          id: string
          is_default: boolean
          title: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          content: string
          created_at?: string
          created_by: string
          id?: string
          is_default?: boolean
          title: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          content?: string
          created_at?: string
          created_by?: string
          id?: string
          is_default?: boolean
          title?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "call_scripts_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      commissions: {
        Row: {
          agency_rake_amount: number | null
          amount: number
          created_at: string
          deal_id: string
          id: string
          paid_at: string | null
          payout_failure_reason: string | null
          payout_last_retry_at: string | null
          payout_retry_count: number | null
          platform_cut_amount: number | null
          platform_cut_percentage: number | null
          rake_amount: number
          sdr_id: string
          sdr_paid_at: string | null
          sdr_payout_amount: number | null
          sdr_payout_status: string | null
          sdr_payout_stripe_transfer_id: string | null
          status: string
          stripe_payment_intent_id: string | null
          updated_at: string
          workspace_id: string
        }
        Insert: {
          agency_rake_amount?: number | null
          amount?: number
          created_at?: string
          deal_id: string
          id?: string
          paid_at?: string | null
          payout_failure_reason?: string | null
          payout_last_retry_at?: string | null
          payout_retry_count?: number | null
          platform_cut_amount?: number | null
          platform_cut_percentage?: number | null
          rake_amount?: number
          sdr_id: string
          sdr_paid_at?: string | null
          sdr_payout_amount?: number | null
          sdr_payout_status?: string | null
          sdr_payout_stripe_transfer_id?: string | null
          status?: string
          stripe_payment_intent_id?: string | null
          updated_at?: string
          workspace_id: string
        }
        Update: {
          agency_rake_amount?: number | null
          amount?: number
          created_at?: string
          deal_id?: string
          id?: string
          paid_at?: string | null
          payout_failure_reason?: string | null
          payout_last_retry_at?: string | null
          payout_retry_count?: number | null
          platform_cut_amount?: number | null
          platform_cut_percentage?: number | null
          rake_amount?: number
          sdr_id?: string
          sdr_paid_at?: string | null
          sdr_payout_amount?: number | null
          sdr_payout_status?: string | null
          sdr_payout_stripe_transfer_id?: string | null
          status?: string
          stripe_payment_intent_id?: string | null
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "commissions_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: true
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
      contract_requests: {
        Row: {
          agency_notes: string | null
          client_address: string | null
          client_company: string | null
          client_email: string
          client_name: string
          client_phone: string | null
          client_title: string | null
          contract_duration: string | null
          created_at: string
          deal_description: string
          deal_id: string
          deal_value: number
          deliverables: string | null
          id: string
          payment_terms: string
          requested_by: string
          reviewed_at: string | null
          reviewed_by: string | null
          special_conditions: string | null
          start_date: string | null
          status: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          agency_notes?: string | null
          client_address?: string | null
          client_company?: string | null
          client_email: string
          client_name: string
          client_phone?: string | null
          client_title?: string | null
          contract_duration?: string | null
          created_at?: string
          deal_description: string
          deal_id: string
          deal_value: number
          deliverables?: string | null
          id?: string
          payment_terms: string
          requested_by: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          special_conditions?: string | null
          start_date?: string | null
          status?: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          agency_notes?: string | null
          client_address?: string | null
          client_company?: string | null
          client_email?: string
          client_name?: string
          client_phone?: string | null
          client_title?: string | null
          contract_duration?: string | null
          created_at?: string
          deal_description?: string
          deal_id?: string
          deal_value?: number
          deliverables?: string | null
          id?: string
          payment_terms?: string
          requested_by?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          special_conditions?: string | null
          start_date?: string | null
          status?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "contract_requests_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contract_requests_workspace_id_fkey"
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
      contract_signing_otps: {
        Row: {
          attempts: number | null
          contract_id: string
          created_at: string | null
          email: string
          expires_at: string
          id: string
          otp_code: string
          session_token: string | null
          verified_at: string | null
        }
        Insert: {
          attempts?: number | null
          contract_id: string
          created_at?: string | null
          email: string
          expires_at: string
          id?: string
          otp_code: string
          session_token?: string | null
          verified_at?: string | null
        }
        Update: {
          attempts?: number | null
          contract_id?: string
          created_at?: string | null
          email?: string
          expires_at?: string
          id?: string
          otp_code?: string
          session_token?: string | null
          verified_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "contract_signing_otps_contract_id_fkey"
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
      coupon_redemptions: {
        Row: {
          coupon_id: string
          discount_applied: number
          id: string
          redeemed_at: string
          workspace_id: string
        }
        Insert: {
          coupon_id: string
          discount_applied: number
          id?: string
          redeemed_at?: string
          workspace_id: string
        }
        Update: {
          coupon_id?: string
          discount_applied?: number
          id?: string
          redeemed_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "coupon_redemptions_coupon_id_fkey"
            columns: ["coupon_id"]
            isOneToOne: false
            referencedRelation: "coupons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coupon_redemptions_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      coupons: {
        Row: {
          code: string
          created_at: string
          created_by: string
          current_uses: number
          discount_percentage: number
          id: string
          is_active: boolean
          max_uses: number | null
          updated_at: string
          valid_from: string
          valid_until: string | null
        }
        Insert: {
          code: string
          created_at?: string
          created_by: string
          current_uses?: number
          discount_percentage: number
          id?: string
          is_active?: boolean
          max_uses?: number | null
          updated_at?: string
          valid_from?: string
          valid_until?: string | null
        }
        Update: {
          code?: string
          created_at?: string
          created_by?: string
          current_uses?: number
          discount_percentage?: number
          id?: string
          is_active?: boolean
          max_uses?: number | null
          updated_at?: string
          valid_from?: string
          valid_until?: string | null
        }
        Relationships: []
      }
      credit_purchases: {
        Row: {
          created_at: string
          credits_amount: number
          id: string
          price_paid: number
          purchased_by: string
          stripe_session_id: string | null
          workspace_id: string
        }
        Insert: {
          created_at?: string
          credits_amount: number
          id?: string
          price_paid: number
          purchased_by: string
          stripe_session_id?: string | null
          workspace_id: string
        }
        Update: {
          created_at?: string
          credits_amount?: number
          id?: string
          price_paid?: number
          purchased_by?: string
          stripe_session_id?: string | null
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
      daily_stats: {
        Row: {
          created_at: string
          id: string
          stat_date: string
          stat_type: string
          stat_value: number
          user_id: string | null
          workspace_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          stat_date: string
          stat_type: string
          stat_value?: number
          user_id?: string | null
          workspace_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          stat_date?: string
          stat_type?: string
          stat_value?: number
          user_id?: string | null
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "daily_stats_workspace_id_fkey"
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
          version: number | null
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
          version?: number | null
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
          version?: number | null
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
      dialer_sequences: {
        Row: {
          created_at: string
          created_by: string
          id: string
          lead_ids: string[]
          name: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          created_by: string
          id?: string
          lead_ids?: string[]
          name: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          created_by?: string
          id?: string
          lead_ids?: string[]
          name?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "dialer_sequences_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      dialer_sessions: {
        Row: {
          created_at: string | null
          current_call_sid: string | null
          current_lead_id: string | null
          ended_at: string | null
          id: string
          last_heartbeat_at: string
          started_at: string
          status: string
          total_calls: number | null
          user_id: string
          workspace_id: string
        }
        Insert: {
          created_at?: string | null
          current_call_sid?: string | null
          current_lead_id?: string | null
          ended_at?: string | null
          id?: string
          last_heartbeat_at?: string
          started_at?: string
          status?: string
          total_calls?: number | null
          user_id: string
          workspace_id: string
        }
        Update: {
          created_at?: string | null
          current_call_sid?: string | null
          current_lead_id?: string | null
          ended_at?: string | null
          id?: string
          last_heartbeat_at?: string
          started_at?: string
          status?: string
          total_calls?: number | null
          user_id?: string
          workspace_id?: string
        }
        Relationships: []
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
      email_verification_tokens: {
        Row: {
          created_at: string
          expires_at: string
          id: string
          token: string
          used_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          expires_at?: string
          id?: string
          token: string
          used_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          expires_at?: string
          id?: string
          token?: string
          used_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      feature_followers: {
        Row: {
          created_at: string
          feature_id: string
          id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          feature_id: string
          id?: string
          user_id: string
        }
        Update: {
          created_at?: string
          feature_id?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "feature_followers_feature_id_fkey"
            columns: ["feature_id"]
            isOneToOne: false
            referencedRelation: "feature_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      feature_requests: {
        Row: {
          admin_notes: string | null
          created_at: string
          description: string
          id: string
          progress_percentage: number | null
          status: string
          target_audience: string
          title: string
          updated_at: string
          upvotes_count: number
          user_id: string
          user_role: string
        }
        Insert: {
          admin_notes?: string | null
          created_at?: string
          description: string
          id?: string
          progress_percentage?: number | null
          status?: string
          target_audience?: string
          title: string
          updated_at?: string
          upvotes_count?: number
          user_id: string
          user_role: string
        }
        Update: {
          admin_notes?: string | null
          created_at?: string
          description?: string
          id?: string
          progress_percentage?: number | null
          status?: string
          target_audience?: string
          title?: string
          updated_at?: string
          upvotes_count?: number
          user_id?: string
          user_role?: string
        }
        Relationships: []
      }
      feature_upvotes: {
        Row: {
          created_at: string
          feature_id: string
          id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          feature_id: string
          id?: string
          user_id: string
        }
        Update: {
          created_at?: string
          feature_id?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "feature_upvotes_feature_id_fkey"
            columns: ["feature_id"]
            isOneToOne: false
            referencedRelation: "feature_requests"
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
          average_ticket_size: number | null
          commission_percentage: number | null
          company_description: string | null
          created_at: string
          description: string
          dream_outcome: string | null
          employment_type: Database["public"]["Enums"]["employment_type"]
          icp_company_size_max: number | null
          icp_company_size_min: number | null
          icp_company_type: string | null
          icp_founding_year_max: number | null
          icp_founding_year_min: number | null
          icp_industry: string | null
          icp_intent_signal: string | null
          icp_job_titles: string[] | null
          icp_revenue_max: number | null
          icp_revenue_min: number | null
          id: string
          is_active: boolean
          offer_description: string | null
          payment_type: string | null
          requirements: string[] | null
          salary_amount: number | null
          title: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          average_ticket_size?: number | null
          commission_percentage?: number | null
          company_description?: string | null
          created_at?: string
          description: string
          dream_outcome?: string | null
          employment_type?: Database["public"]["Enums"]["employment_type"]
          icp_company_size_max?: number | null
          icp_company_size_min?: number | null
          icp_company_type?: string | null
          icp_founding_year_max?: number | null
          icp_founding_year_min?: number | null
          icp_industry?: string | null
          icp_intent_signal?: string | null
          icp_job_titles?: string[] | null
          icp_revenue_max?: number | null
          icp_revenue_min?: number | null
          id?: string
          is_active?: boolean
          offer_description?: string | null
          payment_type?: string | null
          requirements?: string[] | null
          salary_amount?: number | null
          title: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          average_ticket_size?: number | null
          commission_percentage?: number | null
          company_description?: string | null
          created_at?: string
          description?: string
          dream_outcome?: string | null
          employment_type?: Database["public"]["Enums"]["employment_type"]
          icp_company_size_max?: number | null
          icp_company_size_min?: number | null
          icp_company_type?: string | null
          icp_founding_year_max?: number | null
          icp_founding_year_min?: number | null
          icp_industry?: string | null
          icp_intent_signal?: string | null
          icp_job_titles?: string[] | null
          icp_revenue_max?: number | null
          icp_revenue_min?: number | null
          id?: string
          is_active?: boolean
          offer_description?: string | null
          payment_type?: string | null
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
      lead_credit_purchases: {
        Row: {
          created_at: string | null
          credits_amount: number
          id: string
          price_paid: number
          purchased_by: string
          stripe_session_id: string | null
          workspace_id: string
        }
        Insert: {
          created_at?: string | null
          credits_amount: number
          id?: string
          price_paid: number
          purchased_by: string
          stripe_session_id?: string | null
          workspace_id: string
        }
        Update: {
          created_at?: string | null
          credits_amount?: number
          id?: string
          price_paid?: number
          purchased_by?: string
          stripe_session_id?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "lead_credit_purchases_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_credits: {
        Row: {
          created_at: string | null
          credits_balance: number
          id: string
          last_purchased_at: string | null
          updated_at: string | null
          workspace_id: string
        }
        Insert: {
          created_at?: string | null
          credits_balance?: number
          id?: string
          last_purchased_at?: string | null
          updated_at?: string | null
          workspace_id: string
        }
        Update: {
          created_at?: string | null
          credits_balance?: number
          id?: string
          last_purchased_at?: string | null
          updated_at?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "lead_credits_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: true
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_list_items: {
        Row: {
          added_at: string | null
          apollo_lead_id: string
          id: string
          lead_list_id: string
        }
        Insert: {
          added_at?: string | null
          apollo_lead_id: string
          id?: string
          lead_list_id: string
        }
        Update: {
          added_at?: string | null
          apollo_lead_id?: string
          id?: string
          lead_list_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "lead_list_items_apollo_lead_id_fkey"
            columns: ["apollo_lead_id"]
            isOneToOne: false
            referencedRelation: "apollo_leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_list_items_lead_list_id_fkey"
            columns: ["lead_list_id"]
            isOneToOne: false
            referencedRelation: "lead_lists"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_lists: {
        Row: {
          created_at: string | null
          created_by: string
          description: string | null
          id: string
          name: string
          updated_at: string | null
          workspace_id: string
        }
        Insert: {
          created_at?: string | null
          created_by: string
          description?: string | null
          id?: string
          name: string
          updated_at?: string | null
          workspace_id: string
        }
        Update: {
          created_at?: string | null
          created_by?: string
          description?: string | null
          id?: string
          name?: string
          updated_at?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "lead_lists_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      leads: {
        Row: {
          apollo_lead_id: string | null
          assigned_to: string | null
          city: string | null
          company: string | null
          company_domain: string | null
          company_linkedin_url: string | null
          country: string | null
          created_at: string
          created_by: string
          department: string | null
          email: string | null
          employee_count: string | null
          first_name: string
          id: string
          industry: string | null
          last_contacted_at: string | null
          last_name: string
          linkedin_url: string | null
          notes: string | null
          phone: string | null
          seniority: string | null
          source: string | null
          state: string | null
          title: string | null
          updated_at: string
          workspace_id: string
        }
        Insert: {
          apollo_lead_id?: string | null
          assigned_to?: string | null
          city?: string | null
          company?: string | null
          company_domain?: string | null
          company_linkedin_url?: string | null
          country?: string | null
          created_at?: string
          created_by: string
          department?: string | null
          email?: string | null
          employee_count?: string | null
          first_name: string
          id?: string
          industry?: string | null
          last_contacted_at?: string | null
          last_name: string
          linkedin_url?: string | null
          notes?: string | null
          phone?: string | null
          seniority?: string | null
          source?: string | null
          state?: string | null
          title?: string | null
          updated_at?: string
          workspace_id: string
        }
        Update: {
          apollo_lead_id?: string | null
          assigned_to?: string | null
          city?: string | null
          company?: string | null
          company_domain?: string | null
          company_linkedin_url?: string | null
          country?: string | null
          created_at?: string
          created_by?: string
          department?: string | null
          email?: string | null
          employee_count?: string | null
          first_name?: string
          id?: string
          industry?: string | null
          last_contacted_at?: string | null
          last_name?: string
          linkedin_url?: string | null
          notes?: string | null
          phone?: string | null
          seniority?: string | null
          source?: string | null
          state?: string | null
          title?: string | null
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "leads_apollo_lead_id_fkey"
            columns: ["apollo_lead_id"]
            isOneToOne: false
            referencedRelation: "apollo_leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      master_leads: {
        Row: {
          apollo_id: string | null
          city: string | null
          company_domain: string | null
          company_linkedin_url: string | null
          company_name: string | null
          country: string | null
          created_at: string | null
          department: string | null
          email: string | null
          email_status: string | null
          employee_count: string | null
          enrichment_count: number | null
          first_enriched_at: string | null
          first_name: string | null
          id: string
          industry: string | null
          last_name: string | null
          last_updated_at: string | null
          linkedin_url: string
          phone: string | null
          phone_status: string | null
          seniority: string | null
          state: string | null
          title: string | null
        }
        Insert: {
          apollo_id?: string | null
          city?: string | null
          company_domain?: string | null
          company_linkedin_url?: string | null
          company_name?: string | null
          country?: string | null
          created_at?: string | null
          department?: string | null
          email?: string | null
          email_status?: string | null
          employee_count?: string | null
          enrichment_count?: number | null
          first_enriched_at?: string | null
          first_name?: string | null
          id?: string
          industry?: string | null
          last_name?: string | null
          last_updated_at?: string | null
          linkedin_url: string
          phone?: string | null
          phone_status?: string | null
          seniority?: string | null
          state?: string | null
          title?: string | null
        }
        Update: {
          apollo_id?: string | null
          city?: string | null
          company_domain?: string | null
          company_linkedin_url?: string | null
          company_name?: string | null
          country?: string | null
          created_at?: string | null
          department?: string | null
          email?: string | null
          email_status?: string | null
          employee_count?: string | null
          enrichment_count?: number | null
          first_enriched_at?: string | null
          first_name?: string | null
          id?: string
          industry?: string | null
          last_name?: string | null
          last_updated_at?: string | null
          linkedin_url?: string
          phone?: string | null
          phone_status?: string | null
          seniority?: string | null
          state?: string | null
          title?: string | null
        }
        Relationships: []
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
          email_verified: boolean | null
          full_name: string | null
          id: string
          onboarding_completed: boolean | null
          phone: string | null
          sdr_level: number | null
          stripe_connect_account_id: string | null
          stripe_connect_onboarded_at: string | null
          stripe_connect_status: string | null
          total_deals_closed_value: number | null
          updated_at: string | null
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string | null
          email: string
          email_verified?: boolean | null
          full_name?: string | null
          id: string
          onboarding_completed?: boolean | null
          phone?: string | null
          sdr_level?: number | null
          stripe_connect_account_id?: string | null
          stripe_connect_onboarded_at?: string | null
          stripe_connect_status?: string | null
          total_deals_closed_value?: number | null
          updated_at?: string | null
        }
        Update: {
          avatar_url?: string | null
          created_at?: string | null
          email?: string
          email_verified?: boolean | null
          full_name?: string | null
          id?: string
          onboarding_completed?: boolean | null
          phone?: string | null
          sdr_level?: number | null
          stripe_connect_account_id?: string | null
          stripe_connect_onboarded_at?: string | null
          stripe_connect_status?: string | null
          total_deals_closed_value?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
      rate_limits: {
        Row: {
          id: string
          key: string
          timestamp: string
        }
        Insert: {
          id?: string
          key: string
          timestamp?: string
        }
        Update: {
          id?: string
          key?: string
          timestamp?: string
        }
        Relationships: []
      }
      salary_payments: {
        Row: {
          agency_charge_status: string
          agency_charged_at: string | null
          application_id: string
          created_at: string
          failure_reason: string | null
          hired_at: string
          id: string
          job_id: string
          last_retry_at: string | null
          retry_count: number | null
          salary_amount: number
          sdr_id: string
          sdr_paid_at: string | null
          sdr_payout_amount: number | null
          sdr_payout_date: string
          sdr_payout_status: string
          sdr_stripe_transfer_id: string | null
          stripe_payment_intent_id: string | null
          updated_at: string
          workspace_id: string
        }
        Insert: {
          agency_charge_status?: string
          agency_charged_at?: string | null
          application_id: string
          created_at?: string
          failure_reason?: string | null
          hired_at?: string
          id?: string
          job_id: string
          last_retry_at?: string | null
          retry_count?: number | null
          salary_amount: number
          sdr_id: string
          sdr_paid_at?: string | null
          sdr_payout_amount?: number | null
          sdr_payout_date: string
          sdr_payout_status?: string
          sdr_stripe_transfer_id?: string | null
          stripe_payment_intent_id?: string | null
          updated_at?: string
          workspace_id: string
        }
        Update: {
          agency_charge_status?: string
          agency_charged_at?: string | null
          application_id?: string
          created_at?: string
          failure_reason?: string | null
          hired_at?: string
          id?: string
          job_id?: string
          last_retry_at?: string | null
          retry_count?: number | null
          salary_amount?: number
          sdr_id?: string
          sdr_paid_at?: string | null
          sdr_payout_amount?: number | null
          sdr_payout_date?: string
          sdr_payout_status?: string
          sdr_stripe_transfer_id?: string | null
          stripe_payment_intent_id?: string | null
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "salary_payments_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "job_applications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "salary_payments_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "salary_payments_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      scheduled_callbacks: {
        Row: {
          completed_at: string | null
          created_at: string
          created_by: string
          id: string
          lead_id: string
          notes: string | null
          reason: string | null
          scheduled_for: string
          status: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          created_by: string
          id?: string
          lead_id: string
          notes?: string | null
          reason?: string | null
          scheduled_for: string
          status?: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          created_by?: string
          id?: string
          lead_id?: string
          notes?: string | null
          reason?: string | null
          scheduled_for?: string
          status?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "scheduled_callbacks_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scheduled_callbacks_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      support_tickets: {
        Row: {
          admin_notes: string | null
          created_at: string
          description: string
          id: string
          status: string
          title: string
          updated_at: string
          user_email: string
          user_id: string
        }
        Insert: {
          admin_notes?: string | null
          created_at?: string
          description: string
          id?: string
          status?: string
          title: string
          updated_at?: string
          user_email: string
          user_id: string
        }
        Update: {
          admin_notes?: string | null
          created_at?: string
          description?: string
          id?: string
          status?: string
          title?: string
          updated_at?: string
          user_email?: string
          user_id?: string
        }
        Relationships: []
      }
      tasks: {
        Row: {
          assigned_to: string
          completed_at: string | null
          created_at: string
          created_by: string
          deal_id: string | null
          description: string | null
          due_date: string
          id: string
          lead_id: string | null
          priority: string
          reminder_sent: boolean
          status: string
          title: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          assigned_to: string
          completed_at?: string | null
          created_at?: string
          created_by: string
          deal_id?: string | null
          description?: string | null
          due_date: string
          id?: string
          lead_id?: string | null
          priority?: string
          reminder_sent?: boolean
          status?: string
          title: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          assigned_to?: string
          completed_at?: string | null
          created_at?: string
          created_by?: string
          deal_id?: string | null
          description?: string | null
          due_date?: string
          id?: string
          lead_id?: string | null
          priority?: string
          reminder_sent?: boolean
          status?: string
          title?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tasks_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      ticket_replies: {
        Row: {
          admin_id: string
          created_at: string
          id: string
          message: string
          ticket_id: string
        }
        Insert: {
          admin_id: string
          created_at?: string
          id?: string
          message: string
          ticket_id: string
        }
        Update: {
          admin_id?: string
          created_at?: string
          id?: string
          message?: string
          ticket_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ticket_replies_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "support_tickets"
            referencedColumns: ["id"]
          },
        ]
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
      video_rooms: {
        Row: {
          conversation_id: string
          created_at: string
          created_by: string
          ended_at: string | null
          id: string
          room_name: string
          started_at: string
          updated_at: string
        }
        Insert: {
          conversation_id: string
          created_at?: string
          created_by: string
          ended_at?: string | null
          id?: string
          room_name: string
          started_at?: string
          updated_at?: string
        }
        Update: {
          conversation_id?: string
          created_at?: string
          created_by?: string
          ended_at?: string | null
          id?: string
          room_name?: string
          started_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "video_rooms_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      workspace_credits: {
        Row: {
          created_at: string
          credits_balance: number
          free_minutes_remaining: number | null
          free_minutes_reset_at: string | null
          id: string
          last_purchased_at: string | null
          updated_at: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          credits_balance?: number
          free_minutes_remaining?: number | null
          free_minutes_reset_at?: string | null
          id?: string
          last_purchased_at?: string | null
          updated_at?: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          credits_balance?: number
          free_minutes_remaining?: number | null
          free_minutes_reset_at?: string | null
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
      workspace_dialer_features: {
        Row: {
          created_at: string
          feature_type: string
          id: string
          is_enabled: boolean
          updated_at: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          feature_type: string
          id?: string
          is_enabled?: boolean
          updated_at?: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          feature_type?: string
          id?: string
          is_enabled?: boolean
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workspace_dialer_features_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
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
          pending_leave_at: string | null
          removed_at: string | null
          user_id: string
          workspace_id: string
        }
        Insert: {
          cooldown_until?: string | null
          id?: string
          is_salary_exclusive?: boolean | null
          joined_at?: string | null
          pending_leave_at?: string | null
          removed_at?: string | null
          user_id: string
          workspace_id: string
        }
        Update: {
          cooldown_until?: string | null
          id?: string
          is_salary_exclusive?: boolean | null
          joined_at?: string | null
          pending_leave_at?: string | null
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
          assigned_to: string | null
          callhippo_number_id: string | null
          city: string | null
          country_code: string
          created_at: string
          id: string
          is_active: boolean
          monthly_cost: number
          phone_number: string
          purchased_at: string
          twilio_phone_sid: string | null
          workspace_id: string
        }
        Insert: {
          assigned_to?: string | null
          callhippo_number_id?: string | null
          city?: string | null
          country_code?: string
          created_at?: string
          id?: string
          is_active?: boolean
          monthly_cost?: number
          phone_number: string
          purchased_at?: string
          twilio_phone_sid?: string | null
          workspace_id: string
        }
        Update: {
          assigned_to?: string | null
          callhippo_number_id?: string | null
          city?: string | null
          country_code?: string
          created_at?: string
          id?: string
          is_active?: boolean
          monthly_cost?: number
          phone_number?: string
          purchased_at?: string
          twilio_phone_sid?: string | null
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
          first_subscription_at: string | null
          id: string
          is_locked: boolean | null
          max_sdrs: number | null
          name: string
          owner_id: string
          rake_percentage: number | null
          stripe_customer_id: string | null
          stripe_default_payment_method: string | null
          stripe_subscription_id: string | null
          subscription_anchor_day: number | null
          subscription_status: string | null
          subscription_tier:
            | Database["public"]["Enums"]["subscription_tier"]
            | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          first_subscription_at?: string | null
          id?: string
          is_locked?: boolean | null
          max_sdrs?: number | null
          name: string
          owner_id: string
          rake_percentage?: number | null
          stripe_customer_id?: string | null
          stripe_default_payment_method?: string | null
          stripe_subscription_id?: string | null
          subscription_anchor_day?: number | null
          subscription_status?: string | null
          subscription_tier?:
            | Database["public"]["Enums"]["subscription_tier"]
            | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          first_subscription_at?: string | null
          id?: string
          is_locked?: boolean | null
          max_sdrs?: number | null
          name?: string
          owner_id?: string
          rake_percentage?: number | null
          stripe_customer_id?: string | null
          stripe_default_payment_method?: string | null
          stripe_subscription_id?: string | null
          subscription_anchor_day?: number | null
          subscription_status?: string | null
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
      calculate_sdr_level: { Args: { total_value: number }; Returns: number }
      can_access_workspace_conversations: {
        Args: { _user_id: string; _workspace_id: string }
        Returns: boolean
      }
      cleanup_old_rate_limits: { Args: never; Returns: undefined }
      close_deal_atomic: {
        Args: { p_deal_id: string; p_expected_version: number }
        Returns: boolean
      }
      get_conversation_workspace_id: {
        Args: { _conversation_id: string }
        Returns: string
      }
      get_platform_cut_percentage: { Args: { level: number }; Returns: number }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_conversation_participant: {
        Args: { _conversation_id: string; _user_id: string }
        Returns: boolean
      }
      is_first_user: { Args: never; Returns: boolean }
      is_lead_stale: { Args: { last_updated: string }; Returns: boolean }
      is_workspace_member: {
        Args: { _user_id: string; _workspace_id: string }
        Returns: boolean
      }
      is_workspace_owner: {
        Args: { _user_id: string; _workspace_id: string }
        Returns: boolean
      }
      normalize_linkedin_url: { Args: { url: string }; Returns: string }
      reset_free_minutes: { Args: never; Returns: undefined }
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
