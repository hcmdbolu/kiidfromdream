import { CartItem, Customer, DiscountRule, DiscountSecurityConfig, Product } from '../types';
import { hashPin, verifyPin } from './security';

export const DEFAULT_DISCOUNT_PIN = '8888';

export const DEFAULT_DISCOUNT_SECURITY_CONFIG: DiscountSecurityConfig = {
  id: 'DISCOUNT_SECURITY_CONFIG',
  discount_pin: hashPin(DEFAULT_DISCOUNT_PIN),
  is_configured: true,
  stacking_policy: 'BEST_DISCOUNT', // 'BEST_DISCOUNT' | 'CONTROLLED_STACKING'
  max_discount_percent_cap: 25, // Maximum 25% discount allowed without super admin override
  enforce_cost_floor: true, // Prevents selling below wholesale product acquisition cost
  updated_at: '2026-10-01T00:00:00.000Z',
  updated_by_staff_name: 'Store Manager',
};

export const DEFAULT_MANAGEMENT_DISCOUNT_RULES: DiscountRule[] = [
  {
    rule_id: 'RULE_BULK_10KG',
    name: 'Bulk Purchase (≥10kg Single Item)',
    description: '5% discount on qualifying fish/perishable items when purchasing 10kg or more of that item',
    condition_type: 'ITEM_WEIGHT_THRESHOLD',
    threshold_value: 10,
    discount_type: 'PERCENT',
    discount_value: 5,
    scope: 'QUALIFYING_ITEM', // Strictly discounts the items meeting the threshold, not unrelated basket items!
    max_discount_cap: 20000,
    requires_manager_approval: false, // Pre-approved for cashier when qualified
    is_active: true,
  },
  {
    rule_id: 'RULE_BULK_25KG',
    name: 'High Volume Basket (≥25kg Total)',
    description: '8% discount for orders totaling 25kg or more across all items',
    condition_type: 'CART_QUANTITY_THRESHOLD',
    threshold_value: 25,
    discount_type: 'PERCENT',
    discount_value: 8,
    scope: 'BASKET',
    max_discount_cap: 35000,
    requires_manager_approval: false, // Pre-approved for cashier when qualified
    is_active: true,
  },
  {
    rule_id: 'RULE_SUBTOTAL_100K',
    name: 'Wholesale Tier (≥₦100,000)',
    description: 'Flat ₦5,000 instant discount on basket subtotal over ₦100,000',
    condition_type: 'CART_SUBTOTAL_THRESHOLD',
    threshold_value: 100000,
    discount_type: 'FIXED',
    discount_value: 5000,
    scope: 'BASKET',
    requires_manager_approval: false, // Pre-approved for cashier when qualified
    is_active: true,
  },
  {
    rule_id: 'RULE_LOYALTY_5',
    name: 'Frequent Buyer Reward (≥5 Visits)',
    description: '5% discount for registered customers with 5 or more previous visits',
    condition_type: 'CUSTOMER_LOYALTY',
    threshold_value: 5,
    discount_type: 'PERCENT',
    discount_value: 5,
    scope: 'BASKET',
    max_discount_cap: 15000,
    requires_manager_approval: false, // Pre-approved for cashier when qualified
    is_active: true,
  },
  {
    rule_id: 'RULE_MANAGER_CLEARANCE',
    name: 'Manager Clearance / Promo Override',
    description: '10% special clearance or promotional discount (Requires Manager PIN)',
    condition_type: 'GENERAL_OVERRIDE',
    threshold_value: 0,
    discount_type: 'PERCENT',
    discount_value: 10,
    scope: 'BASKET',
    max_discount_cap: 50000,
    requires_manager_approval: true, // Requires Manager PIN
    is_active: true,
  },
];

export interface RuleEvaluationResult {
  isQualified: boolean;
  qualifyingDetails: string;
  calculatedDiscount: number;
  qualifyingSubtotal?: number;
  scope: 'QUALIFYING_ITEM' | 'BASKET';
}

/**
 * Evaluates whether a cart qualifies for a specific management discount rule
 * Supports both ITEM-LEVEL scope (only discounts eligible products >= threshold)
 * and BASKET-LEVEL scope (discounts the whole cart).
 */
