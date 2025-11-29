
import React, { useRef, useState } from 'react';
import { X, Check } from 'lucide-react';
import { useLanguage } from '../hooks/useLanguage';

interface Props {
  onClose: () => void;
}

const PricingModal: React.FC<Props> = ({ onClose }) => {
  const { t } = useLanguage();
  
  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const card = e.currentTarget;
    const rect = card.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    card.style.setProperty('--mouse-x', `${x}px`);
    card.style.setProperty('--mouse-y', `${y}px`);
  };

  return (
    <div className="fixed inset-0 z-[200] bg-obsidian/95 backdrop-blur-md overflow-y-auto animate-fade-in custom-scrollbar font-sans">
      <div className="relative min-h-screen flex items-center justify-center p-4">
        
        {/* Close Button */}
        <button 
          onClick={onClose} 
          className="absolute top-6 right-6 p-2 bg-white/10 hover:bg-white/20 rounded-full text-white transition-colors z-50"
        >
          <X size={24} />
        </button>

        <div className="py-16 relative w-full max-w-7xl mx-auto px-4 md:px-8">
            <div className="text-center mb-16">
                <h2 className="text-4xl md:text-5xl text-white mb-4 tracking-tight font-display font-bold uppercase">{t.pricingTitle}</h2>
                <p className="text-dim text-sm font-light leading-relaxed max-w-2xl mx-auto mb-8">{t.pricingSubtitle}</p>
                <div className="flex items-center justify-center gap-2">
                    <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-acid/20 bg-acid/5 text-acid text-[10px] font-mono uppercase tracking-widest">
                        ⭐ {t.selectCountry ? 'Available Plans' : 'Planes Disponibles'}
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-start w-full max-w-7xl mx-auto">
            
            {/* LIGHT PLAN */}
            <div 
                className="group relative p-8 bg-surface border border-border rounded-3xl flex flex-col shadow-lg hover:shadow-xl transition-all"
                onMouseMove={handleMouseMove}
            >
                <div className="flex justify-between items-start mb-6">
                    <span className="px-3 py-1 border border-acid/30 text-[10px] font-mono font-bold uppercase tracking-widest bg-acid/10 text-acid rounded-lg">{t.freePlanBadge}</span>
                </div>
                
                <h3 className="text-2xl font-display font-bold text-white mb-2 uppercase">Free</h3>
                <div className="mb-6">
                    <span className="text-4xl font-display font-bold text-white">{t.freePlanPrice}</span>
                    <span className="text-lg text-dim ml-2">/ {t.month || 'month'}</span>
                </div>
                
                <p className="text-sm text-dim mb-8 leading-relaxed font-mono">{t.freePlanDesc}</p>
                
                <div className="space-y-3 mb-8 flex-grow">
                    {t.freePlanDescHover.map((item, i) => (
                        <div key={i} className="flex items-start gap-3">
                            <Check className="w-4 h-4 text-acid shrink-0 mt-0.5" />
                            <span className="text-xs text-text leading-relaxed">{item}</span>
                        </div>
                    ))}
                </div>
                
                <button className="w-full px-4 py-3 border border-acid text-acid hover:bg-acid hover:text-black font-mono text-xs uppercase font-bold rounded-lg transition-all">
                    Get Started
                </button>
            </div>

            {/* MOST POPULAR PLAN */}
            <div 
                className="group relative p-8 bg-surface border border-cyan-500/30 rounded-3xl flex flex-col shadow-lg hover:shadow-xl hover:shadow-cyan-500/20 transition-all md:scale-105 md:z-10"
                onMouseMove={handleMouseMove}
            >
                <div className="flex justify-between items-start mb-6">
                    <span className="px-3 py-1 border border-cyan-500/40 text-[10px] font-mono font-bold uppercase tracking-widest bg-cyan-500/10 text-cyan-400 rounded-lg">{t.standardPlanBadge}</span>
                    <span className="px-2 py-1 bg-cyan-500/20 text-cyan-400 text-[10px] font-mono font-bold rounded-lg">POPULAR</span>
                </div>
                
                <h3 className="text-2xl font-display font-bold text-white mb-2 uppercase">Standard</h3>
                <div className="mb-6">
                    <span className="text-4xl font-display font-bold text-white">${t.standardPlanPrice || '2.99'}</span>
                    <span className="text-lg text-dim ml-2">/ {t.month || 'month'}</span>
                </div>
                
                <p className="text-sm text-dim mb-8 leading-relaxed font-mono">{t.standardPlanDesc}</p>
                
                <div className="space-y-3 mb-8 flex-grow">
                    {t.standardPlanDescHover.map((item, i) => (
                        <div key={i} className="flex items-start gap-3">
                            <Check className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
                            <span className="text-xs text-text leading-relaxed">{item}</span>
                        </div>
                    ))}
                </div>
                
                <button className="w-full px-4 py-3 bg-cyan-500 text-black hover:bg-cyan-400 font-mono text-xs uppercase font-bold rounded-lg transition-all shadow-lg">
                    Get Travel
                </button>
            </div>

            {/* PRO PLAN */}
            <div 
                className="group relative p-8 bg-surface border border-border rounded-3xl flex flex-col shadow-lg hover:shadow-xl transition-all"
                onMouseMove={handleMouseMove}
            >
                <div className="flex justify-between items-start mb-6">
                    <span className="px-3 py-1 border border-white/30 text-[10px] font-mono font-bold uppercase tracking-widest bg-white/10 text-white/80 rounded-lg">{t.proPlanBadge}</span>
                </div>
                
                <h3 className="text-2xl font-display font-bold text-white mb-2 uppercase">Pro</h3>
                <div className="mb-6">
                    <span className="text-4xl font-display font-bold text-white">${t.proPlanPrice || '4.99'}</span>
                    <span className="text-lg text-dim ml-2">/ {t.month || 'month'}</span>
                </div>
                
                <p className="text-sm text-dim mb-8 leading-relaxed font-mono">{t.proPlanDesc}</p>
                
                <div className="space-y-3 mb-8 flex-grow">
                    {t.proPlanDescHover.map((item, i) => (
                        <div key={i} className="flex items-start gap-3">
                            <Check className="w-4 h-4 text-white shrink-0 mt-0.5" />
                            <span className="text-xs text-text leading-relaxed">{item}</span>
                        </div>
                    ))}
                </div>
                
                <button className="w-full px-4 py-3 bg-white text-black hover:bg-gray-200 font-mono text-xs uppercase font-bold rounded-lg transition-all">
                    Upgrade Now
                </button>
            </div>

            </div>
        </div>
      </div>
    </div>
  );
};

export default PricingModal;
