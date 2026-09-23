import { UserRole } from '../types';

export type Permission = 
  | 'CAN_POS_SALE'
  | 'CAN_RECEIVE_GOODS'
  | 'CAN_CYCLE_COUNT'
  | 'CAN_REFUND'
  | 'CAN_TRANSFER_STOCK'
  | 'CAN_CREATE_PO'
  | 'CAN_CANCEL_PO'
  | 'CAN_MANAGE_SUPPLIERS'
  | 'CAN_MANAGE_PRODUCTS'
  | 'CAN_APPLY_DISCOUNT'
  | 'CAN_VIEW_INVENTORY'
  | 'CAN_VIEW_REPORTS'
  | 'CAN_VIEW_AUDIT_LOG'
  | 'CAN_MANAGE_STAFF'
  | 'CAN_SYSTEM_CONFIG';

export const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  Cashier: [
    'CAN_POS_SALE',
  ],
  Supervisor: [
    'CAN_POS_SALE',
    'CAN_RECEIVE_GOODS',
    'CAN_CYCLE_COUNT',
    'CAN_REFUND',
    'CAN_VIEW_INVENTORY',
  ],
  Manager: [
    'CAN_POS_SALE',
    'CAN_RECEIVE_GOODS',
    'CAN_CYCLE_COUNT',
    'CAN_REFUND',
    'CAN_VIEW_INVENTORY',
    'CAN_MANAGE_PRODUCTS',
    'CAN_APPLY_DISCOUNT',
    'CAN_CREATE_PO',
    'CAN_CANCEL_PO',
    'CAN_TRANSFER_STOCK',
    'CAN_MANAGE_SUPPLIERS',
    'CAN_VIEW_REPORTS',
    'CAN_VIEW_AUDIT_LOG',
  ],
  Admin: [
    'CAN_POS_SALE',
    'CAN_RECEIVE_GOODS',
    'CAN_CYCLE_COUNT',
    'CAN_REFUND',
    'CAN_VIEW_INVENTORY',
    'CAN_MANAGE_PRODUCTS',
    'CAN_APPLY_DISCOUNT',
    'CAN_CREATE_PO',
    'CAN_CANCEL_PO',
    'CAN_TRANSFER_STOCK',
    'CAN_MANAGE_SUPPLIERS',
    'CAN_VIEW_REPORTS',
    'CAN_VIEW_AUDIT_LOG',
    'CAN_MANAGE_STAFF',
    'CAN_SYSTEM_CONFIG',
  ],
};

export const hasRolePermission = (role: UserRole, permission: Permission): boolean => {
  const permissions = ROLE_PERMISSIONS[role] || [];
  return permissions.includes(permission);
};

export const ROLE_BADGES: Record<UserRole, { label: string; bg: string; text: string; border: string; desc: string }> = {
  Cashier: {
    label: 'Cashier',
    bg: 'bg-blue-500/10',
    text: 'text-blue-400',
    border: 'border-blue-500/30',
    desc: 'POS sales only',
  },
  Supervisor: {
    label: 'Supervisor',
    bg: 'bg-amber-500/10',
    text: 'text-amber-400',
    border: 'border-amber-500/30',
    desc: 'Receive goods, cycle counts, refunds',
  },
  Manager: {
    label: 'Manager',
    bg: 'bg-purple-500/10',
    text: 'text-purple-400',
    border: 'border-purple-500/30',
    desc: 'Purchase orders, transfers, reports',
  },
  Admin: {
    label: 'Admin',
    bg: 'bg-emerald-500/10',
    text: 'text-emerald-400',
    border: 'border-emerald-500/30',
    desc: 'Complete control & audit trail',
  },
};

/**
 * Generates a simulated cryptographic hash for tamper-evident immutable audit logs
 */
export function generateAuditHash(previousHash: string, entryData: Record<string, any>): string {
  const rawString = `${previousHash}_${JSON.stringify(entryData)}`;
  let hash = 0;
  for (let i = 0; i < rawString.length; i++) {
    const char = rawString.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash).toString(16).padStart(8, '0') + Date.now().toString(16).slice(-6);
}
