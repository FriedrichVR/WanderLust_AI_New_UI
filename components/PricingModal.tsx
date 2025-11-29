
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
    <div className="fixed inset-0 z-[200] bg-zinc-950/95 backdrop-blur-md overflow-y-auto animate-fade-in custom-scrollbar font-['Inter',sans-serif]">
      <div className="relative min-h-screen flex items-center justify-center p-4">
        
        {/* Close Button */}
        <button 
          onClick={onClose} 
          className="absolute top-6 right-6 p-2 bg-white/10 hover:bg-white/20 rounded-full text-white transition-colors z-50"
        >
          <X size={24} />
        </button>

        <div className="py-20 relative w-full max-w-7xl mx-auto pr-6 pl-6">
            <div className="text-center mb-16">
            <h2 className="text-3xl md:text-5xl text-white mb-4 tracking-tight font-medium font-display">{t.pricingTitle}</h2>
            <p className="text-lg text-zinc-400 font-medium">{t.pricingSubtitle}</p>
            <div className="flex items-center justify-center mt-8">
                <div className="text-sm text-zinc-400">⭐ Opciones disponibles</div>
            </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-0 items-stretch w-full max-w-7xl mx-auto border-l border-white/10 shadow-2xl">
            
            {/* LIGHT PLAN */}
            <div 
                className="spotlight-card group relative p-10 bg-zinc-950 border-y border-r border-white/10 flex flex-col min-h-[420px] overflow-hidden transition-colors hover:border-white/20"
                onMouseMove={handleMouseMove}
            >
                <div className="pointer-events-none absolute -inset-px opacity-0 group-hover:opacity-100 transition-opacity duration-300 z-0"
                style={{ background: 'radial-gradient(600px circle at var(--mouse-x) var(--mouse-y),rgba(255,255,255,0.06),transparent 40%)' }}>
                </div>
                <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808008_1px,transparent_1px),linear-gradient(to_bottom,#80808008_1px,transparent_1px)] bg-[size:24px_24px] pointer-events-none opacity-50"></div>
                
                {/* Corners */}
                <div className="absolute top-0 left-0 w-3 h-3 border-t border-l border-transparent group-hover:border-white/40 transition-colors z-10"></div>
                <div className="absolute bottom-0 right-0 w-3 h-3 border-b border-r border-transparent group-hover:border-white/40 transition-colors z-10"></div>
                
                <div className="relative z-10 flex flex-col h-full pointer-events-none">
                <div className="flex justify-start mb-8">
                    <span className="px-4 py-1 border border-white/10 text-[10px] font-semibold text-zinc-400 uppercase tracking-widest bg-zinc-900/50 backdrop-blur-sm rounded-full">{t.freePlanBadge}</span>
                </div>
                <div className="relative flex-grow">
                    <div className="absolute inset-0 flex items-center justify-center transition-all duration-500 ease-[cubic-bezier(0.23,1,0.32,1)] group-hover:opacity-0 group-hover:-translate-y-4 group-hover:scale-95 origin-bottom">
                    <div className="text-7xl text-white font-display font-medium tracking-tighter flex items-start leading-none">
                        {t.freePlanPrice}<span className="text-2xl mt-2 ml-2 text-zinc-600 font-mono tracking-normal">$</span>
                    </div>
                    </div>
                    <div className="absolute inset-0 flex flex-col justify-center gap-5 transition-all duration-500 ease-[cubic-bezier(0.23,1,0.32,1)] opacity-0 translate-y-8 scale-95 group-hover:opacity-100 group-hover:translate-y-0 group-hover:scale-100 origin-center">
                    {t.freePlanDescHover.map((item, i) => (
                        <div key={i} className="flex items-start gap-3">
                            <Check className="w-4 h-4 text-zinc-600 shrink-0 mt-0.5" />
                            <span className="text-sm text-zinc-300 font-medium leading-snug">{item}</span>
                        </div>
                    ))}
                    </div>
                </div>
                <div className="mt-auto pt-10 flex items-end gap-6 justify-between pointer-events-auto">
                    <p className="text-sm text-zinc-500 font-medium leading-relaxed max-w-[70%] transition-colors group-hover:text-zinc-400">
                        {t.freePlanDesc}
                    </p>
                    <button className="flex-shrink-0 w-12 h-12 bg-zinc-900 border border-white/10 flex items-center justify-center text-zinc-400 hover:bg-white hover:text-black transition-all duration-300 rounded-full">
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24">
                        <path fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M6 18L18 6m0 0H9m9 0v9"></path>
                    </svg>
                    </button>
                </div>
                </div>
            </div>

            {/* MOST POPULAR PLAN */}
            <div 
                className="spotlight-card group relative p-10 bg-zinc-950 border-y border-r border-white/10 flex flex-col min-h-[420px] overflow-hidden"
                onMouseMove={handleMouseMove}
            >
                <div className="pointer-events-none absolute -inset-px opacity-0 group-hover:opacity-100 transition-opacity duration-300 z-0"
                style={{ background: 'radial-gradient(600px circle at var(--mouse-x) var(--mouse-y),rgba(6,182,212,0.08),transparent 40%)' }}>
                </div>
                <div className="absolute inset-0 border border-cyan-500/20 pointer-events-none opacity-60 group-hover:opacity-100 transition-opacity duration-500"></div>
                <div className="absolute top-0 right-0 w-40 h-40 bg-cyan-500/5 blur-[80px] pointer-events-none group-hover:bg-cyan-500/10 transition-colors"></div>
                
                {/* Cyan Corners */}
                <div className="absolute top-0 left-0 w-3 h-3 border-t border-l border-cyan-500/50 z-10 transition-all group-hover:border-cyan-400"></div>
                <div className="absolute top-0 right-0 w-3 h-3 border-t border-r border-cyan-500/50 z-10 transition-all group-hover:border-cyan-400"></div>
                <div className="absolute bottom-0 left-0 w-3 h-3 border-b border-l border-cyan-500/50 z-10 transition-all group-hover:border-cyan-400"></div>
                <div className="absolute bottom-0 right-0 w-3 h-3 border-b border-r border-cyan-500/50 z-10 transition-all group-hover:border-cyan-400"></div>
                
                <div className="relative z-10 flex flex-col h-full pointer-events-none">
                <div className="flex justify-start mb-10">
                    <span className="px-4 py-1 border border-cyan-500/30 text-[10px] font-semibold text-cyan-400 uppercase tracking-widest bg-cyan-950/20 shadow-[0_0_15px_-5px_rgba(34,211,238,0.3)] backdrop-blur-sm rounded-full">{t.standardPlanBadge}</span>
                </div>
                <div className="relative flex-grow">
                    <div className="absolute inset-0 flex items-center justify-center transition-all duration-500 ease-[cubic-bezier(0.23,1,0.32,1)] group-hover:opacity-0 group-hover:-translate-y-4 group-hover:scale-95 origin-bottom">
                    <div className="text-7xl text-white font-display font-medium tracking-tighter flex items-start leading-none drop-shadow-[0_0_15px_rgba(34,211,238,0.2)]">
                        {t.standardPlanPrice}<span className="text-3xl mt-2 ml-1 text-zinc-400 font-mono tracking-normal" style={{visibility: t.standardPlanPrice === "2.99" ? "visible" : "hidden"}}>.</span><span className="text-3xl mt-2 ml-1 text-zinc-400 font-mono tracking-normal" style={{marginLeft: t.standardPlanPrice === "2.99" ? "-0.25rem" : "0.25rem"}}>99</span><span className="text-2xl mt-2 ml-1 text-cyan-500/70 font-mono tracking-normal">$</span>
                    </div>
                    </div>
                    <div className="absolute inset-0 flex flex-col justify-center gap-5 transition-all duration-500 ease-[cubic-bezier(0.23,1,0.32,1)] opacity-0 translate-y-8 scale-95 group-hover:opacity-100 group-hover:translate-y-0 group-hover:scale-100 origin-center">
                    {t.standardPlanDescHover.map((item, i) => (
                        <div key={i} className="flex items-start gap-4">
                            <Check className="w-4 h-4 text-cyan-500 shrink-0 mt-0.5" />
                            <span className="text-sm text-zinc-300 group-hover:text-white transition-colors font-medium leading-snug">{item}</span>
                        </div>
                    ))}
                    </div>
                </div>
                <div className="mt-auto pt-10 flex items-end gap-6 justify-between pointer-events-auto">
                    <p className="text-sm text-zinc-400 font-medium leading-relaxed max-w-[70%] transition-colors group-hover:text-zinc-300">
                        {t.standardPlanDesc}
                    </p>
                    <button className="flex-shrink-0 w-12 h-12 bg-cyan-500 border border-cyan-400 flex items-center justify-center text-black hover:bg-cyan-400 transition-all duration-300 shadow-[0_0_20px_-5px_rgba(34,211,238,0.5)] rounded-full">
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24">
                        <path fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M6 18L18 6m0 0H9m9 0v9"></path>
                    </svg>
                    </button>
                </div>
                </div>
            </div>

            {/* PRO PLAN */}
            <div 
                className="spotlight-card group relative p-10 bg-zinc-950 border-y border-r border-white/10 flex flex-col min-h-[420px] overflow-hidden transition-colors hover:border-white/20"
                onMouseMove={handleMouseMove}
            >
                <div className="pointer-events-none absolute -inset-px opacity-0 group-hover:opacity-100 transition-opacity duration-300 z-0"
                style={{ background: 'radial-gradient(600px circle at var(--mouse-x) var(--mouse-y),rgba(255,255,255,0.06),transparent 40%)' }}>
                </div>
                <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808008_1px,transparent_1px),linear-gradient(to_bottom,#80808008_1px,transparent_1px)] bg-[size:24px_24px] pointer-events-none opacity-50"></div>
                
                {/* Corners */}
                <div className="absolute top-0 left-0 w-3 h-3 border-t border-l border-transparent group-hover:border-white/40 transition-colors z-10"></div>
                <div className="absolute bottom-0 right-0 w-3 h-3 border-b border-r border-transparent group-hover:border-white/40 transition-colors z-10"></div>
                
                <div className="relative z-10 flex flex-col h-full pointer-events-none">
                <div className="flex justify-start mb-10">
                    <span className="px-4 py-1 border border-white/20 text-[10px] font-semibold text-white/70 uppercase tracking-widest bg-white/5 shadow-[0_0_15px_-5px_rgba(255,255,255,0.1)] backdrop-blur-sm rounded-full">{t.proPlanBadge}</span>
                </div>
                <div className="relative flex-grow">
                    <div className="absolute inset-0 flex items-center justify-center transition-all duration-500 ease-[cubic-bezier(0.23,1,0.32,1)] group-hover:opacity-0 group-hover:-translate-y-4 group-hover:scale-95 origin-bottom">
                    <div className="text-7xl text-white font-display font-medium tracking-tighter flex items-start leading-none drop-shadow-[0_0_15px_rgba(255,255,255,0.1)]">
                        {t.proPlanPrice}<span className="text-3xl mt-2 ml-1 text-zinc-400 font-mono tracking-normal" style={{visibility: t.proPlanPrice === "4.99" ? "visible" : "hidden"}}>.</span><span className="text-3xl mt-2 ml-1 text-zinc-400 font-mono tracking-normal" style={{marginLeft: t.proPlanPrice === "4.99" ? "-0.25rem" : "0.25rem"}}>99</span><span className="text-2xl mt-2 ml-1 text-white/50 font-mono tracking-normal">$</span>
                    </div>
                    </div>
                    <div className="absolute inset-0 flex flex-col justify-center gap-5 transition-all duration-500 ease-[cubic-bezier(0.23,1,0.32,1)] opacity-0 translate-y-8 scale-95 group-hover:opacity-100 group-hover:translate-y-0 group-hover:scale-100 origin-center">
                    {t.proPlanDescHover.map((item, i) => (
                        <div key={i} className="flex items-start gap-4">
                            <Check className="w-4 h-4 text-white shrink-0 mt-0.5" />
                            <span className="text-sm text-zinc-300 group-hover:text-white transition-colors font-medium leading-snug">{item}</span>
                        </div>
                    ))}
                    </div>
                </div>
                <div className="mt-auto pt-10 flex items-end gap-6 justify-between pointer-events-auto">
                    <p className="text-sm text-zinc-400 font-medium leading-relaxed max-w-[70%] transition-colors group-hover:text-zinc-300">
                        {t.proPlanDesc}
                    </p>
                    <button className="flex-shrink-0 w-12 h-12 bg-white border border-white/40 flex items-center justify-center text-black hover:bg-white/90 transition-all duration-300 shadow-[0_0_20px_-5px_rgba(255,255,255,0.2)] rounded-full">
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24">
                        <path fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M6 18L18 6m0 0H9m9 0v9"></path>
                    </svg>
                    </button>
                </div>
                </div>
            </div>

            </div>
        </div>
      </div>
    </div>
  );
};

export default PricingModal;
