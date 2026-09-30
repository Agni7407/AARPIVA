export interface Category {
  id: number;
  name: string;
  slug: string;
  isActive: boolean;
}

export interface Product {
  id: number;
  categoryId: number;
  categoryName: string;
  name: string;
  slug: string;
  description: string;
  price: number;
  discountPrice: number | null;
  stock: number;
  isActive: boolean;
  images: string[];
}

export interface CartItem {
  productId: number;
  quantity: number;
  product: Product;
}

export interface Address {
  id: number;
  recipientName: string;
  phone: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  state: string;
  pincode: string;
}

export interface ReturnRequest {
  id: number;
  orderId: number;
  orderItemId: number;
  productId: number;
  productName: string;
  quantity: number;
  reason: string;
  status: string;
  adminNote: string;
  createdAt: string;
  updatedAt: string;
}

export interface Order {
  id: number;
  totalAmount: number;
  status: string;
  paymentStatus: string;
  createdAt: string;
  items: { productId: number; productName: string; unitPrice: number; quantity: number; id?: number }[];
  address: Address;
  returns: ReturnRequest[];
}
