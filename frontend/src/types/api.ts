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

export interface ProductResponse {
  success: boolean;
  message: string;
  data: Product;
}

export interface CreateProductRequest {
  sku: string;
  name: string;
  price: number;
}

export interface UpdateProductRequest {
  sku: string;
  name: string;
  price: number;
}

export interface ApiErrorBody {
  error: {
    code: string;
    message: string;
    available?: number;
    sku?: string;
  };
}

export type StockMovementType = "in" | "out";

export interface StockMovement {
  id: number;
  product_id: number;
  type: StockMovementType;
  qty: number;
  note: string | null;
  created_at: string;
}

export interface StockAdjustmentRequest {
  type: StockMovementType;
  qty: number;
  note?: string | null;
}

export interface StockAdjustmentResult {
  stock: number;
  movement: StockMovement;
}

export interface StockAdjustmentResponse {
  success: boolean;
  message: string;
  data: StockAdjustmentResult;
}

export interface StockMovementsResponse {
  success: boolean;
  message: string;
  data: StockMovement[];
}
