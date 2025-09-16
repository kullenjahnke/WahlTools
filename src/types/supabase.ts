export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      products: {
        Row: {
          id: string
          name: string
          category_id: string
          upc: string | null
          description: string | null
          internal_notes: string | null
          aliases: string[] | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          category_id: string
          upc?: string | null
          description?: string | null
          internal_notes?: string | null
          aliases?: string[] | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          category_id?: string
          upc?: string | null
          description?: string | null
          internal_notes?: string | null
          aliases?: string[] | null
          created_at?: string
          updated_at?: string
        }
      }
      product_categories: {
        Row: {
          id: string
          name: string
          description: string | null
          created_at: string
        }
        Insert: {
          id?: string
          name: string
          description?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          name?: string
          description?: string | null
          created_at?: string
        }
      }
      prices: {
        Row: {
          id: string
          product_id: string
          retailer: string
          price: number
          timestamp: string
          status: string | null
          is_promotion: boolean | null
          promotion_notes: string | null
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          id?: string
          product_id: string
          retailer: string
          price: number
          timestamp?: string
          status?: string | null
          is_promotion?: boolean | null
          promotion_notes?: string | null
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          id?: string
          product_id?: string
          retailer?: string
          price?: number
          timestamp?: string
          status?: string | null
          is_promotion?: boolean | null
          promotion_notes?: string | null
          updated_at?: string | null
          updated_by?: string | null
        }
      }
      price_change_logs: {
        Row: {
          id: string
          price_id: string
          old_price: number
          new_price: number
          changed_by: string
          changed_at: string
        }
        Insert: {
          id?: string
          price_id: string
          old_price: number
          new_price: number
          changed_by: string
          changed_at?: string
        }
        Update: {
          id?: string
          price_id?: string
          old_price?: number
          new_price?: number
          changed_by?: string
          changed_at?: string
        }
      }
      product_images: {
        Row: {
          id: string
          url: string
          type: string
          main: boolean
          product_id: string
        }
        Insert: {
          id?: string
          url: string
          type: string
          main: boolean
          product_id: string
        }
        Update: {
          id?: string
          url?: string
          type?: string
          main?: boolean
          product_id?: string
        }
      }
      product_urls: {
        Row: {
          id: string
          product_id: string
          retailer: string
          url: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          product_id: string
          retailer: string
          url: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          product_id?: string
          retailer?: string
          url?: string
          created_at?: string
          updated_at?: string
        }
      }
      price_check_logs: {
        Row: {
          id: string
          retailer: string
          check_date: string
          completed: boolean
          completed_by: string | null
          completed_at: string | null
          notes: string | null
        }
        Insert: {
          id?: string
          retailer: string
          check_date?: string
          completed?: boolean
          completed_by?: string | null
          completed_at?: string | null
          notes?: string | null
        }
        Update: {
          id?: string
          retailer?: string
          check_date?: string
          completed?: boolean
          completed_by?: string | null
          completed_at?: string | null
          notes?: string | null
        }
      }
    }
  }
}