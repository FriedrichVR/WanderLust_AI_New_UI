
import React, { useState, useEffect, useRef } from 'react';
import { X, ChevronLeft, ChevronRight, MapPin } from 'lucide-react';

interface Props {
  onClose: () => void;
}

const TESTIMONIALS = [
  {
    id: 1,
    name: "Elena Rodríguez",
    role: "Mochilera Solo",
    image: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?q=80&w=150&h=150&auto=format&fit=crop",
    color: "bg-emerald-500",
    textColor: "text-emerald-500",
    quote: "Caos Organizado",
    desc: "WanderLust AI convirtió mis notas dispersas en un itinerario fluido. Nunca pierdo un vuelo ahora.",
    stats: [
      { label: "Viajes", value: "12" },
      { label: "Países", value: "8" },
      { label: "Ahorrado", value: "$1.2k" }
    ]
  },
  {
    id: 2,
    name: "Marcos Chen",
    role: "Nómada Digital",
    image: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?q=80&w=150&h=150&auto=format&fit=crop",
    color: "bg-blue-500",
    textColor: "text-blue-500",
    quote: "Trabajo y Viaje",
    desc: "El seguimiento de presupuesto es esencial. Puedo gestionar gastos en 3 monedas fácilmente.",
    stats: [
      { label: "Meses", value: "24" },
      { label: "Oficinas", value: "15" },
      { label: "Café", value: "∞" }
    ]
  },
  {
    id: 3,
    name: "Sara y Miguel",
    role: "Pareja Aventura",
    image: "https://images.unsplash.com/photo-1539614474468-f425a269751d?q=80&w=150&h=150&auto=format&fit=crop",
    color: "bg-purple-500",
    textColor: "text-purple-500",
    quote: "Sin Discusiones",
    desc: "Planear solía ser estresante. Ahora la IA sugiere paradas que a ambos nos encantan.",
    stats: [
      { label: "Rutas", value: "45" },
      { label: "Millas", value: "300+" },
      { label: "Fotos", value: "5k" }
    ]
  },
  {
    id: 4,
    name: "Lucas y Emma",
    role: "Foodies Globales",
    image: "https://images.unsplash.com/photo-1529626455594-4ff0802cfb7e?q=80&w=150&h=150&auto=format&fit=crop",
    color: "bg-orange-500",
    textColor: "text-orange-500",
    quote: "Sabor y Cultura",
    desc: "La IA nos encontró joyas culinarias ocultas en Japón que ninguna guía turística mencionaba.",
    stats: [
      { label: "Restaurantes", value: "89" },
      { label: "Estrellas", value: "12" },
      { label: "Bocados", value: "10k" }
    ]
  },
  {
    id: 5,
    name: "David Kim",
    role: "Fotógrafo Extremo",
    image: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?q=80&w=150&h=150&auto=format&fit=crop",
    color: "bg-red-500",
    textColor: "text-red-500",
    quote: "Capturando el Mundo",
    desc: "El mapa integrado es vital para planificar mis tomas al amanecer en lugares remotos.",
    stats: [
      { label: "Cámaras", value: "3" },
      { label: "Tomas", value: "50k" },
      { label: "Premios", value: "5" }
    ]
  },
  {
    id: 6,
    name: "Isabella Rossi",
    role: "Historiadora",
    image: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?q=80&w=150&h=150&auto=format&fit=crop",
    color: "bg-amber-600",
    textColor: "text-amber-600",
    quote: "Viaje en el Tiempo",
    desc: "WanderLust me ayuda a organizar rutas temáticas históricas con una precisión increíble.",
    stats: [
      { label: "Museos", value: "120" },
      { label: "Libros", value: "200" },
      { label: "Eras", value: "All" }
    ]
  }
];

const PixelContainer: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // Clear existing pixels to prevent duplication on re-renders
    container.innerHTML = '';

    const pixelCount = 30;
    const gap = 15;
    
    // Get dimensions (fallback if not rendered yet)
    const width = container.offsetWidth || 300;
    const height = container.offsetHeight || 400;

    for (let i = 0; i < pixelCount; i++) {
      const pixel = document.createElement('div');
      pixel.classList.add('absolute', 'transition-opacity', 'duration-300', 'opacity-0');
      
      const size = 4;
      pixel.style.width = `${size}px`;
      pixel.style.height = `${size}px`;
      
      const x = Math.floor(Math.random() * (width / gap)) * gap;
      const y = Math.floor(Math.random() * (height / gap)) * gap;
      
      pixel.style.left = `${x}px`;
      pixel.style.top = `${y}px`;
      
      const delay = Math.random() * 0.3;
      pixel.style.transitionDelay = `${delay}s`;
      pixel.style.backgroundColor = `rgba(34, 211, 238, 0.4)`; // Cyan color for pixels
      
      container.appendChild(pixel);
    }
  }, []);

  return <div ref={containerRef} className="absolute inset-0 overflow-hidden rounded-xl pointer-events-none group-hover:opacity-100 [&>div]:group-hover:opacity-100"></div>;
};

