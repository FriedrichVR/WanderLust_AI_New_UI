
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Save, X, RotateCcw, ZoomIn, Sun, Contrast, Droplets, Monitor, Undo, Redo, Minus, Plus, Type, Trash2, Move, MousePointer2, ArrowUp, ArrowDown, Layers, Square, ChevronDown, ChevronUp } from 'lucide-react';
import { translations, Language } from '../utils/translations';
import { ToastType } from './Toast';

interface Props {
  imageSrc: string;
  onSave: (newImageSrc: string) => void;
  onCancel: () => void;
  lang: Language;
  showToast?: (msg: string, type: ToastType) => void;
}

interface TextLayer {
  id: string;
  text: string;
  x: number; // Percentage of image width (0-1)
  y: number; // Percentage of image height (0-1)
  fontSize: number; // Relative to image height
  color: string;
  fontFamily: string;
  strokeColor?: string;
  strokeWidth?: number; // Relative to image height
  backgroundColor?: string;
  padding?: number; // Relative to fontSize
}

interface EditorState {
    scale: number;
    position: { x: number; y: number };
    filters: Record<string, number>;
    texts: TextLayer[];
}

const FONTS = [
  { id: 'Inter, sans-serif', label: 'Sans' },
  { id: 'Space Grotesk, sans-serif', label: 'Display' },
  { id: 'JetBrains Mono, monospace', label: 'Mono' },
  { id: 'serif', label: 'Serif' },
];

const COLORS = [
  { id: '#ffffff', label: 'White' },
  { id: '#000000', label: 'Black' },
  { id: '#22d3ee', label: 'Cyan' }, 
  { id: '#ef4444', label: 'Red' },
  { id: '#3b82f6', label: 'Blue' },
  { id: '#facc15', label: 'Yellow' },
  { id: 'transparent', label: 'None' },
];

const ASPECT_RATIO = 16 / 9;

