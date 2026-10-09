import React, { useState } from 'react';
import {
  type LoyaltySettings,
  calculateLoyaltyEarn,
  validateAndConvertRedemption,
  formatPaiseToRupeeString,
} from '@restaurant-os/shared';
import { Calculator, ArrowRight, Sparkles, CheckCircle2 } from 'lucide-react';

interface SettingsExampleCalculatorProps {
  settings: LoyaltySettings;
  className?: string;
}

export const SettingsExampleCalculator: React.FC<SettingsExampleCalculatorProps> = ({
  settings,
  className = '',
}) => {
  const [billAmountRupees, setBillAmountRupees] = useState<number>(1000);
  const [pointsToRedeem, setPointsToRedeem] = useState<number>(500);

  const billPaise = Math.round(billAmountRupees * 100);

  // Calculation for earn
  const earnResult = calculateLoyaltyEarn({
    billSubtotalPaise: billPaise,
    netPaidPaise: billPaise,
    loyaltyDiscountPaise: 0,
    otherDiscountPaise: 0,
    customerLifetimeSpendPaise: 0, // Silver
    settings,
  });

  // Calculation for redeem
  const redeemResult = validateAndConvertRedemption({
    pointsToRedeem,
    billTotalPaise: billPaise,
    pointsBalance: 5000,
    accountAgeHours: 100,
    settings,
  });

  return (
    <div
      className={`p-5 rounded-2xl bg-surface-card border border-surface-border shadow-sm space-y-4 ${className}`}
    >
      <div className="flex items-center gap-2 border-b border-surface-border pb-3">
        <Calculator className="w-4 h-4 text-primary" />
        <h4 className="text-sm font-bold text-content-primary">
          Live Interactive Example Calculator
        </h4>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Earn Simulator */}
        <div className="p-3.5 rounded-xl bg-surface-subtle border border-surface-border space-y-2.5">
          <span className="text-[10px] font-bold uppercase tracking-wider text-content-muted block">
            1. Earn Calculation Simulator
          </span>

          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-content-secondary">Bill Total: ₹</span>
            <input
              type="number"
              min={100}
              step={100}
              value={billAmountRupees}
              onChange={(e) => setBillAmountRupees(Math.max(0, Number(e.target.value)))}
              className="w-24 px-2 py-1 text-xs rounded-lg bg-surface-card border border-surface-border text-content-primary font-mono focus:outline-none focus:border-primary"
            />
          </div>

          <div className="p-2.5 rounded-lg bg-surface-card border border-surface-border flex items-center justify-between text-xs">
            <span className="text-content-secondary">Points Earned:</span>
            <span className="font-mono font-extrabold text-amber-400 text-sm">
              +{earnResult.earnedPoints} pts
            </span>
          </div>

          <p className="text-[11px] text-content-muted leading-relaxed">
            Bill of ₹{billAmountRupees.toLocaleString('en-IN')} gives{' '}
            <strong className="text-content-primary">{earnResult.earnedPoints} points</strong>{' '}
            (Rate: ₹{(settings.spendPaisePerBlock / 100).toFixed(0)} → {settings.pointsPerBlock}{' '}
            pts).
          </p>
        </div>

        {/* Redeem Simulator */}
        <div className="p-3.5 rounded-xl bg-surface-subtle border border-surface-border space-y-2.5">
          <span className="text-[10px] font-bold uppercase tracking-wider text-content-muted block">
            2. Redeem Calculation Simulator
          </span>

          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-content-secondary">Points:</span>
            <input
              type="number"
              min={settings.redeemPointsBlock}
              step={settings.redeemPointsBlock}
              value={pointsToRedeem}
              onChange={(e) => setPointsToRedeem(Math.max(0, Number(e.target.value)))}
              className="w-24 px-2 py-1 text-xs rounded-lg bg-surface-card border border-surface-border text-content-primary font-mono focus:outline-none focus:border-primary"
            />
          </div>

          <div className="p-2.5 rounded-lg bg-surface-card border border-surface-border flex items-center justify-between text-xs">
            <span className="text-content-secondary">Rupee Discount:</span>
            <span className="font-mono font-extrabold text-emerald-400 text-sm">
              {redeemResult.isValid
                ? formatPaiseToRupeeString(redeemResult.discountPaise)
                : 'Ineligible'}
            </span>
          </div>

          <p className="text-[11px] text-content-muted leading-relaxed">
            {pointsToRedeem} points ={' '}
            <strong className="text-content-primary">
              {formatPaiseToRupeeString(
                (pointsToRedeem / settings.redeemPointsBlock) * settings.redeemValuePaise,
              )}
            </strong>{' '}
            off bill total (Max {settings.maxRedeemPercentOfBill}% bill cap).
          </p>
        </div>
      </div>
    </div>
  );
};