const TestimonialsRolodex: React.FC<Props> = ({ onClose }) => {
  const [activeIndex, setActiveIndex] = useState(0);

  const handleNext = () => {
    setActiveIndex((prev) => (prev + 1) % TESTIMONIALS.length);
  };

  const handlePrev = () => {
    setActiveIndex((prev) => (prev - 1 + TESTIMONIALS.length) % TESTIMONIALS.length);
  };

  const getCardClass = (index: number) => {
    const len = TESTIMONIALS.length;
    let diff = (index - activeIndex + len) % len;
    
    if (diff === 0) return 'translate-y-0 scale-100 z-30 opacity-100 shadow-2xl';
    if (diff === 1) return 'translate-y-[15%] scale-90 z-10 brightness-[0.6] opacity-100'; // Next
    if (diff === len - 1) return '-translate-y-[15%] scale-90 z-20 brightness-[0.6] opacity-100'; // Prev
    
    return 'translate-y-[50%] scale-80 z-0 opacity-0'; // Hidden
  };

  return (
    <div className="fixed inset-0 bg-black/90 backdrop-blur-md z-[100] flex flex-col items-center justify-center p-4 animate-fade-in">
      <button 
        onClick={onClose} 
        className="absolute top-6 right-6 p-2 bg-white/10 hover:bg-white/20 rounded-full text-white transition-colors z-50"
      >
        <X size={24} />
      </button>

      <div className="text-center mb-12 relative z-10">
        <h2 className="font-display font-bold text-3xl text-white uppercase tracking-tight mb-2">Historias de Viajeros</h2>
        <p className="text-dim font-mono text-sm">Aventuras reales, personas reales.</p>
      </div>

      <div className="relative w-full max-w-sm h-[500px]">
        {TESTIMONIALS.map((item, index) => (
          <div 
            key={item.id}
            className={`absolute top-0 left-0 w-full h-full transition-all duration-500 cubic-bezier(0.4, 0, 0.2, 1) group ${getCardClass(index)}`}
          >
            {/* Pixel Effect Layer */}
            {index === activeIndex && <PixelContainer />}

            <div className="bg-neutral-900 rounded-xl overflow-hidden border border-neutral-800 h-full relative z-10 flex flex-col shadow-2xl">
              {/* Header */}
              <div className="px-6 py-6 border-b border-neutral-800 flex items-center justify-between bg-neutral-900/50">
                <div className="flex items-center space-x-4">
                  <div className="relative">
                    <img 
                      src={item.image} 
                      alt={item.name} 
                      className="w-12 h-12 rounded-full object-cover border-2 border-neutral-700 group-hover:border-acid transition-colors"
                    />
                    <div className={`absolute bottom-0 right-0 w-3 h-3 rounded-full ${item.color} border-2 border-neutral-900`}></div>
                  </div>
                  <div>
                    <h2 className="text-neutral-200 font-bold text-base leading-tight">{item.name}</h2>
                    <span className="text-[10px] text-neutral-500 font-mono uppercase tracking-wider block mt-1">{item.role}</span>
                  </div>
                </div>
              </div>

              {/* Body */}
              <div className="px-6 py-8 flex-1 flex flex-col justify-center relative">
                <div className="relative z-10">
                  <div className="flex items-baseline mb-4">
                    <span className="text-3xl font-light text-neutral-200 leading-tight italic font-serif">"{item.quote}"</span>
                  </div>
                  <p className="text-neutral-400 text-sm leading-relaxed">{item.desc}</p>
                </div>
                
                {/* Floating Icon */}
                <div className={`absolute bottom-8 right-6 ${item.textColor} opacity-10 animate-[float_6s_ease-in-out_infinite]`}>
                  <MapPin size={80} strokeWidth={1} />
                </div>
              </div>

              {/* Stats Footer */}
              <div className="px-6 py-4 bg-neutral-800/30 border-t border-neutral-800 grid grid-cols-3 gap-2 text-center">
                {item.stats.map((stat, i) => (
                  <div key={i} className="px-2 py-2">
                    <p className="text-[9px] text-neutral-500 uppercase tracking-widest mb-1">{stat.label}</p>
                    <p className="text-acid font-mono text-sm font-bold">{stat.value}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Controls */}
      <div className="flex gap-4 mt-8 relative z-10">
        <button 
          onClick={handlePrev}
          className="w-12 h-12 rounded-full bg-neutral-800 border border-neutral-700 flex items-center justify-center text-white hover:bg-neutral-700 hover:border-acid/50 hover:text-acid transition-all"
        >
          <ChevronLeft size={20} />
        </button>
        <button 
          onClick={handleNext}
          className="w-12 h-12 rounded-full bg-neutral-800 border border-neutral-700 flex items-center justify-center text-white hover:bg-neutral-700 hover:border-acid/50 hover:text-acid transition-all"
        >
          <ChevronRight size={20} />
        </button>
      </div>
    </div>
  );
};

export default TestimonialsRolodex;
