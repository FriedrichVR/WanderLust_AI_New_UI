
import React, { useState, useRef, useEffect } from 'react';
import { Calendar, Plus, MapPin, Trash2, Search, Loader2, ExternalLink, Clock, CheckCircle2, Circle, AlertTriangle, Image as ImageIcon, Upload, X, ZoomIn, FileText, ChevronLeft, ChevronRight, Cloud, Share2, Download, CloudRain } from 'lucide-react';
import { Trip, Activity, MapsSearchResult, DayPlan, InfoBlock } from '../types';
import { searchPlacesWithGemini, getWeatherForecast } from '../services/geminiService';
import { translations, Language } from '../utils/translations';
import { ToastType } from './Toast';
import Tooltip from './Tooltip';
import LazyImage from './LazyImage';

interface Props {
  trip: Trip;
  updateTrip: (t: Trip) => void;
  lang: Language;
  showToast?: (msg: string, type: ToastType) => void;
}

const TripItinerary: React.FC<Props> = ({ trip, updateTrip, lang, showToast }) => {
  const [activeDayId, setActiveDayId] = useState<string>(trip.itinerary[0]?.id || '');
  const [showAddModal, setShowAddModal] = useState(false);
  const [taskInput, setTaskInput] = useState('');
  const [taskDueDate, setTaskDueDate] = useState('');
  const [dayToDelete, setDayToDelete] = useState<string | null>(null);
  const [taskToDelete, setTaskToDelete] = useState<string | null>(null);
  const [imageDeletionTarget, setImageDeletionTarget] = useState<{ dayId: string, index: number, blockId?: string } | null>(null);
  const [blockToDelete, setBlockToDelete] = useState<string | null>(null);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  
  // State for location editing
  const [activityEditingLocation, setActivityEditingLocation] = useState<string | null>(null);

  const t = translations[lang];
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<MapsSearchResult[]>([]);
  
  const [uploadTargetBlockId, setUploadTargetBlockId] = useState<string | null>(null); 
  const fileInputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const [weatherInfo, setWeatherInfo] = useState<{ temp: string; condition: string; description: string } | null>(null);
  const [loadingWeather, setLoadingWeather] = useState(false);

  const currentDay = trip.itinerary.find(d => d.id === activeDayId);

    const MAX_IMAGES_PER_TRIP = 5;

    const getTotalTripImages = () => {
        return trip.itinerary.reduce((acc, day) => {
            const dayCount = day.images?.length || 0;
            const blocksCount = day.infoBlocks?.reduce((bAcc, b) => bAcc + (b.images?.length || 0), 0) || 0;
            return acc + dayCount + blocksCount;
        }, 0);
    };

    const remainingImageSlots = () => Math.max(0, MAX_IMAGES_PER_TRIP - getTotalTripImages());

  useEffect(() => {
    const fetchWeather = async () => {
        if (currentDay) {
            setLoadingWeather(true);
            const location = currentDay.location || trip.destination;
            const forecast = await getWeatherForecast(location, currentDay.date);
            setWeatherInfo(forecast);
            setLoadingWeather(false);
        }
    };
    fetchWeather();
  }, [activeDayId, currentDay?.location, trip.destination]);

  const handleAddDay = () => {
    const lastDay = trip.itinerary[trip.itinerary.length - 1];
    let nextDate = new Date(trip.startDate);
    if (lastDay) { nextDate = new Date(lastDay.date); nextDate.setDate(nextDate.getDate() + 1); }
    const newDay: DayPlan = { id: Date.now().toString(), date: nextDate.toISOString(), activities: [] };
    
    updateTrip({ 
        ...trip, 
        itinerary: [...trip.itinerary, newDay],
        endDate: nextDate.toISOString()
    });
    setActiveDayId(newDay.id);
    if (showToast) showToast("New day added to itinerary.", 'success');
  };

  const handleDeleteDay = () => {
    if (!dayToDelete) return;
    const newItinerary = trip.itinerary.filter(d => d.id !== dayToDelete);
    
    if (activeDayId === dayToDelete) {
        setActiveDayId(newItinerary.length > 0 ? newItinerary[0].id : '');
    }

    let newEndDate = trip.startDate;
    if (newItinerary.length > 0) {
        const last = newItinerary[newItinerary.length - 1];
        newEndDate = last.date;
    }

    updateTrip({ 
        ...trip, 
        itinerary: newItinerary,
        endDate: newEndDate
    });
    setDayToDelete(null);
    if (showToast) showToast("Day deleted from itinerary.", 'info');
  };

  const handleAddTask = () => {
    if (!taskInput.trim()) return;
    updateTrip({ 
        ...trip, 
        checklist: [
            ...trip.checklist, 
            { 
                id: Date.now().toString(), 
                task: taskInput, 
                completed: false,
                dueDate: taskDueDate || undefined 
            }
        ] 
    });
    setTaskInput('');
    setTaskDueDate('');
  };

  const handleDeleteTask = () => {
      if (taskToDelete) {
          updateTrip({...trip, checklist: trip.checklist.filter(c => c.id !== taskToDelete)});
          setTaskToDelete(null);
      }
  };

  const handleUpdateTaskDate = (id: string, date: string) => {
      const updatedChecklist = trip.checklist.map(c => c.id === id ? { ...c, dueDate: date } : c);
      updateTrip({ ...trip, checklist: updatedChecklist });
  };

  const handleSelectPlace = (place: MapsSearchResult) => {
    const updatedItinerary = trip.itinerary.map(day => {
      if (day.id === activeDayId) {
        if (activityEditingLocation) {
            // Update existing activity location
            return {
                ...day,
                activities: day.activities.map(act => 
                    act.id === activityEditingLocation 
                    ? { ...act, locationName: place.title, locationAddress: place.address } 
                    : act
                )
            };
        } else {
            // Add new activity
            return { ...day, activities: [...day.activities, { id: Date.now().toString(), title: place.title, description: place.summary || 'Manual Entry', locationName: place.title, locationAddress: place.address, completed: false, startTime: '09:00' }] };
        }
      }
      return day;
    });
    updateTrip({ ...trip, itinerary: updatedItinerary });
    setSearchResults([]); setSearchQuery(''); setShowAddModal(false);
    setActivityEditingLocation(null);
    if (showToast) showToast(activityEditingLocation ? "Location updated." : "Activity added.", 'success');
  };

  const openSearchForActivity = (activity: Activity) => {
      setActivityEditingLocation(activity.id);
      setSearchQuery(activity.title); // Pre-fill search with title
      setSearchResults([]);
      setShowAddModal(true);
  };

  const openSearchNew = () => {
      setActivityEditingLocation(null);
      setSearchQuery('');
      setSearchResults([]);
      setShowAddModal(true);
  };

  const handleSearch = async () => {
    if (!searchQuery) return;
    setIsSearching(true);
    try {
        const results = await searchPlacesWithGemini(searchQuery, trip.destination);
        setSearchResults(results);
    } catch (e: any) {
        if (showToast) showToast(e.message || "Search failed.", 'error');
    } finally {
        setIsSearching(false);
    }
  };

  const handleUpdateDayLog = (updates: Partial<DayPlan>) => {
      const updated = trip.itinerary.map(d => d.id === activeDayId ? { ...d, ...updates } : d);
      updateTrip({ ...trip, itinerary: updated });
  };

  const confirmDeleteImage = () => {
    if (!imageDeletionTarget) return;
    const { dayId, index, blockId } = imageDeletionTarget;

    const updatedItinerary = trip.itinerary.map(day => {
        if (day.id === dayId) {
            if (blockId && day.infoBlocks) {
                return {
                    ...day,
                    infoBlocks: day.infoBlocks.map(b => {
                        if (b.id === blockId && b.images) {
                            return { ...b, images: b.images.filter((_, i) => i !== index) };
                        }
                        return b;
                    })
                };
            }
            if (!blockId && day.images) {
                return {
                    ...day,
                    images: day.images.filter((_, i) => i !== index)
                };
            }
        }
        return day;
    });
    updateTrip({ ...trip, itinerary: updatedItinerary });
    setImageDeletionTarget(null);
    if (showToast) showToast("Image removed.", 'info');
  };

  const triggerImageUpload = (blockId: string | null) => {
        const slots = remainingImageSlots();
        if (slots <= 0) {
            if (showToast) showToast(`Máximo ${MAX_IMAGES_PER_TRIP} imágenes por viaje.`, 'warning');
            return;
        }
        setUploadTargetBlockId(blockId);
        fileInputRef.current?.click();
  };

  const resizeImage = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
        if (!file.type.startsWith('image/')) {
            const reader = new FileReader();
            reader.onload = (e) => resolve(e.target?.result as string);
            reader.onerror = reject;
            reader.readAsDataURL(file);
            return;
        }
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = (event) => {
            const img = new Image();
            img.src = event.target?.result as string;
            img.onload = () => {
                // Aggressive Compression for Bandwidth Optimization
                const MAX_WIDTH = 800;
                const MAX_HEIGHT = 800;
                let width = img.width;
                let height = img.height;
                if (width > height) {
                    if (width > MAX_WIDTH) { height *= MAX_WIDTH / width; width = MAX_WIDTH; }
                } else {
                    if (height > MAX_HEIGHT) { width *= MAX_HEIGHT / height; height = MAX_HEIGHT; }
                }
                const canvas = document.createElement('canvas');
                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx?.drawImage(img, 0, 0, width, height);
                // Lower quality to 0.6
                resolve(canvas.toDataURL('image/jpeg', 0.6));
            };
            img.onerror = reject;
        };
        reader.onerror = reject;
    });
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && e.target.files.length > 0) {
          try {
              const newImages: string[] = await Promise.all(
                  Array.from(e.target.files).map(file => resizeImage(file as File))
              );

              const existingTotal = getTotalTripImages();
              if (existingTotal >= MAX_IMAGES_PER_TRIP) {
                  if (fileInputRef.current) fileInputRef.current.value = '';
                  if (showToast) showToast(`Máximo ${MAX_IMAGES_PER_TRIP} imágenes por viaje.`, 'warning');
                  return;
              }

              const allowedCount = Math.min(newImages.length, MAX_IMAGES_PER_TRIP - existingTotal);
              const imagesToAdd = newImages.slice(0, allowedCount);

              if (uploadTargetBlockId) {
                  const currentBlocks = currentDay?.infoBlocks || [];
                  const updatedBlocks = currentBlocks.map(b => {
                      if (b.id === uploadTargetBlockId) {
                          return { ...b, images: [...(b.images || []), ...imagesToAdd] };
                      }
                      return b;
                  });
                  handleUpdateDayLog({ infoBlocks: updatedBlocks });
              } else {
                  const currentImages = currentDay?.images || [];
                  handleUpdateDayLog({ images: [...currentImages, ...imagesToAdd] });
              }

              if (imagesToAdd.length < newImages.length) {
                  if (showToast) showToast(`Sólo se añadieron ${imagesToAdd.length} imágenes (límite alcanzado).`, 'info');
              }
              if (fileInputRef.current) fileInputRef.current.value = '';
              if (showToast) showToast("Images uploaded successfully.", 'success');
          } catch (e) {
              console.error("Upload error", e);
              if (showToast) showToast("Failed to upload image(s).", 'error');
          }
      }
  };

  const handleAddInfoBlock = () => {
      const newBlock: InfoBlock = {
          id: crypto.randomUUID(),
          title: '',
          content: '',
          location: '',
          images: []
      };
      const currentBlocks = currentDay?.infoBlocks || [];
      handleUpdateDayLog({ infoBlocks: [...currentBlocks, newBlock] });
  };

  const handleUpdateInfoBlock = (blockId: string, field: keyof InfoBlock, value: any) => {
      const currentBlocks = currentDay?.infoBlocks || [];
      const updatedBlocks = currentBlocks.map(b => b.id === blockId ? { ...b, [field]: value } : b);
      handleUpdateDayLog({ infoBlocks: updatedBlocks });
  };

  const confirmDeleteBlock = () => {
      if (!blockToDelete) return;
      const currentBlocks = currentDay?.infoBlocks || [];
      handleUpdateDayLog({ infoBlocks: currentBlocks.filter(b => b.id !== blockToDelete) });
      setBlockToDelete(null);
      if (showToast) showToast("Info block deleted.", 'info');
  };

  const scrollNav = (direction: 'left' | 'right') => {
      if (scrollRef.current) {
          const container = scrollRef.current;
          const scrollAmount = 240;
          const targetScroll = direction === 'left' 
            ? container.scrollLeft - scrollAmount 
            : container.scrollLeft + scrollAmount;
          
          container.scrollTo({
              left: targetScroll,
              behavior: 'smooth'
          });
      }
  };

  const downloadDayPlan = () => {
      if (!currentDay) return;
      const dateStr = new Date(currentDay.date).toLocaleDateString();
      const locationStr = currentDay.location || trip.destination;
      let content = `TRIP: ${trip.destination.toUpperCase()}\nDATE: ${dateStr}\nLOCATION: ${locationStr}\n\n`;
      
      if (weatherInfo) {
          content += `--- WEATHER ---\n${weatherInfo.condition} | ${weatherInfo.temp}\n${weatherInfo.description}\n\n`;
      }

      content += `--- NOTES ---\n${currentDay.notes || 'No notes'}\n\n--- ACTIVITIES ---\n`;
      currentDay.activities.forEach(act => {
          content += `[${act.startTime}] ${act.title}\n  Location: ${act.locationAddress || 'N/A'}\n  Details: ${act.description}\n\n`;
      });

      if (currentDay.infoBlocks && currentDay.infoBlocks.length > 0) {
          content += `--- INFO BLOCKS ---\n`;
          currentDay.infoBlocks.forEach(block => {
              content += `## ${block.title}\n${block.content}\n\n`;
          });
      }

      const blob = new Blob([content], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `DayPlan_${dateStr.replace(/\//g, '-')}.txt`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      if (showToast) showToast("Itinerary downloaded.", 'success');
  };

  // ... (Drag and drop logic same as previous) ...
  const handleDragStart = (e: React.DragEvent, index: number, type: 'dayImage' | 'blockImage', blockId?: string) => {
    e.dataTransfer.setData('index', index.toString());
    e.dataTransfer.setData('type', type);
    if (blockId) e.dataTransfer.setData('blockId', blockId);
  };

  const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); };

  const handleDrop = (e: React.DragEvent, targetIndex: number, targetType: 'dayImage' | 'blockImage', targetBlockId?: string) => {
    e.preventDefault();
    const sourceIndex = parseInt(e.dataTransfer.getData('index'));
    const sourceType = e.dataTransfer.getData('type');
    const sourceBlockId = e.dataTransfer.getData('blockId');

    if (sourceType !== targetType) return;
    if (targetType === 'blockImage' && sourceBlockId !== targetBlockId) return;

    if (targetType === 'dayImage') {
        const currentImages = [...(currentDay?.images || [])];
        const [movedItem] = currentImages.splice(sourceIndex, 1);
        currentImages.splice(targetIndex, 0, movedItem);
        handleUpdateDayLog({ images: currentImages });
    } else if (targetType === 'blockImage' && targetBlockId) {
        const currentBlocks = currentDay?.infoBlocks || [];
        const updatedBlocks = currentBlocks.map(block => {
            if (block.id === targetBlockId) {
                const currentImages = [...(block.images || [])];
                const [movedItem] = currentImages.splice(sourceIndex, 1);
                currentImages.splice(targetIndex, 0, movedItem);
                return { ...block, images: currentImages };
            }
            return block;
        });
        handleUpdateDayLog({ infoBlocks: updatedBlocks });
    }
  };

    const totalRemainingSlots = remainingImageSlots();

  return (
    <div className="animate-fade-in pt-6">
      
      {/* Day Nav */}
      <div className="relative group/nav mb-8">
         <button 
            onClick={() => scrollNav('left')} 
            className="hidden md:flex absolute left-0 top-0 bottom-4 z-20 w-10 items-center justify-center bg-obsidian border border-border text-dim hover:text-white transition-colors rounded-xl shadow-md hover:border-acid/50"
         >
             <ChevronLeft size={24} />
         </button>
         
         <div ref={scrollRef} className="flex overflow-x-auto gap-3 pb-4 scroll-smooth custom-scrollbar px-1 md:px-12 no-scrollbar">
            {trip.itinerary.map((day, index) => {
                const date = new Date(day.date);
                const isActive = activeDayId === day.id;
                return (
                    <button
                        key={day.id}
                        onClick={() => setActiveDayId(day.id)}
                        className={`flex-shrink-0 w-20 h-24 flex flex-col items-center justify-center border transition-all duration-300 relative overflow-hidden rounded-2xl ${
                            isActive ? 'bg-text text-obsidian border-text scale-105 font-bold shadow-lg' : 'bg-surface border-border text-dim hover:border-dim hover:bg-panel'
                        }`}
                    >
                        <span className="font-mono text-xs z-10 mb-1">DAY {index + 1}</span>
                        <span className="font-display text-2xl z-10">{date.getDate()}</span>
                        <span className="font-mono text-[9px] z-10 opacity-70">{date.toLocaleDateString(lang, { weekday: 'short' })}</span>
                    </button>
                );
            })}
            <button onClick={handleAddDay} className="flex-shrink-0 w-20 h-24 flex items-center justify-center border border-dashed border-dim text-dim hover:text-white hover:border-white transition-colors bg-transparent rounded-2xl">
                <Plus size={24} />
            </button>
         </div>

         <button 
            onClick={() => scrollNav('right')} 
            className="hidden md:flex absolute right-0 top-0 bottom-4 z-20 w-10 items-center justify-center bg-obsidian border border-border text-dim hover:text-white transition-colors rounded-xl shadow-md hover:border-acid/50"
         >
             <ChevronRight size={24} />
         </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Timeline */}
        <div key={activeDayId} className="lg:col-span-2 space-y-6 animate-fade-in">
            <div className="flex justify-between items-center flex-wrap gap-4 bg-surface p-4 rounded-2xl border border-border">
                <div className="flex flex-col">
                    <h3 className="font-display text-xl text-text uppercase tracking-tight">
                        {currentDay ? new Date(currentDay.date).toLocaleDateString(lang, { weekday: 'long', month: 'long', day: 'numeric' }) : 'No Selection'}
                    </h3>
                    {loadingWeather ? (
                         <div className="flex items-center gap-2 text-dim text-xs font-mono mt-1">
                             <Loader2 size={12} className="animate-spin" /> Checking forecast...
                         </div>
                    ) : weatherInfo ? (
                         <div className="flex items-center gap-3 mt-1 animate-fade-in">
                             <div className="flex items-center gap-1 text-acid font-mono text-xs font-bold">
                                 {weatherInfo.condition?.toLowerCase()?.includes('rain') ? <CloudRain size={14}/> : <Cloud size={14}/>}
                                 {weatherInfo.temp}
                             </div>
                             <span className="text-[10px] font-mono text-dim border-l border-border pl-2 uppercase">{weatherInfo.condition} // {weatherInfo.description}</span>
                         </div>
                    ) : (
                        <span className="text-[10px] font-mono text-dim mt-1">Weather unavailable</span>
                    )}

                    {/* Passengers section */}
                    <div className="mt-3 space-y-1">
                        { (trip.passengers && trip.passengers.length > 0 ? trip.passengers : ['PASAJERO 1', 'PASAJERO 2']).map((p, idx) => (
                            <div key={idx} className="flex items-center justify-between bg-panel border border-border px-3 py-2 rounded-xl">
                                <span className="text-[10px] font-mono text-dim uppercase tracking-widest">{p}</span>
                                <span className="text-[10px] font-mono text-text uppercase">—</span>
                            </div>
                        ))}
                    </div>
                </div>

                {currentDay && (
                    <div className="flex gap-2">
                         <button onClick={downloadDayPlan} className="p-2 bg-panel text-dim hover:text-text hover:bg-border transition-colors rounded-full" title={t.exportPlan}>
                            <Download size={18}/>
                        </button>
                        <button onClick={() => setDayToDelete(currentDay.id)} className="p-2 bg-panel text-dim hover:text-danger hover:bg-border transition-colors rounded-full" title="Delete Day">
                            <Trash2 size={18}/>
                        </button>
                        <button onClick={openSearchNew} className="px-4 py-2 bg-text text-obsidian font-mono text-xs font-bold uppercase hover:bg-acid transition-colors flex items-center gap-2 rounded-full">
                            <MapPin size={14} /> {t.addPoint}
                        </button>
                    </div>
                )}
            </div>

            <input type="file" ref={fileInputRef} className="hidden" accept="image/*" multiple onChange={handleImageUpload} />

            {/* Day Log */}
            {currentDay && (
                <div className="space-y-6">
                    <div className="bg-surface border border-border p-6 rounded-3xl">
                        <div className="flex flex-col gap-4">
                            <div className="space-y-2">
                                <label className="font-mono text-[10px] text-acid uppercase tracking-widest">{t.dayLog}</label>
                                <textarea 
                                    value={currentDay.notes || ''} 
                                    onChange={e => handleUpdateDayLog({ notes: e.target.value })}
                                    className="w-full bg-panel border border-border p-4 text-sm text-text focus:border-acid outline-none min-h-[100px] transition-colors rounded-xl resize-y"
                                    placeholder="// Write your notes here..."
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="font-mono text-[10px] text-acid uppercase tracking-widest">{t.baseLocation}</label>
                                <input 
                                    type="text" 
                                    value={currentDay.location || ''}
                                    onChange={e => handleUpdateDayLog({ location: e.target.value })}
                                    className="w-full bg-panel border border-border p-3 text-sm text-text focus:border-acid outline-none mb-2 transition-colors rounded-xl"
                                    placeholder="City or Hotel..."
                                />
                                <div className="flex gap-3 overflow-x-auto py-2 custom-scrollbar">
                                    {currentDay.images?.map((img, i) => (
                                        <div 
                                            key={i} 
                                            className="relative group flex-shrink-0 w-20 h-20 rounded-xl overflow-hidden cursor-move"
                                            draggable
                                            onDragStart={(e) => handleDragStart(e, i, 'dayImage')}
                                            onDragOver={handleDragOver}
                                            onDrop={(e) => handleDrop(e, i, 'dayImage')}
                                        >
                                            <LazyImage 
                                                src={img} 
                                                alt="Day Image"
                                                className="w-full h-full object-cover hover:scale-110 transition-transform duration-300" 
                                                onClick={() => setPreviewImage(img)}
                                            />
                                            <button 
                                                onClick={(e) => { e.stopPropagation(); setImageDeletionTarget({ dayId: currentDay.id, index: i, blockId: undefined }); }}
                                                className="absolute top-1 right-1 bg-black/50 text-white hover:bg-red-500 rounded-full p-1 opacity-0 group-hover:opacity-100 transition-all"
                                                title="Delete Image"
                                            >
                                                <X size={12} />
                                            </button>
                                        </div>
                                    ))}
                                    <button onClick={() => triggerImageUpload(null)} disabled={totalRemainingSlots === 0} className={`flex-shrink-0 w-20 h-20 border border-dashed border-dim flex items-center justify-center text-dim hover:text-white hover:border-white transition-colors rounded-xl ${totalRemainingSlots === 0 ? 'opacity-40 cursor-not-allowed' : ''}`}>
                                        <ImageIcon size={24} />
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Info Blocks */}
                    {currentDay.infoBlocks?.map(block => (
                        <div key={block.id} className="bg-surface border border-border p-6 relative group animate-fade-in rounded-3xl">
                            <button 
                                onClick={() => setBlockToDelete(block.id)}
                                className="absolute top-4 right-4 text-dim hover:text-danger opacity-0 group-hover:opacity-100 transition-opacity p-2"
                            >
                                <X size={18} />
                            </button>
                            
                            <div className="mb-4 pr-8">
                                <input 
                                    type="text" 
                                    value={block.title}
                                    onChange={e => handleUpdateInfoBlock(block.id, 'title', e.target.value)}
                                    className="w-full bg-transparent border-b border-border p-2 text-lg font-bold text-text placeholder-dim/50 focus:border-acid outline-none transition-colors"
                                    placeholder="BLOCK TITLE"
                                />
                            </div>

                            <div className="flex flex-col gap-4">
                                <textarea 
                                    value={block.content}
                                    onChange={e => handleUpdateInfoBlock(block.id, 'content', e.target.value)}
                                    className="w-full bg-panel border border-border p-4 text-sm text-text focus:border-acid outline-none min-h-[100px] transition-colors rounded-xl"
                                    placeholder="Content details..."
                                />
                                
                                <div className="space-y-2">
                                     <div className="flex gap-3 overflow-x-auto py-2 custom-scrollbar">
                                        {block.images?.map((img, i) => (
                                            <div 
                                                key={i} 
                                                className="relative group/img flex-shrink-0 w-20 h-20 rounded-xl overflow-hidden cursor-move"
                                                draggable
                                                onDragStart={(e) => handleDragStart(e, i, 'blockImage', block.id)}
                                                onDragOver={handleDragOver}
                                                onDrop={(e) => handleDrop(e, i, 'blockImage', block.id)}
                                            >
                                                <LazyImage 
                                                    src={img} 
                                                    alt="Block Image"
                                                    className="w-full h-full object-cover hover:scale-110 transition-transform duration-300" 
                                                    onClick={() => setPreviewImage(img)}
                                                />
                                                <button 
                                                    onClick={(e) => { e.stopPropagation(); setImageDeletionTarget({ dayId: currentDay.id, index: i, blockId: block.id }); }}
                                                    className="absolute top-1 right-1 bg-black/50 text-white hover:bg-red-500 rounded-full p-1 opacity-0 group-hover/img:opacity-100 transition-all"
                                                    title="Delete Image"
                                                >
                                                    <X size={12} />
                                                </button>
                                            </div>
                                        ))}
                                        <button onClick={() => triggerImageUpload(block.id)} disabled={totalRemainingSlots === 0} className={`flex-shrink-0 w-20 h-20 border border-dashed border-dim flex items-center justify-center text-dim hover:text-white hover:border-white transition-colors rounded-xl ${totalRemainingSlots === 0 ? 'opacity-40 cursor-not-allowed' : ''}`}>
                                            <ImageIcon size={24} />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))}

                    <button 
                        onClick={handleAddInfoBlock}
                        className="w-full py-4 border border-dashed border-dim text-dim hover:text-acid hover:border-acid hover:bg-acid/5 font-mono text-xs uppercase transition-all flex items-center justify-center gap-2 group rounded-2xl"
                    >
                        <Plus size={14} className="group-hover:scale-110 transition-transform" /> {t.addInfoBlock}
                    </button>
                </div>
            )}

            <div className="relative border-l-2 border-border ml-4 pl-8 space-y-8 py-4 mt-8">
                {!currentDay || currentDay.activities.length === 0 ? (
                    <div className="text-dim font-mono text-xs uppercase tracking-widest pl-2">{t.timelineEmpty}</div>
                ) : (
                    currentDay.activities.map((activity) => (
                        <div key={activity.id} className="relative group">
                            {/* Dot */}
                            <div className="absolute -left-[41px] top-6 w-6 h-6 bg-surface border-4 border-border group-hover:border-acid rounded-full transition-colors z-10"></div>
                            
                            <div className="bg-surface border border-border p-6 hover:border-dim transition-colors group rounded-3xl shadow-sm relative">
                                <div className="flex justify-between items-start mb-3">
                                    <div className="font-mono text-xs font-bold text-acid bg-acid/10 px-3 py-1 rounded-full">{activity.startTime}</div>
                                    <button 
                                        onClick={() => {
                                            const updated = trip.itinerary.map(d => d.id === activeDayId ? {...d, activities: d.activities.filter(a => a.id !== activity.id)} : d);
                                            updateTrip({...trip, itinerary: updated});
                                        }}
                                        className="text-dim hover:text-danger opacity-0 group-hover:opacity-100 transition-opacity p-1"
                                    >
                                        <Trash2 size={16} />
                                    </button>
                                </div>
                                <h4 className="font-bold text-lg text-text mb-1">{activity.title}</h4>
                                <button 
                                    onClick={() => openSearchForActivity(activity)}
                                    className="text-xs text-dim hover:text-acid font-mono mb-4 flex items-center gap-1 transition-colors text-left group/loc"
                                    title={t.locateTarget}
                                >
                                    <MapPin size={12} className="group-hover/loc:scale-110 transition-transform" /> 
                                    {activity.locationAddress || 'Set Location'}
                                </button>
                                <p className="text-sm text-gray-400 leading-relaxed">{activity.description}</p>
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>

        {/* Checklist */}
        <div className="bg-surface border border-border h-fit sticky top-24 rounded-3xl shadow-lg overflow-hidden">
            <div className="p-5 border-b border-border bg-panel/50">
                <h3 className="font-mono text-xs text-acid uppercase tracking-widest flex items-center gap-2">
                    <CheckCircle2 size={16} /> {t.logisticsCheck}
                </h3>
            </div>
            <div className="p-2 max-h-[400px] overflow-y-auto custom-scrollbar">
                {trip.checklist.map(item => (
                    <div key={item.id} className="flex items-start gap-3 p-3 hover:bg-panel transition-colors group border-b border-border/30 last:border-0 rounded-xl">
                        <div 
                            className={`w-5 h-5 mt-0.5 border flex items-center justify-center transition-colors shrink-0 cursor-pointer rounded-md ${item.completed ? 'bg-acid border-acid text-black' : 'border-dim'}`}
                            onClick={() => {
                                const updatedChecklist = trip.checklist.map(c => c.id === item.id ? {...c, completed: !c.completed} : c);
                                updateTrip({...trip, checklist: updatedChecklist});
                            }}
                        >
                            {item.completed && <CheckCircle2 size={14} />}
                        </div>
                        <div className="flex-1">
                             <div className={`text-sm font-medium mb-1 ${item.completed ? 'text-dim line-through' : 'text-text'}`}>{item.task}</div>
                             <div className="flex items-center gap-2">
                                 <div className="flex items-center gap-1.5 bg-panel/50 hover:bg-panel border border-transparent hover:border-border px-2 py-1 rounded-lg transition-all cursor-pointer group/date">
                                     <Calendar size={10} className={item.dueDate ? "text-acid" : "text-dim group-hover/date:text-text"} />
                                     <input 
                                        type="date" 
                                        className="bg-transparent text-[10px] text-dim font-mono border-none outline-none hover:text-text cursor-pointer w-auto p-0 uppercase"
                                        value={item.dueDate || ''}
                                        onChange={(e) => handleUpdateTaskDate(item.id, e.target.value)}
                                    />
                                 </div>
                                 {item.dueDate && !item.completed && new Date(item.dueDate) < new Date() && (
                                     <span className="text-[9px] text-danger font-bold bg-danger/10 px-1.5 py-0.5 rounded-sm flex items-center gap-1 animate-pulse">
                                         <AlertTriangle size={8} /> OVERDUE
                                     </span>
                                 )}
                             </div>
                        </div>
                        <button 
                            onClick={() => setTaskToDelete(item.id)}
                            className="text-dim hover:text-danger opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                            <Trash2 size={14} />
                        </button>
                    </div>
                ))}
            </div>
            <div className="p-4 border-t border-border bg-panel/30">
                <div className="flex flex-col gap-2">
                    <input 
                        type="text" 
                        placeholder={t.addTask}
                        value={taskInput}
                        onChange={(e) => setTaskInput(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleAddTask()}
                        className="w-full bg-surface border border-border px-4 py-2.5 text-sm text-text focus:border-acid outline-none rounded-xl transition-colors" 
                    />
                    <div className="flex gap-2">
                        <div className="flex-1 bg-surface border border-border px-3 py-2 rounded-xl flex items-center gap-2">
                            <Calendar size={14} className="text-dim" />
                            <input 
                                type="date"
                                value={taskDueDate}
                                onChange={(e) => setTaskDueDate(e.target.value)}
                                className="w-full bg-transparent text-xs text-dim focus:text-text outline-none"
                            />
                        </div>
                        <button onClick={handleAddTask} disabled={!taskInput.trim()} className="bg-text text-obsidian px-4 py-2 text-xs font-bold hover:bg-acid transition-colors uppercase rounded-xl">{t.add}</button>
                    </div>
                </div>
            </div>
        </div>
      </div>

      {/* Add Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-surface w-full max-w-lg border border-border shadow-2xl p-8 rounded-3xl">
                <div className="flex justify-between items-center mb-6 pb-4 border-b border-border">
                    <h3 className="font-display text-xl text-text uppercase tracking-wide">
                        {activityEditingLocation ? 'Update Location' : t.locateTarget}
                    </h3>
                    <button onClick={() => { setShowAddModal(false); setActivityEditingLocation(null); }} className="text-dim hover:text-text"><X size={24} /></button>
                </div>
                <div className="flex gap-2 mb-6">
                    <input 
                        type="text" 
                        placeholder={t.searchQuery}
                        className="flex-1 bg-panel border border-border px-4 py-3 text-sm text-text font-mono focus:border-acid outline-none rounded-xl"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                        autoFocus
                    />
                    <button onClick={handleSearch} disabled={isSearching} className="bg-acid text-black px-6 font-bold text-xs uppercase tracking-widest hover:bg-white transition-colors rounded-xl">
                        {isSearching ? t.scanning : t.scan}
                    </button>
                </div>
                <div className="space-y-2 max-h-[300px] overflow-y-auto custom-scrollbar">
                    {searchResults.map((place, idx) => (
                        <div key={idx} className="p-4 border border-border hover:border-acid transition-colors group bg-panel rounded-xl flex flex-col gap-2 relative">
                            <div className="cursor-pointer" onClick={() => handleSelectPlace(place)}>
                                <div className="flex justify-between items-start">
                                    <h4 className="font-bold text-text group-hover:text-acid transition-colors">{place.title}</h4>
                                    <Plus size={16} className="text-dim group-hover:text-acid opacity-0 group-hover:opacity-100 transition-all" />
                                </div>
                                <p className="text-xs text-dim font-mono mt-1 pr-6">{place.address}</p>
                            </div>
                            {place.uri && (
                                <div className="mt-2 pt-2 border-t border-border/50">
                                    <a href={place.uri} target="_blank" rel="noopener noreferrer" className="text-[10px] text-acid hover:text-white flex items-center gap-1 w-fit transition-colors">
                                        <ExternalLink size={12} /> View on Google Maps
                                    </a>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            </div>
        </div>
      )}

      {/* Delete Day Modal */}
      {dayToDelete && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-surface w-full max-w-sm border border-border p-8 shadow-2xl rounded-3xl">
                <div className="flex items-center gap-3 mb-4 text-danger">
                    <AlertTriangle size={28} />
                    <h3 className="font-display text-lg uppercase">Confirm Delete</h3>
                </div>
                <p className="text-sm text-dim font-mono mb-8">
                    {t.confirmDeleteDayMsg}
                </p>
                <div className="flex justify-end gap-3">
                    <button onClick={() => setDayToDelete(null)} className="px-5 py-2.5 border border-border text-dim hover:text-text text-xs uppercase rounded-xl">{t.cancel}</button>
                    <button onClick={handleDeleteDay} className="px-5 py-2.5 bg-danger text-white hover:bg-red-600 text-xs font-bold uppercase rounded-xl">{t.purge}</button>
                </div>
            </div>
        </div>
      )}

      {/* Delete Task Modal */}
      {taskToDelete && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-surface w-full max-w-sm border border-border p-8 shadow-2xl rounded-3xl">
                <div className="flex items-center gap-3 mb-4 text-danger">
                    <AlertTriangle size={28} />
                    <h3 className="font-display text-lg uppercase">{t.confirmDeleteTaskTitle}</h3>
                </div>
                <p className="text-sm text-dim font-mono mb-8">
                    {t.confirmDeleteTaskMsg}
                </p>
                <div className="flex justify-end gap-3">
                    <button onClick={() => setTaskToDelete(null)} className="px-5 py-2.5 border border-border text-dim hover:text-text text-xs uppercase rounded-xl">{t.cancel}</button>
                    <button onClick={handleDeleteTask} className="px-5 py-2.5 bg-danger text-white hover:bg-red-600 text-xs font-bold uppercase rounded-xl">{t.purge}</button>
                </div>
            </div>
        </div>
      )}

      {/* Delete Image Modal */}
      {imageDeletionTarget && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in">
            <div className="bg-surface w-full max-w-sm border border-border p-8 shadow-2xl rounded-3xl">
                <div className="flex items-center gap-3 mb-4 text-danger">
                    <AlertTriangle size={28} />
                    <h3 className="font-display text-lg uppercase">{t.confirmDeleteImageTitle}</h3>
                </div>
                <p className="text-sm text-dim font-mono mb-8">
                    {t.confirmDeleteImageMsg}
                </p>
                <div className="flex justify-end gap-3">
                    <button onClick={() => setImageDeletionTarget(null)} className="px-5 py-2.5 border border-border text-dim hover:text-text text-xs uppercase rounded-xl">{t.cancel}</button>
                    <button onClick={confirmDeleteImage} className="px-5 py-2.5 bg-danger text-white hover:bg-red-600 text-xs font-bold uppercase rounded-xl">{t.purge}</button>
                </div>
            </div>
        </div>
      )}

       {previewImage && (
        <div className="fixed inset-0 bg-black/98 backdrop-blur-xl z-[100] flex items-center justify-center p-4 animate-fade-in" onClick={() => setPreviewImage(null)}>
            <div className="relative max-w-7xl max-h-[90vh] flex flex-col items-center">
                <button 
                    onClick={() => setPreviewImage(null)} 
                    className="absolute -top-12 right-0 text-white hover:text-acid transition-colors flex items-center gap-2 p-4"
                >
                    <span className="font-mono text-xs uppercase">Close</span> <X size={24} />
                </button>
                <img 
                    src={previewImage} 
                    className="max-w-full max-h-[85vh] border border-border shadow-2xl object-contain rounded-2xl" 
                    onClick={(e) => e.stopPropagation()} 
                />
            </div>
        </div>
      )}
    </div>
  );
};

export default TripItinerary;