export function evaluateDiscountRule(
  rule: DiscountRule,
  cart: CartItem[],
  customer: Customer | null,
  cartSubtotal: number
): RuleEvaluationResult {
  const scope = rule.scope || 'BASKET';

  if (!rule.is_active || cart.length === 0) {
    return {
      isQualified: false,
      qualifyingDetails: 'Cart is empty or rule is inactive',
      calculatedDiscount: 0,
      scope,
    };
  }

  let isQualified = false;
  let qualifyingDetails = '';
  let qualifyingSubtotal = cartSubtotal;

  switch (rule.condition_type) {
    case 'ITEM_WEIGHT_THRESHOLD': {
      // Find items meeting weight/quantity threshold
      const qualifyingItems = cart.filter(i => (i.quantity_sold || 0) >= rule.threshold_value);
      if (qualifyingItems.length > 0) {
        isQualified = true;
        qualifyingSubtotal = qualifyingItems.reduce((sum, i) => sum + (i.total_amount || (i.quantity_sold * i.unit_price)), 0);
        
        if (scope === 'QUALIFYING_ITEM') {
          qualifyingDetails = `${qualifyingItems.map(i => `${i.item_name} (${i.quantity_sold}${i.unit})`).join(', ')} qualify (${qualifyingItems.length} items, ₦${qualifyingSubtotal.toLocaleString()})`;
        } else {
          qualifyingDetails = `${qualifyingItems[0].item_name} has ${qualifyingItems[0].quantity_sold} ${qualifyingItems[0].unit} (≥ ${rule.threshold_value} ${qualifyingItems[0].unit})`;
        }
      } else {
        const maxItem = cart.reduce((max, cur) => (cur.quantity_sold > (max?.quantity_sold || 0) ? cur : max), cart[0]);
        const currentQty = maxItem ? maxItem.quantity_sold : 0;
        const diff = Math.round((rule.threshold_value - currentQty) * 10) / 10;
        qualifyingDetails = `Requires ${rule.threshold_value}kg on a single item (closest: ${currentQty}kg, need +${diff}kg)`;
      }
      break;
    }

    case 'CART_QUANTITY_THRESHOLD': {
      // Total weight/qty across all items in cart >= threshold
      const totalQty = cart.reduce((sum, item) => sum + (item.quantity_sold || 0), 0);
      if (totalQty >= rule.threshold_value) {
        isQualified = true;
        qualifyingDetails = `Cart total quantity is ${totalQty} units/kg (≥ ${rule.threshold_value})`;
      } else {
        const diff = Math.round((rule.threshold_value - totalQty) * 10) / 10;
        qualifyingDetails = `Total cart is ${totalQty} units/kg (need +${diff} more)`;
      }
      break;
    }

    case 'CART_SUBTOTAL_THRESHOLD': {
      if (cartSubtotal >= rule.threshold_value) {
        isQualified = true;
        qualifyingDetails = `Subtotal ₦${cartSubtotal.toLocaleString()} reaches ₦${rule.threshold_value.toLocaleString()}`;
      } else {
        const diff = rule.threshold_value - cartSubtotal;
        qualifyingDetails = `Subtotal is ₦${cartSubtotal.toLocaleString()} (need +₦${diff.toLocaleString()})`;
      }
      break;
    }

    case 'CUSTOMER_LOYALTY': {
      if (customer && (customer.purchase_count || 0) >= rule.threshold_value) {
        isQualified = true;
        qualifyingDetails = `${customer.full_name} has ${customer.purchase_count} prior purchases (≥ ${rule.threshold_value})`;
      } else if (customer) {
        qualifyingDetails = `Customer has ${customer.purchase_count || 0} purchases (need ${rule.threshold_value})`;
      } else {
        qualifyingDetails = `Requires selected customer with ${rule.threshold_value}+ visits`;
      }
      break;
    }

    case 'GENERAL_OVERRIDE':
    default: {
      isQualified = true;
      qualifyingDetails = 'Management promotional clearance rule';
      break;
    }
  }

  // Calculate discount amount in Naira based on scope
  let calculatedDiscount = 0;
  const basisAmount = scope === 'QUALIFYING_ITEM' ? qualifyingSubtotal : cartSubtotal;

  if (isQualified) {
    if (rule.discount_type === 'PERCENT') {
      calculatedDiscount = Math.round((basisAmount * rule.discount_value) / 100);
    } else {
      calculatedDiscount = Math.min(basisAmount, Math.round(rule.discount_value));
    }

    // Apply rule maximum cap if configured
    if (rule.max_discount_cap && rule.max_discount_cap > 0) {
      calculatedDiscount = Math.min(calculatedDiscount, rule.max_discount_cap);
    }
  }

  return {
    isQualified,
    qualifyingDetails,
    calculatedDiscount,
    qualifyingSubtotal: scope === 'QUALIFYING_ITEM' ? qualifyingSubtotal : undefined,
    scope,
  };
}

