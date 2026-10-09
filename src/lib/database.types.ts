
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  
  "graphql_public": {
          Tables: {
            [_ in never]: never
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "graphql":
{ Args: { "extensions"?: Json,"operationName"?: string,"query"?: string,"variables"?: Json }; Returns: Json
                           }
          }
          Enums: {
            [_ in never]: never
          }
          CompositeTypes: {
            [_ in never]: never
          }
        },"public": {
          Tables: {
            "bookings": {
                  Row: {
                    "created_at": string,"customer_id": string,"deposit_amount": number | null,"end_time": string,"event_date": string,"guests": number | null,"id": string,"kind": Database["public"]['Enums']["booking_kind"],"location": unknown,"location_text": string | null,"notes": string | null,"quote_amount": number | null,"start_time": string,"status": Database["public"]['Enums']["booking_status"],"truck_id": string | null,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"customer_id": string,"deposit_amount"?: number | null,"end_time": string,"event_date": string,"guests"?: number | null,"id"?: string,"kind": Database["public"]['Enums']["booking_kind"],"location"?: unknown,"location_text"?: string | null,"notes"?: string | null,"quote_amount"?: number | null,"start_time": string,"status"?: Database["public"]['Enums']["booking_status"],"truck_id"?: string | null,"updated_at"?: string
                  }
                  Update: {
                    "created_at"?: string,"customer_id"?: string,"deposit_amount"?: number | null,"end_time"?: string,"event_date"?: string,"guests"?: number | null,"id"?: string,"kind"?: Database["public"]['Enums']["booking_kind"],"location"?: unknown,"location_text"?: string | null,"notes"?: string | null,"quote_amount"?: number | null,"start_time"?: string,"status"?: Database["public"]['Enums']["booking_status"],"truck_id"?: string | null,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "bookings_customer_id_fkey"
      columns: ["customer_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "bookings_truck_id_fkey"
      columns: ["truck_id"]
isOneToOne: false
      referencedRelation: "trucks"
      referencedColumns: ["id"]
    }
                  ]
                },"favorites": {
                  Row: {
                    "created_at": string,"customer_id": string,"id": string,"truck_id": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"customer_id": string,"id"?: string,"truck_id": string,"updated_at"?: string
                  }
                  Update: {
                    "created_at"?: string,"customer_id"?: string,"id"?: string,"truck_id"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "favorites_customer_id_fkey"
      columns: ["customer_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "favorites_truck_id_fkey"
      columns: ["truck_id"]
isOneToOne: false
      referencedRelation: "trucks"
      referencedColumns: ["id"]
    }
                  ]
                },"menu_categories": {
                  Row: {
                    "created_at": string,"id": string,"name_ar": string,"name_en": string | null,"sort_order": number,"truck_id": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"id"?: string,"name_ar": string,"name_en"?: string | null,"sort_order"?: number,"truck_id": string,"updated_at"?: string
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"name_ar"?: string,"name_en"?: string | null,"sort_order"?: number,"truck_id"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "menu_categories_truck_id_fkey"
      columns: ["truck_id"]
isOneToOne: false
      referencedRelation: "trucks"
      referencedColumns: ["id"]
    }
                  ]
                },"menu_items": {
                  Row: {
                    "category_id": string | null,"created_at": string,"description_ar": string | null,"description_en": string | null,"id": string,"image_url": string | null,"is_available": boolean,"name_ar": string,"name_en": string | null,"prep_minutes": number,"price": number,"sort_order": number,"truck_id": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "category_id"?: string | null,"created_at"?: string,"description_ar"?: string | null,"description_en"?: string | null,"id"?: string,"image_url"?: string | null,"is_available"?: boolean,"name_ar": string,"name_en"?: string | null,"prep_minutes"?: number,"price": number,"sort_order"?: number,"truck_id": string,"updated_at"?: string
                  }
                  Update: {
                    "category_id"?: string | null,"created_at"?: string,"description_ar"?: string | null,"description_en"?: string | null,"id"?: string,"image_url"?: string | null,"is_available"?: boolean,"name_ar"?: string,"name_en"?: string | null,"prep_minutes"?: number,"price"?: number,"sort_order"?: number,"truck_id"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "menu_items_category_id_fkey"
      columns: ["category_id"]
isOneToOne: false
      referencedRelation: "menu_categories"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "menu_items_truck_id_fkey"
      columns: ["truck_id"]
isOneToOne: false
      referencedRelation: "trucks"
      referencedColumns: ["id"]
    }
                  ]
                },"order_items": {
                  Row: {
                    "created_at": string,"id": string,"menu_item_id": string | null,"name_ar": string,"name_en": string | null,"notes": string | null,"order_id": string,"qty": number,"unit_price": number,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"id"?: string,"menu_item_id"?: string | null,"name_ar": string,"name_en"?: string | null,"notes"?: string | null,"order_id": string,"qty": number,"unit_price": number,"updated_at"?: string
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"menu_item_id"?: string | null,"name_ar"?: string,"name_en"?: string | null,"notes"?: string | null,"order_id"?: string,"qty"?: number,"unit_price"?: number,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "order_items_menu_item_id_fkey"
      columns: ["menu_item_id"]
isOneToOne: false
      referencedRelation: "menu_items"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "order_items_order_id_fkey"
      columns: ["order_id"]
isOneToOne: false
      referencedRelation: "orders"
      referencedColumns: ["id"]
    }
                  ]
                },"orders": {
                  Row: {
                    "accepted_at": string | null,"cancel_reason": string | null,"cancelled_at": string | null,"commission": number,"completed_at": string | null,"created_at": string,"customer_id": string,"delivery_address": string | null,"delivery_fee": number,"delivery_location": unknown,"id": string,"moyasar_payment_id": string | null,"notes": string | null,"payment_expires_at": string | null,"payment_status": Database["public"]['Enums']["payment_status"],"pickup_slot_start": string | null,"ready_at": string | null,"status": Database["public"]['Enums']["order_status"],"subtotal": number,"total": number,"truck_id": string,"type": Database["public"]['Enums']["order_type"],"updated_at": string,"vat_amount": number
                  }
                  ComputedFields: never
                  Insert: {
                    "accepted_at"?: string | null,"cancel_reason"?: string | null,"cancelled_at"?: string | null,"commission"?: number,"completed_at"?: string | null,"created_at"?: string,"customer_id": string,"delivery_address"?: string | null,"delivery_fee"?: number,"delivery_location"?: unknown,"id"?: string,"moyasar_payment_id"?: string | null,"notes"?: string | null,"payment_expires_at"?: string | null,"payment_status"?: Database["public"]['Enums']["payment_status"],"pickup_slot_start"?: string | null,"ready_at"?: string | null,"status"?: Database["public"]['Enums']["order_status"],"subtotal": number,"total": number,"truck_id": string,"type": Database["public"]['Enums']["order_type"],"updated_at"?: string,"vat_amount"?: number
                  }
                  Update: {
                    "accepted_at"?: string | null,"cancel_reason"?: string | null,"cancelled_at"?: string | null,"commission"?: number,"completed_at"?: string | null,"created_at"?: string,"customer_id"?: string,"delivery_address"?: string | null,"delivery_fee"?: number,"delivery_location"?: unknown,"id"?: string,"moyasar_payment_id"?: string | null,"notes"?: string | null,"payment_expires_at"?: string | null,"payment_status"?: Database["public"]['Enums']["payment_status"],"pickup_slot_start"?: string | null,"ready_at"?: string | null,"status"?: Database["public"]['Enums']["order_status"],"subtotal"?: number,"total"?: number,"truck_id"?: string,"type"?: Database["public"]['Enums']["order_type"],"updated_at"?: string,"vat_amount"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "orders_customer_id_fkey"
      columns: ["customer_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "orders_truck_id_fkey"
      columns: ["truck_id"]
isOneToOne: false
      referencedRelation: "trucks"
      referencedColumns: ["id"]
    }
                  ]
                },"payments": {
                  Row: {
                    "amount": number,"booking_id": string | null,"created_at": string,"created_by": string | null,"currency": string,"id": string,"kind": Database["public"]['Enums']["payment_kind"],"order_id": string | null,"provider": string,"provider_payment_id": string | null,"raw": Json | null,"status": Database["public"]['Enums']["payment_status"],"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "amount": number,"booking_id"?: string | null,"created_at"?: string,"created_by"?: string | null,"currency"?: string,"id"?: string,"kind": Database["public"]['Enums']["payment_kind"],"order_id"?: string | null,"provider"?: string,"provider_payment_id"?: string | null,"raw"?: Json | null,"status": Database["public"]['Enums']["payment_status"],"updated_at"?: string
                  }
                  Update: {
                    "amount"?: number,"booking_id"?: string | null,"created_at"?: string,"created_by"?: string | null,"currency"?: string,"id"?: string,"kind"?: Database["public"]['Enums']["payment_kind"],"order_id"?: string | null,"provider"?: string,"provider_payment_id"?: string | null,"raw"?: Json | null,"status"?: Database["public"]['Enums']["payment_status"],"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "payments_booking_id_fkey"
      columns: ["booking_id"]
isOneToOne: false
      referencedRelation: "bookings"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "payments_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "payments_order_id_fkey"
      columns: ["order_id"]
isOneToOne: false
      referencedRelation: "orders"
      referencedColumns: ["id"]
    }
                  ]
                },"platform_settings": {
                  Row: {
                    "created_at": string,"crowd_empty_max": number,"crowd_moderate_max": number,"default_commission_rate": number,"id": boolean,"max_delivery_radius_m": number,"payment_expiry_minutes": number,"pickup_slot_minutes": number,"updated_at": string,"vat_rate": number
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"crowd_empty_max"?: number,"crowd_moderate_max"?: number,"default_commission_rate"?: number,"id"?: boolean,"max_delivery_radius_m"?: number,"payment_expiry_minutes"?: number,"pickup_slot_minutes"?: number,"updated_at"?: string,"vat_rate"?: number
                  }
                  Update: {
                    "created_at"?: string,"crowd_empty_max"?: number,"crowd_moderate_max"?: number,"default_commission_rate"?: number,"id"?: boolean,"max_delivery_radius_m"?: number,"payment_expiry_minutes"?: number,"pickup_slot_minutes"?: number,"updated_at"?: string,"vat_rate"?: number
                  }
                  Relationships: [
                    
                  ]
                },"profiles": {
                  Row: {
                    "created_at": string,"full_name": string | null,"id": string,"locale": string,"phone": string | null,"role": Database["public"]['Enums']["user_role"],"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"full_name"?: string | null,"id": string,"locale"?: string,"phone"?: string | null,"role"?: Database["public"]['Enums']["user_role"],"updated_at"?: string
                  }
                  Update: {
                    "created_at"?: string,"full_name"?: string | null,"id"?: string,"locale"?: string,"phone"?: string | null,"role"?: Database["public"]['Enums']["user_role"],"updated_at"?: string
                  }
                  Relationships: [
                    
                  ]
                },"quotes": {
                  Row: {
                    "amount": number,"booking_id": string,"created_at": string,"deposit_amount": number,"id": string,"line_items": NonNullable<Json>,"status": Database["public"]['Enums']["quote_status"],"updated_at": string,"valid_until": string | null,"vendor_id": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "amount": number,"booking_id": string,"created_at"?: string,"deposit_amount"?: number,"id"?: string,"line_items"?: NonNullable<Json>,"status"?: Database["public"]['Enums']["quote_status"],"updated_at"?: string,"valid_until"?: string | null,"vendor_id"?: string | null
                  }
                  Update: {
                    "amount"?: number,"booking_id"?: string,"created_at"?: string,"deposit_amount"?: number,"id"?: string,"line_items"?: NonNullable<Json>,"status"?: Database["public"]['Enums']["quote_status"],"updated_at"?: string,"valid_until"?: string | null,"vendor_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "quotes_booking_id_fkey"
      columns: ["booking_id"]
isOneToOne: false
      referencedRelation: "bookings"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "quotes_vendor_id_fkey"
      columns: ["vendor_id"]
isOneToOne: false
      referencedRelation: "vendors"
      referencedColumns: ["id"]
    }
                  ]
                },"reviews": {
                  Row: {
                    "comment": string | null,"created_at": string,"customer_id": string,"id": string,"order_id": string,"rating": number,"truck_id": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "comment"?: string | null,"created_at"?: string,"customer_id": string,"id"?: string,"order_id": string,"rating": number,"truck_id": string,"updated_at"?: string
                  }
                  Update: {
                    "comment"?: string | null,"created_at"?: string,"customer_id"?: string,"id"?: string,"order_id"?: string,"rating"?: number,"truck_id"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "reviews_customer_id_fkey"
      columns: ["customer_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "reviews_order_id_fkey"
      columns: ["order_id"]
isOneToOne: true
      referencedRelation: "orders"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "reviews_truck_id_fkey"
      columns: ["truck_id"]
isOneToOne: false
      referencedRelation: "trucks"
      referencedColumns: ["id"]
    }
                  ]
                },"trucks": {
                  Row: {
                    "active_orders": number,"avg_prep_minutes": number,"created_at": string,"crowd_mode": Database["public"]['Enums']["crowd_mode"],"crowd_status": Database["public"]['Enums']["crowd_level"],"cuisine": string,"delivery_enabled": boolean,"delivery_fee": number,"delivery_radius_m": number,"description_ar": string | null,"description_en": string | null,"est_wait_minutes": number,"id": string,"is_online": boolean,"is_suspended": boolean,"lat": number | null,"lng": number | null,"location": unknown,"location_updated_at": string | null,"logo_url": string | null,"manual_crowd": Database["public"]['Enums']["crowd_level"] | null,"name_ar": string,"name_en": string | null,"parallelism": number,"rating_avg": number,"rating_count": number,"slot_capacity": number,"updated_at": string,"vendor_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "active_orders"?: number,"avg_prep_minutes"?: number,"created_at"?: string,"crowd_mode"?: Database["public"]['Enums']["crowd_mode"],"crowd_status"?: Database["public"]['Enums']["crowd_level"],"cuisine"?: string,"delivery_enabled"?: boolean,"delivery_fee"?: number,"delivery_radius_m"?: number,"description_ar"?: string | null,"description_en"?: string | null,"est_wait_minutes"?: number,"id"?: string,"is_online"?: boolean,"is_suspended"?: boolean,"lat"?: never,"lng"?: never,"location"?: unknown,"location_updated_at"?: string | null,"logo_url"?: string | null,"manual_crowd"?: Database["public"]['Enums']["crowd_level"] | null,"name_ar": string,"name_en"?: string | null,"parallelism"?: number,"rating_avg"?: number,"rating_count"?: number,"slot_capacity"?: number,"updated_at"?: string,"vendor_id": string
                  }
                  Update: {
                    "active_orders"?: number,"avg_prep_minutes"?: number,"created_at"?: string,"crowd_mode"?: Database["public"]['Enums']["crowd_mode"],"crowd_status"?: Database["public"]['Enums']["crowd_level"],"cuisine"?: string,"delivery_enabled"?: boolean,"delivery_fee"?: number,"delivery_radius_m"?: number,"description_ar"?: string | null,"description_en"?: string | null,"est_wait_minutes"?: number,"id"?: string,"is_online"?: boolean,"is_suspended"?: boolean,"lat"?: never,"lng"?: never,"location"?: unknown,"location_updated_at"?: string | null,"logo_url"?: string | null,"manual_crowd"?: Database["public"]['Enums']["crowd_level"] | null,"name_ar"?: string,"name_en"?: string | null,"parallelism"?: number,"rating_avg"?: number,"rating_count"?: number,"slot_capacity"?: number,"updated_at"?: string,"vendor_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "trucks_vendor_id_fkey"
      columns: ["vendor_id"]
isOneToOne: false
      referencedRelation: "vendors"
      referencedColumns: ["id"]
    }
                  ]
                },"vendors": {
                  Row: {
                    "business_name": string,"commission_rate": number,"cr_number": string,"created_at": string,"id": string,"municipality_license_no": string,"owner_id": string,"rejection_reason": string | null,"reviewed_at": string | null,"status": Database["public"]['Enums']["vendor_status"],"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "business_name": string,"commission_rate"?: number,"cr_number": string,"created_at"?: string,"id"?: string,"municipality_license_no": string,"owner_id": string,"rejection_reason"?: string | null,"reviewed_at"?: string | null,"status"?: Database["public"]['Enums']["vendor_status"],"updated_at"?: string
                  }
                  Update: {
                    "business_name"?: string,"commission_rate"?: number,"cr_number"?: string,"created_at"?: string,"id"?: string,"municipality_license_no"?: string,"owner_id"?: string,"rejection_reason"?: string | null,"reviewed_at"?: string | null,"status"?: Database["public"]['Enums']["vendor_status"],"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "vendors_owner_id_fkey"
      columns: ["owner_id"]
isOneToOne: true
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                }
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "apply_as_vendor":
{ Args: { "p_business_name": string,"p_cr_number": string,"p_municipality_license_no": string }; Returns: string
                           },
"crowd_level_for":
{ Args: { "active_orders": number }; Returns: Database["public"]['Enums']["crowd_level"]
                           },
"current_role_name":
{ Args: Record<PropertyKey, never>; Returns: Database["public"]['Enums']["user_role"]
                           },
"is_admin":
{ Args: Record<PropertyKey, never>; Returns: boolean
                           },
"nearby_trucks":
{ Args: { "p_lat": number,"p_lng": number,"p_only_online"?: boolean,"p_radius_m"?: number }; Returns: {
              "active_orders": number,"crowd_status": Database["public"]['Enums']["crowd_level"],"cuisine": string,"delivery_enabled": boolean,"delivery_radius_m": number,"distance_m": number,"est_wait_minutes": number,"id": string,"is_online": boolean,"lat": number,"lng": number,"logo_url": string,"name_ar": string,"name_en": string,"rating_avg": number,"rating_count": number
            }[]
                           },
"owns_truck":
{ Args: { "p_truck_id": string }; Returns: boolean
                           },
"owns_vendor":
{ Args: { "p_vendor_id": string }; Returns: boolean
                           },
"refresh_truck_load":
{ Args: { "p_truck_id": string }; Returns: undefined
                           },
"truck_is_public":
{ Args: { "p_truck_id": string }; Returns: boolean
                           },
"update_truck_location":
{ Args: { "p_lat": number,"p_lng": number,"p_truck_id": string }; Returns: undefined
                           }
          }
          Enums: {
            "booking_kind": "corporate"|"private_event","booking_status": "requested"|"quoted"|"accepted"|"deposit_paid"|"completed"|"cancelled","crowd_level": "empty"|"moderate"|"busy","crowd_mode": "auto"|"manual","order_status": "pending_payment"|"new"|"accepted"|"preparing"|"ready"|"completed"|"cancelled"|"expired","order_type": "pickup"|"delivery","payment_kind": "charge"|"deposit"|"refund","payment_status": "pending"|"paid"|"failed"|"refunded"|"partially_refunded","quote_status": "draft"|"sent"|"accepted"|"rejected"|"expired","user_role": "customer"|"vendor"|"admin","vendor_status": "pending"|"approved"|"rejected"|"suspended"
          }
          CompositeTypes: {
            [_ in never]: never
          }
        }
}

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
  ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
  ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
  : never

export const Constants = {
  "graphql_public": {
          Enums: {
            
          }
        },"public": {
          Enums: {
            "booking_kind": ["corporate", "private_event"],"booking_status": ["requested", "quoted", "accepted", "deposit_paid", "completed", "cancelled"],"crowd_level": ["empty", "moderate", "busy"],"crowd_mode": ["auto", "manual"],"order_status": ["pending_payment", "new", "accepted", "preparing", "ready", "completed", "cancelled", "expired"],"order_type": ["pickup", "delivery"],"payment_kind": ["charge", "deposit", "refund"],"payment_status": ["pending", "paid", "failed", "refunded", "partially_refunded"],"quote_status": ["draft", "sent", "accepted", "rejected", "expired"],"user_role": ["customer", "vendor", "admin"],"vendor_status": ["pending", "approved", "rejected", "suspended"]
          }
        }
} as const
