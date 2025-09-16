// Interface definitions
export interface Product {
  id: string;
  name: string;
  category: string;
  category_id?: string;
  description?: string | null;
  internal_notes?: string | null;
  aliases?: string[] | null;
  created_at: string;
  updated_at: string;
  prices?: Price[];
  product_images?: ProductImage[];
  product_urls?: ProductUrl[];
}

export interface Price {
  id: string;
  product_id: string;
  retailer: string;
  price: number;
  timestamp: string;
  status?: string | null;
  is_promotion?: boolean | null;
  is_sold_out?: boolean | null;
  promotion_notes?: string | null;
  updated_at?: string | null;
  updated_by?: string | null;
}
  
export interface PriceChangeLog {
  id: string;
  price_id: string;
  old_price: number;
  new_price: number;
  changed_by: string;
  changed_at: string;
}

export interface ProductImage {
  id: string;
  url: string;
  type: 'product' | 'upc';
  main: boolean;
  product_id: string;
}

export interface ProductUrl {
  id: string;
  product_id: string;
  retailer: string;
  url: string;
  created_at: string;
  updated_at: string;
}

export interface ProductCategory {
  id: string;
  name: string;
  description?: string | null;
  created_at: string;
}

export interface PriceCheckLog {
  id: string;
  retailer: string;
  completed: boolean;
  completed_by?: string | null;
  completed_at?: string | null;
  check_date?: string | null;
  notes?: string | null;
}

export interface Competitor {
  id: string;
  name: string;
  description?: string | null;
  created_at: string;
  updated_at: string;
}

export interface CompetitorProduct {
  id: string;
  competitor_id: string;
  name: string;
  category_id: string;
  related_product_id?: string | null;
  is_active: boolean;
  weight_oz?: number | null;
  created_at: string;
  updated_at: string;
  competitor?: Competitor;
  related_product?: Product;
  competitor_prices?: CompetitorPrice[];
  competitor_product_urls?: CompetitorProductUrl[];
}

export interface CompetitorProductUrl {
  id: string;
  competitor_product_id: string;
  retailer: string;
  url: string;
  created_at: string;
  updated_at: string;
}

export interface CompetitorPrice {
  id: string;
  competitor_product_id: string;
  retailer: string;
  price: number;
  is_promotion?: boolean | null;
  is_sold_out?: boolean | null;
  promotion_notes?: string | null;
  timestamp: string;
  status?: string | null;
  updated_at?: string | null;
  updated_by?: string | null;
}