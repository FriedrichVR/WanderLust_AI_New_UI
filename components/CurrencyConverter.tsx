
import React, { useState, useMemo } from 'react';
import { Coins, ArrowRightLeft, TrendingUp } from 'lucide-react';
import { Currency } from '../types';
import { translations, Language } from '../utils/translations';

interface Props { lang: Language; }

const EXCHANGE_RATES: Record<string, number> = { 
    [Currency.USD]: 1, 
    [Currency.EUR]: 0.92, 
    [Currency.GBP]: 0.79, 
    [Currency.JPY]: 150.0, 
    [Currency.AUD]: 1.52, 
    [Currency.MXN]: 17.1, 
    [Currency.CLP]: 970, 
    [Currency.BRL]: 5.05,
    [Currency.ARS]: 1200 
};

const TARGET_CURRENCIES = [Currency.USD, Currency.EUR, Currency.BRL, Currency.MXN, Currency.CLP, Currency.ARS];

const CurrencyConverter: React.FC<Props> = ({ lang }) => {
  const [amount, setAmount] = useState<string>('100');
  const [baseCurrency, setBaseCurrency] = useState<Currency>(Currency.USD);
  const t = translations[lang];

  const calculate = (target: Currency) => {
    const val = parseFloat(amount);
    if (isNaN(val) || !val) return '0.00';
    // Convert Base -> USD -> Target
    const inUSD = val / EXCHANGE_RATES[baseCurrency];
    const result = inUSD * EXCHANGE_RATES[target];
    
    return result.toLocaleString(undefined, { 
        minimumFractionDigits: 2, 
        maximumFractionDigits: 2 
    });
  };

  const displayTargets = useMemo(() => {
      return TARGET_CURRENCIES.filter(c => c !== baseCurrency);
  }, [baseCurrency]);

  return (
    <div className="bg-surface border border-border p-4 relative overflow-hidden group flex flex-col shadow-lg">
      {/* Header */}
      <div className="flex items-center justify-between mb-4 border-b border-border pb-2">
        <div className="font-mono text-[10px] text-acid flex items-center gap-2 uppercase tracking-widest">
            <Coins size={12} /> {t.globalFx}
        </div>
      </div>

      {/* Main Input Area - Compact */}
      <div className="mb-4 bg-panel border border-border p-3 relative group-focus-within:border-acid transition-colors">
          <label className="font-mono text-[8px] text-dim uppercase tracking-widest block mb-1">{t.baseValue}</label>
          <div className="flex items-center gap-2">
              <div className="flex-1">
                  <input 
                    type="number" 
                    value={amount} 
                    onChange={(e) => setAmount(e.target.value)} 
                    className="w-full bg-transparent text-xl font-display font-bold text-text outline-none placeholder-dim"
                    placeholder="0.00"
                  />
              </div>
              <div className="relative">
                  <select 
                    value={baseCurrency} 
                    onChange={(e) => setBaseCurrency(e.target.value as Currency)} 
                    className="appearance-none bg-surface border border-border py-1 pl-2 pr-6 text-xs font-mono text-acid uppercase font-bold outline-none focus:border-acid cursor-pointer"
                  >
                      {Object.values(Currency).map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                  <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-1 text-dim">
                    <ArrowRightLeft size={10} />
                  </div>
              </div>
          </div>
      </div>

      {/* Results Grid - Tighter */}
      <div className="grid grid-cols-1 gap-2 overflow-y-auto custom-scrollbar max-h-[200px]">
          {displayTargets.map((target) => (
              <div key={target} className="flex items-center justify-between p-2 border border-border/50 hover:border-dim bg-panel/50 transition-all">
                  <div className="flex items-center gap-2">
                      <div className="w-6 h-6 bg-surface border border-border flex items-center justify-center font-mono text-[9px] text-dim font-bold">
                          {target}
                      </div>
                  </div>
                  <div className="font-mono text-xs text-text">
                      {calculate(target)}
                  </div>
              </div>
          ))}
      </div>
    </div>
  );
};

export default CurrencyConverter;
