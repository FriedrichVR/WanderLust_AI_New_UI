import React from 'react';
import { X, Wand2, PenTool } from 'lucide-react';
import { useLanguage } from '../hooks/useLanguage';

interface Props {
  onManualMode: () => void;
  onAIMode: () => void;
  onClose: () => void;
}

const TripModeSelector: React.FC<Props> = ({ onManualMode, onAIMode, onClose }) => {
  const { t } = useLanguage();

  return (
    <div className="fixed inset-0 bg-black/90 backdrop-blur-md z-[100] flex flex-col items-center justify-center p-4 animate-fade-in">
      <button 
        onClick={onClose} 
        className="absolute top-6 right-6 p-2 bg-white/10 hover:bg-white/20 rounded-full text-white transition-colors z-50"
      >
        <X size={24} />
      </button>

      <div className="text-center mb-12 relative z-10 max-w-md">
        <h2 className="font-display font-bold text-3xl text-white uppercase tracking-tight mb-3">{t.selectOption}</h2>
        <p className="text-dim font-mono text-sm">{t.createTripMode}</p>
      </div>

      <div className="grid md:grid-cols-2 gap-6 max-w-2xl relative z-10">
        {/* Manual Mode */}
        <button
          onClick={onManualMode}
          className="group relative p-8 bg-neutral-900/50 border border-neutral-800 rounded-xl hover:border-acid/50 transition-all overflow-hidden flex flex-col items-center justify-center text-center"
        >
          {/* Hover effect background */}
          <div className="absolute inset-0 bg-gradient-to-br from-neutral-800/0 to-acid/0 group-hover:from-neutral-800/20 group-hover:to-acid/10 transition-all duration-300"></div>
          
          <div className="relative z-10">
            <div className="w-16 h-16 rounded-lg bg-neutral-800 group-hover:bg-neutral-700 transition-colors flex items-center justify-center mb-4 mx-auto">
              <PenTool size={32} className="text-dim group-hover:text-acid transition-colors" />
            </div>
            <h3 className="font-display font-bold text-lg text-white mb-2">{t.manualMode}</h3>
            <p className="text-xs text-dim group-hover:text-neutral-300 transition-colors">{t.manualModeDesc}</p>
          </div>
        </button>

        {/* AI Mode */}
        <button
          onClick={onAIMode}
          className="group relative p-8 bg-neutral-900/50 border border-acid/30 rounded-xl hover:border-acid transition-all overflow-hidden flex flex-col items-center justify-center text-center ring-1 ring-acid/20 hover:ring-acid/40"
        >
          {/* Hover effect background */}
          <div className="absolute inset-0 bg-gradient-to-br from-acid/10 to-acid/5 group-hover:from-acid/20 group-hover:to-acid/10 transition-all duration-300"></div>
          
          {/* Badge Popular */}
          <div className="absolute top-3 right-3 bg-acid/20 text-acid text-[9px] font-mono font-bold px-2 py-1 rounded-md">
            ⚡ AI POWERED
          </div>

          <div className="relative z-10">
            <div className="w-16 h-16 rounded-lg bg-acid/10 group-hover:bg-acid/20 transition-colors flex items-center justify-center mb-4 mx-auto">
              <Wand2 size={32} className="text-acid" />
            </div>
            <h3 className="font-display font-bold text-lg text-white mb-2">{t.aiMode}</h3>
            <p className="text-xs text-dim group-hover:text-neutral-300 transition-colors">{t.aiModeDesc}</p>
          </div>
        </button>
      </div>
    </div>
  );
};

export default TripModeSelector;
