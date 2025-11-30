
import React, { useState, useEffect, useCallback, useRef, useMemo, Suspense, lazy } from 'react';
import {
    Plus, Sun, Moon, Map as MapIcon, Wallet, Calendar as CalendarIcon,
    ArrowLeft, Luggage, FileText, Globe, X, Image as ImageIcon, Upload, Wand2, Loader2, Info, LogOut, Share2, Check, Search, Trash2, AlertTriangle, Maximize2, ChevronLeft, ChevronRight, Edit2, Hexagon, PenTool, ExternalLink, Save, Terminal, ArrowDownCircle, ArrowRightLeft, Play, Plane, Compass, Users, CreditCard
} from 'lucide-react';
import { Trip, AppState, Currency, TripStatus, TripType, DayPlan } from './types';
import { loadSettings, saveSettings, getTrips, upsertTrip, deleteTripFromDb, getLocalCache, INITIAL_TRIPS } from './services/storageService';
import { generateTripImage, generateTripSummary } from './services/geminiService';
import { supabase } from './services/supabaseClient';
import AuthScreen from './components/AuthScreen';
import Tooltip from './components/Tooltip';
import LazyImage from './components/LazyImage';
import Toast, { ToastType } from './components/Toast';
import BudgetSuggestionModal from './components/BudgetSuggestionModal';
import { translations, Language } from './utils/translations';

// Lazy load heavy components for faster initial bundle load
const BudgetOverview = lazy(() => import('./components/BudgetOverview'));
const TripItinerary = lazy(() => import('./components/TripItinerary'));
const ChatAssistant = lazy(() => import('./components/ChatAssistant'));
const DocumentsManager = lazy(() => import('./components/DocumentsManager'));
const CurrencyConverter = lazy(() => import('./components/CurrencyConverter'));
const ImageEditor = lazy(() => import('./components/ImageEditor'));
const TestimonialsRolodex = lazy(() => import('./components/TestimonialsRolodex'));
const PricingModal = lazy(() => import('./components/PricingModal'));
const WorldMapTracker = lazy(() => import('./components/WorldMapTracker'));
const TripModeSelector = lazy(() => import('./components/TripModeSelector'));

const DEFAULT_PLACEHOLDER = 'https://images.unsplash.com/photo-1488646953014-85cb44e25828?q=60&w=800&auto=format&fit=crop';
const PAGE_SIZE = 20;

interface UserSession {
    id: string;
    name: string;
    email: string;
}

interface GalleryImage {
    src: string;
    date: string;
    label: string;
    type: 'cover' | 'document' | 'day' | 'block';
    id?: string;      // for docs
    dayId?: string;   // for day/block
    blockId?: string; // for block
    index?: number;   // for arrays (day/block images)
}

// Helper to safely access API Key without crashing Vercel/Vite
const getSafeApiKey = (): string => {
    let key = '';
    try {
        // @ts-ignore
        if (typeof import.meta !== 'undefined' && import.meta.env) {
            // @ts-ignore
            key = import.meta.env.VITE_API_KEY || import.meta.env.API_KEY;
        }
    } catch (e) { }

    if (!key) {
        try {
            // @ts-ignore
            if (typeof process !== 'undefined' && process.env) {
                // @ts-ignore
                key = process.env.API_KEY;
            }
        } catch (e) { }
    }
    return key || '';
};

// Image compression utility (simulating browser-image-compression behavior via Canvas)
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
                    if (width > MAX_WIDTH) {
                        height *= MAX_WIDTH / width;
                        width = MAX_WIDTH;
                    }
                } else {
                    if (height > MAX_HEIGHT) {
                        width *= MAX_HEIGHT / height;
                        height = MAX_HEIGHT;
                    }
                }

                const canvas = document.createElement('canvas');
                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx?.drawImage(img, 0, 0, width, height);

                // Try WebP first (30-40% better compression), fallback to JPEG
                try {
                    if (canvas.toDataURL('image/webp', 0.7).length < canvas.toDataURL('image/jpeg', 0.6).length) {
                        resolve(canvas.toDataURL('image/webp', 0.7));
                    } else {
                        resolve(canvas.toDataURL('image/jpeg', 0.6));
                    }
                } catch (e) {
                    // Fallback if WebP not supported
                    resolve(canvas.toDataURL('image/jpeg', 0.6));
                }
            };
            img.onerror = reject;
        };
        reader.onerror = reject;
    });
};

