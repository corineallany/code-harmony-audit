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
    PostgrestVersion: "14.15"
  }
  public: {
    Tables: {
      app_settings: {
        Row: {
          adjoint_member_id: string | null
          brand: string | null
          cover_enabled: boolean
          cover_url: string | null
          created_at: string
          export_config: Json
          group_leads: Json
          home_title: string | null
          icon_url: string | null
          id: string
          menus: Json
          subtitle: string | null
          supervisor_member_id: string | null
          updated_at: string
          verses: Json
        }
        Insert: {
          adjoint_member_id?: string | null
          brand?: string | null
          cover_enabled?: boolean
          cover_url?: string | null
          created_at?: string
          export_config?: Json
          group_leads?: Json
          home_title?: string | null
          icon_url?: string | null
          id?: string
          menus?: Json
          subtitle?: string | null
          supervisor_member_id?: string | null
          updated_at?: string
          verses?: Json
        }
        Update: {
          adjoint_member_id?: string | null
          brand?: string | null
          cover_enabled?: boolean
          cover_url?: string | null
          created_at?: string
          export_config?: Json
          group_leads?: Json
          home_title?: string | null
          icon_url?: string | null
          id?: string
          menus?: Json
          subtitle?: string | null
          supervisor_member_id?: string | null
          updated_at?: string
          verses?: Json
        }
        Relationships: []
      }
      audit_log: {
        Row: {
          action: string
          actor_id: string | null
          actor_name: string | null
          created_at: string
          detail: string | null
          entity: string | null
          entity_id: string | null
          id: string
          occurred_at: string
        }
        Insert: {
          action: string
          actor_id?: string | null
          actor_name?: string | null
          created_at?: string
          detail?: string | null
          entity?: string | null
          entity_id?: string | null
          id: string
          occurred_at?: string
        }
        Update: {
          action?: string
          actor_id?: string | null
          actor_name?: string | null
          created_at?: string
          detail?: string | null
          entity?: string | null
          entity_id?: string | null
          id?: string
          occurred_at?: string
        }
        Relationships: []
      }
      legacy_state_archive: {
        Row: {
          captured_at: string
          created_at: string
          id: string
          payload: Json
          revision: number | null
          schema_version: number | null
          source: string
        }
        Insert: {
          captured_at?: string
          created_at?: string
          id?: string
          payload: Json
          revision?: number | null
          schema_version?: number | null
          source: string
        }
        Update: {
          captured_at?: string
          created_at?: string
          id?: string
          payload?: Json
          revision?: number | null
          schema_version?: number | null
          source?: string
        }
        Relationships: []
      }
      member_availability: {
        Row: {
          created_at: string
          ends_at: string
          id: string
          member_id: string
          note: string | null
          request_id: string | null
          starts_at: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          ends_at: string
          id: string
          member_id: string
          note?: string | null
          request_id?: string | null
          starts_at: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          ends_at?: string
          id?: string
          member_id?: string
          note?: string | null
          request_id?: string | null
          starts_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "member_availability_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
        ]
      }
      member_poles: {
        Row: {
          created_at: string
          id: string
          is_referent: boolean
          member_id: string
          pole_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_referent?: boolean
          member_id: string
          pole_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_referent?: boolean
          member_id?: string
          pole_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "member_poles_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "member_poles_pole_id_fkey"
            columns: ["pole_id"]
            isOneToOne: false
            referencedRelation: "poles"
            referencedColumns: ["id"]
          },
        ]
      }
      members: {
        Row: {
          affiliations: string | null
          arrival_month: number | null
          arrival_year: number | null
          auth_user_id: string | null
          base_role: Database["public"]["Enums"]["app_role"]
          created_at: string
          first_name: string | null
          full_name: string
          id: string
          inactive_note: string | null
          is_ejp: boolean
          is_icc: boolean
          last_name: string | null
          legacy_updated_at: string | null
          login_email: string | null
          photo_url: string | null
          status: Database["public"]["Enums"]["member_status"]
          training_done: boolean
          training_end_effective: string | null
          training_end_planned: string | null
          training_start: string | null
          updated_at: string
        }
        Insert: {
          affiliations?: string | null
          arrival_month?: number | null
          arrival_year?: number | null
          auth_user_id?: string | null
          base_role?: Database["public"]["Enums"]["app_role"]
          created_at?: string
          first_name?: string | null
          full_name: string
          id: string
          inactive_note?: string | null
          is_ejp?: boolean
          is_icc?: boolean
          last_name?: string | null
          legacy_updated_at?: string | null
          login_email?: string | null
          photo_url?: string | null
          status?: Database["public"]["Enums"]["member_status"]
          training_done?: boolean
          training_end_effective?: string | null
          training_end_planned?: string | null
          training_start?: string | null
          updated_at?: string
        }
        Update: {
          affiliations?: string | null
          arrival_month?: number | null
          arrival_year?: number | null
          auth_user_id?: string | null
          base_role?: Database["public"]["Enums"]["app_role"]
          created_at?: string
          first_name?: string | null
          full_name?: string
          id?: string
          inactive_note?: string | null
          is_ejp?: boolean
          is_icc?: boolean
          last_name?: string | null
          legacy_updated_at?: string | null
          login_email?: string | null
          photo_url?: string | null
          status?: Database["public"]["Enums"]["member_status"]
          training_done?: boolean
          training_end_effective?: string | null
          training_end_planned?: string | null
          training_start?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          body: string | null
          created_at: string
          id: string
          link: string | null
          member_id: string | null
          read: boolean
          read_at: string | null
          title: string
          type: string
          user_id: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          id?: string
          link?: string | null
          member_id?: string | null
          read?: boolean
          read_at?: string | null
          title: string
          type: string
          user_id: string
        }
        Update: {
          body?: string | null
          created_at?: string
          id?: string
          link?: string | null
          member_id?: string | null
          read?: boolean
          read_at?: string | null
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      poles: {
        Row: {
          archived: boolean
          created_at: string
          description: string | null
          id: string
          name: string
          pole_group: string | null
          sort_order: number
          updated_at: string
        }
        Insert: {
          archived?: boolean
          created_at?: string
          description?: string | null
          id?: string
          name: string
          pole_group?: string | null
          sort_order?: number
          updated_at?: string
        }
        Update: {
          archived?: boolean
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          pole_group?: string | null
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          display_name: string | null
          email: string | null
          id: string
          member_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          email?: string | null
          id: string
          member_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          display_name?: string | null
          email?: string | null
          id?: string
          member_id?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      program_assignment_members: {
        Row: {
          assignment_id: string
          created_at: string
          id: string
          member_id: string
        }
        Insert: {
          assignment_id: string
          created_at?: string
          id?: string
          member_id: string
        }
        Update: {
          assignment_id?: string
          created_at?: string
          id?: string
          member_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "program_assignment_members_assignment_id_fkey"
            columns: ["assignment_id"]
            isOneToOne: false
            referencedRelation: "program_assignments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "program_assignment_members_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
        ]
      }
      program_assignments: {
        Row: {
          created_at: string
          id: string
          pole_id: string
          program_id: string
          tasks: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          pole_id: string
          program_id: string
          tasks?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          pole_id?: string
          program_id?: string
          tasks?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "program_assignments_pole_id_fkey"
            columns: ["pole_id"]
            isOneToOne: false
            referencedRelation: "poles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "program_assignments_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "programs"
            referencedColumns: ["id"]
          },
        ]
      }
      program_checklist_items: {
        Row: {
          created_at: string
          done: boolean
          id: string
          label: string
          program_id: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          done?: boolean
          id?: string
          label: string
          program_id: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          done?: boolean
          id?: string
          label?: string
          program_id?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "program_checklist_items_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "programs"
            referencedColumns: ["id"]
          },
        ]
      }
      program_member_responses: {
        Row: {
          created_at: string
          id: string
          member_id: string
          program_id: string
          reason: string | null
          reserve: string | null
          reversible_until: string | null
          status: Database["public"]["Enums"]["response_status"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          member_id: string
          program_id: string
          reason?: string | null
          reserve?: string | null
          reversible_until?: string | null
          status?: Database["public"]["Enums"]["response_status"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          member_id?: string
          program_id?: string
          reason?: string | null
          reserve?: string | null
          reversible_until?: string | null
          status?: Database["public"]["Enums"]["response_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "program_member_responses_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "program_member_responses_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "programs"
            referencedColumns: ["id"]
          },
        ]
      }
      program_models: {
        Row: {
          archived: boolean
          audience: string | null
          checklist: Json
          created_at: string
          description: string | null
          format: string | null
          id: string
          name: string
          poles: Json
          program_type: string | null
          tasks: string | null
          updated_at: string
        }
        Insert: {
          archived?: boolean
          audience?: string | null
          checklist?: Json
          created_at?: string
          description?: string | null
          format?: string | null
          id: string
          name: string
          poles?: Json
          program_type?: string | null
          tasks?: string | null
          updated_at?: string
        }
        Update: {
          archived?: boolean
          audience?: string | null
          checklist?: Json
          created_at?: string
          description?: string | null
          format?: string | null
          id?: string
          name?: string
          poles?: Json
          program_type?: string | null
          tasks?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      program_response_history: {
        Row: {
          changed_at: string
          changed_by: string | null
          created_at: string
          id: string
          member_id: string
          program_id: string
          reason: string | null
          reserve: string | null
          reversible_until: string | null
          status: Database["public"]["Enums"]["response_status"]
        }
        Insert: {
          changed_at?: string
          changed_by?: string | null
          created_at?: string
          id?: string
          member_id: string
          program_id: string
          reason?: string | null
          reserve?: string | null
          reversible_until?: string | null
          status: Database["public"]["Enums"]["response_status"]
        }
        Update: {
          changed_at?: string
          changed_by?: string | null
          created_at?: string
          id?: string
          member_id?: string
          program_id?: string
          reason?: string | null
          reserve?: string | null
          reversible_until?: string | null
          status?: Database["public"]["Enums"]["response_status"]
        }
        Relationships: [
          {
            foreignKeyName: "program_response_history_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "program_response_history_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "programs"
            referencedColumns: ["id"]
          },
        ]
      }
      programs: {
        Row: {
          archived: boolean
          audience: string | null
          created_at: string
          deleted: boolean
          description: string | null
          end_date: string | null
          end_time: string | null
          format: string | null
          general_note: string | null
          id: string
          importance: string | null
          invite_members: string | null
          legacy_updated_at: string | null
          location: string | null
          onsite: string | null
          program_type: string | null
          recurrence: string | null
          recurrence_rule: Json
          recurrence_until: string | null
          resource_link: string | null
          start_date: string | null
          start_time: string | null
          status: string
          title: string
          travel: string | null
          updated_at: string
        }
        Insert: {
          archived?: boolean
          audience?: string | null
          created_at?: string
          deleted?: boolean
          description?: string | null
          end_date?: string | null
          end_time?: string | null
          format?: string | null
          general_note?: string | null
          id: string
          importance?: string | null
          invite_members?: string | null
          legacy_updated_at?: string | null
          location?: string | null
          onsite?: string | null
          program_type?: string | null
          recurrence?: string | null
          recurrence_rule?: Json
          recurrence_until?: string | null
          resource_link?: string | null
          start_date?: string | null
          start_time?: string | null
          status?: string
          title: string
          travel?: string | null
          updated_at?: string
        }
        Update: {
          archived?: boolean
          audience?: string | null
          created_at?: string
          deleted?: boolean
          description?: string | null
          end_date?: string | null
          end_time?: string | null
          format?: string | null
          general_note?: string | null
          id?: string
          importance?: string | null
          invite_members?: string | null
          legacy_updated_at?: string | null
          location?: string | null
          onsite?: string | null
          program_type?: string | null
          recurrence?: string | null
          recurrence_rule?: Json
          recurrence_until?: string | null
          resource_link?: string | null
          start_date?: string | null
          start_time?: string | null
          status?: string
          title?: string
          travel?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      push_subscriptions: {
        Row: {
          active: boolean
          auth_key: string
          created_at: string
          endpoint: string
          id: string
          member_id: string | null
          p256dh: string
          updated_at: string
          user_agent: string | null
          user_id: string
        }
        Insert: {
          active?: boolean
          auth_key: string
          created_at?: string
          endpoint: string
          id?: string
          member_id?: string | null
          p256dh: string
          updated_at?: string
          user_agent?: string | null
          user_id: string
        }
        Update: {
          active?: boolean
          auth_key?: string
          created_at?: string
          endpoint?: string
          id?: string
          member_id?: string | null
          p256dh?: string
          updated_at?: string
          user_agent?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "push_subscriptions_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
        ]
      }
      role_permissions: {
        Row: {
          created_at: string
          id: string
          permission: string
          role: Database["public"]["Enums"]["app_role"]
        }
        Insert: {
          created_at?: string
          id?: string
          permission: string
          role: Database["public"]["Enums"]["app_role"]
        }
        Update: {
          created_at?: string
          id?: string
          permission?: string
          role?: Database["public"]["Enums"]["app_role"]
        }
        Relationships: []
      }
      solicitation_decision_history: {
        Row: {
          changed_at: string
          changed_by: string | null
          created_at: string
          decision: string | null
          id: string
          note: string | null
          solicitation_id: string
        }
        Insert: {
          changed_at?: string
          changed_by?: string | null
          created_at?: string
          decision?: string | null
          id?: string
          note?: string | null
          solicitation_id: string
        }
        Update: {
          changed_at?: string
          changed_by?: string | null
          created_at?: string
          decision?: string | null
          id?: string
          note?: string | null
          solicitation_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "solicitation_decision_history_solicitation_id_fkey"
            columns: ["solicitation_id"]
            isOneToOne: false
            referencedRelation: "solicitations"
            referencedColumns: ["id"]
          },
        ]
      }
      solicitations: {
        Row: {
          archived: boolean
          archived_at: string | null
          attachment: string | null
          created_at: string
          decision: string | null
          decision_at: string | null
          decision_note: string | null
          deleted: boolean
          event_date: string | null
          event_name: string | null
          id: string
          link: string | null
          message: string | null
          mode: string | null
          program_id: string | null
          replacement_member_id: string | null
          requester: string | null
          reversible_until: string | null
          seen: boolean
          status: string
          target_name: string | null
          target_pole_id: string | null
          target_type: string | null
          updated_at: string
        }
        Insert: {
          archived?: boolean
          archived_at?: string | null
          attachment?: string | null
          created_at?: string
          decision?: string | null
          decision_at?: string | null
          decision_note?: string | null
          deleted?: boolean
          event_date?: string | null
          event_name?: string | null
          id: string
          link?: string | null
          message?: string | null
          mode?: string | null
          program_id?: string | null
          replacement_member_id?: string | null
          requester?: string | null
          reversible_until?: string | null
          seen?: boolean
          status?: string
          target_name?: string | null
          target_pole_id?: string | null
          target_type?: string | null
          updated_at?: string
        }
        Update: {
          archived?: boolean
          archived_at?: string | null
          attachment?: string | null
          created_at?: string
          decision?: string | null
          decision_at?: string | null
          decision_note?: string | null
          deleted?: boolean
          event_date?: string | null
          event_name?: string | null
          id?: string
          link?: string | null
          message?: string | null
          mode?: string | null
          program_id?: string | null
          replacement_member_id?: string | null
          requester?: string | null
          reversible_until?: string | null
          seen?: boolean
          status?: string
          target_name?: string | null
          target_pole_id?: string | null
          target_type?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "solicitations_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "programs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "solicitations_replacement_member_id_fkey"
            columns: ["replacement_member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "solicitations_target_pole_id_fkey"
            columns: ["target_pole_id"]
            isOneToOne: false
            referencedRelation: "poles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          active: boolean
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          updated_at: string
          user_id: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          updated_at?: string
          user_id: string
        }
        Update: {
          active?: boolean
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          updated_at?: string
          user_id?: string
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
      is_admin: { Args: { _user_id: string }; Returns: boolean }
      is_staff: { Args: { _user_id: string }; Returns: boolean }
    }
    Enums: {
      app_role:
        | "responsable"
        | "adjoint"
        | "referent"
        | "equipier"
        | "admin_technique"
      member_status: "active" | "inactive" | "archived"
      response_status: "available" | "partial" | "unavailable" | "pending"
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
      app_role: [
        "responsable",
        "adjoint",
        "referent",
        "equipier",
        "admin_technique",
      ],
      member_status: ["active", "inactive", "archived"],
      response_status: ["available", "partial", "unavailable", "pending"],
    },
  },
} as const
