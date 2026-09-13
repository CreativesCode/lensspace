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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      audit_events: {
        Row: {
          actor_user_id: string | null
          entity_id: string | null
          entity_type: string
          event_type: string
          id: number
          occurred_at: string
          organization_id: number | null
          origin: string
          payload: Json
          reason: string | null
        }
        Insert: {
          actor_user_id?: string | null
          entity_id?: string | null
          entity_type: string
          event_type: string
          id?: never
          occurred_at?: string
          organization_id?: number | null
          origin?: string
          payload?: Json
          reason?: string | null
        }
        Update: {
          actor_user_id?: string | null
          entity_id?: string | null
          entity_type?: string
          event_type?: string
          id?: never
          occurred_at?: string
          organization_id?: number | null
          origin?: string
          payload?: Json
          reason?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_events_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      branches: {
        Row: {
          code: string
          created_at: string
          id: number
          is_active: boolean
          name: string
          organization_id: number
          timezone: string
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          id?: never
          is_active?: boolean
          name: string
          organization_id: number
          timezone?: string
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          id?: never
          is_active?: boolean
          name?: string
          organization_id?: number
          timezone?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "branches_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      catalog_item_compatibilities: {
        Row: {
          created_at: string
          created_by: string | null
          id: number
          is_allowed: boolean
          left_item_id: number
          message: string
          organization_id: number | null
          right_item_id: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: never
          is_allowed?: boolean
          left_item_id: number
          message: string
          organization_id?: number | null
          right_item_id: number
          updated_at?: string
        }
        Update: {
          is_allowed?: boolean
          message?: string
        }
        Relationships: []
      }
      catalog_item_overrides: {
        Row: {
          catalog_item_id: number
          changed_at: string
          changed_by: string
          cost_amount: number
          currency: string
          is_enabled: boolean
          organization_id: number
          sale_price: number
        }
        Insert: {
          catalog_item_id: number
          changed_at?: string
          changed_by: string
          cost_amount: number
          currency: string
          is_enabled?: boolean
          organization_id: number
          sale_price: number
        }
        Update: {
          changed_at?: string
          changed_by?: string
          cost_amount?: number
          currency?: string
          is_enabled?: boolean
          sale_price?: number
        }
        Relationships: []
      }
      catalog_items: {
        Row: {
          category: string
          code: string
          cost_amount: number
          created_at: string
          created_by: string | null
          currency: string
          description: string | null
          id: number
          is_active: boolean
          name: string
          organization_id: number | null
          sale_price: number
          updated_at: string
        }
        Insert: {
          category: string
          code: string
          cost_amount?: number
          created_at?: string
          created_by?: string | null
          currency: string
          description?: string | null
          id?: never
          is_active?: boolean
          name: string
          organization_id?: number | null
          sale_price: number
          updated_at?: string
        }
        Update: {
          category?: string
          code?: string
          cost_amount?: number
          currency?: string
          description?: string | null
          is_active?: boolean
          name?: string
          sale_price?: number
        }
        Relationships: []
      }
      customer_phones: {
        Row: {
          branch_id: number
          created_at: string
          customer_id: number
          id: number
          is_primary: boolean
          label: string
          normalized_phone: string | null
          organization_id: number
          phone_number: string
          updated_at: string
          whatsapp_enabled: boolean
        }
        Insert: {
          branch_id: number
          created_at?: string
          customer_id: number
          id?: never
          is_primary?: boolean
          label?: string
          normalized_phone?: string | null
          organization_id: number
          phone_number: string
          updated_at?: string
          whatsapp_enabled?: boolean
        }
        Update: {
          branch_id?: number
          created_at?: string
          customer_id?: number
          id?: never
          is_primary?: boolean
          label?: string
          normalized_phone?: string | null
          organization_id?: number
          phone_number?: string
          updated_at?: string
          whatsapp_enabled?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "customer_phones_customer_fkey"
            columns: ["customer_id", "organization_id", "branch_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id", "organization_id", "branch_id"]
          },
        ]
      }
      customers: {
        Row: {
          address: string | null
          archived_at: string | null
          birth_date: string | null
          branch_id: number
          created_at: string
          created_by: string
          full_name: string
          id: number
          messaging_consent: boolean
          national_id: string | null
          notes: string | null
          organization_id: number
          updated_at: string
        }
        Insert: {
          address?: string | null
          archived_at?: string | null
          birth_date?: string | null
          branch_id: number
          created_at?: string
          created_by: string
          full_name: string
          id?: never
          messaging_consent?: boolean
          national_id?: string | null
          notes?: string | null
          organization_id: number
          updated_at?: string
        }
        Update: {
          address?: string | null
          archived_at?: string | null
          birth_date?: string | null
          branch_id?: number
          created_at?: string
          created_by?: string
          full_name?: string
          id?: never
          messaging_consent?: boolean
          national_id?: string | null
          notes?: string | null
          organization_id?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "customers_branch_fkey"
            columns: ["branch_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id", "organization_id"]
          },
          {
            foreignKeyName: "customers_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "customers_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      graduation_rules: {
        Row: {
          applies_to_item_id: number | null
          code: string
          created_at: string
          created_by: string | null
          id: number
          is_active: boolean
          message: string
          minimum_absolute_cylinder: number | null
          minimum_absolute_sphere: number | null
          minimum_addition: number | null
          name: string
          organization_id: number | null
          recommended_item_id: number | null
          surcharge_amount: number
          surcharge_currency: string | null
          updated_at: string
        }
        Insert: {
          applies_to_item_id?: number | null
          code: string
          created_at?: string
          created_by?: string | null
          id?: never
          is_active?: boolean
          message: string
          minimum_absolute_cylinder?: number | null
          minimum_absolute_sphere?: number | null
          minimum_addition?: number | null
          name: string
          organization_id?: number | null
          recommended_item_id?: number | null
          surcharge_amount?: number
          surcharge_currency?: string | null
          updated_at?: string
        }
        Update: {
          applies_to_item_id?: number | null
          code?: string
          is_active?: boolean
          message?: string
          minimum_absolute_cylinder?: number | null
          minimum_absolute_sphere?: number | null
          minimum_addition?: number | null
          name?: string
          recommended_item_id?: number | null
          surcharge_amount?: number
          surcharge_currency?: string | null
        }
        Relationships: []
      }
      module_dependencies: {
        Row: {
          created_at: string
          depends_on_module_key: string
          module_key: string
        }
        Insert: {
          created_at?: string
          depends_on_module_key: string
          module_key: string
        }
        Update: {
          created_at?: string
          depends_on_module_key?: string
          module_key?: string
        }
        Relationships: [
          {
            foreignKeyName: "module_dependencies_depends_on_module_key_fkey"
            columns: ["depends_on_module_key"]
            isOneToOne: false
            referencedRelation: "modules"
            referencedColumns: ["key"]
          },
          {
            foreignKeyName: "module_dependencies_module_key_fkey"
            columns: ["module_key"]
            isOneToOne: false
            referencedRelation: "modules"
            referencedColumns: ["key"]
          },
        ]
      }
      modules: {
        Row: {
          created_at: string
          description: string
          is_active: boolean
          is_mandatory: boolean
          key: string
          name: string
        }
        Insert: {
          created_at?: string
          description: string
          is_active?: boolean
          is_mandatory?: boolean
          key: string
          name: string
        }
        Update: {
          created_at?: string
          description?: string
          is_active?: boolean
          is_mandatory?: boolean
          key?: string
          name?: string
        }
        Relationships: []
      }
      organization_memberships: {
        Row: {
          branch_id: number | null
          created_at: string
          id: number
          organization_id: number
          role: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          branch_id?: number | null
          created_at?: string
          id?: never
          organization_id: number
          role: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          branch_id?: number | null
          created_at?: string
          id?: never
          organization_id?: number
          role?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_memberships_branch_fkey"
            columns: ["branch_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id", "organization_id"]
          },
          {
            foreignKeyName: "organization_memberships_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organization_memberships_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      organization_modules: {
        Row: {
          changed_at: string
          changed_by: string
          is_enabled: boolean
          module_key: string
          organization_id: number
        }
        Insert: {
          changed_at?: string
          changed_by: string
          is_enabled?: boolean
          module_key: string
          organization_id: number
        }
        Update: {
          changed_at?: string
          changed_by?: string
          is_enabled?: boolean
          module_key?: string
          organization_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "organization_modules_module_key_fkey"
            columns: ["module_key"]
            isOneToOne: false
            referencedRelation: "modules"
            referencedColumns: ["key"]
          },
          {
            foreignKeyName: "organization_modules_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          created_at: string
          first_order_created_at: string | null
          id: number
          name: string
          order_prefix: string
          status: string
          timezone: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          first_order_created_at?: string | null
          id?: never
          name: string
          order_prefix: string
          status?: string
          timezone?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          first_order_created_at?: string | null
          id?: never
          name?: string
          order_prefix?: string
          status?: string
          timezone?: string
          updated_at?: string
        }
        Relationships: []
      }
      prescription_files: {
        Row: {
          branch_id: number
          byte_size: number
          created_at: string
          file_name: string
          id: number
          mime_type: string
          organization_id: number
          prescription_id: number
          revision_id: number
          storage_path: string
          uploaded_by: string
        }
        Insert: {
          branch_id: number
          byte_size: number
          created_at?: string
          file_name: string
          id?: never
          mime_type: string
          organization_id: number
          prescription_id: number
          revision_id: number
          storage_path: string
          uploaded_by: string
        }
        Update: {
          branch_id?: number
          byte_size?: number
          created_at?: string
          file_name?: string
          id?: never
          mime_type?: string
          organization_id?: number
          prescription_id?: number
          revision_id?: number
          storage_path?: string
          uploaded_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "prescription_files_prescription_fkey"
            columns: ["prescription_id", "organization_id", "branch_id"]
            isOneToOne: false
            referencedRelation: "prescriptions"
            referencedColumns: ["id", "organization_id", "branch_id"]
          },
          {
            foreignKeyName: "prescription_files_revision_fkey"
            columns: [
              "revision_id",
              "prescription_id",
              "organization_id",
              "branch_id",
            ]
            isOneToOne: false
            referencedRelation: "prescription_revisions"
            referencedColumns: [
              "id",
              "prescription_id",
              "organization_id",
              "branch_id",
            ]
          },
          {
            foreignKeyName: "prescription_files_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      prescription_revisions: {
        Row: {
          branch_id: number
          change_reason: string | null
          created_at: string
          created_by: string
          id: number
          left_addition: number | null
          left_axis: number | null
          left_cylinder: number | null
          left_height: number | null
          left_prism: number | null
          left_prism_base: string | null
          left_pupillary_distance: number | null
          left_sphere: number | null
          notes: string | null
          organization_id: number
          prescriber_name: string | null
          prescription_date: string
          prescription_id: number
          pupillary_distance_total: number | null
          revision_number: number
          right_addition: number | null
          right_axis: number | null
          right_cylinder: number | null
          right_height: number | null
          right_prism: number | null
          right_prism_base: string | null
          right_pupillary_distance: number | null
          right_sphere: number | null
        }
        Insert: {
          branch_id: number
          change_reason?: string | null
          created_at?: string
          created_by: string
          id?: never
          left_addition?: number | null
          left_axis?: number | null
          left_cylinder?: number | null
          left_height?: number | null
          left_prism?: number | null
          left_prism_base?: string | null
          left_pupillary_distance?: number | null
          left_sphere?: number | null
          notes?: string | null
          organization_id: number
          prescriber_name?: string | null
          prescription_date?: string
          prescription_id: number
          pupillary_distance_total?: number | null
          revision_number: number
          right_addition?: number | null
          right_axis?: number | null
          right_cylinder?: number | null
          right_height?: number | null
          right_prism?: number | null
          right_prism_base?: string | null
          right_pupillary_distance?: number | null
          right_sphere?: number | null
        }
        Update: {
          branch_id?: number
          change_reason?: string | null
          created_at?: string
          created_by?: string
          id?: never
          left_addition?: number | null
          left_axis?: number | null
          left_cylinder?: number | null
          left_height?: number | null
          left_prism?: number | null
          left_prism_base?: string | null
          left_pupillary_distance?: number | null
          left_sphere?: number | null
          notes?: string | null
          organization_id?: number
          prescriber_name?: string | null
          prescription_date?: string
          prescription_id?: number
          pupillary_distance_total?: number | null
          revision_number?: number
          right_addition?: number | null
          right_axis?: number | null
          right_cylinder?: number | null
          right_height?: number | null
          right_prism?: number | null
          right_prism_base?: string | null
          right_pupillary_distance?: number | null
          right_sphere?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "prescription_revisions_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "prescription_revisions_prescription_fkey"
            columns: ["prescription_id", "organization_id", "branch_id"]
            isOneToOne: false
            referencedRelation: "prescriptions"
            referencedColumns: ["id", "organization_id", "branch_id"]
          },
        ]
      }
      prescriptions: {
        Row: {
          archived_at: string | null
          branch_id: number
          created_at: string
          created_by: string
          customer_id: number
          id: number
          organization_id: number
          updated_at: string
        }
        Insert: {
          archived_at?: string | null
          branch_id: number
          created_at?: string
          created_by: string
          customer_id: number
          id?: never
          organization_id: number
          updated_at?: string
        }
        Update: {
          archived_at?: string | null
          branch_id?: number
          created_at?: string
          created_by?: string
          customer_id?: number
          id?: never
          organization_id?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "prescriptions_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "prescriptions_customer_fkey"
            columns: ["customer_id", "organization_id", "branch_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id", "organization_id", "branch_id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          display_name: string
          is_active: boolean
          phone: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          display_name: string
          is_active?: boolean
          phone?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          display_name?: string
          is_active?: boolean
          phone?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      subscriptions: {
        Row: {
          amount: number
          billing_period: string
          created_at: string
          currency: string
          expires_on: string
          id: number
          last_renewed_on: string | null
          notes: string | null
          organization_id: number
          starts_on: string
          status: string
          updated_at: string
        }
        Insert: {
          amount?: number
          billing_period?: string
          created_at?: string
          currency?: string
          expires_on: string
          id?: never
          last_renewed_on?: string | null
          notes?: string | null
          organization_id: number
          starts_on: string
          status: string
          updated_at?: string
        }
        Update: {
          amount?: number
          billing_period?: string
          created_at?: string
          currency?: string
          expires_on?: string
          id?: never
          last_renewed_on?: string | null
          notes?: string | null
          organization_id?: number
          starts_on?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscriptions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: true
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
      add_organization_member: {
        Args: {
          actor_user_id: string
          target_branch_id: number
          target_organization_id: number
          target_role: string
          target_status: string
          target_user_id: string
        }
        Returns: number
      }
      bootstrap_organization: {
        Args: {
          actor_user_id: string
          branch_code: string
          branch_name: string
          enabled_module_keys: string[]
          organization_name: string
          organization_prefix: string
          organization_timezone: string
          owner_user_id: string
          subscription_amount: number
          subscription_billing_period: string
          subscription_currency: string
          subscription_expires_on: string
          subscription_starts_on: string
          subscription_status: string
        }
        Returns: number
      }
      calculate_catalog_price: {
        Args: {
          selected_item_ids: number[]
          target_organization_id: number
          target_prescription_revision_id: number | null
          usd_to_cup_rate: number | null
        }
        Returns: Json
      }
      create_customer_with_phones: {
        Args: {
          customer_address?: string
          customer_birth_date?: string
          customer_full_name: string
          customer_messaging_consent?: boolean
          customer_national_id?: string
          customer_notes?: string
          phone_entries?: Json
          target_branch_id: number
          target_organization_id: number
        }
        Returns: number
      }
      create_prescription_revision: {
        Args: {
          revision_change_reason: string | null
          revision_left_addition: number | null
          revision_left_axis: number | null
          revision_left_cylinder: number | null
          revision_left_height: number | null
          revision_left_prism: number | null
          revision_left_prism_base: string | null
          revision_left_pupillary_distance: number | null
          revision_left_sphere: number | null
          revision_notes: string | null
          revision_prescriber_name: string | null
          revision_prescription_date: string
          revision_pupillary_distance_total: number | null
          revision_right_addition: number | null
          revision_right_axis: number | null
          revision_right_cylinder: number | null
          revision_right_height: number | null
          revision_right_prism: number | null
          revision_right_prism_base: string | null
          revision_right_pupillary_distance: number | null
          revision_right_sphere: number | null
          target_branch_id: number
          target_customer_id: number
          target_organization_id: number
          target_prescription_id: number | null
        }
        Returns: Json
      }
      current_user_can_manage_organization: {
        Args: { target_organization_id: number }
        Returns: boolean
      }
      current_user_can_operate_organization: {
        Args: { required_module_key?: string; target_organization_id: number }
        Returns: boolean
      }
      current_user_is_platform_admin: { Args: never; Returns: boolean }
      find_auth_user_by_email: {
        Args: { target_email: string }
        Returns: {
          is_confirmed: boolean
          user_id: string
        }[]
      }
      manage_organization_member: {
        Args: {
          target_branch_id: number
          target_membership_id: number
          target_status: string
        }
        Returns: undefined
      }
    }
    Enums: {
      [_ in never]: never
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
