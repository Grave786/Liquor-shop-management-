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
  sku?: string;
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
  subtotal?: number;
  discountType?: 'amount' | 'percent';
  discountValue?: number;
  discountAmount?: number;
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
  createdByUserId?: string;
  lastUpdatedByUserId?: string;
  events?: StockTransferEvent[];
}

export interface StockTransferEvent {
  type: 'created' | 'status_changed' | 'note';
  statusFrom?: StockTransfer['status'];
  statusTo?: StockTransfer['status'];
  note?: string;
  userId?: string;
  timestamp: string;
}

export interface InventoryAdditionLog {
  id: string;
  outletId: string;
  productId: string;
  product?: { id: string; name: string; sku?: string; category?: string } | null;
  quantityAdded: number;
  previousQuantity: number;
  newQuantity: number;
  addedBy?: { id: string; email: string; displayName?: string; role: UserRole } | null;
  source: 'manual' | 'transfer_in';
  transferId?: string;
  timestamp: string;
}
