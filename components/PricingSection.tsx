import React from 'react';
import { Check, X, Unlock } from 'lucide-react';

interface PricingSectionProps {
  onStartFree?: () => void;
  onStandard?: () => void;
  onPro?: () => void;
}

const PricingSection: React.FC<PricingSectionProps> = ({ onStartFree, onStandard, onPro }) => {
  return (
    <section className="relative mt-10 md:mt-14">
      <div className="text-center max-w-2xl mx-auto">
        <h2 className="text-2xl md:text-3xl font-semibold tracking-tight">Elige tu ritmo</h2>
        <p className="mt-2 text-neutral-300 text-sm">Empieza gratis. Mejora cuando quieras.</p>
      </div>
      <div className="mt-6 grid md:grid-cols-3 gap-5">
        {/* FREE */}
        <div className="rounded-2xl p-5 bg-neutral-900/60 ring-1 ring-white/10 hover:ring-white/20 transition flex flex-col relative">
          <h3 className="mt-6 text-base md:text-lg font-semibold tracking-tight">FREE</h3>
          <div className="mt-1 text-3xl md:text-4xl font-semibold tracking-tight">$0 <span className="text-sm text-neutral-400">/ month</span></div>
          <p className="mt-3 text-sm text-neutral-300">Mantené acceso a tus viajes guardados.</p>
          <ul className="mt-3 space-y-1.5 text-[13px] text-neutral-300">
            <li className="flex items-center gap-2"><Check className="text-emerald-400" size={14} />Seguí explorando tus viajes guardados</li>
            <li className="flex items-center gap-2"><X className="text-neutral-500" size={14} />No podés generar nuevos itinerarios</li>
          </ul>
          <button onClick={onStartFree} className="mt-auto inline-flex items-center justify-center gap-2 rounded-md px-4 py-2 text-xs text-neutral-200 ring-1 ring-white/10 hover:ring-white/20 hover:bg-white/5 transition">GET STARTED</button>
        </div>

        {/* STANDARD */}
        <div className="relative rounded-2xl p-5 bg-neutral-900/70 ring-2 ring-emerald-500/30 hover:ring-emerald-400/60 transition flex flex-col">
          <div className="absolute top-3 left-4 inline-flex items-center gap-1 rounded-md bg-neutral-800 text-neutral-300 px-2 py-0.5 text-[10px] font-mono uppercase"><Unlock size={12} /> DESBLOQUEAR 1 VIAJE</div>
          <div className="absolute top-3 right-4 inline-flex items-center gap-1 rounded-md bg-cyan-500/20 text-cyan-300 px-2 py-0.5 text-[10px] font-mono uppercase">Popular</div>
          <h3 className="mt-6 text-base md:text-lg font-semibold tracking-tight">STANDARD</h3>
          <div className="mt-1 text-3xl md:text-4xl font-semibold tracking-tight">$2.99 <span className="text-sm text-neutral-300">/ viaje</span></div>
          <p className="mt-3 text-sm text-neutral-300">Ideal si solo necesitás un viaje puntual.</p>
          <ul className="mt-3 space-y-1.5 text-[13px] text-neutral-200">
            <li className="flex items-center gap-2"><Check className="text-emerald-400" size={14} />Generás un viaje extra</li>
            <li className="flex items-center gap-2"><Check className="text-emerald-400" size={14} />Guardado en tu cuenta</li>
            <li className="flex items-center gap-2"><Check className="text-emerald-400" size={14} />Acceso completo al itinerario</li>
          </ul>
          <button onClick={onStandard} className="mt-auto inline-flex items-center justify-center gap-2 rounded-md px-4 py-2 text-xs font-medium bg-emerald-500 text-neutral-950 hover:bg-emerald-400 transition">GET TRAVEL</button>
        </div>

        {/* PRO */}
        <div className="rounded-2xl p-5 bg-neutral-900/60 ring-1 ring-white/10 hover:ring-white/20 transition flex flex-col relative">
          <h3 className="mt-6 text-base md:text-lg font-semibold tracking-tight">PRO</h3>
          <div className="mt-1 text-3xl md:text-4xl font-semibold tracking-tight">$4.99 <span className="text-sm text-neutral-400">/ month</span></div>
          <p className="mt-3 text-sm text-neutral-300">La mejor opción si viajás seguido o querés planificar sin límites.</p>
          <ul className="mt-3 space-y-1.5 text-[13px] text-neutral-300">
            <li className="flex items-center gap-2"><Check className="text-emerald-400" size={14} />Viajes ilimitados</li>
            <li className="flex items-center gap-2"><Check className="text-emerald-400" size={14} />Itinerarios premium</li>
            <li className="flex items-center gap-2"><Check className="text-emerald-400" size={14} />Descarga en PDF</li>
            <li className="flex items-center gap-2"><Check className="text-emerald-400" size={14} />Recomendaciones avanzadas</li>
            <li className="flex items-center gap-2"><Check className="text-emerald-400" size={14} />Prioridad en generación</li>
          </ul>
          <button onClick={onPro} className="mt-auto inline-flex items-center justify-center gap-2 rounded-md px-4 py-2 text-xs font-medium bg-white text-neutral-950 hover:bg-acid hover:text-black transition">UPGRADE NOW</button>
        </div>
      </div>
      <div className="mx-auto max-w-7xl px-0 mt-6">
        <div className="h-px bg-gradient-to-r from-transparent via-white/10 to-transparent"></div>
      </div>
    </section>
  );
};

export default PricingSection;
