export interface Product {
  id: number;
  sku: string;
  name: string;
  price: number;
  stock: number;
  is_active: boolean;
  created_at: string;
  last_movement_at: string | null;
}

export interface ProductMeta {
  page: number;
  limit: number;
  total: number;
  total_pages: number;
}

export interface ProductsResponse {
  success: boolean;
  message: string;
  data: Product[];
  meta: ProductMeta;
}

export interface ApiErrorBody {
  error: {
    code: string;
    message: string;
    available?: number;
    sku?: string;
  };
}