/**
 * Validates cart acquisition cost against proposed discount to prevent selling below cost
 */
export interface ProfitMarginValidationResult {
  isSafe: boolean;
  totalCost: number;
  subtotal: number;
  finalTotal: number;
  projectedGrossProfit: number;
  projectedMarginPercent: number;
  maxSafeDiscount: number;
  warningMessage?: string;
}

export function validateProfitMargin(
  cart: CartItem[],
  proposedDiscount: number,
  products: Product[]
): ProfitMarginValidationResult {
  let totalCost = 0;
  let subtotal = 0;

  cart.forEach(item => {
    const lineTotal = item.total_amount || (item.quantity_sold * item.unit_price);
    subtotal += lineTotal;
    const prod = products.find(p => p.item_sn === item.item_sn);
    const unitCost = prod && typeof prod.item_cost === 'number' && prod.item_cost > 0 
      ? prod.item_cost 
      : (item.unit_price * 0.65);
    totalCost += unitCost * (item.quantity_sold || 0);
  });

  totalCost = Math.round(totalCost);
  const finalTotal = Math.max(0, subtotal - proposedDiscount);
  const projectedGrossProfit = finalTotal - totalCost;
  const projectedMarginPercent = finalTotal > 0 ? Math.round((projectedGrossProfit / finalTotal) * 1000) / 10 : 0;
  const maxSafeDiscount = Math.max(0, subtotal - totalCost);
  const isSafe = projectedGrossProfit >= 0;

  let warningMessage: string | undefined = undefined;
  if (!isSafe) {
    const lossAmount = Math.abs(projectedGrossProfit);
    warningMessage = `Negative Margin Warning: Selling at a loss of ₦${lossAmount.toLocaleString()} below wholesale acquisition cost (₦${totalCost.toLocaleString()}). Requires Manager/Super Admin PIN.`;
  }

  return {
    isSafe,
    totalCost,
    subtotal,
    finalTotal,
    projectedGrossProfit,
    projectedMarginPercent,
    maxSafeDiscount,
    warningMessage,
  };
}

/**
 * Resolves total discount based on store policy (Best Single Discount vs Controlled Stacking)
 */
export function calculateEffectiveDiscount(params: {
  customerDiscount: number;
  wholesaleDiscount: number;
  customDiscount: number;
  cartSubtotal: number;
  config?: DiscountSecurityConfig;
}): { totalDiscount: number; policyApplied: 'BEST_DISCOUNT' | 'CONTROLLED_STACKING'; capped: boolean } {
  const { customerDiscount, wholesaleDiscount, customDiscount, cartSubtotal, config } = params;
  const policy = config?.stacking_policy || 'BEST_DISCOUNT';
  const percentCap = config?.max_discount_percent_cap ?? 25;
  const maxNairaCap = Math.round((cartSubtotal * percentCap) / 100);

  let rawDiscount = 0;
  if (policy === 'BEST_DISCOUNT') {
    rawDiscount = Math.max(customerDiscount, wholesaleDiscount, customDiscount);
  } else {
    rawDiscount = customerDiscount + wholesaleDiscount + customDiscount;
  }

  // Bound by percent cap and cart subtotal
  const boundedDiscount = Math.min(rawDiscount, maxNairaCap, cartSubtotal);
  const capped = rawDiscount > boundedDiscount;

  return {
    totalDiscount: Math.max(0, boundedDiscount),
    policyApplied: policy,
    capped,
  };
}

/**
 * Validates entered discount PIN against the salted hash
 */
export function verifyDiscountAuthorizationPin(enteredPin: string, hashedPin: string): boolean {
  if (!enteredPin || !hashedPin) return false;
  return verifyPin(enteredPin.trim(), hashedPin);
}
