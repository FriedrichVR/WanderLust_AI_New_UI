
import React, { useEffect, useState } from 'react';
import { Utensils, Wine, Landmark, RefreshCw, Loader2, MapPin } from 'lucide-react';
import { getTravelSuggestions } from '../services/geminiService';

interface Recommendation {
  name: string;
  desc: string;
}

interface SuggestionsData {
  restaurants: Recommendation[];
  bars: Recommendation[];
  museums: Recommendation[];
}

interface Props {
  destination: string;
  type: string;
}

const TripSuggestions: React.FC<Props> = ({ destination, type }) => {
  const [data, setData] = useState<SuggestionsData | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchSuggestions = async () => {
    setLoading(true);
    try {
      const res = await getTravelSuggestions(destination, type);
      if (res) setData(res);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (destination) fetchSuggestions();
  }, [destination]);

  if (loading) {
    return (
      <div className="bg-surface border border-border p-6 rounded-3xl h-full min-h-[300px] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3 text-dim animate-pulse">
          <Loader2 className="animate-spin text-acid" size={24} />
          <span className="text-xs font-mono uppercase tracking-widest">Scanning local hotspots...</span>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="bg-surface border border-border p-6 rounded-3xl h-full flex flex-col items-center justify-center text-center">
        <p className="text-dim text-xs font-mono mb-4">No suggestions found.</p>
        <button onClick={fetchSuggestions} className="text-acid hover:text-white flex items-center gap-2 text-xs font-bold uppercase"><RefreshCw size={14}/> Retry</button>
      </div>
    );
  }

  const sections = [
    { id: 'restaurants', icon: Utensils, label: 'Eats', items: data.restaurants },
    { id: 'bars', icon: Wine, label: 'Nightlife', items: data.bars },
    { id: 'museums', icon: Landmark, label: 'Culture', items: data.museums },
  ];

  return (
    <div className="bg-surface border border-border p-6 rounded-3xl shadow-sm h-full overflow-hidden flex flex-col">
      <div className="flex justify-between items-center mb-6">
        <h3 className="font-mono text-xs text-acid uppercase tracking-widest flex items-center gap-2">
          <MapPin size={14} /> Local Intel
        </h3>
        <button onClick={fetchSuggestions} className="text-dim hover:text-acid transition-colors p-1" title="Refresh">
          <RefreshCw size={12} />
        </button>
      </div>

      <div className="space-y-6 overflow-y-auto custom-scrollbar pr-2 flex-1">
        {sections.map((section) => (
          <div key={section.id}>
            <h4 className="flex items-center gap-2 text-[10px] font-bold uppercase text-text mb-3 opacity-80">
              <section.icon size={12} className="text-dim" /> {section.label}
            </h4>
            <div className="space-y-2">
              {section.items?.map((item, idx) => (
                <div key={idx} className="bg-panel p-3 rounded-xl border border-transparent hover:border-dim/30 transition-colors group">
                  <div className="font-bold text-xs text-white mb-1 group-hover:text-acid transition-colors">{item.name}</div>
                  <div className="text-[10px] text-dim leading-relaxed">{item.desc}</div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default TripSuggestions;
