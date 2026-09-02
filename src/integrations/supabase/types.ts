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
      categories: {
        Row: {
          created_at: string
          description: string | null
          id: string
          image_url: string | null
          name: string
          slug: string
          sort_order: number
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          name: string
          slug: string
          sort_order?: number
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          name?: string
          slug?: string
          sort_order?: number
        }
        Relationships: []
      }
      coupons: {
        Row: {
          active: boolean
          code: string
          created_at: string
          discount_type: Database["public"]["Enums"]["discount_type"]
          expires_at: string | null
          id: string
          max_uses: number | null
          min_subtotal_kes: number
          uses: number
          value: number
        }
        Insert: {
          active?: boolean
          code: string
          created_at?: string
          discount_type: Database["public"]["Enums"]["discount_type"]
          expires_at?: string | null
          id?: string
          max_uses?: number | null
          min_subtotal_kes?: number
          uses?: number
          value: number
        }
        Update: {
          active?: boolean
          code?: string
          created_at?: string
          discount_type?: Database["public"]["Enums"]["discount_type"]
          expires_at?: string | null
          id?: string
          max_uses?: number | null
          min_subtotal_kes?: number
          uses?: number
          value?: number
        }
        Relationships: []
      }
      gift_packages: {
        Row: {
          active: boolean
          contents: string[]
          created_at: string
          description: string | null
          featured: boolean
          gallery: string[]
          id: string
          image_url: string | null
          item_count: number
          name: string
          occasion: Database["public"]["Enums"]["gift_occasion"]
          price_kes: number
          slug: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          contents?: string[]
          created_at?: string
          description?: string | null
          featured?: boolean
          gallery?: string[]
          id?: string
          image_url?: string | null
          item_count?: number
          name: string
          occasion?: Database["public"]["Enums"]["gift_occasion"]
          price_kes: number
          slug: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          contents?: string[]
          created_at?: string
          description?: string | null
          featured?: boolean
          gallery?: string[]
          id?: string
          image_url?: string | null
          item_count?: number
          name?: string
          occasion?: Database["public"]["Enums"]["gift_occasion"]
          price_kes?: number
          slug?: string
          updated_at?: string
        }
        Relationships: []
      }
      newsletter_subscribers: {
        Row: {
          created_at: string
          email: string
          id: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
        }
        Relationships: []
      }
      order_items: {
        Row: {
          id: string
          image_url: string | null
          order_id: string
          product_id: string | null
          product_name: string
          quantity: number
          size: string | null
          unit_price_kes: number
        }
        Insert: {
          id?: string
          image_url?: string | null
          order_id: string
          product_id?: string | null
          product_name: string
          quantity: number
          size?: string | null
          unit_price_kes: number
        }
        Update: {
          id?: string
          image_url?: string | null
          order_id?: string
          product_id?: string | null
          product_name?: string
          quantity?: number
          size?: string | null
          unit_price_kes?: number
        }
        Relationships: [
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          address: string
          county: string
          coupon_code: string | null
          created_at: string
          delivery_fee_kes: number
          discount_kes: number
          email: string | null
          first_name: string
          id: string
          last_name: string
          order_number: string
          payment_method: Database["public"]["Enums"]["payment_method"]
          payment_ref: string | null
          phone: string
          status: Database["public"]["Enums"]["order_status"]
          subtotal_kes: number
          total_kes: number
          updated_at: string
          user_id: string | null
        }
        Insert: {
          address: string
          county: string
          coupon_code?: string | null
          created_at?: string
          delivery_fee_kes?: number
          discount_kes?: number
          email?: string | null
          first_name: string
          id?: string
          last_name: string
          order_number?: string
          payment_method?: Database["public"]["Enums"]["payment_method"]
          payment_ref?: string | null
          phone: string
          status?: Database["public"]["Enums"]["order_status"]
          subtotal_kes: number
          total_kes: number
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          address?: string
          county?: string
          coupon_code?: string | null
          created_at?: string
          delivery_fee_kes?: number
          discount_kes?: number
          email?: string | null
          first_name?: string
          id?: string
          last_name?: string
          order_number?: string
          payment_method?: Database["public"]["Enums"]["payment_method"]
          payment_ref?: string | null
          phone?: string
          status?: Database["public"]["Enums"]["order_status"]
          subtotal_kes?: number
          total_kes?: number
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      products: {
        Row: {
          category_id: string | null
          created_at: string
          description: string | null
          featured: boolean
          gallery: string[]
          id: string
          image_url: string | null
          name: string
          price_kes: number
          sizes: string[]
          slug: string
          sold: boolean
          tag: string | null
          updated_at: string
        }
        Insert: {
          category_id?: string | null
          created_at?: string
          description?: string | null
          featured?: boolean
          gallery?: string[]
          id?: string
          image_url?: string | null
          name: string
          price_kes: number
          sizes?: string[]
          slug: string
          sold?: boolean
          tag?: string | null
          updated_at?: string
        }
        Update: {
          category_id?: string | null
          created_at?: string
          description?: string | null
          featured?: boolean
          gallery?: string[]
          id?: string
          image_url?: string | null
          name?: string
          price_kes?: number
          sizes?: string[]
          slug?: string
          sold?: boolean
          tag?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "products_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          full_name: string | null
          id: string
          phone: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          full_name?: string | null
          id: string
          phone?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          full_name?: string | null
          id?: string
          phone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      reviews: {
        Row: {
          body: string | null
          created_at: string
          id: string
          product_id: string
          rating: number
          title: string | null
          user_id: string
          verified_buyer: boolean
        }
        Insert: {
          body?: string | null
          created_at?: string
          id?: string
          product_id: string
          rating: number
          title?: string | null
          user_id: string
          verified_buyer?: boolean
        }
        Update: {
          body?: string | null
          created_at?: string
          id?: string
          product_id?: string
          rating?: number
          title?: string | null
          user_id?: string
          verified_buyer?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "reviews_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      wishlists: {
        Row: {
          created_at: string
          id: string
          product_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          product_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          product_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "wishlists_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      reviews_public: {
        Row: {
          body: string | null
          created_at: string | null
          id: string | null
          product_id: string | null
          rating: number | null
          title: string | null
          verified_buyer: boolean | null
        }
        Insert: {
          body?: string | null
          created_at?: string | null
          id?: string | null
          product_id?: string | null
          rating?: number | null
          title?: string | null
          verified_buyer?: boolean | null
        }
        Update: {
          body?: string | null
          created_at?: string | null
          id?: string | null
          product_id?: string | null
          rating?: number | null
          title?: string | null
          verified_buyer?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "reviews_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      validate_coupon: {
        Args: { _code: string; _subtotal_kes: number }
        Returns: {
          code: string
          discount_kes: number
          discount_type: Database["public"]["Enums"]["discount_type"]
          message: string
          value: number
        }[]
      }
    }
    Enums: {
      app_role: "admin" | "customer"
      discount_type: "percent" | "fixed"
      gift_occasion:
        | "birthday"
        | "anniversary"
        | "valentines"
        | "mothers_day"
        | "womens_day"
        | "graduation"
        | "baby_shower"
        | "just_because"
        | "other"
      order_status: "pending" | "paid" | "shipped" | "delivered" | "cancelled"
      payment_method: "mpesa" | "card" | "cod"
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
      app_role: ["admin", "customer"],
      discount_type: ["percent", "fixed"],
      gift_occasion: [
        "birthday",
        "anniversary",
        "valentines",
        "mothers_day",
        "womens_day",
        "graduation",
        "baby_shower",
        "just_because",
        "other",
      ],
      order_status: ["pending", "paid", "shipped", "delivered", "cancelled"],
      payment_method: ["mpesa", "card", "cod"],
    },
  },
} as const