const TripDetailView: React.FC<{
    trip: Trip;
    updateTrip: (t: Trip) => void;
    goBack: () => void;
    lang: Language;
    theme: 'light' | 'dark';
    onDeleteRequest: () => void;
    resizeImageUtil: (file: File) => Promise<string>;
    handleCoverImageUploadUtil: (e: React.ChangeEvent<HTMLInputElement>, trip: Trip, update: (t: Trip) => void) => void;
    allImages: GalleryImage[];
    onDeleteImage: (img: GalleryImage) => void;
    apiKey: string;
    showToast: (msg: string, type: ToastType) => void;
}> = ({ trip, updateTrip, goBack, lang, theme, onDeleteRequest, resizeImageUtil, handleCoverImageUploadUtil, allImages, onDeleteImage, apiKey, showToast }) => {
    const [activeTab, setActiveTab] = useState<'overview' | 'itinerary' | 'budget' | 'documents'>('overview');
    const [isGeneratingImage, setIsGeneratingImage] = useState(false);
    const [isGeneratingSummary, setIsGeneratingSummary] = useState(false);
    const [showImageEditor, setShowImageEditor] = useState(false);
    const [showEditModal, setShowEditModal] = useState(false);

    // Missing State Variables Added
    const [deleteImageTarget, setDeleteImageTarget] = useState<GalleryImage | null>(null);
    const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
    const [showDeleteTripConfirm, setShowDeleteTripConfirm] = useState(false);

    const coverInputRef = useRef<HTMLInputElement>(null);
    const t = translations[lang];

    // Local state for editing to prevent jitter and allow cancel
    const [editForm, setEditForm] = useState<Partial<Trip>>({});

    useEffect(() => {
        if (showEditModal) {
            setEditForm({ ...trip });
        }
    }, [showEditModal, trip]);

    const performDeleteImage = () => {
        if (deleteImageTarget) {
            onDeleteImage(deleteImageTarget);
            setDeleteImageTarget(null);
        }
    };

    const handleGenImage = async () => {
        setIsGeneratingImage(true);
        try {
            const newImage = await generateTripImage(trip.destination, trip.type);
            if (newImage) {
                updateTrip({ ...trip, coverImage: newImage });
                showToast("Cover image generated successfully!", 'success');
            }
        } catch (error: any) {
            showToast(error.message || "Failed to generate image.", 'error');
        } finally {
            setIsGeneratingImage(false);
        }
    };

    const handleGenSummary = async () => {
        setIsGeneratingSummary(true);
        try {
            const summary = await generateTripSummary(trip);
            if (summary) {
                updateTrip({ ...trip, notes: summary });
                showToast("Mission summary updated.", 'success');
            }
        } catch (error: any) {
            showToast(error.message || "Failed to generate summary.", 'error');
        } finally {
            setIsGeneratingSummary(false);
        }
    };

    const saveTripDetails = () => {
        const newStartStr = editForm.startDate ? editForm.startDate.split('T')[0] : '';
        const newEndStr = editForm.endDate ? editForm.endDate.split('T')[0] : '';
        const oldStartStr = trip.startDate.split('T')[0];

        if (!newStartStr || !newEndStr) {
            updateTrip({ ...trip, ...editForm } as Trip);
            setShowEditModal(false);
            return;
        }

        // 1. Calculate Day Shift
        const d1 = new Date(oldStartStr);
        const d2 = new Date(newStartStr);
        const diffTime = d2.getTime() - d1.getTime();
        const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));

        let updatedItinerary = trip.itinerary.map(day => {
            const newDate = new Date(day.date);
            newDate.setDate(newDate.getDate() + diffDays);
            return { ...day, date: newDate.toISOString() };
        });

        // 2. Adjust for Duration
        const start = new Date(newStartStr);
        const end = new Date(newEndStr);
        const newDurationDays = Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;

        if (updatedItinerary.length < newDurationDays) {
            const daysToAdd = newDurationDays - updatedItinerary.length;
            let lastDate = updatedItinerary.length > 0
                ? new Date(updatedItinerary[updatedItinerary.length - 1].date)
                : new Date(start);

            if (updatedItinerary.length === 0) lastDate.setDate(lastDate.getDate() - 1);

            for (let i = 1; i <= daysToAdd; i++) {
                const nextDay = new Date(lastDate);
                nextDay.setDate(lastDate.getDate() + i);
                updatedItinerary.push({
                    id: crypto.randomUUID(),
                    date: nextDay.toISOString(), // Fixed calculation
                    activities: []
                });
                lastDate = nextDay; // Fixed update loop
            }
        } else if (updatedItinerary.length > newDurationDays) {
            updatedItinerary = updatedItinerary.slice(0, newDurationDays);
        }

        const updatedTrip = {
            ...trip,
            ...editForm,
            startDate: new Date(newStartStr).toISOString(),
            endDate: new Date(newEndStr).toISOString(),
            itinerary: updatedItinerary
        };

        updateTrip(updatedTrip as Trip);
        setShowEditModal(false);
        showToast("Trip details updated.", 'success');
    };

    const diaryImages = useMemo(() => allImages.filter(img => img.type !== 'cover'), [allImages]);

    return (
        <div className="animate-fade-in pb-20">
            {/* Header with Cover Image */}
            <div className="relative m-1 overflow-hidden group mb-6 md:mb-8 shadow-2xl h-[180px] md:h-[400px]">
                <LazyImage src={trip.coverImage} alt={trip.destination} className="w-full h-full object-cover" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent"></div>

                <div className="absolute top-3 md:top-6 left-3 md:left-6 z-20">
                    <button onClick={goBack} className="bg-black/40 hover:bg-white hover:text-black text-white p-2 md:p-3 rounded-full backdrop-blur-md border border-white/10 transition-all flex items-center gap-1.5 md:gap-2 group/back shadow-lg">
                        <ArrowLeft size={16} className="md:size-[18px] group-hover/back:-translate-x-1 transition-transform" />
                        <ArrowLeft size={20} className="hidden md:block group-hover/back:-translate-x-1 transition-transform" />
                        <span className="hidden md:inline font-mono text-xs uppercase tracking-widest">{t.dashboard}</span>
                    </button>
                </div>

                <div className="absolute top-4 md:top-6 right-4 md:right-6 z-20 flex gap-1.5 md:gap-2">
                    <div className="flex items-center gap-1.5 md:gap-2 bg-black/40 backdrop-blur-md rounded-full p-0.5 md:p-1 border border-white/10 opacity-0 group-hover:opacity-100 transition-all duration-300">
                        <button onClick={() => setShowImageEditor(true)} className="p-1.5 md:p-2 hover:bg-white hover:text-black text-white rounded-full transition-all" title={t.editImage}>
                            <Wand2 size={16} className="md:hidden" />
                            <Wand2 size={18} className="hidden md:block" />
                        </button>
                        <div className="w-px h-3 md:h-4 bg-white/20"></div>
                        <button onClick={() => coverInputRef.current?.click()} className="p-1.5 md:p-2 hover:bg-white hover:text-black text-white rounded-full transition-all" title={t.uploadImage}>
                            <Upload size={16} className="md:hidden" />
                            <Upload size={18} className="hidden md:block" />
                        </button>
                    </div>
                    <input type="file" ref={coverInputRef} className="hidden" accept="image/*" onChange={(e) => handleCoverImageUploadUtil(e, trip, updateTrip)} />
                </div>

                {/* Refactored Header Content for Layout Stability */}
                <div className="absolute bottom-0 left-0 w-full p-2 md:p-8 z-20 flex justify-start">
                    <div className="w-full md:max-w-4xl bg-gradient-to-tr from-black/85 via-black/70 to-black/40 backdrop-blur-xl border border-white/10 rounded-2xl md:rounded-3xl shadow-[0_20px_60px_rgba(0,0,0,0.65)] p-3 md:p-6 flex flex-col gap-1.5 md:gap-4">
                        <div className="flex flex-wrap items-center gap-2 md:gap-3">
                            <button
                                onClick={() => setShowEditModal(true)}
                                className={`px-2.5 md:px-3 py-0.5 md:py-1 font-mono text-[9px] md:text-[10px] uppercase tracking-widest rounded-full border shadow-lg hover:scale-105 transition-transform ${trip.status === 'Completed' ? 'bg-black/70 text-emerald-400 border-emerald-500/30' :
                                    trip.status === 'Booked' ? 'bg-black/70 text-cyan-400 border-cyan-500/30' : 'bg-black/70 text-violet-400 border-violet-500/30'
                                    }`}>
                                {trip.status}
                            </button>

                            <div className="opacity-100 md:opacity-0 group-hover:opacity-100 transition-opacity flex gap-1.5 md:gap-2">
                                <button onClick={() => setShowEditModal(true)} className="p-1 md:p-1.5 bg-white/10 hover:bg-white hover:text-black text-white rounded-full backdrop-blur-md transition-colors" title={t.editParams}>
                                    <Edit2 size={12} className="md:hidden" />
                                    <Edit2 size={14} className="hidden md:block" />
                                </button>
                                <button onClick={() => setShowDeleteTripConfirm(true)} className="p-1 md:p-1.5 bg-red-500/20 text-red-400 hover:bg-red-500 hover:text-white rounded-full backdrop-blur-md transition-colors" title={t.deleteMission}>
                                    <Trash2 size={12} className="md:hidden" />
                                    <Trash2 size={14} className="hidden md:block" />
                                </button>
                            </div>
                        </div>

                        <h1
                            onClick={() => setShowEditModal(true)}
                            className="text-white text-lg md:text-6xl font-display font-bold uppercase tracking-tight drop-shadow-[0_10px_30px_rgba(0,0,0,0.95)] cursor-pointer hover:text-acid transition-colors break-words leading-tight"
                        >
                            {trip.destination}
                        </h1>

                        <div className="flex flex-wrap gap-3 md:gap-6 text-white/90 font-mono text-[10px] md:text-xs">
                            <button onClick={() => setShowEditModal(true)} className="flex items-center gap-1.5 md:gap-2 hover:text-acid transition-all cursor-pointer group/dates">
                                <CalendarIcon size={12} className="md:hidden text-acid group-hover/dates:scale-110 transition-transform" />
                                <CalendarIcon size={14} className="hidden md:block text-acid group-hover/dates:scale-110 transition-transform" />
                                <span>
                                    {new Date(trip.startDate).toLocaleDateString()} — {new Date(trip.endDate).toLocaleDateString()}
                                </span>
                            </button>
                            <button onClick={() => setShowEditModal(true)} className="flex items-center gap-1.5 md:gap-2 hover:text-acid transition-all cursor-pointer group/budget">
                                <Wallet size={12} className="md:hidden text-acid group-hover/budget:scale-110 transition-transform" />
                                <Wallet size={14} className="hidden md:block text-acid group-hover/budget:scale-110 transition-transform" />
                                <span>{trip.currency} {trip.budget.toLocaleString()}</span>
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Navigation Tabs */}
            <div className="flex items-center gap-1 md:gap-2 mb-4 md:mb-8 overflow-x-auto pb-2 no-scrollbar border-b border-border bg-obsidian pt-2 px-2 md:px-8">
                {[
                    { id: 'overview', icon: Check, label: t.overview },
                    { id: 'itinerary', icon: MapIcon, label: t.itinerary },
                    { id: 'budget', icon: Wallet, label: t.budget },
                    { id: 'documents', icon: FileText, label: t.documents }
                ].map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id as any)}
                        className={`flex items-center gap-1 md:gap-2 px-2 py-1.5 md:px-6 md:py-3 font-mono text-[9px] md:text-xs uppercase tracking-widest transition-all border-b-2 whitespace-nowrap ${activeTab === tab.id
                            ? 'border-acid text-acid font-bold'
                            : 'border-transparent text-dim hover:text-text hover:border-dim'
                            }`}
                    >
                        <tab.icon size={14} className="md:hidden" />
                        <tab.icon size={16} className="hidden md:block" /> 
                        <span className="hidden sm:inline">{tab.label}</span>
                    </button>
                ))}
            </div>

            {/* Tab Content - Suspense Wrapped */}
            <div className="min-h-[300px] md:min-h-[400px] px-2 md:px-0">
                <Suspense fallback={<div className="flex justify-center py-10 md:py-20"><Loader2 className="animate-spin text-acid" size={24} /></div>}>
                    {activeTab === 'overview' && (
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-8 animate-fade-in">
                            <div className="lg:col-span-3 flex flex-col gap-8">
                                {/* Visual Diary */}
                                <div className="bg-surface border border-border p-6 rounded-3xl shadow-sm">
                                    <div className="flex justify-between items-center mb-6">
                                        <h3 className="font-mono text-xs text-dim uppercase tracking-widest flex items-center gap-2">
                                            <ImageIcon size={14} /> {t.visualDiary}
                                        </h3>
                                        <button
                                            onClick={handleGenImage}
                                            disabled={isGeneratingImage}
                                            className="text-[10px] font-mono border border-dim px-3 py-1.5 rounded-full hover:border-acid hover:text-acid transition-colors disabled:opacity-50 flex items-center gap-2"
                                        >
                                            {isGeneratingImage ? <Loader2 className="animate-spin" size={12} /> : <Wand2 size={12} />}
                                            {isGeneratingImage ? t.generating : t.regenVisual}
                                        </button>
                                    </div>

                                    <div className="flex gap-4 overflow-x-auto pb-4 custom-scrollbar">
                                        {diaryImages.length === 0 && (
                                            <div className="w-full py-12 text-center text-[10px] font-mono text-dim border border-dashed border-dim rounded-2xl flex flex-col items-center justify-center gap-2">
                                                <ImageIcon size={24} className="opacity-50" />
                                                {t.galleryEmpty}
                                            </div>
                                        )}
                                        {diaryImages.map((img) => {
                                            const originalIndex = allImages.indexOf(img);
                                            return (
                                                <div key={`${img.type}-${img.dayId}-${img.index}-${originalIndex}`} className="flex-shrink-0 w-48 h-48 rounded-2xl overflow-hidden bg-panel border border-border relative group cursor-pointer">
                                                    <LazyImage
                                                        src={img.src}
                                                        alt={img.label}
                                                        className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                                                        onClick={() => setLightboxIndex(originalIndex)}
                                                    />
                                                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors pointer-events-none"></div>
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); onDeleteImage(img); }}
                                                        className="absolute top-2 right-2 p-2 bg-black/50 text-white hover:bg-red-500 rounded-full opacity-0 group-hover:opacity-100 transition-all backdrop-blur-sm z-10"
                                                        title="Delete Image"
                                                    >
                                                        <Trash2 size={14} />
                                                    </button>
                                                    <div className="absolute bottom-0 left-0 right-0 p-3 bg-gradient-to-t from-black/90 to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
                                                        <p className="text-[10px] font-mono text-white font-bold truncate">{img.label}</p>
                                                        <p className="text-[8px] font-mono text-white/70">{new Date(img.date).toLocaleDateString()}</p>
                                                    </div>
                                                </div>
                                            )
                                        })}
                                    </div>
                                </div>

                                {/* Split: Notes & Converter & Map */}
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 h-full">
                                    {/* Mission Notes */}
                                    <div className="bg-surface border border-border p-8 rounded-3xl relative overflow-hidden shadow-sm flex flex-col h-full min-h-[300px] md:min-h-[400px] px-2 md:px-0">
                                        <div className="flex justify-between items-start mb-4">
                                            <h3 className="font-mono text-xs text-acid uppercase tracking-widest flex items-center gap-2">
                                                <FileText size={14} /> {t.missionNotes}
                                            </h3>
                                            <button
                                                onClick={handleGenSummary}
                                                disabled={isGeneratingSummary}
                                                className="text-[10px] font-mono border border-dim px-3 py-1.5 rounded-full hover:border-acid hover:text-acid transition-colors disabled:opacity-50 flex items-center gap-2"
                                            >
                                                {isGeneratingSummary ? <Loader2 className="animate-spin" size={12} /> : <Wand2 size={12} />}
                                                {isGeneratingSummary ? t.generating : t.aiSummary}
                                            </button>
                                        </div>
                                        <textarea
                                            value={trip.notes || ''}
                                            onChange={(e) => updateTrip({ ...trip, notes: e.target.value })}
                                            className="w-full flex-1 bg-panel border border-border p-4 rounded-2xl outline-none text-text text-sm resize-none leading-relaxed placeholder-dim custom-scrollbar focus:border-acid transition-colors"
                                            placeholder="// Enter mission notes or generate summary..."
                                        />
                                    </div>

                                    {/* Currency Converter */}
                                    <div className="bg-surface border border-border rounded-3xl overflow-hidden shadow-sm h-full min-h-[300px] md:min-h-[400px] px-2 md:px-0 flex flex-col">
                                        <Suspense fallback={<div className="h-full flex items-center justify-center"><Loader2 className="animate-spin" /></div>}>
                                            <CurrencyConverter lang={lang} />
                                        </Suspense>
                                    </div>

                                    {/* World Map Tracker */}
                                    <div className="bg-surface border border-border rounded-3xl overflow-hidden shadow-sm h-full min-h-[300px] md:min-h-[400px] px-2 md:px-0 flex flex-col">
                                        <Suspense fallback={<div className="h-full flex items-center justify-center"><Loader2 className="animate-spin" /></div>}>
                                            <WorldMapTracker trip={trip} />
                                        </Suspense>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === 'itinerary' && <TripItinerary trip={trip} updateTrip={updateTrip} lang={lang} showToast={showToast} />}
                    {activeTab === 'budget' && <BudgetOverview trip={trip} addExpense={(e) => updateTrip({ ...trip, expenses: [...trip.expenses, e] })} removeExpense={(id) => updateTrip({ ...trip, expenses: trip.expenses.filter(e => e.id !== id) })} currencySymbol={trip.currency} lang={lang} theme={theme} />}
                    {activeTab === 'documents' && <DocumentsManager trip={trip} updateTrip={updateTrip} lang={lang} showToast={showToast} />}
                </Suspense>
            </div>

            {showImageEditor && (
                <Suspense fallback={null}>
                    <ImageEditor
                        imageSrc={trip.coverImage}
                        onSave={(newImg) => { updateTrip({ ...trip, coverImage: newImg }); setShowImageEditor(false); showToast("Image edited successfully.", 'success'); }}
                        onCancel={() => setShowImageEditor(false)}
                        lang={lang}
                    />
                </Suspense>
            )}

            {/* Edit Trip Metadata Modal */}
            {showEditModal && (
                <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur-sm flex justify-center items-end md:items-center p-0 md:p-4 animate-fade-in">
                    <div className="bg-surface w-full md:max-w-2xl rounded-t-3xl md:rounded-3xl border border-border flex flex-col shadow-2xl overflow-hidden max-h-[90vh]">
                        <div className="p-6 border-b border-border flex justify-between items-center bg-panel/50">
                            <h3 className="font-display text-xl text-text uppercase tracking-tight">{t.editParams}</h3>
                            <button onClick={() => setShowEditModal(false)} className="text-dim hover:text-text bg-surface rounded-full p-2 hover:bg-border transition-colors"><X size={20} /></button>
                        </div>
                        <div className="p-6 md:p-8 overflow-y-auto custom-scrollbar space-y-6">
                            {/* ... Form fields ... */}
                            <div className="space-y-2">
                                <label className="font-mono text-[10px] text-acid uppercase tracking-widest">{t.target}</label>
                                <input
                                    type="text"
                                    value={editForm.destination || ''}
                                    onChange={(e) => setEditForm({ ...editForm, destination: e.target.value })}
                                    className="w-full bg-panel border border-border p-4 text-lg font-bold text-text outline-none focus:border-acid rounded-xl transition-colors"
                                    placeholder="DESTINATION..."
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <label className="font-mono text-[10px] text-dim uppercase tracking-widest">{t.startDate}</label>
                                    <input
                                        type="date"
                                        value={editForm.startDate ? editForm.startDate.split('T')[0] : ''}
                                        onChange={(e) => setEditForm({ ...editForm, startDate: e.target.value })}
                                        className="w-full bg-panel border border-border p-3 text-sm text-text outline-none focus:border-acid rounded-xl transition-colors"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="font-mono text-[10px] text-dim uppercase tracking-widest">{t.endDate}</label>
                                    <input
                                        type="date"
                                        value={editForm.endDate ? editForm.endDate.split('T')[0] : ''}
                                        onChange={(e) => setEditForm({ ...editForm, endDate: e.target.value })}
                                        className="w-full bg-panel border border-border p-3 text-sm text-text outline-none focus:border-acid rounded-xl transition-colors"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div className="space-y-2">
                                    <label className="font-mono text-[10px] text-dim uppercase tracking-widest">{t.budget}</label>
                                    <div className="flex gap-2">
                                        <select
                                            value={editForm.currency}
                                            onChange={(e) => setEditForm({ ...editForm, currency: e.target.value as Currency })}
                                            className="bg-panel border border-border p-3 rounded-xl text-xs font-bold outline-none focus:border-acid"
                                        >
                                            {(Object.values(Currency) as string[]).map(c => <option key={c} value={c}>{c}</option>)}
                                        </select>
                                        <input
                                            type="number"
                                            value={editForm.budget}
                                            onChange={(e) => setEditForm({ ...editForm, budget: parseFloat(e.target.value) })}
                                            className="w-full bg-panel border border-border p-3 text-sm text-text outline-none focus:border-acid rounded-xl transition-colors"
                                        />
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <label className="font-mono text-[10px] text-dim uppercase tracking-widest">{t.tripStatus}</label>
                                    <select
                                        value={editForm.status}
                                        onChange={(e) => setEditForm({ ...editForm, status: e.target.value as TripStatus })}
                                        className="w-full bg-panel border border-border p-3 text-sm text-text outline-none focus:border-acid rounded-xl transition-colors appearance-none"
                                    >
                                        {(Object.values(TripStatus) as string[]).map(s => <option key={s} value={s}>{s}</option>)}
                                    </select>
                                </div>
                                <div className="space-y-2">
                                    <label className="font-mono text-[10px] text-dim uppercase tracking-widest">{t.tripType}</label>
                                    <select
                                        value={editForm.type}
                                        onChange={(e) => setEditForm({ ...editForm, type: e.target.value as TripType })}
                                        className="w-full bg-panel border border-border p-3 text-sm text-text outline-none focus:border-acid rounded-xl transition-colors appearance-none"
                                    >
                                        {['Leisure', 'Business', 'Adventure', 'Family', 'Romantic', 'Solo'].map(t => <option key={t} value={t}>{t}</option>)}
                                    </select>
                                </div>
                            </div>
                        </div>
                        <div className="p-6 border-t border-border bg-panel/30 flex justify-end gap-3">
                            <button onClick={() => setShowEditModal(false)} className="px-6 py-3 border border-border text-dim hover:text-text font-mono text-xs uppercase rounded-xl transition-colors">{t.cancel}</button>
                            <button onClick={saveTripDetails} className="px-8 py-3 bg-text text-obsidian hover:bg-acid font-mono text-xs font-bold uppercase tracking-widest rounded-xl shadow-lg flex items-center gap-2 transition-all">
                                <Save size={16} /> {t.saveChanges}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Delete Image Modal */}
            {deleteImageTarget && (
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
                            <button onClick={() => setDeleteImageTarget(null)} className="px-5 py-2.5 border border-border text-dim hover:text-text text-xs uppercase rounded-xl">{t.cancel}</button>
                            <button onClick={performDeleteImage} className="px-5 py-2.5 bg-danger text-white hover:bg-red-600 text-xs font-bold uppercase rounded-xl">{t.purge}</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Global Lightbox */}
            {lightboxIndex !== null && (
                <div className="fixed inset-0 z-[999] bg-black/98 backdrop-blur-xl flex flex-col animate-fade-in" onClick={() => setLightboxIndex(null)}>
                    <div className="absolute top-0 left-0 right-0 p-6 flex justify-between items-start z-20">
                        <div className="text-white">
                            <h3 className="font-display font-bold text-xl uppercase tracking-wide">{allImages[lightboxIndex].label}</h3>
                            <p className="font-mono text-xs text-acid">{new Date(allImages[lightboxIndex].date).toLocaleDateString()}</p>
                        </div>
                        <div className="flex gap-4">
                            <button
                                onClick={(e) => { e.stopPropagation(); performDeleteImage(); }}
                                className="p-3 bg-black/50 text-white hover:text-red-500 hover:bg-black border border-white/20 rounded-full transition-all"
                                title="Delete Image"
                            >
                                <Trash2 size={20} />
                            </button>
                            <button
                                onClick={() => setLightboxIndex(null)}
                                className="p-3 bg-white text-black hover:bg-gray-200 rounded-full transition-all shadow-lg"
                            >
                                <X size={24} />
                            </button>
                        </div>
                    </div>

                    <div className="flex-1 flex items-center justify-center relative px-4 md:px-20">
                        <button
                            onClick={(e) => { e.stopPropagation(); setLightboxIndex((prev) => (prev !== null && prev > 0 ? prev - 1 : allImages.length - 1)); }}
                            className="absolute left-4 p-4 text-white/50 hover:text-white hover:bg-white/10 rounded-full transition-all hidden md:block"
                        >
                            <ChevronLeft size={32} />
                        </button>

                        <LazyImage
                            src={allImages[lightboxIndex].src}
                            alt="Lightbox Image"
                            className="max-w-full max-h-[85vh] object-contain shadow-2xl rounded-sm"
                            onClick={(e) => e.stopPropagation()}
                        />

                        <button
                            onClick={(e) => { e.stopPropagation(); setLightboxIndex((prev) => (prev !== null && prev < allImages.length - 1 ? prev + 1 : 0)); }}
                            className="absolute right-4 p-4 text-white/50 hover:text-white hover:bg-white/10 rounded-full transition-all hidden md:block"
                        >
                            <ChevronRight size={32} />
                        </button>
                    </div>
                </div>
            )}

            {/* Delete Trip Confirmation */}
            {showDeleteTripConfirm && (
                <div className="fixed inset-0 bg-black/90 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-surface w-full max-w-sm border border-border p-8 shadow-2xl rounded-3xl">
                        <div className="flex items-center gap-3 mb-4 text-danger">
                            <AlertTriangle size={32} />
                            <h3 className="font-display text-lg uppercase">{t.confirmDeleteTripTitle}</h3>
                        </div>
                        <p className="text-sm text-dim font-mono mb-8 leading-relaxed">
                            {t.confirmDeleteTripMsg}
                        </p>
                        <div className="flex justify-end gap-3">
                            <button onClick={() => setShowDeleteTripConfirm(false)} className="px-5 py-2.5 border border-border text-dim hover:text-text text-xs uppercase rounded-xl">{t.cancel}</button>
                            <button onClick={onDeleteRequest} className="px-5 py-2.5 bg-danger text-white hover:bg-red-600 text-xs font-bold uppercase rounded-xl shadow-lg">{t.purge}</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

const App: React.FC = () => {
    const [user, setUser] = useState<UserSession | null>(null);
    const [trips, setTrips] = useState<Trip[]>([]);
    const [currentTripId, setCurrentTripId] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [settings, setSettings] = useState<Partial<AppState>>({ theme: 'dark', language: 'en' });
    const [toast, setToast] = useState<{ msg: string; type: ToastType } | null>(null);
    const apiKey = getSafeApiKey();
    const [globalSearch, setGlobalSearch] = useState('');

    // Demo Video Modal State
    const [showDemo, setShowDemo] = useState(false);

    // Stories Modal State
    const [showStories, setShowStories] = useState(false);

    // Pricing Modal State
    const [showPricing, setShowPricing] = useState(false);

    // Budget Suggestion Modal State
    const [showBudgetSuggestion, setShowBudgetSuggestion] = useState(false);
    const [pendingNewTrip, setPendingNewTrip] = useState<Trip | null>(null);
    const [showModeSelector, setShowModeSelector] = useState(false);
    const [autoFetchBudget, setAutoFetchBudget] = useState(false);

    // Pagination State
    const [currentPage, setCurrentPage] = useState(1);
    const ITEMS_PER_PAGE = 12; // 3 columns x 4 rows

    useEffect(() => {
        const savedSettings = loadSettings();
        if (savedSettings) setSettings(savedSettings);

        // Optimistic Auth
        const cachedUser = localStorage.getItem('wanderlust_last_user');
        if (cachedUser) {
            setUser(JSON.parse(cachedUser));
            const cachedTrips = getLocalCache(JSON.parse(cachedUser).id);
            if (cachedTrips) setTrips(cachedTrips.trips);
            setLoading(false);
        }

        supabase.auth.getSession().then(({ data: { session } }) => {
            if (session?.user) {
                const userData = {
                    id: session.user.id,
                    name: session.user.user_metadata.full_name || session.user.email?.split('@')[0] || 'Traveler',
                    email: session.user.email || ''
                };
                setUser(userData);
                localStorage.setItem('wanderlust_last_user', JSON.stringify(userData));
                getTrips(userData.id).then(fetchedTrips => setTrips(fetchedTrips));
            } else if (!cachedUser) {
                setLoading(false);
            }
        });

        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            if (session?.user) {
                const userData = {
                    id: session.user.id,
                    name: session.user.user_metadata.full_name || session.user.email?.split('@')[0] || 'Traveler',
                    email: session.user.email || ''
                };
                setUser(userData);
                localStorage.setItem('wanderlust_last_user', JSON.stringify(userData));
            }
        });

        return () => subscription.unsubscribe();
    }, []);

    // Theme Effect
    useEffect(() => {
        if (settings.theme === 'dark') {
            document.documentElement.classList.add('dark');
        } else {
            document.documentElement.classList.remove('dark');
        }
    }, [settings.theme]);

    const showToast = useCallback((msg: string, type: ToastType) => {
        setToast({ msg, type });
    }, []);

    const handleLogin = async (userData: UserSession) => {
        setUser(userData);
        localStorage.setItem('wanderlust_last_user', JSON.stringify(userData));
        setLoading(true);
        const fetchedTrips = await getTrips(userData.id);
        setTrips(fetchedTrips);
        setLoading(false);
    };

    const handleLogout = async () => {
        await supabase.auth.signOut();
        localStorage.removeItem('wanderlust_last_user');
        setUser(null);
        setTrips([]);
    };

    const handleCreateTrip = () => {
        if (!user) return;
        setShowModeSelector(true);
    };

    const handleManualMode = () => {
        if (!user) return;
        const newTrip: Trip = {
            id: crypto.randomUUID(),
            destination: 'New Adventure',
            coverImage: DEFAULT_PLACEHOLDER,
            startDate: new Date().toISOString(),
            endDate: new Date().toISOString(),
            budget: 0,
            currency: Currency.USD,
            status: TripStatus.PLANNING,
            type: 'Leisure',
            expenses: [],
            itinerary: [],
            checklist: [],
            documents: [],
            documentCategories: ['flight', 'hotel', 'airbnb', 'food', 'other']
        };
        // For manual mode, we just create the trip and let them edit it
        const updatedTrips = [newTrip, ...trips];
        setTrips(updatedTrips);
        upsertTrip(user.id, newTrip);
        setCurrentTripId(newTrip.id);
        setShowModeSelector(false);
        showToast('New trip created. Edit details now.', 'success');
        // Optionally open edit modal immediately? For now just showing the trip details is good.
    };

    const handleAIMode = () => {
        if (!user) return;
        const newTrip: Trip = {
            id: crypto.randomUUID(),
            destination: 'New Adventure',
            coverImage: DEFAULT_PLACEHOLDER,
            startDate: new Date().toISOString(),
            endDate: new Date().toISOString(),
            budget: 0,
            currency: Currency.USD,
            status: TripStatus.PLANNING,
            type: 'Leisure',
            expenses: [],
            itinerary: [],
            checklist: [],
            documents: [],
            documentCategories: ['flight', 'hotel', 'airbnb', 'food', 'other']
        };
        setPendingNewTrip(newTrip);
        setAutoFetchBudget(true);
        setShowModeSelector(false);
        setShowBudgetSuggestion(true);
    };

    const handleBudgetSuggested = (budget: number) => {
        if (!user || !pendingNewTrip) return;
        const tripWithBudget = { ...pendingNewTrip, budget };
        const updatedTrips = [tripWithBudget, ...trips];
        setTrips(updatedTrips);
        upsertTrip(user.id, tripWithBudget);
        setCurrentTripId(tripWithBudget.id);
        setPendingNewTrip(null);
        setShowBudgetSuggestion(false);
        showToast('Trip created with suggested budget!', 'success');
    };

    const handleUpdateTrip = (updatedTrip: Trip) => {
        if (!user) return;
        const updatedTrips = trips.map(t => t.id === updatedTrip.id ? updatedTrip : t);
        setTrips(updatedTrips);
        upsertTrip(user.id, updatedTrip);
    };

    const handleDeleteTrip = (tripId: string) => {
        if (!user) return;
        const updatedTrips = trips.filter(t => t.id !== tripId);
        setTrips(updatedTrips);
        deleteTripFromDb(user.id, tripId);
        setCurrentTripId(null);
        showToast("Trip deleted.", 'info');
    };

    const handleCoverImageUpload = async (e: React.ChangeEvent<HTMLInputElement>, trip: Trip, update: (t: Trip) => void) => {
        if (e.target.files && e.target.files[0]) {
            try {
                const base64 = await resizeImage(e.target.files[0]);
                update({ ...trip, coverImage: base64 });
                showToast("Cover image updated.", 'success');
            } catch (err) {
                showToast("Failed to upload image.", 'error');
            }
        }
    };

    const getAllImages = (trip: Trip): GalleryImage[] => {
        const images: GalleryImage[] = [];
        if (trip.coverImage) images.push({ src: trip.coverImage, date: trip.startDate, label: 'Cover Image', type: 'cover' });
        trip.documents?.filter(d => d.dataUrl.startsWith('data:image')).forEach(d => {
            images.push({ src: d.dataUrl, date: d.dateAdded, label: d.name, type: 'document', id: d.id });
        });
        trip.itinerary?.forEach(day => {
            day.images?.forEach((img, idx) => {
                images.push({ src: img, date: day.date, label: `Day ${day.date}`, type: 'day', dayId: day.id, index: idx });
            });
            day.infoBlocks?.forEach(block => {
                block.images?.forEach((img, idx) => {
                    images.push({ src: img, date: day.date, label: block.title || 'Info Block', type: 'block', dayId: day.id, blockId: block.id, index: idx });
                });
            });
        });
        return images;
    };

    const handleDeleteImage = (img: GalleryImage, trip: Trip) => {
        let updatedTrip = { ...trip };
        if (img.type === 'document' && img.id) {
            updatedTrip.documents = trip.documents.filter(d => d.id !== img.id);
        } else if (img.type === 'day' && img.dayId !== undefined && img.index !== undefined) {
            updatedTrip.itinerary = trip.itinerary.map(d => {
                if (d.id === img.dayId) {
                    const newImages = [...(d.images || [])];
                    newImages.splice(img.index!, 1);
                    return { ...d, images: newImages };
                }
                return d;
            });
        } else if (img.type === 'block' && img.dayId !== undefined && img.blockId !== undefined && img.index !== undefined) {
            updatedTrip.itinerary = trip.itinerary.map(d => {
                if (d.id === img.dayId) {
                    const newBlocks = d.infoBlocks?.map(b => {
                        if (b.id === img.blockId) {
                            const newImages = [...(b.images || [])];
                            newImages.splice(img.index!, 1);
                            return { ...b, images: newImages };
                        }
                        return b;
                    });
                    return { ...d, infoBlocks: newBlocks };
                }
                return d;
            });
        }
        handleUpdateTrip(updatedTrip);
        showToast("Image deleted.", 'info');
    };

    const filteredTrips = useMemo(() => {
        if (!globalSearch) return trips;
        const lowerQ = globalSearch.toLowerCase();
        return trips.filter(t =>
            t.destination.toLowerCase().includes(lowerQ) ||
            t.type.toLowerCase().includes(lowerQ) ||
            t.status.toLowerCase().includes(lowerQ)
        );
    }, [trips, globalSearch]);

    // Pagination for trips list
    const paginatedTrips = useMemo(() => {
        const start = (currentPage - 1) * ITEMS_PER_PAGE;
        const end = start + ITEMS_PER_PAGE;
        return filteredTrips.slice(start, end);
    }, [filteredTrips, currentPage]);

    const totalPages = Math.ceil(filteredTrips.length / ITEMS_PER_PAGE);

    if (loading) return <div className="h-screen flex items-center justify-center bg-obsidian text-acid"><Loader2 className="animate-spin" size={48} /></div>;

    if (!user) {
        return (
            <AuthScreen
                onLogin={handleLogin}
                lang={settings.language as Language}
                toggleLanguage={() => {
                    const newLang = settings.language === 'en' ? 'es' : 'en';
                    setSettings({ ...settings, language: newLang });
                    saveSettings({ ...settings, language: newLang });
                }}
            />
        );
    }

    const currentTrip = trips.find(t => t.id === currentTripId);
    const t = translations[settings.language as Language];

    return (
        <div className={`min-h-screen bg-obsidian text-text font-sans selection:bg-acid selection:text-black ${settings.theme}`}>
            {currentTripId && currentTrip ? (
                <TripDetailView
                    trip={currentTrip}
                    updateTrip={handleUpdateTrip}
                    goBack={() => setCurrentTripId(null)}
                    lang={settings.language as Language}
                    theme={settings.theme as 'light' | 'dark'}
                    onDeleteRequest={() => handleDeleteTrip(currentTrip.id)}
                    resizeImageUtil={resizeImage}
                    handleCoverImageUploadUtil={handleCoverImageUpload}
                    allImages={getAllImages(currentTrip)}
                    onDeleteImage={(img) => handleDeleteImage(img, currentTrip)}
                    apiKey={apiKey}
                    showToast={showToast}
                />
            ) : (
                <>
                    {/* Compact Navbar */}
                    <div className="h-14 md:h-16 border-b border-border bg-obsidian/95 backdrop-blur-md sticky top-0 z-50 px-3 md:px-6 flex items-center justify-between">
                        <div className="flex items-center gap-2 md:gap-3">
                            <div className="w-8 h-8 md:w-9 md:h-9 bg-surface border border-border flex items-center justify-center rounded-lg shadow-sm">
                                <Hexagon className="text-acid fill-acid/10" size={16} />
                            </div>
                            <span className="font-display font-bold text-base md:text-lg tracking-tight text-text">
                                WanderLust<span className="text-dim">AI</span>
                            </span>
                        </div>

                        <div className="hidden md:flex flex-1 max-w-2xl mx-8 gap-3 items-center">
                            <div className="w-full relative group flex-1">
                                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-dim group-focus-within:text-acid transition-colors" size={16} />
                                <input
                                    type="text"
                                    placeholder={t.searchQuery}
                                    value={globalSearch}
                                    onChange={(e) => setGlobalSearch(e.target.value)}
                                    className="w-full bg-surface border border-border rounded-xl md:rounded-2xl py-1.5 md:py-2 pl-10 md:pl-12 pr-3 md:pr-4 text-[10px] md:text-xs font-mono focus:border-acid focus:ring-1 focus:ring-acid outline-none transition-all placeholder-dim"
                                />
                            </div>
                            <button
                                onClick={() => setShowPricing(true)}
                                className="flex items-center gap-2 text-xs font-mono font-bold uppercase border border-border px-3 py-1.5 rounded-md hover:border-acid transition-colors text-dim hover:text-acid group whitespace-nowrap"
                            >
                                <CreditCard size={14} className="group-hover:text-acid transition-colors" /> Precios
                            </button>
                        </div>

                        <div className="flex items-center gap-4">
                            <button
                                onClick={() => {
                                    const newTheme = settings.theme === 'light' ? 'dark' : 'light';
                                    setSettings({ ...settings, theme: newTheme });
                                    saveSettings({ ...settings, theme: newTheme });
                                }}
                                className="p-1.5 md:p-2 text-dim hover:text-text transition-colors"
                            >
                                {settings.theme === 'light' ? <Moon size={16} className="md:size-[18px]" /> : <Sun size={16} className="md:size-[18px]" />}
                            </button>
                            <div className="h-4 w-px bg-border"></div>
                            <button onClick={() => {
                                const newLang = settings.language === 'en' ? 'es' : 'en';
                                setSettings({ ...settings, language: newLang });
                                saveSettings({ ...settings, language: newLang });
                            }} className="text-[10px] font-mono font-bold uppercase border border-border px-2 py-1 rounded-md hover:border-acid transition-colors text-dim hover:text-acid">
                                [{settings.language?.toUpperCase()}]
                            </button>
                            <div className="hidden md:flex items-center gap-2 text-xs font-mono text-dim border-l border-border pl-4 ml-2">
                                <span className="uppercase">{user.name}</span>
                                <button onClick={handleLogout} className="text-text hover:text-red-500 transition-colors ml-2" title="Logout">
                                    <LogOut size={14} />
                                </button>
                            </div>
                            <button onClick={handleLogout} className="md:hidden text-text hover:text-red-500 transition-colors" title="Logout">
                                <LogOut size={18} />
                            </button>
                        </div>
                    </div>

                    <div className="p-4 md:p-8 max-w-7xl mx-auto animate-fade-in relative z-10">
                        {/* HERO SECTION - REFACTORED TO LEFT ALIGN & HEADER STYLE */}
                        <div className="flex flex-col md:flex-row justify-between items-end mb-8 md:mb-16 gap-4 md:gap-6 pt-4 md:pt-8">
                            <div className="text-left">
                                <h4 className="text-xs font-mono font-bold uppercase tracking-[0.2em] text-dim mb-4 opacity-60">
                                    {t.authority}
                                </h4>
                                <div className="flex items-center gap-3 md:gap-4 mb-3 md:mb-4">
                                    <Hexagon className="text-acid w-8 h-8 md:w-12 md:h-12" />
                                    <h1 className="text-3xl md:text-7xl font-display font-bold uppercase tracking-tighter text-white leading-tight">
                                        WanderLust<span className="text-dim">AI</span>
                                    </h1>
                                </div>
                                <p className="text-dim text-sm font-light leading-relaxed font-sans max-w-lg">
                                    {t.heroSubtitle}
                                </p>
                            </div>

                            <div className="flex flex-col gap-4 items-end">
                                <button
                                    onClick={handleCreateTrip}
                                    className="px-5 py-3 md:px-8 md:py-4 bg-white text-black hover:bg-acid hover:scale-105 transition-all rounded-lg md:rounded-xl font-mono text-xs md:text-sm font-bold uppercase tracking-widest flex items-center gap-2 shadow-[0_0_20px_rgba(255,255,255,0.3)] group"
                                >
                                    <Plane size={16} className="md:size-5 group-hover:-rotate-45 transition-transform" /> {t.initiateTrip}
                                </button>

                                <div className="flex items-center gap-4">
                                    <Tooltip content={t.freemiumTooltip} position="bottom">
                                        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-acid/20 bg-acid/5 text-acid text-[10px] font-mono uppercase tracking-widest cursor-help w-fit">
                                            {t.freemiumNotice} <Info size={10} />
                                        </div>
                                    </Tooltip>
                                </div>

                                <div className="flex gap-4 mt-2">
                                    <button
                                        onClick={() => setShowStories(true)}
                                        className="text-dim hover:text-white transition-all opacity-80 hover:opacity-100 flex items-center gap-2 text-xs font-mono uppercase tracking-wide border-b border-transparent hover:border-acid pb-0.5"
                                    >
                                        <Users size={14} /> Traveler Stories
                                    </button>
                                    <button
                                        onClick={() => setShowDemo(true)}
                                        className="text-dim hover:text-white transition-all opacity-80 hover:opacity-100 flex items-center gap-2 text-xs font-mono uppercase tracking-wide border-b border-transparent hover:border-acid pb-0.5"
                                    >
                                        {t.watchDemo}
                                    </button>
                                </div>
                            </div>
                        </div>

                        {filteredTrips.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-20 border-2 border-dashed border-dim/30 rounded-3xl bg-panel/20">
                                <div className="w-24 h-24 bg-surface rounded-full flex items-center justify-center mb-6 shadow-xl border border-border">
                                    <Compass size={48} className="text-acid animate-pulse-slow" />
                                </div>
                                <h3 className="text-2xl font-display font-bold text-white uppercase mb-2">{t.emptyStateTitle}</h3>
                                <p className="text-dim font-mono text-sm mb-8">{t.emptyStateDesc}</p>
                                <button
                                    onClick={handleCreateTrip}
                                    className="px-6 py-3 border border-acid text-acid hover:bg-acid hover:text-black font-mono text-xs uppercase font-bold rounded-xl transition-all"
                                >
                                    {t.createFirstTrip}
                                </button>
                            </div>
                        ) : (
                            <div className="w-full space-y-6">
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 md:gap-10">
                                    {/* Trip Cards Only - No Sidebar */}
                                    {paginatedTrips.map(trip => (
                                        <div
                                            key={trip.id}
                                            onClick={() => setCurrentTripId(trip.id)}
                                            className="group relative h-[340px] md:h-[450px] bg-surface rounded-2xl md:rounded-3xl overflow-hidden cursor-pointer shadow-xl hover:shadow-acid/20 transition-all hover:-translate-y-2 border border-border flex flex-col"
                                        >
                                            <div className="h-[65%] relative overflow-hidden">
                                                <LazyImage src={trip.coverImage} alt={trip.destination} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" />
                                                <div className="absolute inset-0 bg-gradient-to-t from-black via-black/60 to-transparent"></div>

                                                <div className="absolute top-3 right-3 md:top-4 md:right-4">
                                                    <span className={`px-2.5 py-1 md:px-3 md:py-1 text-[9px] md:text-[10px] font-mono uppercase font-bold rounded-full backdrop-blur-md border flex items-center gap-1 md:gap-1.5 shadow-sm ${trip.status === 'Completed' ? 'bg-black/60 text-emerald-400 border-emerald-500/50' :
                                                        trip.status === 'Booked' ? 'bg-black/60 text-cyan-400 border-cyan-500/50' :
                                                            'bg-black/60 text-violet-400 border-violet-500/50'
                                                        }`}>
                                                        <span className={`w-1.5 h-1.5 rounded-full ${trip.status === 'Completed' ? 'bg-emerald-400' :
                                                            trip.status === 'Booked' ? 'bg-cyan-400' :
                                                                'bg-violet-400'
                                                            }`}></span>
                                                        {trip.status}
                                                    </span>
                                                </div>

                                                <div className="absolute bottom-4 left-4 right-4 md:bottom-6 md:left-6 md:right-6">
                                                    <h3 className="text-2xl md:text-5xl font-display font-bold text-white uppercase drop-shadow-lg truncate leading-none mb-1.5 md:mb-2">{trip.destination}</h3>
                                                    <p className="text-[10px] md:text-sm font-mono text-white/80 uppercase tracking-widest">{trip.type}</p>
                                                </div>
                                            </div>

                                            <div className="flex-1 bg-panel p-4 md:p-6 flex flex-col justify-between border-t border-border group-hover:bg-surface transition-colors">
                                                <div className="space-y-3 md:space-y-4">
                                                    <div className="flex justify-between items-end border-b border-border/50 pb-3 md:pb-4">
                                                        <div>
                                                            <span className="text-[10px] md:text-xs font-mono text-dim uppercase tracking-widest block mb-1">{t.dates}</span>
                                                            <div className="text-xs md:text-sm font-bold text-text flex items-center gap-1 md:gap-2">
                                                                {new Date(trip.startDate).toLocaleDateString()} - {new Date(trip.endDate).toLocaleDateString()}
                                                            </div>
                                                        </div>
                                                        <div className="text-right">
                                                            <span className="text-[10px] md:text-xs font-mono text-dim uppercase tracking-widest block mb-1">{t.budget}</span>
                                                            <div className="text-base md:text-xl font-display font-bold text-text">{trip.currency} {trip.budget}</div>
                                                        </div>
                                                    </div>

                                                    <div className="flex justify-between items-center text-dim font-mono text-xs uppercase">
                                                        <span className="flex items-center gap-1">
                                                            <CalendarIcon size={14} />
                                                            {Math.ceil((new Date(trip.endDate).getTime() - new Date(trip.startDate).getTime()) / (1000 * 3600 * 24))} {t.days}
                                                        </span>
                                                        <span>ID: #{trip.id.substring(0, 4)}</span>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>

                                {/* Pagination Controls */}
                                {totalPages > 1 && (
                                    <div className="flex items-center justify-center gap-1.5 md:gap-2 mt-6 md:mt-12 pb-6 md:pb-10">
                                        <button
                                            onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                                            disabled={currentPage === 1}
                                            className="p-1.5 md:p-2 border border-border rounded-lg hover:bg-panel disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                                        >
                                            <ChevronLeft size={18} className="md:size-5 text-text" />
                                        </button>

                                        <div className="flex items-center gap-1">
                                            {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                                                <button
                                                    key={page}
                                                    onClick={() => setCurrentPage(page)}
                                                    className={`w-8 h-8 md:w-9 md:h-9 rounded-lg font-mono text-[10px] md:text-xs font-bold transition-all ${currentPage === page
                                                        ? 'bg-acid text-black'
                                                        : 'border border-border text-text hover:bg-panel'
                                                        }`}
                                                >
                                                    {page}
                                                </button>
                                            ))}
                                        </div>

                                        <button
                                            onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                                            disabled={currentPage === totalPages}
                                            className="p-2 border border-border rounded-lg hover:bg-panel disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                                        >
                                            <ChevronRight size={20} className="text-text" />
                                        </button>

                                        <span className="text-xs font-mono text-dim ml-4">
                                            Page {currentPage} of {totalPages} ({filteredTrips.length} trips)
                                        </span>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    {/* World Map Background Layer */}
                    <div className="fixed inset-0 z-0 opacity-[0.03] pointer-events-none dark:invert">
                        <img
                            src="https://static.vecteezy.com/system/resources/previews/020/997/828/non_2x/detailed-world-map-in-black-and-white-free-vector.jpg"
                            alt="World Map"
                            className="w-full h-full object-cover"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-obsidian via-transparent to-obsidian"></div>
                    </div>
                </>
            )}

            <ChatAssistant
                lang={settings.language as Language}
                trip={currentTrip}
                isOpen={false}
            />

            {toast && <Toast message={toast.msg} type={toast.type} onClose={() => setToast(null)} />}

            {/* Demo Video Modal */}
            {showDemo && (
                <div className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-md flex items-center justify-center p-4 animate-fade-in">
                    <div className="bg-obsidian border border-border w-full max-w-4xl aspect-video rounded-3xl shadow-2xl relative overflow-hidden flex flex-col">
                        <button onClick={() => setShowDemo(false)} className="absolute top-4 right-4 z-20 bg-black/50 text-white hover:text-acid p-2 rounded-full backdrop-blur-md">
                            <X size={24} />
                        </button>
                        <div className="flex-1 relative flex items-center justify-center bg-surface">
                            <div className="absolute inset-0 flex items-center justify-center text-center p-12 animate-[pulse-slow_3s_infinite]">
                                <div>
                                    <div className="w-20 h-20 bg-acid/10 rounded-full flex items-center justify-center mx-auto mb-6">
                                        <Play size={40} className="text-acid ml-1" />
                                    </div>
                                    <h3 className="text-2xl font-display font-bold text-white mb-2">Demo Simulation</h3>
                                    <p className="text-dim font-mono text-sm">Visualizing Workflow...</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Stories Modal */}
            {showStories && (
                <Suspense fallback={null}>
                    <TestimonialsRolodex onClose={() => setShowStories(false)} />
                </Suspense>
            )}

            {/* Pricing Modal */}
            {showPricing && (
                <Suspense fallback={null}>
                    <PricingModal onClose={() => setShowPricing(false)} />
                </Suspense>
            )}

            {/* Trip Mode Selector */}
            {showModeSelector && (
                <Suspense fallback={null}>
                    <TripModeSelector
                        onManualMode={handleManualMode}
                        onAIMode={handleAIMode}
                        onClose={() => setShowModeSelector(false)}
                    />
                </Suspense>
            )}

            {/* Budget Suggestion Modal */}
            {showBudgetSuggestion && pendingNewTrip && (
                <BudgetSuggestionModal
                    destination={pendingNewTrip.destination}
                    startDate={pendingNewTrip.startDate}
                    endDate={pendingNewTrip.endDate}
                    tripType={pendingNewTrip.type}
                    currency={pendingNewTrip.currency}
                    onBudgetSuggested={handleBudgetSuggested}
                    onClose={() => {
                        setShowBudgetSuggestion(false);
                        setPendingNewTrip(null);
                        setAutoFetchBudget(false);
                    }}
                    autoFetch={autoFetchBudget}
                />
            )}
        </div>
    );
};

export default App;
