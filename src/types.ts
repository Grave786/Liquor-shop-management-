export type UserRole = 'super_admin' | 'admin' | 'manager' | 'user';

export interface UserProfile {
  uid: string;
  email: string;
  role: UserRole;
  outletId?: string;
  displayName?: string;
}

export interface Outlet {
  id: string;
  name: string;
  location: string;
  managerId?: string;
  licenseNumber?: string;
  licenseValidUntil?: string;
}

export interface Product {
  id: string;
  name: string;
  category: string;
  sku: string;
  unitPrice: number;
  description?: string;
}

export interface InventoryItem {
  id: string;
  productId: string;
  outletId: string;
  quantity: number;
  lastUpdated: string;
}

export interface SaleItem {
  productId: string;
  quantity: number;
  price: number;
}

export interface Sale {
  id: string;
  outletId: string;
  userId: string;
  items: SaleItem[];
  totalAmount: number;
  timestamp: string;
}

export interface StockTransfer {
  id: string;
  fromOutletId: string;
  toOutletId: string;
  productId: string;
  quantity: number;
  status: 'pending' | 'completed' | 'cancelled';
  timestamp: string;
}
