import React from 'react';
import {
  type ReceiptData,
  type ReceiptTemplateConfig,
  formatReceiptPlainText,
} from '@restaurant-os/shared';

interface ReceiptPreviewProps {
  receiptData?: ReceiptData;
  templateConfig?: ReceiptTemplateConfig;
  plainText?: string;
  widthMm?: 58 | 80;
  className?: string;
}

export const ReceiptPreview: React.FC<ReceiptPreviewProps> = ({
  receiptData,
  templateConfig,
  plainText,
  widthMm = 80,
  className = '',
}) => {
  const effectiveWidth = templateConfig?.widthMm ?? widthMm;
  const charsPerLine = templateConfig?.charsPerLine ?? (effectiveWidth === 58 ? 32 : 48);

  const renderedText = React.useMemo(() => {
    if (plainText) return plainText;
    if (receiptData) {
      return formatReceiptPlainText(receiptData, {
        ...templateConfig,
        widthMm: effectiveWidth,
        charsPerLine,
      });
    }
    return '';
  }, [plainText, receiptData, templateConfig, effectiveWidth, charsPerLine]);

  return (
    <div className={`flex flex-col items-center ${className}`}>
      {/* Paper Roll Top Edge */}
      <div
        className="w-full max-w-[340px] h-3 bg-surface-subtle border-t border-l border-r border-surface-border rounded-t-sm"
        style={{
          backgroundImage: 'radial-gradient(circle, transparent 2px, #18181b 2px)',
          backgroundSize: '8px 8px',
        }}
      />

      {/* Thermal Receipt Paper Canvas */}
      <div
        className="w-full max-w-[340px] bg-white text-zinc-900 border-l border-r border-surface-border p-4 shadow-xl font-mono text-[11px] leading-[1.3] select-text"
        style={{
          fontFamily: "'Courier New', Courier, monospace",
          width: effectiveWidth === 58 ? '260px' : '320px',
        }}
      >
        <div className="text-[10px] text-zinc-400 text-center mb-2 pb-1 border-b border-zinc-200">
          [{effectiveWidth}mm Format &bull; {charsPerLine} Chars/Line]
        </div>

        <pre className="whitespace-pre-wrap break-all font-mono m-0 text-zinc-950 font-normal">
          {renderedText}
        </pre>
      </div>

      {/* Paper Roll Jagged Tear Bottom Edge */}
      <div
        className="w-full max-w-[340px] h-3 bg-white border-b border-l border-r border-surface-border"
        style={{
          clipPath:
            'polygon(0% 0%, 5% 100%, 10% 0%, 15% 100%, 20% 0%, 25% 100%, 30% 0%, 35% 100%, 40% 0%, 45% 100%, 50% 0%, 55% 100%, 60% 0%, 65% 100%, 70% 0%, 75% 100%, 80% 0%, 85% 100%, 90% 0%, 95% 100%, 100% 0%)',
          width: effectiveWidth === 58 ? '260px' : '320px',
        }}
      />
    </div>
  );
};