const ImageEditor: React.FC<Props> = ({ imageSrc, onSave, onCancel, lang, showToast }) => {
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const t = translations[lang];
  
  // Transform State
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  // Gestures State
  const [isPinching, setIsPinching] = useState(false);
  const pinchStartDist = useRef(0);
  const pinchStartScale = useRef(1);

  // Filter State
  const [filters, setFilters] = useState<Record<string, number>>({
    brightness: 100,
    contrast: 100,
    saturation: 100,
    grayscale: 0
  });
  
  // Text State
  const [texts, setTexts] = useState<TextLayer[]>([]);
  const [activeTextId, setActiveTextId] = useState<string | null>(null);
  const [isDraggingText, setIsDraggingText] = useState(false);

  const [activeTab, setActiveTab] = useState<'filter' | 'text'>('filter');
  const [activeFilter, setActiveFilter] = useState('brightness');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(true);

  const containerRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);

  // History State
  const [history, setHistory] = useState<EditorState[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);

  const FILTERS = [
    { id: 'brightness', icon: Sun, label: t.brightness, min: 0, max: 200, default: 100 },
    { id: 'contrast', icon: Contrast, label: t.contrast, min: 0, max: 200, default: 100 },
    { id: 'saturation', icon: Droplets, label: t.saturation, min: 0, max: 200, default: 100 },
    { id: 'grayscale', icon: Monitor, label: t.grayscale, min: 0, max: 100, default: 0 },
  ];

  // Initialize
  useEffect(() => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.src = imageSrc;
    img.onload = () => {
      setImage(img);
      setScale(1); 
      setPosition({ x: 0, y: 0 });
      // Initial History State
      const initialState = {
          scale: 1,
          position: { x: 0, y: 0 },
          filters: { brightness: 100, contrast: 100, saturation: 100, grayscale: 0 },
          texts: []
      };
      setHistory([initialState]);
      setHistoryIndex(0);
    };
  }, [imageSrc]);

  // --- History Management ---
  const applyState = (state: EditorState) => {
      setScale(state.scale);
      setPosition(state.position);
      setFilters(state.filters);
      setTexts(state.texts);
  };

  const pushToHistory = (overrides?: Partial<EditorState>) => {
      const currentState: EditorState = {
          scale,
          position: { ...position },
          filters: { ...filters },
          texts: [...texts],
          ...overrides
      };

      // Prevent duplicate history entries if nothing changed
      if (historyIndex >= 0) {
          const prevState = history[historyIndex];
          if (JSON.stringify(prevState) === JSON.stringify(currentState)) return;
      }

      const newHistory = history.slice(0, historyIndex + 1);
      newHistory.push(currentState);
      setHistory(newHistory);
      setHistoryIndex(newHistory.length - 1);
  };

  const undo = useCallback(() => {
      if (historyIndex > 0) {
          const newIndex = historyIndex - 1;
          const state = history[newIndex];
          applyState(state);
          setHistoryIndex(newIndex);
          setActiveTextId(null); // Clear selection to avoid ghost state
      }
  }, [history, historyIndex]);

  const redo = useCallback(() => {
      if (historyIndex < history.length - 1) {
          const newIndex = historyIndex + 1;
          const state = history[newIndex];
          applyState(state);
          setHistoryIndex(newIndex);
          setActiveTextId(null); // Clear selection
      }
  }, [history, historyIndex]);

  // Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
        // Undo: Ctrl+Z or Cmd+Z
        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && !e.shiftKey) {
            e.preventDefault();
            undo();
        }
        // Redo: Ctrl+Y, Cmd+Y, Ctrl+Shift+Z, Cmd+Shift+Z
        if (
            ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') ||
            ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'z')
        ) {
            e.preventDefault();
            redo();
        }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [undo, redo]);

  // --- Interaction Handlers (Mouse) ---
  const handleMouseDown = (e: React.MouseEvent) => {
    // Click on background deselects text and starts panning
    if (activeTextId) setActiveTextId(null);
    
    setIsDragging(true);
    setDragStart({ x: e.clientX - position.x, y: e.clientY - position.y });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDraggingText && activeTextId && imageRef.current) {
        // Handle Text Dragging
        const rect = imageRef.current.getBoundingClientRect();
        const x = (e.clientX - rect.left) / rect.width;
        const y = (e.clientY - rect.top) / rect.height;
        
        setTexts(prev => prev.map(t => t.id === activeTextId ? { ...t, x, y } : t));
        return;
    }

    if (isDragging) {
        // Handle Image Panning
        setPosition({
            x: e.clientX - dragStart.x,
            y: e.clientY - dragStart.y
        });
    }
  };

  const handleMouseUp = () => {
    if (isDragging) {
        setIsDragging(false);
        pushToHistory(); 
    }
    if (isDraggingText) {
        setIsDraggingText(false);
        pushToHistory();
    }
  };

  // --- Interaction Handlers (Wheel & Touch) ---
  const handleWheel = (e: React.WheelEvent) => {
      const sensitivity = 0.001;
      const delta = -e.deltaY * sensitivity;
      const newScale = Math.min(3, Math.max(0.5, scale + delta));
      setScale(newScale);
  };

  const handleTouchStart = (e: React.TouchEvent) => {
      if (e.touches.length === 2) {
          // Pinch Start
          setIsPinching(true);
          setIsDragging(false);
          setIsDraggingText(false);
          const dist = Math.hypot(
              e.touches[0].clientX - e.touches[1].clientX,
              e.touches[0].clientY - e.touches[1].clientY
          );
          pinchStartDist.current = dist;
          pinchStartScale.current = scale;
      } else if (e.touches.length === 1) {
          if (!isDraggingText) {
              // Pan Start
              if (activeTextId) setActiveTextId(null);
              setIsDragging(true);
              setDragStart({ 
                  x: e.touches[0].clientX - position.x, 
                  y: e.touches[0].clientY - position.y 
              });
          }
      }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
      if (isPinching && e.touches.length === 2) {
          // Pinch Zoom
          const dist = Math.hypot(
              e.touches[0].clientX - e.touches[1].clientX,
              e.touches[0].clientY - e.touches[1].clientY
          );
          if (pinchStartDist.current > 0) {
              const ratio = dist / pinchStartDist.current;
              const newScale = Math.min(3, Math.max(0.5, pinchStartScale.current * ratio));
              setScale(newScale);
          }
      } else if (isDraggingText && e.touches.length === 1 && activeTextId && imageRef.current) {
          // Text Drag
          const rect = imageRef.current.getBoundingClientRect();
          const x = (e.touches[0].clientX - rect.left) / rect.width;
          const y = (e.touches[0].clientY - rect.top) / rect.height;
          setTexts(prev => prev.map(t => t.id === activeTextId ? { ...t, x, y } : t));
      } else if (isDragging && e.touches.length === 1) {
          // Pan Move
          setPosition({
              x: e.touches[0].clientX - dragStart.x,
              y: e.touches[0].clientY - dragStart.y
          });
      }
  };

  const handleTouchEnd = () => {
      if (isDragging || isPinching || isDraggingText) {
          pushToHistory();
      }
      setIsDragging(false);
      setIsPinching(false);
      setIsDraggingText(false);
  };

  const handleTextTouchStart = (e: React.TouchEvent, id: string) => {
      e.stopPropagation();
      setActiveTextId(id);
      setIsDraggingText(true);
  };

  // --- Text Handlers ---
  const addText = () => {
      const newText: TextLayer = {
          id: crypto.randomUUID(),
          text: 'Enter Text',
          x: 0.5,
          y: 0.5,
          fontSize: 0.1, // 10% of image height
          color: '#ffffff',
          fontFamily: 'Inter, sans-serif',
          strokeColor: '#000000',
          strokeWidth: 0.005,
          backgroundColor: 'transparent',
          padding: 0.5
      };
      const newTexts = [...texts, newText];
      setTexts(newTexts);
      setActiveTextId(newText.id);
      setActiveTab('text');
      setIsMobileMenuOpen(true);
      pushToHistory({ texts: newTexts });
  };

  const updateActiveText = (key: keyof TextLayer, value: any) => {
      if (!activeTextId) return;
      const updatedTexts = texts.map(t => t.id === activeTextId ? { ...t, [key]: value } : t);
      setTexts(updatedTexts);
  };

  const deleteActiveText = () => {
      if (!activeTextId) return;
      const newTexts = texts.filter(t => t.id !== activeTextId);
      setTexts(newTexts);
      setActiveTextId(null);
      pushToHistory({ texts: newTexts });
  };

  const handleTextMouseDown = (e: React.MouseEvent, id: string) => {
      e.stopPropagation(); // Stop panning
      setActiveTextId(id);
      setIsDraggingText(true);
      setIsMobileMenuOpen(true);
  };

  const moveLayer = (index: number, direction: 'up' | 'down') => {
      if (direction === 'up' && index < texts.length - 1) {
          const newTexts = [...texts];
          // Swap with next (Move Forward)
          [newTexts[index], newTexts[index + 1]] = [newTexts[index + 1], newTexts[index]];
          setTexts(newTexts);
          pushToHistory({ texts: newTexts });
      } else if (direction === 'down' && index > 0) {
          const newTexts = [...texts];
          // Swap with prev (Move Backward)
          [newTexts[index], newTexts[index - 1]] = [newTexts[index - 1], newTexts[index]];
          setTexts(newTexts);
          pushToHistory({ texts: newTexts });
      }
  };

  // --- Zoom ---
  const handleZoomBtn = (delta: number) => {
      const newScale = Math.min(3, Math.max(0.5, scale + delta));
      setScale(newScale);
      pushToHistory({ scale: newScale });
  };

  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      if (activeTab === 'filter' && activeFilter) {
          setFilters({...filters, [activeFilter]: parseInt(e.target.value)});
      }
  };

  const handleSliderCommit = () => {
      pushToHistory();
  };

  const handleSave = () => {
    if (!image) return;
    
    // Create a high-res canvas for output
    const outputCanvas = document.createElement('canvas');
    const WIDTH = 1280;
    const HEIGHT = WIDTH / ASPECT_RATIO;
    outputCanvas.width = WIDTH;
    outputCanvas.height = HEIGHT;
    const ctx = outputCanvas.getContext('2d');
    if (!ctx) return;

    // Background color
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, WIDTH, HEIGHT);

    // Apply Filters
    ctx.filter = `brightness(${filters.brightness}%) contrast(${filters.contrast}%) saturate(${filters.saturation}%) grayscale(${filters.grayscale}%)`;

    // Calculate drawing params
    const imgAspectRatio = image.width / image.height;
    let renderW, renderH;
    if (imgAspectRatio > ASPECT_RATIO) {
        renderH = HEIGHT;
        renderW = image.width * (HEIGHT / image.height);
    } else {
        renderW = WIDTH;
        renderH = image.height * (WIDTH / image.width);
    }

    const cx = WIDTH / 2;
    const cy = HEIGHT / 2;

    // Apply transformations
    ctx.translate(cx + position.x, cy + position.y);
    ctx.scale(scale, scale);
    ctx.translate(-renderW/2, -renderH/2); 

    // Draw Image
    ctx.drawImage(image, 0, 0, renderW, renderH);

    // Draw Text Layers
    ctx.filter = 'none'; // Reset filters for text
    texts.forEach(text => {
        const x = renderW * text.x;
        const y = renderH * text.y;
        const fontSizePx = renderH * text.fontSize;
        
        ctx.font = `bold ${fontSizePx}px ${text.fontFamily.split(',')[0]}`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        
        // Split lines for multi-line support
        const lines = text.text.split('\n');
        const lineHeight = fontSizePx * 1.2;
        
        // Calculate bounding box for background
        let maxWidth = 0;
        lines.forEach(line => {
            const m = ctx.measureText(line);
            if (m.width > maxWidth) maxWidth = m.width;
        });
        
        const totalHeight = lines.length * lineHeight;
        const pad = fontSizePx * (text.padding || 0.2);
        
        const bgX = x - maxWidth / 2 - pad;
        const bgY = y - totalHeight / 2 - pad;
        const bgW = maxWidth + pad * 2;
        const bgH = totalHeight + pad * 2;

        // Draw Background
        if (text.backgroundColor && text.backgroundColor !== 'transparent') {
            ctx.fillStyle = text.backgroundColor;
            ctx.fillRect(bgX, bgY, bgW, bgH);
        }

        // Draw Lines
        lines.forEach((line, i) => {
            const lineY = y - (totalHeight / 2) + (i * lineHeight) + (lineHeight / 2);
            
            // Draw Stroke
            if (text.strokeWidth && text.strokeWidth > 0) {
                ctx.lineWidth = renderH * text.strokeWidth;
                ctx.strokeStyle = text.strokeColor || '#000000';
                ctx.lineJoin = 'round';
                ctx.strokeText(line, x, lineY);
            }

            // Draw Fill
            ctx.fillStyle = text.color;
            if (!text.backgroundColor || text.backgroundColor === 'transparent') {
                ctx.shadowColor = 'rgba(0,0,0,0.5)';
                ctx.shadowBlur = 4;
                ctx.shadowOffsetX = 2;
                ctx.shadowOffsetY = 2;
            } else {
                ctx.shadowColor = 'transparent';
            }
            ctx.fillText(line, x, lineY);
        });
    });

    const dataUrl = outputCanvas.toDataURL('image/jpeg', 0.90);
    onSave(dataUrl);
  };

  const reset = () => {
      const defaultState = {
          scale: 1,
          position: { x: 0, y: 0 },
          filters: { brightness: 100, contrast: 100, saturation: 100, grayscale: 0 },
          texts: []
      };
      applyState(defaultState);
      pushToHistory(defaultState);
      setActiveTextId(null);
  };

  return (
    <div className="fixed inset-0 bg-black/95 z-[100] flex flex-col animate-fade-in select-none">
      
      {/* Header */}
      <div className="w-full flex justify-between items-center p-4 border-b border-border bg-panel shrink-0 z-30">
        <div className="flex items-center gap-4">
            <button onClick={onCancel} className="md:hidden text-dim hover:text-white"><X size={24}/></button>
            <h3 className="font-display font-bold text-white uppercase tracking-widest text-sm md:text-base">{t.imageEditor}</h3>
        </div>
        <div className="flex items-center gap-2">
             <button 
                onClick={undo} 
                disabled={historyIndex <= 0}
                className="p-2 text-dim hover:text-white disabled:opacity-30 disabled:hover:text-dim transition-colors rounded-full hover:bg-surface"
                title="Undo (Ctrl+Z)"
            >
                <Undo size={18} />
             </button>
             <button 
                onClick={redo} 
                disabled={historyIndex >= history.length - 1}
                className="p-2 text-dim hover:text-white disabled:opacity-30 disabled:hover:text-dim transition-colors rounded-full hover:bg-surface"
                title="Redo (Ctrl+Y)"
            >
                <Redo size={18} />
             </button>
             <div className="h-4 w-[1px] bg-border mx-2 hidden md:block"></div>
             <button onClick={handleSave} className="md:hidden text-acid font-bold text-xs uppercase px-2">{t.saveChanges}</button>
        </div>
      </div>

      <div className="flex-1 flex flex-col md:flex-row min-h-0 overflow-hidden relative">
        
        {/* Editor Viewport */}
        <div className="flex-1 bg-black/50 relative overflow-hidden cursor-move touch-none group order-1 md:order-1">
            <div 
                ref={containerRef}
                className="absolute inset-0 w-full h-full"
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseUp}
                onWheel={handleWheel}
                onTouchStart={handleTouchStart}
                onTouchMove={handleTouchMove}
                onTouchEnd={handleTouchEnd}
            >
                <div 
                    className="absolute top-1/2 left-1/2 w-full h-full pointer-events-none"
                    style={{
                         transform: `translate(-50%, -50%) translate(${position.x}px, ${position.y}px) scale(${scale})`,
                         transformOrigin: 'center',
                    }}
                >
                    {image ? (
                        <>
                            <img 
                                ref={imageRef}
                                src={imageSrc}
                                alt="Edit Target"
                                className="absolute top-1/2 left-1/2 max-w-none transform -translate-x-1/2 -translate-y-1/2 transition-transform duration-75 ease-out"
                                style={{
                                    filter: `brightness(${filters.brightness}%) contrast(${filters.contrast}%) saturate(${filters.saturation}%) grayscale(${filters.grayscale}%)`,
                                    width: image.width / image.height > ASPECT_RATIO ? 'auto' : '100%',
                                    height: image.width / image.height > ASPECT_RATIO ? '100%' : 'auto',
                                    maxHeight: 'none',
                                    maxWidth: 'none'
                                }}
                            />
                            {/* Text Overlay Layer */}
                            <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 pointer-events-auto"
                                style={{
                                    width: image.width / image.height > ASPECT_RATIO ? (image.height * (image.width/image.height)) + 'px' : '100%', 
                                    height: image.width / image.height > ASPECT_RATIO ? '100%' : 'auto',
                                    aspectRatio: `${image.width}/${image.height}`,
                                    containerType: 'size'
                                } as React.CSSProperties}
                            >
                                {texts.map(text => (
                                    <div
                                        key={text.id}
                                        onMouseDown={(e) => handleTextMouseDown(e, text.id)}
                                        onTouchStart={(e) => handleTextTouchStart(e, text.id)}
                                        className={`absolute transform -translate-x-1/2 -translate-y-1/2 cursor-move hover:ring-1 ring-white/50 whitespace-pre text-center rounded-lg ${activeTextId === text.id ? 'ring-2 ring-acid z-50' : 'z-10'}`}
                                        style={{
                                            left: `${text.x * 100}%`,
                                            top: `${text.y * 100}%`,
                                            color: text.color,
                                            backgroundColor: text.backgroundColor || 'transparent',
                                            padding: `calc(100cqh * ${(text.fontSize) * (text.padding || 0)})`,
                                            fontFamily: text.fontFamily,
                                            fontSize: `calc(100cqh * ${text.fontSize})`,
                                            fontWeight: 'bold',
                                            lineHeight: 1.2,
                                            textShadow: (!text.backgroundColor || text.backgroundColor === 'transparent') ? '2px 2px 4px rgba(0,0,0,0.5)' : 'none',
                                            WebkitTextStroke: text.strokeWidth ? `calc(100cqh * ${text.strokeWidth}) ${text.strokeColor || '#000'}` : '0px'
                                        }}
                                    >
                                        {text.text}
                                        {activeTextId === text.id && (
                                            <div className="absolute -top-2 -right-2 w-3 h-3 bg-acid rounded-full shadow-md border border-black"></div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </>
                    ) : (
                       <div className="flex items-center justify-center h-full text-dim">Loading...</div>
                    )}
                </div>
            </div>

            {/* Overlay Controls */}
            <div className="absolute bottom-24 md:bottom-6 left-1/2 -translate-x-1/2 z-20 flex gap-2 pointer-events-none">
                <button onClick={reset} className="pointer-events-auto flex items-center gap-2 text-xs font-mono text-white/70 hover:text-white uppercase transition-colors bg-black/40 backdrop-blur px-4 py-2 rounded-full border border-white/10 shadow-lg">
                    <RotateCcw size={12} /> {t.reset}
                </button>
            </div>
        </div>

        {/* Controls Sidebar */}
        <div 
            className={`
                absolute md:static bottom-0 left-0 right-0 bg-panel md:bg-panel/95 border-t md:border-t-0 md:border-l border-border flex flex-col 
                transition-all duration-300 z-40 shadow-[0_-10px_40px_rgba(0,0,0,0.5)] md:shadow-none
                ${isMobileMenuOpen ? 'h-[50vh]' : 'h-16'} md:h-auto md:w-80
            `}
        >
            {/* Mobile Toggle */}
            <button 
                className="md:hidden w-full flex items-center justify-center p-2 text-dim border-b border-border/50"
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            >
                {isMobileMenuOpen ? <ChevronDown size={20} /> : <ChevronUp size={20} />}
            </button>

            <div className="flex-1 overflow-y-auto custom-scrollbar p-5 flex flex-col gap-6">
                {/* Tabs */}
                <div className="grid grid-cols-2 gap-1 bg-surface p-1 rounded-xl border border-border shrink-0">
                    <button 
                        onClick={() => { setActiveTab('filter'); setIsMobileMenuOpen(true); }}
                        className={`p-2.5 flex justify-center items-center gap-2 text-xs font-mono uppercase rounded-lg transition-all ${activeTab === 'filter' ? 'bg-text text-obsidian font-bold shadow-sm' : 'text-dim hover:text-white'}`}
                    >
                        <Sun size={14} /> {t.filters}
                    </button>
                    <button 
                        onClick={() => { setActiveTab('text'); setIsMobileMenuOpen(true); }}
                        className={`p-2.5 flex justify-center items-center gap-2 text-xs font-mono uppercase rounded-lg transition-all ${activeTab === 'text' ? 'bg-text text-obsidian font-bold shadow-sm' : 'text-dim hover:text-white'}`}
                    >
                        <Type size={14} /> {t.text}
                    </button>
                </div>

                {/* Zoom Control */}
                <div className="space-y-3 pb-6 border-b border-border shrink-0">
                    <div className="flex justify-between text-[10px] font-mono uppercase text-dim">
                        <span className="flex items-center gap-1"><ZoomIn size={10}/> {t.zoom}</span>
                        <span className="text-acid">{(scale * 100).toFixed(0)}%</span>
                    </div>
                    <div className="flex items-center gap-3 bg-surface p-2 rounded-xl border border-border">
                        <button onClick={() => handleZoomBtn(-0.1)} className="p-3 md:p-2 text-dim hover:text-white active:bg-panel rounded-lg transition-colors"><Minus size={16}/></button>
                        <input type="range" min="0.5" max="3" step="0.1" value={scale} onChange={(e) => setScale(parseFloat(e.target.value))} onMouseUp={() => pushToHistory({ scale })} onTouchEnd={() => pushToHistory({ scale })} className="flex-1 accent-acid h-1.5 bg-panel rounded-lg appearance-none cursor-pointer" />
                        <button onClick={() => handleZoomBtn(0.1)} className="p-3 md:p-2 text-dim hover:text-white active:bg-panel rounded-lg transition-colors"><Plus size={16}/></button>
                    </div>
                </div>

                {activeTab === 'filter' && (
                    <div className="space-y-6 animate-fade-in pb-8">
                        {/* Filters Icons */}
                        <div className="grid grid-cols-4 gap-2">
                            {FILTERS.map(f => (
                                <button key={f.id} onClick={() => setActiveFilter(f.id)} className={`flex flex-col items-center justify-center gap-2 p-3 rounded-xl transition-all ${activeFilter === f.id ? 'bg-acid text-black shadow-md scale-105 font-bold' : 'bg-surface text-dim hover:text-white border border-border'}`}>
                                    <f.icon size={20} />
                                    <span className="text-[9px] font-mono uppercase">{f.label}</span>
                                </button>
                            ))}
                        </div>
                        <div className="bg-surface p-4 rounded-xl border border-border space-y-4">
                            <div className="flex justify-between text-[10px] font-mono uppercase text-text font-bold">
                                <span>{FILTERS.find(f => f.id === activeFilter)?.label}</span>
                                <span className="text-acid">{filters[activeFilter]}%</span>
                            </div>
                            <input type="range" min={FILTERS.find(f => f.id === activeFilter)?.min} max={FILTERS.find(f => f.id === activeFilter)?.max} value={filters[activeFilter]} onChange={handleSliderChange} onMouseUp={handleSliderCommit} onTouchEnd={handleSliderCommit} className="w-full accent-acid h-1.5 bg-panel rounded-lg appearance-none cursor-pointer py-4 md:py-0" />
                        </div>
                    </div>
                )}

                {activeTab === 'text' && (
                    <div className="space-y-6 animate-fade-in pb-20 md:pb-8">
                        <div className="bg-surface border border-border rounded-xl overflow-hidden">
                            <div className="flex items-center justify-between p-3 bg-panel/50 border-b border-border">
                                <span className="text-[10px] font-mono uppercase text-dim flex items-center gap-2"><Layers size={12}/> Layers</span>
                                <button onClick={addText} className="p-1 text-acid hover:bg-acid/10 rounded-lg transition-colors"><Plus size={14} /></button>
                            </div>
                            <div className="max-h-[150px] overflow-y-auto custom-scrollbar p-1">
                                {texts.length === 0 && <div className="text-[10px] text-dim p-4 text-center">No text layers</div>}
                                {[...texts].reverse().map((t, i) => {
                                    const originalIndex = texts.length - 1 - i;
                                    return (
                                        <div key={t.id} className={`flex items-center justify-between p-2 rounded-lg mb-1 last:mb-0 group ${activeTextId === t.id ? 'bg-acid/10 border border-acid/20' : 'hover:bg-panel border border-transparent'}`}>
                                            <button onClick={() => setActiveTextId(t.id)} className="flex-1 text-left text-xs truncate mr-2 font-mono text-gray-300 hover:text-white">{t.text}</button>
                                            <div className="flex items-center gap-1 opacity-100 md:opacity-0 group-hover:opacity-100 transition-opacity">
                                                <button onClick={() => moveLayer(originalIndex, 'up')} disabled={originalIndex === texts.length - 1} className="p-1 hover:text-white text-dim disabled:opacity-20"><ArrowUp size={12} /></button>
                                                <button onClick={() => moveLayer(originalIndex, 'down')} disabled={originalIndex === 0} className="p-1 hover:text-white text-dim disabled:opacity-20"><ArrowDown size={12} /></button>
                                                <button onClick={() => { setActiveTextId(t.id); deleteActiveText(); }} className="p-1 hover:text-danger text-dim"><X size={12} /></button>
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>
                        </div>
                        
                        {activeTextId ? (
                            <div className="space-y-5 bg-surface p-4 rounded-xl border border-border">
                                <textarea 
                                    value={texts.find(t => t.id === activeTextId)?.text || ''}
                                    onChange={(e) => { updateActiveText('text', e.target.value); pushToHistory(); }}
                                    className="w-full bg-panel border border-border p-3 text-sm text-white font-mono outline-none focus:border-acid rounded-lg resize-y min-h-[80px] transition-colors"
                                    placeholder={t.typeHere}
                                />
                                
                                <div className="space-y-2">
                                    <label className="text-[10px] font-mono uppercase text-dim">Font Family</label>
                                    <div className="grid grid-cols-2 gap-2">
                                        {FONTS.map(font => (
                                            <button key={font.id} onClick={() => { updateActiveText('fontFamily', font.id); pushToHistory(); }} className={`px-2 py-3 md:py-2 text-[10px] uppercase border rounded-lg transition-all ${texts.find(t => t.id === activeTextId)?.fontFamily === font.id ? 'bg-acid text-black border-acid font-bold' : 'border-border text-dim hover:text-white bg-panel'}`}>{font.label}</button>
                                        ))}
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-mono uppercase text-dim block">Text Color</label>
                                        <div className="flex gap-2 flex-wrap">
                                            {COLORS.map(c => (
                                                <button key={c.id} onClick={() => { updateActiveText('color', c.id); pushToHistory(); }} className={`w-8 h-8 md:w-6 md:h-6 rounded-full border transition-transform hover:scale-110 ${texts.find(t => t.id === activeTextId)?.color === c.id ? 'border-white ring-2 ring-acid' : 'border-transparent'}`} style={{ backgroundColor: c.id === 'transparent' ? '#333' : c.id }} title={c.label}>
                                                    {c.id === 'transparent' && <X size={12} className="text-dim m-auto"/>}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-mono uppercase text-dim block">Background</label>
                                        <div className="flex gap-2 flex-wrap">
                                            {COLORS.map(c => (
                                                <button key={c.id} onClick={() => { updateActiveText('backgroundColor', c.id); pushToHistory(); }} className={`w-8 h-8 md:w-6 md:h-6 rounded-full border transition-transform hover:scale-110 ${texts.find(t => t.id === activeTextId)?.backgroundColor === c.id ? 'border-white ring-2 ring-acid' : 'border-transparent'}`} style={{ backgroundColor: c.id === 'transparent' ? '#333' : c.id }} title={c.label}>
                                                    {c.id === 'transparent' && <X size={12} className="text-dim m-auto"/>}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                     <div className="space-y-2">
                                        <label className="text-[10px] font-mono uppercase text-dim">Stroke</label>
                                        <input type="range" min="0" max="0.03" step="0.001" value={texts.find(t => t.id === activeTextId)?.strokeWidth || 0} onChange={(e) => updateActiveText('strokeWidth', parseFloat(e.target.value))} onMouseUp={() => pushToHistory()} className="w-full accent-acid h-1.5 bg-panel rounded-lg appearance-none cursor-pointer py-3 md:py-0" />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-mono uppercase text-dim">Padding</label>
                                        <input type="range" min="0" max="1" step="0.1" value={texts.find(t => t.id === activeTextId)?.padding || 0.2} onChange={(e) => updateActiveText('padding', parseFloat(e.target.value))} onMouseUp={() => pushToHistory()} className="w-full accent-acid h-1.5 bg-panel rounded-lg appearance-none cursor-pointer py-3 md:py-0" />
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <div className="flex justify-between text-[10px] font-mono uppercase text-dim"><span>{t.size}</span></div>
                                    <input type="range" min="0.02" max="0.3" step="0.01" value={texts.find(t => t.id === activeTextId)?.fontSize || 0.1} onChange={(e) => updateActiveText('fontSize', parseFloat(e.target.value))} onMouseUp={() => pushToHistory()} className="w-full accent-acid h-1.5 bg-panel rounded-lg appearance-none cursor-pointer py-3 md:py-0" />
                                </div>

                                <button onClick={deleteActiveText} className="w-full py-4 md:py-3 bg-danger text-white text-xs font-mono uppercase flex items-center justify-center gap-2 rounded-lg hover:bg-red-600 transition-colors shadow-lg mt-4"><Trash2 size={16} /> {t.removeText}</button>
                            </div>
                        ) : (
                            <div className="text-center py-8 text-dim font-mono text-xs uppercase border border-dashed border-border rounded-xl bg-surface/50">{t.selectTextPrompt}</div>
                        )}
                    </div>
                )}
            </div>
        </div>
      </div>

      {/* Footer Actions */}
      <div className="hidden md:flex w-full p-4 border-t border-border bg-panel justify-end gap-4 shrink-0 z-30">
        <button onClick={onCancel} className="px-8 py-3 border border-border text-dim hover:text-white font-mono text-xs uppercase transition-colors rounded-xl hover:bg-surface">{t.cancel}</button>
        <button onClick={handleSave} className="px-8 py-3 bg-text text-obsidian hover:bg-acid font-mono text-xs font-bold uppercase transition-colors flex items-center gap-2 rounded-xl shadow-lg hover:shadow-acid/20"><Save size={16} /> {t.saveChanges}</button>
      </div>
    </div>
  );
};

export default ImageEditor;
