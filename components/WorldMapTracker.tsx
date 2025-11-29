
import React, { useState, useEffect } from 'react';
import { Globe, RefreshCw } from 'lucide-react';
import { Trip } from '../types';
import { getTravelSuggestions, generateTripImage, generateTripSummary } from '../services/geminiService';

const CONTINENTS = [
  { id: 'na', name: 'North America', path: "M 50 50 L 150 50 L 150 150 L 50 150 Z" }, // Placeholder paths - replacing with simple circles/abstract shapes for reliability without external heavy libs
];

// Abstract representation of a scratch map using clickable regions
const REGIONS = [
  { id: 'na', name: 'North America', x: 20, y: 25, r: 15 },
  { id: 'sa', name: 'South America', x: 30, y: 65, r: 12 },
  { id: 'eu', name: 'Europe', x: 52, y: 25, r: 8 },
  { id: 'af', name: 'Africa', x: 55, y: 55, r: 14 },
  { id: 'as', name: 'Asia', x: 75, y: 30, r: 18 },
  { id: 'oc', name: 'Oceania', x: 85, y: 75, r: 10 },
];

interface Props {
  trip?: Trip;
}

const WorldMapTracker: React.FC<Props> = ({ trip }) => {
  const [visited, setVisited] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<any | null>(null);
  const [images, setImages] = useState<Record<string, string>>({});
  const [summary, setSummary] = useState<string>('');
  const [loadingSummary, setLoadingSummary] = useState(false);

  const toggleRegion = (id: string) => {
    setVisited(prev => prev.includes(id) ? prev.filter(r => r !== id) : [...prev, id]);
  };

  const clearMap = () => setVisited([]);

  const destination = trip?.destination || 'your destination';

  const fetchContextualInfo = async () => {
    setLoading(true);
    try {
      const res = await getTravelSuggestions(destination, trip?.type || 'Leisure');
      setSuggestions(res);

      // Generate up to one image per item but limit total to avoid too many calls
      const imgs: Record<string, string> = {};
      let generated = 0;
      const MAX_GEN = 6;
      if (res) {
        const categories = ['restaurants', 'bars', 'museums'];
        for (const cat of categories) {
          const list = res[cat] || [];
          for (let i = 0; i < list.length && generated < MAX_GEN; i++) {
            const item = list[i];
            const key = `${cat}_${i}`;
            try {
              const img = await generateTripImage(`${destination} ${item.name}`, cat);
              imgs[key] = img;
              generated++;
            } catch (e) {
              // ignore image failures, leave placeholder
            }
          }
        }
      }
      setImages(imgs);
    } catch (e) {
      console.error('Context fetch error', e);
      setSuggestions(null);
    } finally {
      setLoading(false);
    }
  };

  const fetchSummary = async () => {
    if (!trip) return;
    setLoadingSummary(true);
    try {
      const s = await generateTripSummary(trip);
      setSummary(s);
    } catch (e) {
      console.error('Summary error', e);
    } finally {
      setLoadingSummary(false);
    }
  };

  useEffect(() => {
    // Load contextual info when component mounts or trip changes
    // For now, use dummy data if trip not provided
    if (trip) {
      fetchContextualInfo();
      fetchSummary();
    } else {
      // Use dummy data when no trip
      setSuggestions({
        restaurants: [
          { name: 'Le Petit Bistro', desc: 'French fine dining with local wines' },
          { name: 'Trattoria Roma', desc: 'Authentic Italian pasta & seafood' },
          { name: 'Zen Garden', desc: 'Modern Asian fusion cuisine' }
        ],
        bars: [
          { name: 'The Rusty Compass', desc: 'Cocktail bar with rooftop views' },
          { name: 'Local Brewery Tap', desc: 'Craft beer & craft cocktails' },
          { name: 'Sky Lounge', desc: 'Upscale drinks & live music' }
        ],
        museums: [
          { name: 'Museum of History', desc: 'Ancient artifacts & local heritage' },
          { name: 'Art Gallery Modern', desc: 'Contemporary & digital art' },
          { name: 'Natural History Wing', desc: 'Dinosaurs, geology & exhibits' }
        ]
      });
      setSummary('Experience the vibrant culture, stunning architecture, and world-class cuisine of this iconic destination. Perfect for adventure seekers and culture enthusiasts alike.');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trip]);

  return (
    <div className="bg-surface border border-border rounded-3xl p-6 relative overflow-hidden h-full flex flex-col">
      <div className="flex justify-between items-center mb-4 z-10">
        <h3 className="font-mono text-xs text-acid uppercase tracking-widest flex items-center gap-2">
          <Globe size={14} /> World Tracker
        </h3>
        <button onClick={clearMap} className="text-[10px] font-mono text-dim hover:text-danger uppercase transition-colors">
          Reset
        </button>
      </div>

      <div className="relative flex-1 bg-panel rounded-2xl border border-border overflow-hidden group">
        <div className="h-full flex gap-4">
          {/* Map area */}
          <div className="flex-1 p-4">
            <svg viewBox="0 0 100 100" className="w-full h-full opacity-80">
               {/* Grid Lines */}
               <line x1="0" y1="50" x2="100" y2="50" stroke="currentColor" className="text-white/5" strokeWidth="0.5" />
               <line x1="50" y1="0" x2="50" y2="100" stroke="currentColor" className="text-white/5" strokeWidth="0.5" />
               {REGIONS.map((region) => (
                 <g key={region.id} onClick={() => toggleRegion(region.id)} className="cursor-pointer transition-all hover:opacity-80">
                   <circle 
                     cx={region.x} 
                     cy={region.y} 
                     r={region.r} 
                     className={`transition-all duration-500 ${visited.includes(region.id) ? 'fill-acid stroke-acid' : 'fill-dim/20 stroke-dim'}`}
                     strokeWidth="0.5"
                   />
                   <text 
                     x={region.x} 
                     y={region.y} 
                     textAnchor="middle" 
                     dy="0.3em" 
                     fontSize="3" 
                     className={`font-mono uppercase pointer-events-none transition-colors ${visited.includes(region.id) ? 'fill-black font-bold' : 'fill-dim'}`}
                   >
                     {region.id}
                   </text>
                 </g>
               ))}
            </svg>
            <div className="absolute bottom-4 left-4 text-[10px] font-mono text-dim">
              Regions Visited: <span className="text-acid">{visited.length}</span> / {REGIONS.length}
            </div>
          </div>

        </div>
      </div>
      
      <p className="text-[9px] text-dim font-mono mt-4 text-center opacity-60">
        Click regions to mark as visited.
      </p>
    </div>
  );
};

export default WorldMapTracker;
