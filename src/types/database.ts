// Database type definitions
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
          brand_id: string | null
          brand_type: string
          brand_name: string
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
          brand_id?: string | null
          brand_type?: string
          brand_name?: string
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
          brand_id?: string | null
          brand_type?: string
          brand_name?: string
          created_at?: string
          updated_at?: string
        }
      }
      social_posts: {
        Row: {
          id: string
          title: string | null
          caption: string | null
          format: 'image' | 'carousel' | 'reel' | 'story'
          status: 'idea' | 'draft' | 'scheduled' | 'posted' | 'failed'
          scheduled_at: string | null
          posted_at: string | null
          platforms: string[]
          notes: string | null
          external_ref: Json | null
          failure_reason: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          title?: string | null
          caption?: string | null
          format?: 'image' | 'carousel' | 'reel' | 'story'
          status?: 'idea' | 'draft' | 'scheduled' | 'posted' | 'failed'
          scheduled_at?: string | null
          posted_at?: string | null
          platforms?: string[]
          notes?: string | null
          external_ref?: Json | null
          failure_reason?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          title?: string | null
          caption?: string | null
          format?: 'image' | 'carousel' | 'reel' | 'story'
          status?: 'idea' | 'draft' | 'scheduled' | 'posted' | 'failed'
          scheduled_at?: string | null
          posted_at?: string | null
          platforms?: string[]
          notes?: string | null
          external_ref?: Json | null
          failure_reason?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      social_post_media: {
        Row: {
          id: string
          post_id: string
          url: string
          storage_path: string
          media_type: 'image' | 'video'
          position: number
          created_at: string
        }
        Insert: {
          id?: string
          post_id: string
          url: string
          storage_path: string
          media_type?: 'image' | 'video'
          position?: number
          created_at?: string
        }
        Update: {
          id?: string
          post_id?: string
          url?: string
          storage_path?: string
          media_type?: 'image' | 'video'
          position?: number
          created_at?: string
        }
      }
      social_post_products: {
        Row: { post_id: string; product_id: string }
        Insert: { post_id: string; product_id: string }
        Update: { post_id?: string; product_id?: string }
      }
      social_post_retailers: {
        Row: { post_id: string; retailer: string }
        Insert: { post_id: string; retailer: string }
        Update: { post_id?: string; retailer?: string }
      }
      brands: {
        Row: {
          id: string
          name: string
          type: string
          description: string | null
          logo_url: string | null
          website: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          type?: string
          description?: string | null
          logo_url?: string | null
          website?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          type?: string
          description?: string | null
          logo_url?: string | null
          website?: string | null
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
          is_sold_out: boolean | null
          original_price: number | null
          discount_percentage: number | null
          promotion_start_date: string | null
          promotion_end_date: string | null
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
          is_sold_out?: boolean | null
          original_price?: number | null
          discount_percentage?: number | null
          promotion_start_date?: string | null
          promotion_end_date?: string | null
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
          is_sold_out?: boolean | null
          original_price?: number | null
          discount_percentage?: number | null
          promotion_start_date?: string | null
          promotion_end_date?: string | null
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
      // Competitor tables
      competitors: {
        Row: {
          id: string
          name: string
          description: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          description?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          description?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      competitor_products: {
        Row: {
          id: string
          competitor_id: string
          name: string
          category_id: string | null
          related_product_id: string | null
          is_active: boolean
          weight_oz: number | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          competitor_id: string
          name: string
          category_id?: string | null
          related_product_id?: string | null
          is_active?: boolean
          weight_oz?: number | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          competitor_id?: string
          name?: string
          category_id?: string | null
          related_product_id?: string | null
          is_active?: boolean
          weight_oz?: number | null
          created_at?: string
          updated_at?: string
        }
      }
      competitor_product_urls: {
        Row: {
          id: string
          competitor_product_id: string
          retailer: string
          url: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          competitor_product_id: string
          retailer: string
          url: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          competitor_product_id?: string
          retailer?: string
          url?: string
          created_at?: string
          updated_at?: string
        }
      }
      competitor_prices: {
        Row: {
          id: string
          competitor_product_id: string
          retailer: string
          price: number
          timestamp: string
          status: string | null
          is_promotion: boolean | null
          promotion_notes: string | null
          is_sold_out: boolean | null
        }
        Insert: {
          id?: string
          competitor_product_id: string
          retailer: string
          price: number
          timestamp?: string
          status?: string | null
          is_promotion?: boolean | null
          promotion_notes?: string | null
          is_sold_out?: boolean | null
        }
        Update: {
          id?: string
          competitor_product_id?: string
          retailer?: string
          price?: number
          timestamp?: string
          status?: string | null
          is_promotion?: boolean | null
          promotion_notes?: string | null
          is_sold_out?: boolean | null
        }
      }
    }
  }
}

// Helper types for easier access
export type Product = Database['public']['Tables']['products']['Row']
export type ProductInsert = Database['public']['Tables']['products']['Insert']
export type ProductUpdate = Database['public']['Tables']['products']['Update']

export type Brand = Database['public']['Tables']['brands']['Row']
export type BrandInsert = Database['public']['Tables']['brands']['Insert']
export type BrandUpdate = Database['public']['Tables']['brands']['Update']

export type ProductCategory = Database['public']['Tables']['product_categories']['Row']
export type Price = Database['public']['Tables']['prices']['Row']
export type PriceInsert = Database['public']['Tables']['prices']['Insert']
export type PriceUpdate = Database['public']['Tables']['prices']['Update']

export type ProductImage = Database['public']['Tables']['product_images']['Row']
export type ProductUrl = Database['public']['Tables']['product_urls']['Row']
export type PriceCheckLog = Database['public']['Tables']['price_check_logs']['Row']

export type Competitor = Database['public']['Tables']['competitors']['Row']
export type CompetitorProduct = Database['public']['Tables']['competitor_products']['Row']
export type CompetitorProductUrl = Database['public']['Tables']['competitor_product_urls']['Row']
export type CompetitorPrice = Database['public']['Tables']['competitor_prices']['Row']

// Extended types with relations
export type ProductWithImages = Product & {
  product_images?: ProductImage[]
}

export type ProductWithCategory = Product & {
  product_categories?: ProductCategory
}

export type CompetitorProductWithRelations = CompetitorProduct & {
  competitor?: Competitor
  competitor_product_urls?: CompetitorProductUrl[]
}

export type PriceWithProduct = Price & {
  product?: Product
}

export type CompetitorPriceWithProduct = CompetitorPrice & {
  competitor_product?: CompetitorProductWithRelations
}