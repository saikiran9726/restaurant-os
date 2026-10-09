import React from 'react';
import { Button } from './ui/Button.js';
import { Minus, Plus, Sparkles, AlertCircle } from 'lucide-react';
import { formatPaiseToRupeeString } from '@restaurant-os/shared';

interface RedeemStepperProps {
  pointsBalance: number;
  redeemPointsBlock?: number;
  redeemValuePaise?: number;
  maxRedeemablePoints: number;
  selectedPoints: number;
  onChange: (points: number) => void;
  billTotalPaise: number;
  unverifiedBalance?: boolean;
  className?: string;
}

export const RedeemStepper: React.FC<RedeemStepperProps> = ({
  pointsBalance,
  redeemPointsBlock = 500,
  redeemValuePaise = 5000,
  maxRedeemablePoints,
  selectedPoints,
  onChange,
  billTotalPaise,
  unverifiedBalance = false,
  className = '',
}) => {
  const currentDiscountPaise = (selectedPoints / redeemPointsBlock) * redeemValuePaise;
  const newBillTotalPaise = Math.max(0, billTotalPaise - currentDiscountPaise);

  const canIncrement = selectedPoints + redeemPointsBlock <= maxRedeemablePoints;
  const canDecrement = selectedPoints - redeemPointsBlock >= 0;

  const handleIncrement = () => {
    if (canIncrement) {
      onChange(selectedPoints + redeemPointsBlock);
    }
  };

  const handleDecrement = () => {
    if (canDecrement) {
      onChange(selectedPoints - redeemPointsBlock);
    }
  };

  const handleRedeemMax = () => {
    onChange(maxRedeemablePoints);
  };

  return (
    <div
      className={`p-4 rounded-2xl bg-surface-card border border-surface-border space-y-4 ${className}`}
    >
      <div className="flex items-center justify-between">
        <div>
          <span className="text-xs font-bold text-content-secondary uppercase tracking-wider flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            <span>Redeem Loyalty Points</span>
          </span>
          <p className="text-xs text-content-muted mt-0.5">
            {redeemPointsBlock} points = {formatPaiseToRupeeString(redeemValuePaise)} off
          </p>
        </div>

        {unverifiedBalance && (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40">
            <AlertCircle className="w-3 h-3" /> Unverified offline balance
          </span>
        )}
      </div>

      {maxRedeemablePoints <= 0 ? (
        <div className="p-3 rounded-xl bg-surface-subtle text-xs text-content-muted border border-surface-border">
          Customer balance or bill amount does not meet minimum redemption threshold (
          {redeemPointsBlock} pts).
        </div>
      ) : (
        <>
          {/* Controls */}
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleDecrement}
                disabled={!canDecrement}
                aria-label="Decrease points to redeem"
              >
                <Minus className="w-4 h-4" />
              </Button>

              <div className="text-center min-w-[100px]">
                <span className="text-base font-extrabold font-mono text-content-primary block">
                  {selectedPoints.toLocaleString('en-IN')}
                </span>
                <span className="text-[10px] text-content-muted block">points selected</span>
              </div>

              <Button
                variant="outline"
                size="sm"
                onClick={handleIncrement}
                disabled={!canIncrement}
                aria-label="Increase points to redeem"
              >
                <Plus className="w-4 h-4" />
              </Button>
            </div>

            <Button
              variant="ghost"
              size="sm"
              onClick={handleRedeemMax}
              disabled={selectedPoints === maxRedeemablePoints}
              className="text-xs text-primary font-bold hover:bg-primary/10"
            >
              Max ({maxRedeemablePoints})
            </Button>
          </div>

          {/* Instant Before / After Preview */}
          <div className="p-3 rounded-xl bg-surface-subtle border border-surface-border grid grid-cols-2 gap-2 text-xs">
            <div>
              <span className="text-content-muted block text-[10px] uppercase font-bold">
                Discount Applied
              </span>
              <span className="font-mono font-bold text-emerald-400 text-sm">
                -{formatPaiseToRupeeString(currentDiscountPaise)}
              </span>
            </div>

            <div className="text-right">
              <span className="text-content-muted block text-[10px] uppercase font-bold">
                New Total Due
              </span>
              <span className="font-mono font-bold text-content-primary text-sm">
                {formatPaiseToRupeeString(newBillTotalPaise)}
              </span>
            </div>
          </div>
        </>
      )}
    </div>
  );
};
