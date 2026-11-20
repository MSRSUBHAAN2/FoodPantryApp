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
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      diary_entries: {
        Row: {
          amount: number
          created_at: string
          entry_date: string
          id: string
          item_id: string | null
          meal: string
          name: string
          nutrients: Json
          nutrition_basis: string | null
          nutrition_complete: boolean
          nutrition_source: string | null
          request_id: string
          stock_deducted: number | null
          stock_unit: string | null
          unit: string
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          entry_date?: string
          id?: string
          item_id?: string | null
          meal: string
          name: string
          nutrients?: Json
          nutrition_basis?: string | null
          nutrition_complete?: boolean
          nutrition_source?: string | null
          request_id?: string
          stock_deducted?: number | null
          stock_unit?: string | null
          unit: string
          user_id?: string
        }
        Update: {
          amount?: number
          created_at?: string
          entry_date?: string
          id?: string
          item_id?: string | null
          meal?: string
          name?: string
          nutrients?: Json
          nutrition_basis?: string | null
          nutrition_complete?: boolean
          nutrition_source?: string | null
          request_id?: string
          stock_deducted?: number | null
          stock_unit?: string | null
          unit?: string
          user_id?: string
        }
        Relationships: []
      }
      food_items: {
        Row: {
          category: string
          created_at: string
          date_type: string
          emoji: string
          expiry_date: string
          id: string
          location: string
          name: string
          notes: string
          opened_date: string | null
          purchase_date: string
          quantity: string
          recommended_date: string | null
          status: string
          user_id: string | null
        }
        Insert: {
          category?: string
          created_at?: string
          date_type?: string
          emoji?: string
          expiry_date: string
          id?: string
          location?: string
          name: string
          notes?: string
          opened_date?: string | null
          purchase_date?: string
          quantity?: string
          recommended_date?: string | null
          status?: string
          user_id?: string | null
        }
        Update: {
          category?: string
          created_at?: string
          date_type?: string
          emoji?: string
          expiry_date?: string
          id?: string
          location?: string
          name?: string
          notes?: string
          opened_date?: string | null
          purchase_date?: string
          quantity?: string
          recommended_date?: string | null
          status?: string
          user_id?: string | null
        }
        Relationships: []
      }
      food_preferences: {
        Row: {
          allergies: string
          cooking_time: number
          dietary: string
          dislikes: string
          reminder_days: number[]
          servings: number
          user_id: string
        }
        Insert: {
          allergies?: string
          cooking_time?: number
          dietary?: string
          dislikes?: string
          reminder_days?: number[]
          servings?: number
          user_id: string
        }
        Update: {
          allergies?: string
          cooking_time?: number
          dietary?: string
          dislikes?: string
          reminder_days?: number[]
          servings?: number
          user_id?: string
        }
        Relationships: []
      }
      item_events: {
        Row: {
          amount: number | null
          created_at: string
          id: string
          item_id: string | null
          item_name: string
          kind: string
          unit: string | null
          user_id: string
        }
        Insert: {
          amount?: number | null
          created_at?: string
          id?: string
          item_id?: string | null
          item_name: string
          kind: string
          unit?: string | null
          user_id?: string
        }
        Update: {
          amount?: number | null
          created_at?: string
          id?: string
          item_id?: string | null
          item_name?: string
          kind?: string
          unit?: string | null
          user_id?: string
        }
        Relationships: []
      }
      pantry_items: {
        Row: {
          allergens: string[] | null
          barcode: string | null
          brand: string | null
          category: string
          created_at: string
          date_type: string
          frozen_date: string | null
          id: string
          location: string
          name: string
          notes: string
          nutrition: Json | null
          open_life_days: number | null
          open_life_source: string | null
          opened_date: string | null
          printed_date: string | null
          purchase_date: string
          quantity: number
          serving_size: string | null
          status: string
          thawed_date: string | null
          unit: string
          updated_at: string
          user_id: string
        }
        Insert: {
          allergens?: string[] | null
          barcode?: string | null
          brand?: string | null
          category?: string
          created_at?: string
          date_type?: string
          frozen_date?: string | null
          id?: string
          location?: string
          name: string
          notes?: string
          nutrition?: Json | null
          open_life_days?: number | null
          open_life_source?: string | null
          opened_date?: string | null
          printed_date?: string | null
          purchase_date?: string
          quantity?: number
          serving_size?: string | null
          status?: string
          thawed_date?: string | null
          unit?: string
          updated_at?: string
          user_id?: string
        }
        Update: {
          allergens?: string[] | null
          barcode?: string | null
          brand?: string | null
          category?: string
          created_at?: string
          date_type?: string
          frozen_date?: string | null
          id?: string
          location?: string
          name?: string
          notes?: string
          nutrition?: Json | null
          open_life_days?: number | null
          open_life_source?: string | null
          opened_date?: string | null
          printed_date?: string | null
          purchase_date?: string
          quantity?: number
          serving_size?: string | null
          status?: string
          thawed_date?: string | null
          unit?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      shopping_items: {
        Row: {
          created_at: string
          done: boolean
          id: string
          name: string
          quantity: string
          user_id: string
        }
        Insert: {
          created_at?: string
          done?: boolean
          id?: string
          name: string
          quantity?: string
          user_id?: string
        }
        Update: {
          created_at?: string
          done?: boolean
          id?: string
          name?: string
          quantity?: string
          user_id?: string
        }
        Relationships: []
      }
      user_settings: {
        Row: {
          allergies: string[]
          calorie_goal: number | null
          carbs_goal_g: number | null
          dietary: string
          dislikes: string[]
          email_reminders: boolean
          equipment: string[]
          fat_goal_g: number | null
          max_cook_minutes: number
          overdue_alerts: boolean
          protein_goal_g: number | null
          reminder_days: number[]
          servings: number
          updated_at: string
          user_id: string
        }
        Insert: {
          allergies?: string[]
          calorie_goal?: number | null
          carbs_goal_g?: number | null
          dietary?: string
          dislikes?: string[]
          email_reminders?: boolean
          equipment?: string[]
          fat_goal_g?: number | null
          max_cook_minutes?: number
          overdue_alerts?: boolean
          protein_goal_g?: number | null
          reminder_days?: number[]
          servings?: number
          updated_at?: string
          user_id?: string
        }
        Update: {
          allergies?: string[]
          calorie_goal?: number | null
          carbs_goal_g?: number | null
          dietary?: string
          dislikes?: string[]
          email_reminders?: boolean
          equipment?: string[]
          fat_goal_g?: number | null
          max_cook_minutes?: number
          overdue_alerts?: boolean
          protein_goal_g?: number | null
          reminder_days?: number[]
          servings?: number
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
      consume_item: {
        Args: {
          _amount: number
          _basis: string
          _complete: boolean
          _diary_amount: number
          _diary_unit: string
          _entry_date: string
          _item_id: string
          _kind?: string
          _log: boolean
          _meal: string
          _name: string
          _nutrients: Json
          _request_id: string
          _source: string
        }
        Returns: string
      }
      delete_diary_entry: { Args: { _entry_id: string }; Returns: undefined }
      update_diary_amount: {
        Args: {
          _entry_id: string
          _new_amount: number
          _new_stock: number
          _nutrients: Json
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
