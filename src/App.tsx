
import React, { useState, useEffect, useCallback, useRef, useMemo, Suspense, lazy } from 'react';
import DeletionCountdown from '../components/DeletionCountdown';
import { useLanguage } from '../hooks/useLanguage';
import { generateQuickSuggestion } from '../utils/aiTripSuggester';
import { generateBudgetSuggestion } from '../services/geminiService';
import {
    Plus, Sun, Moon, Map as MapIcon, Wallet, Calendar as CalendarIcon,
    ArrowLeft, Luggage, FileText, Globe, X, Image as ImageIcon, Upload, Wand2, Loader2, Info, LogOut, Share2, Check, Search, Trash2, AlertTriangle, Maximize2, ChevronLeft, ChevronRight, Edit2, Hexagon, PenTool, ExternalLink, Save, Terminal, ArrowDownCircle, ArrowRightLeft, Play, Plane, Compass, Users, CreditCard, DollarSign, Files, Sparkles, Goal, Unlock
} from 'lucide-react';
import PricingSection from '../components/PricingSection';
import { Trip, AppState, Currency, TripStatus, TripType, DayPlan } from '../types';
import { loadSettings, saveSettings, getTrips, upsertTrip, deleteTripFromDb, getLocalCache, INITIAL_TRIPS } from '../services/storageService';
import { generateTripImage, generateTripSummary } from '../services/geminiService';
import { extractFlightMetadataLocal } from '../utils/flightMetadataExtractor';
import { supabase } from '../services/supabaseClient';
import AuthScreen from '../components/AuthScreen';
import Tooltip from '../components/Tooltip';
import LazyImage from '../components/LazyImage';
import Toast, { ToastType } from '../components/Toast';
// BudgetSuggestionModal ya no se usa para flujo AI inicial (overlay integrado)
import { Language, translations } from '../utils/translations';

// Lazy load heavy components for faster initial bundle load
const BudgetOverview = lazy(() => import('../components/BudgetOverview'));
const TripItinerary = lazy(() => import('../components/TripItinerary'));
const ChatAssistant = lazy(() => import('../components/ChatAssistant'));
const DocumentsManager = lazy(() => import('../components/DocumentsManager'));
const CurrencyConverter = lazy(() => import('../components/CurrencyConverter'));
const ImageEditor = lazy(() => import('../components/ImageEditor'));
const TestimonialsRolodex = lazy(() => import('../components/TestimonialsRolodex'));
const PricingModal = lazy(() => import('../components/PricingModal'));
const TripSuggestions = lazy(() => import('../components/TripSuggestions'));
const WorldMapTracker = lazy(() => import('../components/WorldMapTracker'));
const TripModeSelector = lazy(() => import('../components/TripModeSelector'));

const DEFAULT_PLACEHOLDER = 'https://images.unsplash.com/photo-1488646953014-85cb44e25828?q=60&w=800&auto=format&fit=crop';
const PAGE_SIZE = 20;
// Tiempo máximo permitido para eliminar un viaje recién creado (ms)
// Se puede configurar vía variable de entorno VITE_DELETION_WINDOW_MS (ej: 300000 para 5 min)
const DELETION_WINDOW_MS: number = (() => {
    let raw: any = undefined;
    try {
        // @ts-ignore
        raw = import.meta?.env?.VITE_DELETION_WINDOW_MS;
    } catch {}
    if (raw === undefined && typeof process !== 'undefined') {
        // @ts-ignore
        raw = process.env.VITE_DELETION_WINDOW_MS;
    }
    const parsed = parseInt(raw, 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 3600_000; // fallback 2 minuto
})();

interface UserSession {
    id: string;
    name: string;
    email: string;
    country?: string;
    language?: Language;
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

interface DocInsightDraft {
    metadata: Record<string, string>;
    notes: string;
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
    initialTab?: 'overview' | 'itinerary' | 'budget' | 'documents';
    isAuthenticated: boolean;
}> = ({ trip, updateTrip, goBack, lang, theme, onDeleteRequest, resizeImageUtil, handleCoverImageUploadUtil, allImages, onDeleteImage, apiKey, showToast, initialTab = 'overview', isAuthenticated }) => {
    const [activeTab, setActiveTab] = useState<'overview' | 'itinerary' | 'budget' | 'documents' | 'insights'>(initialTab);
    const [isGeneratingImage, setIsGeneratingImage] = useState(false);
    const [isGeneratingSummary, setIsGeneratingSummary] = useState(false);
    const [showImageEditor, setShowImageEditor] = useState(false);
    const [showEditModal, setShowEditModal] = useState(false);
    const [toolPanelTab, setToolPanelTab] = useState<'converter' | 'maps'>('maps');
    const [docFilter, setDocFilter] = useState<'all' | 'flight' | 'hotel' | 'airbnb' | 'food' | 'other'>('all');
    const [notesTab, setNotesTab] = useState<'notes' | 'gallery'>('gallery');

    // Missing State Variables Added
    const [deleteImageTarget, setDeleteImageTarget] = useState<GalleryImage | null>(null);
    const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
    const [showDeleteTripConfirm, setShowDeleteTripConfirm] = useState(false);
    const [docInsightsDraft, setDocInsightsDraft] = useState<Record<string, DocInsightDraft>>({});
    const [leftPanelTab, setLeftPanelTab] = useState<'diary' | 'notes' | 'converter'>('diary');
    const [previewDoc, setPreviewDoc] = useState<any | null>(null);
    const [selectedAttraction, setSelectedAttraction] = useState<{ url: string; title: string; desc: string } | null>(null);

    const coverInputRef = useRef<HTMLInputElement>(null);
    const t = translations[lang];
    const isLight = theme === 'light';

    // Local state for editing to prevent jitter and allow cancel
    const [editForm, setEditForm] = useState<Partial<Trip>>({});

    useEffect(() => {
        if (showEditModal) {
            setEditForm({ ...trip });
        }
    }, [showEditModal, trip]);

    useEffect(() => {
        const initialDrafts: Record<string, DocInsightDraft> = {};
        (trip.documents || []).forEach(doc => {
            const normalizedMeta: Record<string, string> = {};
            Object.entries(doc.metadata || {}).forEach(([key, value]) => {
                if (value === undefined || value === null) return;
                normalizedMeta[key] = typeof value === 'string' ? value : JSON.stringify(value);
            });
            initialDrafts[doc.id] = {
                metadata: normalizedMeta,
                notes: doc.notes || ''
            };
        });
        setDocInsightsDraft(initialDrafts);
    }, [trip.documents]);

    const performDeleteImage = () => {
        if (deleteImageTarget) {
            onDeleteImage(deleteImageTarget);
            setDeleteImageTarget(null);
        }
    };

    // Auto generators disabled per request

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
        
        // If destination changed, generate new cover image
        if (editForm.destination && editForm.destination !== trip.destination && editForm.destination !== 'New Adventure') {
            generateTripImage(editForm.destination, trip.type).then(imageUrl => {
                const tripWithNewImage = { ...updatedTrip, coverImage: imageUrl };
                updateTrip(tripWithNewImage as Trip);
                showToast('Destination image updated!', 'success');
            }).catch(err => {
                console.warn('Failed to generate new destination image:', err);
            });
        }
    };

    const diaryImages = useMemo(() => allImages.filter(img => img.type !== 'cover'), [allImages]);
    const destinationGallery = useMemo(() => {
        const seed = encodeURIComponent((trip.destination || 'travel').toLowerCase());
        // Use Picsum with seeded images to avoid Unavailable responses and hotlink issues
        return Array.from({ length: 9 }).map((_, i) => `https://picsum.photos/seed/${seed}-${i}/800/800`);
    }, [trip.destination]);
    const mapsEmbedUrl = useMemo(() => {
        if (!trip.destination) return 'https://www.google.com/maps?output=embed';
        return `https://www.google.com/maps?q=${encodeURIComponent(trip.destination)}&output=embed`;
    }, [trip.destination]);

    return (
        <div className="animate-fade-in pb-20">
            {/* New Trip Header — reference-inspired */}
            <section className="relative mx-auto max-w-7xl px-4 md:px-6 pt-6">
                <div className="grid gap-6 md:grid-cols-2 items-stretch">
                    <div className="rounded-2xl bg-neutral-950/70 ring-1 ring-white/10 p-5 md:p-8 flex flex-col gap-4 justify-between shadow-[0_12px_40px_rgba(0,0,0,0.45)] order-2 md:order-1 relative">
                        <div className="absolute top-4 right-4 flex gap-1.5">
                            <button onClick={() => setShowEditModal(true)} className="h-8 w-8 rounded-md border border-emerald-400 text-white hover:bg-white/10 transition flex items-center justify-center" title={t.editParams}>
                                <Edit2 size={12} />
                                <span className="sr-only">{t.editParams}</span>
                            </button>
                            <button
                                onClick={() => {
                                    const enforceWindow = !isAuthenticated;
                                    const expired = enforceWindow && (!trip.createdAt || Date.now() - new Date(trip.createdAt).getTime() > DELETION_WINDOW_MS);
                                    if (expired) { showToast('Deletion window expired.', 'info'); return; }
                                    setShowDeleteTripConfirm(true);
                                }}
                                className="h-8 w-8 rounded-md border border-red-500/50 text-red-300 hover:bg-red-500/10 transition flex items-center justify-center"
                                title={t.deleteMission}
                            >
                                <Trash2 size={12} />
                            </button>
                        </div>

                        <div className="space-y-3 pr-16">
                            <div className="inline-flex items-center gap-2 rounded-full px-3 py-1 ring-1 ring-white/10 bg-white/5 text-[11px] md:text-xs text-neutral-200 uppercase tracking-[0.25em]">
                                <Wand2 className="text-emerald-400" size={14} />
                                {trip.type} • {trip.status}
                            </div>
                            <div>
                                <h1 onClick={() => setShowEditModal(true)} className="text-3xl md:text-5xl font-semibold tracking-tight leading-[1.1] cursor-pointer">
                                    {trip.destination}
                                </h1>
                                <p className="mt-2 text-neutral-300 text-sm md:text-base font-mono">
                                    {new Date(trip.startDate).toLocaleDateString()} — {new Date(trip.endDate).toLocaleDateString()} • {trip.currency} {trip.budget.toLocaleString()}
                                </p>
                            </div>
                        </div>

                        <div className="mt-2 flex flex-wrap gap-3">
                            <button onClick={goBack} className="inline-flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm md:text-base font-semibold bg-white text-neutral-950 hover:bg-acid transition shadow-lg">
                                <ArrowLeft size={16} /> {t.dashboard}
                            </button>
                        </div>
                    </div>

                    <div className="relative rounded-2xl overflow-hidden ring-1 ring-white/10 bg-neutral-900/50 h-[200px] md:h-[260px] lg:h-[270px] order-1 md:order-2">
                        <LazyImage src={trip.coverImage} alt={trip.destination} className="w-full h-full object-cover" />
                        <div className="absolute inset-0 bg-gradient-to-b from-black/10 via-black/40 to-black/80" />
                        <div className="absolute top-4 right-4 z-10">
                            <span className="inline-flex items-center gap-1 rounded-md bg-emerald-500/10 text-emerald-300 px-2 py-1 text-[11px] ring-1 ring-emerald-500/30">
                                <Compass size={12} /> {trip.type}
                            </span>
                        </div>
                        <div className="absolute top-4 left-4 flex items-center gap-2 z-10">
                            <button onClick={() => setShowImageEditor(true)} className="inline-flex items-center gap-1 rounded-md bg-white/10 text-white px-2 py-1 text-[11px] ring-1 ring-white/20 hover:bg-white/20 transition">
                                <Wand2 size={12} /> {t.editImage}
                            </button>
                            <button onClick={() => coverInputRef.current?.click()} className="inline-flex items-center gap-1 rounded-md bg-white/10 text-white px-2 py-1 text-[11px] ring-1 ring-white/20 hover:bg-white/20 transition">
                                <Upload size={12} /> {t.uploadImage}
                            </button>
                            <input type="file" ref={coverInputRef} className="hidden" accept="image/*" onChange={(e) => handleCoverImageUploadUtil(e, trip, updateTrip)} />
                        </div>
                        <div className="absolute inset-x-0 bottom-0 p-4 md:p-5 bg-gradient-to-t from-neutral-950/90 via-neutral-950/50 to-transparent">
                            <div className="flex flex-wrap gap-4 text-[11px] md:text-xs text-neutral-200 font-mono">
                                <span className="inline-flex items-center gap-1"><CalendarIcon size={12} /> {Math.max(1, Math.ceil((new Date(trip.endDate).getTime() - new Date(trip.startDate).getTime())/(1000*60*60*24)))} días</span>
                                <span className="inline-flex items-center gap-1"><Wallet size={12} /> {trip.currency} {trip.budget.toLocaleString()}</span>
                            </div>
                        </div>
                    </div>
                </div>
                {/* Overview badges under header */}
                <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-3">
                    <div className="rounded-lg bg-neutral-900/60 ring-1 ring-white/10 p-3">
                        <div className="text-xs text-neutral-400">Días</div>
                        <div className="mt-1 text-lg font-semibold tracking-tight">{Math.max(1, Math.ceil((new Date(trip.endDate).getTime() - new Date(trip.startDate).getTime())/(1000*60*60*24)))}</div>
                    </div>
                    <div className="rounded-lg bg-neutral-900/60 ring-1 ring-white/10 p-3">
                        <div className="text-xs text-neutral-400">Gasto total</div>
                        <div className="mt-1 text-lg font-semibold tracking-tight">{(trip.expenses?.reduce((s,e)=>s+(e.amount||0),0) || 0).toLocaleString()}</div>
                    </div>
                    <div className="rounded-lg bg-neutral-900/60 ring-1 ring-white/10 p-3">
                        <div className="text-xs text-neutral-400">Restante</div>
                        <div className="mt-1 text-lg font-semibold tracking-tight">{Math.max(0, (trip.budget||0) - (trip.expenses?.reduce((s,e)=>s+(e.amount||0),0) || 0)).toLocaleString()}</div>
                    </div>
                    <div className="rounded-lg bg-neutral-900/60 ring-1 ring-white/10 p-3">
                        <div className="text-xs text-neutral-400">Docs</div>
                        <div className="mt-1 text-lg font-semibold tracking-tight">{trip.documents?.length || 0}</div>
                    </div>
                </div>
            </section>

            {/* Navigation Tabs — streamlined */}
            <div className={`flex items-center justify-center gap-2 mb-8 overflow-x-auto pb-2 no-scrollbar border-b sticky top-0 backdrop-blur-sm z-[80] pt-2 ${isLight ? 'bg-white/70 border-neutral-300' : 'bg-neutral-950/70 border-white/10'}`}>
                {[
                    { id: 'overview', icon: Check, label: t.overview },
                    { id: 'itinerary', icon: MapIcon, label: t.itinerary },
                    { id: 'documents', icon: FileText, label: t.documents },
                    { id: 'budget', icon: Wallet, label: t.budget }
                ].map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id as any)}
                        className={`flex items-center gap-2 px-6 py-3 text-xs transition-all border-b-2 whitespace-nowrap ${activeTab === tab.id
                            ? 'border-emerald-500 text-emerald-400 font-semibold'
                            : 'border-transparent text-neutral-300 hover:text-white hover:border-white/10'
                            }`}
                    >
                        <tab.icon size={16} /> {tab.label}
                    </button>
                ))}
            </div>

            {/* Tab Content - natural height (no internal scroll) */}
            <div className="relative">
                <Suspense fallback={<div className="flex justify-center py-20"><Loader2 className="animate-spin text-acid" size={32} /></div>}>
                    {activeTab === 'overview' && (
                        <div className="animate-fade-in px-0 md:px-0 w-full">
                            {/* Card grid overview */}
                            <section className="mx-auto max-w-7xl px-4 md:px-6">
                                <div className="grid md:grid-cols-3 gap-6">
                                    <div className="rounded-xl p-6 bg-neutral-900/60 ring-1 ring-white/10 hover:ring-white/20 transition">
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 rounded-md bg-emerald-500/15 ring-1 ring-emerald-500/30 flex items-center justify-center text-emerald-300">
                                                    <Goal className="w-5 h-5" />
                                                </div>
                                                <h3 className="text-lg font-semibold tracking-tight">{t.visualDiary}</h3>
                                            </div>
                                            {/* Regenerar visual removed */}
                                        </div>
                                        <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                                            {diaryImages.length === 0 && (
                                                <div className="col-span-full py-10 text-center text-[10px] font-mono border border-dashed rounded-xl flex flex-col items-center justify-center gap-2 text-neutral-300">
                                                    <ImageIcon size={24} className="opacity-50" />
                                                    {t.galleryEmpty}
                                                </div>
                                            )}
                                            {diaryImages.slice(0, 8).map((img) => {
                                                const originalIndex = allImages.indexOf(img);
                                                return (
                                                    <div key={`${img.type}-${img.dayId}-${img.index}-${originalIndex}`} className="aspect-square rounded-xl overflow-hidden bg-neutral-950/60 ring-1 ring-white/10 relative group cursor-pointer">
                                                        <LazyImage
                                                            src={img.src}
                                                            alt={img.label}
                                                            className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                                                            onClick={() => setLightboxIndex(originalIndex)}
                                                        />
                                                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors pointer-events-none"></div>
                                                        <button
                                                            onClick={(e) => { e.stopPropagation(); setDeleteImageTarget(img); }}
                                                            className="absolute top-2 right-2 p-1.5 bg-black/50 text-white hover:bg-red-500 rounded-full opacity-0 group-hover:opacity-100 transition-all backdrop-blur-sm z-10"
                                                            title="Delete Image"
                                                        >
                                                            <Trash2 size={12} />
                                                        </button>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                    <div className="rounded-xl p-6 bg-neutral-900/60 ring-1 ring-white/10 hover:ring-white/20 transition">
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 rounded-md bg-emerald-500/15 ring-1 ring-emerald-500/30 flex items-center justify-center text-emerald-300">
                                                <Sparkles className="w-5 h-5" />
                                            </div>
                                            <h3 className="text-lg font-semibold tracking-tight">{t.missionNotes}</h3>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <button onClick={() => setNotesTab('gallery')} className={`px-2.5 py-1 rounded-md text-[11px] ring-1 ring-white/10 ${notesTab==='gallery'?'bg-emerald-500/20 text-emerald-300':'bg-neutral-950/60 text-neutral-300 hover:bg-white/5'}`}>Galería</button>
                                                <button onClick={() => setNotesTab('notes')} className={`px-2.5 py-1 rounded-md text-[11px] ring-1 ring-white/10 ${notesTab==='notes'?'bg-emerald-500/20 text-emerald-300':'bg-neutral-950/60 text-neutral-300 hover:bg-white/5'}`}>Notas</button>
                                            </div>
                                        </div>
                                        {notesTab === 'notes' ? (
                                            <div className="mt-4">
                                                <label className="text-[11px] text-neutral-400 block mb-1">{t.missionNotes}</label>
                                                <textarea
                                                    value={trip.notes || ''}
                                                    onChange={(e) => updateTrip({ ...trip, notes: e.target.value })}
                                                    placeholder="Escribe tu resumen de la misión…"
                                                    className="w-full min-h-[120px] bg-neutral-950/60 ring-1 ring-white/10 rounded-lg p-3 text-sm text-neutral-200 placeholder-neutral-400 focus:ring-emerald-500/40 focus:outline-none"
                                                />
                                            </div>
                                        ) : (
                                            <div className="mt-4 grid grid-cols-3 gap-2">
                                                {destinationGallery.map((url, idx) => (
                                                    <button
                                                        key={idx}
                                                        onClick={() => {
                                                            const title = `${trip.destination} · Atracción ${idx + 1}`;
                                                            const desc = `Descubre esta atracción destacada en ${trip.destination}. Ideal para fotos y paseo.
Ubicación aproximada: centro de la ciudad · Recomendado: tarde dorada`;
                                                            setSelectedAttraction({ url, title, desc });
                                                        }}
                                                        className="aspect-square rounded-lg overflow-hidden bg-neutral-950/60 ring-1 ring-white/10 hover:ring-emerald-500/30 focus:outline-none"
                                                        title="Ver detalle"
                                                    >
                                                        <LazyImage src={url} alt={`${trip.destination} gallery ${idx+1}`} className="w-full h-full object-cover" />
                                                    </button>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                    <div className="rounded-xl p-6 bg-neutral-900/60 ring-1 ring-white/10 hover:ring-white/20 transition">
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 rounded-md bg-emerald-500/15 ring-1 ring-emerald-500/30 flex items-center justify-center text-emerald-300">
                                                    <DollarSign className="w-5 h-5" />
                                                </div>
                                                <h3 className="text-lg font-semibold tracking-tight">Herramientas</h3>
                                            </div>
                                            <div className="flex items-center gap-2 text-[11px] font-mono">
                                                {[
                                                    { id: 'maps', label: 'Maps' },
                                                    { id: 'converter', label: 'Converter' }
                                                ].map(tab => (
                                                    <button
                                                        key={tab.id}
                                                        onClick={() => setToolPanelTab(tab.id as 'converter' | 'maps')}
                                                        className={`px-3 py-1 rounded-full border transition ${toolPanelTab === tab.id ? 'border-emerald-400 text-emerald-300 bg-emerald-500/10' : 'border-white/10 text-neutral-300 hover:border-emerald-400/60 hover:text-white'}`}
                                                    >
                                                        {tab.label}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                        <p className="mt-3 text-sm text-neutral-300">
                                            {toolPanelTab === 'maps' ? 'Visualiza el destino en Google Maps.' : 'Convierte rápidamente a tu moneda.'}
                                        </p>
                                        <div className="mt-4">
                                            {toolPanelTab === 'maps' ? (
                                                <div className="w-full overflow-hidden rounded-xl ring-1 ring-white/10 bg-neutral-950/60">
                                                    <iframe
                                                        title="Mapa del destino"
                                                        src={mapsEmbedUrl}
                                                        loading="lazy"
                                                        referrerPolicy="no-referrer-when-downgrade"
                                                        className="w-full h-64 md:h-72"
                                                        allowFullScreen
                                                    ></iframe>
                                                </div>
                                            ) : (
                                                <Suspense fallback={<div className="h-20 bg-neutral-950/60 ring-1 ring-white/10 rounded-lg animate-pulse"></div>}>
                                                    <CurrencyConverter lang={lang} />
                                                </Suspense>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </section>
                        </div>
                    )}
                    {activeTab === 'itinerary' && (
                        <div className="px-0 md:px-0 w-full">
                            <section className="mx-auto max-w-7xl px-4 md:px-6">
                                <div className="grid md:grid-cols-3 gap-6">
                                    <div className="md:col-span-2 rounded-xl p-6 bg-neutral-900/60 ring-1 ring-white/10 hover:ring-white/20 transition">
                                        <div className="flex items-center justify-between">
                                            <h4 className="text-lg font-semibold tracking-tight">{t.itinerary}</h4>
                                            {/* AI itinerary button removed */}
                                        </div>
                                        <div className="mt-4">
                                            <TripItinerary trip={trip} updateTrip={updateTrip} lang={lang} showToast={showToast} />
                                        </div>
                                    </div>
                                    <div className="rounded-xl p-6 bg-neutral-900/60 ring-1 ring-white/10 hover:ring-white/20 transition">
                                        <h4 className="text-lg font-semibold tracking-tight">{t.overview}</h4>
                                        <p className="mt-3 text-sm text-neutral-300">{Math.max(1, Math.ceil((new Date(trip.endDate).getTime() - new Date(trip.startDate).getTime())/(1000*60*60*24)))} días • {trip.type}</p>
                                        <div className="mt-4 grid grid-cols-2 gap-3">
                                            <div className="rounded-lg bg-neutral-950/60 ring-1 ring-white/10 p-3">
                                                <div className="text-xs text-neutral-400">Presupuesto</div>
                                                <div className="mt-1 text-lg font-semibold tracking-tight">{trip.currency} {trip.budget.toLocaleString()}</div>
                                            </div>
                                            <div className="rounded-lg bg-neutral-950/60 ring-1 ring-white/10 p-3">
                                                <div className="text-xs text-neutral-400">Documentos</div>
                                                <div className="mt-1 text-lg font-semibold tracking-tight">{trip.documents?.length || 0}</div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </section>
                        </div>
                    )}
                    {activeTab === 'budget' && (
                        <div className="px-0 md:px-0 w-full">
                            <section className="mx-auto max-w-7xl px-4 md:px-6">
                                <div className="grid md:grid-cols-3 gap-6">
                                    <div className="md:col-span-2 rounded-xl p-6 bg-neutral-900/60 ring-1 ring-white/10 hover:ring-white/20 transition">
                                        <div className="flex items-center justify-between">
                                            <h4 className="text-lg font-semibold tracking-tight">{t.budget}</h4>
                                            {/* AI budget button removed */}
                                        </div>
                                        <div className="mt-4">
                                            <BudgetOverview trip={trip} addExpense={(e) => updateTrip({ ...trip, expenses: [...trip.expenses, e] })} removeExpense={(id) => updateTrip({ ...trip, expenses: trip.expenses.filter(e => e.id !== id) })} currencySymbol={trip.currency} lang={lang} theme={theme} />
                                        </div>
                                    </div>
                                    <div className="rounded-xl p-6 bg-neutral-900/60 ring-1 ring-white/10 hover:ring-white/20 transition">
                                        <h4 className="text-lg font-semibold tracking-tight">Resumen</h4>
                                        <div className="mt-4 grid grid-cols-2 gap-3">
                                            <div className="rounded-lg bg-neutral-950/60 ring-1 ring-white/10 p-3">
                                                <div className="text-xs text-neutral-400">Total gastos</div>
                                                <div className="mt-1 text-lg font-semibold tracking-tight">{trip.expenses?.reduce((s, e) => s + (e.amount || 0), 0).toLocaleString()}</div>
                                            </div>
                                            <div className="rounded-lg bg-neutral-950/60 ring-1 ring-white/10 p-3">
                                                <div className="text-xs text-neutral-400">Items</div>
                                                <div className="mt-1 text-lg font-semibold tracking-tight">{trip.expenses?.length || 0}</div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </section>
                        </div>
                    )}
                    {activeTab === 'documents' && (
                        <div className="px-0 md:px-0 w-full">
                            <section className="mx-auto max-w-7xl px-4 md:px-6">
                                <div className="grid lg:grid-cols-12 gap-6">
                                    {/* Sidebar filters */}
                                    <aside className="lg:col-span-3 rounded-xl p-4 bg-neutral-900/60 ring-1 ring-white/10">
                                        <h4 className="text-base font-semibold tracking-tight mb-3">Filtros</h4>
                                        <div className="grid grid-cols-2 gap-1.5">
                                            {['all','flight','hotel','airbnb','food','other'].map((c) => (
                                                <button key={c} onClick={() => setDocFilter(c as any)} className={`px-2.5 py-1.5 rounded-md text-[11px] ring-1 ring-white/10 ${docFilter===c? 'bg-emerald-500/20 text-emerald-300' : 'bg-neutral-950/60 text-neutral-300 hover:bg-white/5'}`}>{c.toUpperCase()}</button>
                                            ))}
                                        </div>
                                        <div className="mt-4 grid grid-cols-2 gap-2">
                                            <div className="rounded-lg bg-neutral-950/60 ring-1 ring-white/10 p-2.5">
                                                <div className="text-[11px] text-neutral-400">Total docs</div>
                                                <div className="mt-1 text-base font-semibold tracking-tight">{trip.documents?.length || 0}</div>
                                            </div>
                                            <div className="rounded-lg bg-neutral-950/60 ring-1 ring-white/10 p-2.5">
                                                <div className="text-[11px] text-neutral-400">Categorías</div>
                                                <div className="mt-1 text-base font-semibold tracking-tight">{trip.documentCategories?.length || 0}</div>
                                            </div>
                                        </div>
                                    </aside>
                                    {/* Main content */}
                                    <div className="lg:col-span-9 rounded-xl p-5 bg-neutral-900/60 ring-1 ring-white/10">
                                        <div className="flex items-center justify-between">
                                            <h4 className="text-base font-semibold tracking-tight">{t.documents}</h4>
                                            <div className="flex items-center gap-2">
                                                <label className="text-[10px] font-mono border border-dim px-2 py-1 rounded-full hover:border-emerald-500 hover:text-emerald-400 transition-colors flex items-center gap-1 cursor-pointer">
                                                    <Files size={10} /> Subir
                                                    <input type="file" multiple className="hidden" onChange={async (e) => {
                                                        const files = Array.from(e.target.files || []);
                                                        if (!files.length) return;
                                                        let updated = { ...trip };
                                                        const ensureFirstDay = () => {
                                                            if (!updated.itinerary || updated.itinerary.length === 0) {
                                                                updated.itinerary = [{ id: crypto.randomUUID(), date: new Date(updated.startDate || Date.now()).toISOString(), activities: [] } as any];
                                                            }
                                                        };
                                                        for (const f of files) {
                                                            const reader = new FileReader();
                                                            const dataUrl = await new Promise<string>((res, rej) => { reader.onload = () => res(reader.result as string); reader.onerror = rej; reader.readAsDataURL(f); });
                                                            const name = f.name.toLowerCase();
                                                            const cat = name.includes('flight') || name.includes('pnr') ? 'flight' : name.includes('hotel') ? 'hotel' : name.includes('airbnb') ? 'airbnb' : name.includes('food') || name.includes('receipt') ? 'food' : 'other';
                                                            const doc = { id: crypto.randomUUID(), name: f.name, category: cat, dataUrl, dateAdded: new Date().toISOString() } as any;
                                                            updated.documents = [...(updated.documents||[]), doc];

                                                            // Basic extraction for flight PDFs -> map to itinerary info block
                                                            const isPdf = dataUrl.startsWith('data:application/pdf') || f.name.toLowerCase().endsWith('.pdf') || dataUrl.includes('pdf');
                                                            if (cat === 'flight' && isPdf) {
                                                                try {
                                                                    const meta = await extractFlightMetadataLocal(dataUrl);
                                                                    if (meta) {
                                                                        ensureFirstDay();
                                                                        const first = updated.itinerary[0];
                                                                        const block = {
                                                                            id: crypto.randomUUID(),
                                                                            title: `Ticket aéreo (${meta.bookingReference || 'PNR'})`,
                                                                            description: `${meta.outbound?.route || ''} ${meta.outbound?.departureDate || ''} ${meta.outbound?.departureTime || ''} → ${meta.outbound?.arrivalTime || ''}`.trim(),
                                                                            images: [],
                                                                            data: {
                                                                                bookingReference: meta.bookingReference || null,
                                                                                airline: meta.outbound?.airline || null,
                                                                                outbound: meta.outbound || null,
                                                                                return: meta.return || null
                                                                            }
                                                                        } as any;
                                                                        first.infoBlocks = [...(first.infoBlocks||[]), block];
                                                                        showToast('Datos de vuelo extraídos.', 'success');
                                                                    } else {
                                                                        // Fallback: extraer por nombre de archivo
                                                                        const IATA_RE = /\b([A-Z]{3})[-_ ]([A-Z]{3})\b/;
                                                                        const PNR_RE = /\b([A-Z0-9]{5,8})\b/;
                                                                        const DATE_RE = /(20\d{2}[-_ ]\d{2}[-_ ]\d{2}|\d{2}[-_ ]\d{2}[-_ ]20\d{2})/;
                                                                        const routeMatch = f.name.toUpperCase().match(IATA_RE);
                                                                        const pnrMatch = f.name.toUpperCase().match(PNR_RE);
                                                                        const dateMatch = f.name.toUpperCase().match(DATE_RE);
                                                                        if (routeMatch || pnrMatch || dateMatch) {
                                                                            ensureFirstDay();
                                                                            const first = updated.itinerary[0];
                                                                            const route = routeMatch ? `${routeMatch[1]} → ${routeMatch[2]}` : '';
                                                                            const title = `Ticket aéreo (${pnrMatch ? pnrMatch[1] : 'PNR'})`;
                                                                            const description = `${route} ${dateMatch ? dateMatch[1].replace(/[-_ ]/g,'-') : ''}`.trim();
                                                                            const block = { id: crypto.randomUUID(), title, description, images: [], data: { bookingReference: pnrMatch ? pnrMatch[1] : null, outbound: { route, departureDate: dateMatch ? dateMatch[1].replace(/[-_ ]/g,'-') : null } } } as any;
                                                                            first.infoBlocks = [...(first.infoBlocks||[]), block];
                                                                            showToast('Datos de vuelo inferidos por nombre.', 'success');
                                                                        } else {
                                                                            showToast('No se detectaron datos de vuelo.', 'info');
                                                                        }
                                                                    }
                                                                } catch (err) {
                                                                    showToast('Error al extraer datos de vuelo.', 'error');
                                                                }
                                                            }
                                                        }
                                                        // Mantener categorías únicas
                                                        const cats = Array.from(new Set([...(updated.documentCategories||[]), ...updated.documents.map(d => d.category||'other')]))
                                                        updated.documentCategories = cats as any;
                                                        updateTrip(updated);
                                                        showToast('Documentos subidos.', 'success');
                                                    }} />
                                                </label>
                                            </div>
                                        </div>
                                        {/* Upload bar */}
                                        <div
                                            onDragOver={(e) => { e.preventDefault(); }}
                                            onDrop={async (e) => {
                                                e.preventDefault();
                                                const files = Array.from(e.dataTransfer.files || []);
                                                if (!files.length) return;
                                                let updated = { ...trip };
                                                for (const f of files) {
                                                    const reader = new FileReader();
                                                    const dataUrl = await new Promise<string>((res, rej) => { reader.onload = () => res(reader.result as string); reader.onerror = rej; reader.readAsDataURL(f); });
                                                    const name = f.name.toLowerCase();
                                                    const cat = name.includes('flight') || name.includes('pnr') ? 'flight' : name.includes('hotel') ? 'hotel' : name.includes('airbnb') ? 'airbnb' : name.includes('food') || name.includes('receipt') ? 'food' : 'other';
                                                    const doc = { id: crypto.randomUUID(), name: f.name, category: cat, dataUrl, dateAdded: new Date().toISOString() } as any;
                                                    updated.documents = [...(updated.documents||[]), doc];

                                                    // Extraction for dropped flight PDFs
                                                    const isPdf = dataUrl.startsWith('data:application/pdf') || f.name.toLowerCase().endsWith('.pdf') || dataUrl.includes('pdf');
                                                    if (cat === 'flight' && isPdf) {
                                                        try {
                                                            const meta = await extractFlightMetadataLocal(dataUrl);
                                                            if (meta) {
                                                                if (!updated.itinerary || updated.itinerary.length === 0) {
                                                                    updated.itinerary = [{ id: crypto.randomUUID(), date: new Date(updated.startDate || Date.now()).toISOString(), activities: [] } as any];
                                                                }
                                                                const first = updated.itinerary[0];
                                                                const block = {
                                                                    id: crypto.randomUUID(),
                                                                    title: `Ticket aéreo (${meta.bookingReference || 'PNR'})`,
                                                                    description: `${meta.outbound?.route || ''} ${meta.outbound?.departureDate || ''} ${meta.outbound?.departureTime || ''} → ${meta.outbound?.arrivalTime || ''}`.trim(),
                                                                    images: [],
                                                                    data: {
                                                                        bookingReference: meta.bookingReference || null,
                                                                        airline: meta.outbound?.airline || null,
                                                                        outbound: meta.outbound || null,
                                                                        return: meta.return || null
                                                                    }
                                                                } as any;
                                                                first.infoBlocks = [...(first.infoBlocks||[]), block];
                                                                showToast('Datos de vuelo extraídos.', 'success');
                                                            } else {
                                                                // Fallback: nombre de archivo
                                                                const IATA_RE = /\b([A-Z]{3})[-_ ]([A-Z]{3})\b/;
                                                                const PNR_RE = /\b([A-Z0-9]{5,8})\b/;
                                                                const DATE_RE = /(20\d{2}[-_ ]\d{2}[-_ ]\d{2}|\d{2}[-_ ]\d{2}[-_ ]20\d{2})/;
                                                                const routeMatch = f.name.toUpperCase().match(IATA_RE);
                                                                const pnrMatch = f.name.toUpperCase().match(PNR_RE);
                                                                const dateMatch = f.name.toUpperCase().match(DATE_RE);
                                                                if (routeMatch || pnrMatch || dateMatch) {
                                                                    if (!updated.itinerary || updated.itinerary.length === 0) {
                                                                        updated.itinerary = [{ id: crypto.randomUUID(), date: new Date(updated.startDate || Date.now()).toISOString(), activities: [] } as any];
                                                                    }
                                                                    const first = updated.itinerary[0];
                                                                    const route = routeMatch ? `${routeMatch[1]} → ${routeMatch[2]}` : '';
                                                                    const title = `Ticket aéreo (${pnrMatch ? pnrMatch[1] : 'PNR'})`;
                                                                    const description = `${route} ${dateMatch ? dateMatch[1].replace(/[-_ ]/g,'-') : ''}`.trim();
                                                                    const block = { id: crypto.randomUUID(), title, description, images: [], data: { bookingReference: pnrMatch ? pnrMatch[1] : null, outbound: { route, departureDate: dateMatch ? dateMatch[1].replace(/[-_ ]/g,'-') : null } } } as any;
                                                                    first.infoBlocks = [...(first.infoBlocks||[]), block];
                                                                    showToast('Datos de vuelo inferidos por nombre.', 'success');
                                                                } else {
                                                                    showToast('No se detectaron datos de vuelo.', 'info');
                                                                }
                                                            }
                                                        } catch (err) {
                                                            showToast('Error al extraer datos de vuelo.', 'error');
                                                        }
                                                    }
                                                }
                                                // Actualizar categorías agregadas
                                                const cats = Array.from(new Set([...(updated.documentCategories||[]), ...updated.documents.map(d => d.category||'other')]))
                                                updated.documentCategories = cats as any;
                                                updateTrip(updated);
                                                showToast('Documentos agregados.', 'success');
                                            }}
                                            className="mt-3 w-full rounded-xl border border-white/10 bg-neutral-950/60 p-3 text-[12px] text-neutral-300"
                                        >
                                            Arrastra y suelta tus archivos aquí para subirlos.
                                        </div>
                                        {/* Grid */}
                                        <div className="mt-4 grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3">
                                            {(trip.documents || []).filter(d => {
                                                if (!docFilter || docFilter==='all') return true;
                                                return (d.category||'other') === docFilter;
                                            }).map((d) => {
                                                const isImg = (d.dataUrl || '').startsWith('data:image');
                                                return (
                                                    <div key={d.id} className="rounded-xl bg-neutral-900/60 ring-1 ring-white/10 hover:ring-white/20 transition overflow-hidden group">
                                                        <div className="h-28 bg-neutral-900/60 relative">
                                                            {isImg ? (
                                                                <LazyImage src={d.dataUrl} alt={d.name} className="w-full h-full object-cover" />
                                                            ) : (
                                                                <div className="w-full h-full flex items-center justify-center text-neutral-300 text-[11px]">
                                                                    <Files size={12} className="text-emerald-400 mr-1" /> {d.name.split('.').pop()?.toUpperCase()} file
                                                                </div>
                                                            )}
                                                            <button
                                                                onClick={() => {
                                                                    const updated = { ...trip, documents: (trip.documents || []).filter(x => x.id !== d.id) };
                                                                    updateTrip(updated);
                                                                    showToast('Documento eliminado.', 'info');
                                                                }}
                                                                className="absolute top-2 right-2 p-1.5 bg-black/50 text-white hover:bg-red-500 rounded-md opacity-0 group-hover:opacity-100 transition-all ring-1 ring-white/20"
                                                                title="Eliminar"
                                                            >
                                                                <Trash2 size={12} />
                                                            </button>
                                                            <button
                                                                onClick={(e) => { e.stopPropagation(); setPreviewDoc(d); }}
                                                                className="absolute top-2 left-2 p-1.5 bg-black/50 text-white hover:bg-white/70 hover:text-black rounded-md opacity-100 transition-all ring-1 ring-white/20"
                                                                title="Abrir documento"
                                                            >
                                                                <ExternalLink size={12} />
                                                            </button>
                                                        </div>
                                                        <div className="p-3 space-y-1.5 border-t border-white/10">
                                                            <div className="text-[11px] font-semibold truncate text-neutral-100">{d.name}</div>
                                                            <div className="flex items-center justify-between">
                                                                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 text-emerald-300 px-2 py-0.5 text-[10px] ring-1 ring-emerald-500/30">{d.category || 'other'}</span>
                                                                <span className="text-[10px] text-neutral-400">{new Date(d.dateAdded).toLocaleDateString()}</span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                            {(trip.documents || []).filter(d => {
                                                if (!docFilter || docFilter==='all') return true;
                                                return (d.category||'other') === docFilter;
                                            }).length === 0 && (
                                                <div className="col-span-full text-[12px] text-neutral-300 ring-1 ring-white/10 rounded-xl p-6 bg-neutral-900/60">
                                                    No hay documentos para este filtro.
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </section>
                        </div>
                    )}
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
            {
                showEditModal && (
                    <div className="fixed inset-0 z-[200] bg-black/90 backdrop-blur-sm flex justify-center items-end md:items-center p-0 md:p-4 animate-fade-in">
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
                )
            }

            {/* Delete Image Modal */}
            {
                deleteImageTarget && (
                    <div className="fixed inset-0 bg-black/90 backdrop-blur-sm z-[1100] flex items-center justify-center p-4 animate-fade-in">
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
                )
            }

            {/* Global Lightbox */}
            {
                lightboxIndex !== null && (
                    <div className="fixed inset-0 z-[999] bg-black/98 backdrop-blur-xl flex flex-col animate-fade-in" onClick={() => setLightboxIndex(null)}>
                        <div className="absolute top-0 left-0 right-0 p-6 flex justify-between items-start z-20">
                            <div className="text-white">
                                <h3 className="font-display font-bold text-xl uppercase tracking-wide">{allImages[lightboxIndex].label}</h3>
                                <p className="font-mono text-xs text-acid">{new Date(allImages[lightboxIndex].date).toLocaleDateString()}</p>
                            </div>
                            <div className="flex gap-4">
                                <button
                                    onClick={(e) => { e.stopPropagation(); setDeleteImageTarget(allImages[lightboxIndex]); }}
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
                                className="w-auto h-auto max-w-[90vw] max-h-[85vh] object-contain shadow-2xl rounded-sm"
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
                )
            }

            {/* Delete Trip Confirmation */}
            {
                showDeleteTripConfirm && (
                    <div className="fixed inset-0 bg-black/90 backdrop-blur-sm z-[200] flex items-center justify-center p-4">
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
                )
            }

            {/* Document Preview Modal */}
            {previewDoc && (
                <div className="fixed inset-0 z-[140] bg-black/90 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in" onClick={() => setPreviewDoc(null)}>
                    <div className="w-full max-w-5xl bg-surface border border-border rounded-3xl shadow-2xl overflow-hidden" onClick={(e)=>e.stopPropagation()}>
                        <div className="flex items-center justify-between p-4 border-b border-border">
                            <div className="text-sm font-mono text-dim truncate">{previewDoc.name}</div>
                            <button className="p-2 rounded-full bg-black/40 text-white hover:bg-black/60" onClick={() => setPreviewDoc(null)}><X size={18} /></button>
                        </div>
                        <div className="h-[70vh] bg-panel">
                            { (previewDoc.dataUrl||'').startsWith('data:image') ? (
                                <img src={previewDoc.dataUrl} alt={previewDoc.name} className="w-full h-full object-contain" />
                            ) : (previewDoc.dataUrl||'').startsWith('data:application/pdf') ? (
                                <object data={previewDoc.dataUrl} type="application/pdf" className="w-full h-full">
                                    <p className="p-6 text-sm text-neutral-300">Tu navegador no puede embeber PDF. <a href={previewDoc.dataUrl} target="_blank" rel="noreferrer" className="text-emerald-400 underline">Abrir en nueva pestaña</a>.</p>
                                </object>
                            ) : (
                                <iframe src={previewDoc.dataUrl} className="w-full h-full" title="document-preview"></iframe>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Attraction Detail Modal */}
            {selectedAttraction && (
                <div className="fixed inset-0 z-[200] bg-black/90 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in" onClick={() => setSelectedAttraction(null)}>
                    <div className="w-full max-w-2xl bg-surface border border-border rounded-3xl shadow-2xl overflow-hidden" onClick={(e)=>e.stopPropagation()}>
                        <div className="flex items-center justify-between p-4 border-b border-border">
                            <div className="text-sm font-mono text-text truncate">{selectedAttraction.title}</div>
                            <button className="p-2 rounded-full bg-black/40 text-white hover:bg-black/60" onClick={() => setSelectedAttraction(null)}><X size={18} /></button>
                        </div>
                        <div className="grid md:grid-cols-2 gap-0">
                            <div className="bg-panel p-0">
                                <LazyImage src={selectedAttraction.url} alt={selectedAttraction.title} className="w-full h-full object-cover md:h-[360px]" />
                            </div>
                            <div className="p-5 bg-panel border-l border-border">
                                <h4 className="text-lg font-semibold tracking-tight mb-2">{trip.destination}</h4>
                                <p className="text-sm text-neutral-300 whitespace-pre-line">{selectedAttraction.desc}</p>
                                <div className="mt-4 grid grid-cols-2 gap-2 text-[11px] text-neutral-400">
                                    <div className="rounded-lg bg-neutral-900/60 ring-1 ring-white/10 p-2">
                                        Mejor horario
                                        <div className="text-neutral-200 mt-1">Golden hour</div>
                                    </div>
                                    <div className="rounded-lg bg-neutral-900/60 ring-1 ring-white/10 p-2">
                                        Entrada
                                        <div className="text-neutral-200 mt-1">Libre</div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div >
    );
};

const App: React.FC = () => {
    const { language, setLanguage, t, toggleLanguage } = useLanguage();
    const [user, setUser] = useState<UserSession | null>(null);
    const [trips, setTrips] = useState<Trip[]>([]);
    const [currentTripId, setCurrentTripId] = useState<string | null>(null);
    const [initialTab, setInitialTab] = useState<'overview' | 'itinerary' | 'budget' | 'documents'>('overview');
    const [loading, setLoading] = useState(true);
    const [settings, setSettings] = useState<Partial<AppState>>({ theme: 'dark' });
    const [toast, setToast] = useState<{ msg: string; type: ToastType } | null>(null);
    const apiKey = getSafeApiKey();
    const [globalSearch, setGlobalSearch] = useState('');

    // Demo Video Modal State
    const [showDemo, setShowDemo] = useState(false);

    // Stories Modal State
    const [showStories, setShowStories] = useState(false);

    // Pricing Modal State
    const [showPricing, setShowPricing] = useState(false);

    // Delete Trip Confirmation State
    const [tripToDelete, setTripToDelete] = useState<string | null>(null);

    // Budget Suggestion Modal State (legacy, no longer used)
    // Removed usage to avoid confusing duplicate overlays
    const [pendingNewTrip, setPendingNewTrip] = useState<Trip | null>(null);

    // Trip Mode Selector State
    const [showTripModeSelector, setShowTripModeSelector] = useState(false);
    const [aiSuggestedBudget, setAiSuggestedBudget] = useState<number | null>(null);
    // Estado para mostrar barra/overlay de espera mientras se prepara viaje IA
    const [creatingAiTrip, setCreatingAiTrip] = useState(false); // overlay visible
    const [aiPhase, setAiPhase] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
    const [aiError, setAiError] = useState<string | null>(null);
    // Auth modal state (used when clicking freemium notice to open signup)
    const [showAuthModal, setShowAuthModal] = useState(false);
    const [authInitialMode, setAuthInitialMode] = useState<'login' | 'signup'>('login');

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

    // Disable scroll when PricingModal is open
    useEffect(() => {
        if (showPricing) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = 'unset';
        }
        return () => {
            document.body.style.overflow = 'unset';
        };
    }, [showPricing]);

    // Disable scroll when Auth Modal is open
    useEffect(() => {
        if (showAuthModal) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = 'unset';
        }
        return () => {
            document.body.style.overflow = 'unset';
        };
    }, [showAuthModal]);

    const showToast = useCallback((msg: string, type: ToastType) => {
        setToast({ msg, type });
    }, []);

    const handleLogin = async (userData: UserSession) => {
        setUser(userData);
        localStorage.setItem('wanderlust_last_user', JSON.stringify(userData));

        // If user has a detected language (from signup), apply it
        if (userData.language) {
            setLanguage(userData.language);
        }

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

        if (trips.length >= 3) {
            showToast("Has alcanzado el límite de 3 viajes. Suscríbete para más.", 'info');
            setShowPricing(true);
            return;
        }

        // Show mode selector instead of directly creating trip
        setShowTripModeSelector(true);
    };

    const handleCreateTripManual = async () => {
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
            documentCategories: ['flight', 'hotel', 'airbnb', 'food', 'other'],
            createdAt: new Date().toISOString()
        };
        setPendingNewTrip(newTrip);
        setShowTripModeSelector(false);
        // Open the trip directly for manual editing
        setCurrentTripId(newTrip.id);
        const updatedTrips = [newTrip, ...trips];
        setTrips(updatedTrips);
        upsertTrip(user.id, newTrip);
        showToast('Trip created! Fill in the details.', 'success');
    };

    const handleCreateTripWithAI = async () => {
        if (!user) return;
        setCreatingAiTrip(true);
        setAiPhase('loading');
        setAiError(null);
        // generate quick suggestion locally
        const sug = generateQuickSuggestion();
        const mappedType = (['Leisure', 'Adventure', 'Family', 'Romantic', 'Solo', 'Business'].includes(sug.tripType) ? (sug.tripType as any) : 'Leisure');

        const newTrip: Trip = {
            id: crypto.randomUUID(),
            destination: sug.destination,
            coverImage: DEFAULT_PLACEHOLDER,
            startDate: sug.startDate,
            endDate: sug.endDate,
            budget: 0,
            currency: Currency.USD,
            status: TripStatus.PLANNING,
            type: mappedType,
            expenses: [],
            itinerary: [],
            checklist: [],
            documents: [],
            documentCategories: ['flight', 'hotel', 'airbnb', 'food', 'other'],
            createdAt: new Date().toISOString()
        };
        // Show the pending trip immediately so the user sees it in the list
        setPendingNewTrip(newTrip);
        const updatedTrips = [newTrip, ...trips];
        setTrips(updatedTrips);
        try {
            // Persist the provisional trip (budget will be updated if user accepts suggestion)
            await upsertTrip(user.id, newTrip);
        } catch (err) {
            console.warn('Failed to persist provisional AI trip', err);
        }

        setShowTripModeSelector(false);
        setAiSuggestedBudget(null);
        
        // Generate destination image in background
        generateTripImage(sug.destination, mappedType).then(imageUrl => {
            const tripWithImage = { ...newTrip, coverImage: imageUrl };
            setTrips(prev => prev.map(t => t.id === newTrip.id ? tripWithImage : t));
            if (pendingNewTrip?.id === newTrip.id) {
                setPendingNewTrip(tripWithImage);
            }
            upsertTrip(user.id, tripWithImage).catch(console.warn);
        }).catch(err => {
            console.warn('Failed to generate destination image:', err);
        });
        
        try {
            const computed = await generateBudgetSuggestion(sug.destination, sug.days, sug.tripType, 'USD');
            if (computed) {
                setAiSuggestedBudget(computed);
                setAiPhase('ready');
            } else {
                setAiPhase('error');
                setAiError('No se pudo generar un presupuesto.');
            }
        } catch (e: any) {
            setAiPhase('error');
            setAiError(e?.message || 'Error al obtener presupuesto.');
        }
        // Mantener overlay visible para mostrar resultado y botones
    };

    const handleBudgetSuggested = (budget: number) => {
        if (!user || !pendingNewTrip) return;
        const tripWithBudget = { ...pendingNewTrip, budget };
        // Replace provisional trip instead of duplicating it in the array
        setTrips(prev => prev.some(t => t.id === tripWithBudget.id)
            ? prev.map(t => t.id === tripWithBudget.id ? tripWithBudget : t)
            : [tripWithBudget, ...prev]
        );
        upsertTrip(user.id, tripWithBudget);
        // Navigate into the trip and show itinerary by default
        setInitialTab('itinerary');
        setCurrentTripId(tripWithBudget.id);
        // Ensure overlay is closed no matter who calls this handler
        setCreatingAiTrip(false);
        setAiPhase('idle');
        setAiError(null);

        // Attempt to generate a custom cover image for the newly created trip
        (async () => {
            try {
                const img = await generateTripImage(tripWithBudget.destination, tripWithBudget.type);
                if (img) {
                    const updated = { ...tripWithBudget, coverImage: img };
                    // update local state and persist
                    // Ensure we do not duplicate the trip when updating the image
                    setTrips((prev) => prev.map(t => t.id === updated.id ? updated : t));
                    upsertTrip(user.id, updated);
                    // If currently viewing this trip, set it so UI refreshes
                    setCurrentTripId(updated.id);
                    showToast('Cover image generated for your suggested trip.', 'success');
                }
            } catch (e: any) {
                // Non-fatal: user can regenerate visual manually
                console.warn('Auto-generate cover image failed', e);
            }
        })();
        // Auto-generate a basic itinerary based on the date range if empty
        try {
            const start = new Date(tripWithBudget.startDate);
            const end = new Date(tripWithBudget.endDate);
            const days = Math.max(1, Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1);
            if (!pendingNewTrip.itinerary || pendingNewTrip.itinerary.length === 0) {
                const generated: DayPlan[] = Array.from({ length: days }).map((_, i) => ({
                    id: crypto.randomUUID(),
                    date: new Date(start.getTime() + i * 24 * 60 * 60 * 1000).toISOString(),
                    activities: []
                }));
                const withItin = { ...tripWithBudget, itinerary: generated };
                setTrips(prev => prev.map(t => t.id === withItin.id ? withItin : t));
                upsertTrip(user.id, withItin);
            }
        } catch {}
        setPendingNewTrip(null);
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
        const target = trips.find(t => t.id === tripId);
        // Enforce deletion window only for free/demo (no authenticated user). Authenticated users can delete anytime.
        const enforceWindow = !user; // user presente => sin restricción
        if (enforceWindow && (!target || !target.createdAt || Date.now() - new Date(target.createdAt).getTime() > DELETION_WINDOW_MS)) {
            showToast('El tiempo para eliminar este viaje ha expirado.', 'info');
            return;
        }
        const updatedTrips = trips.filter(t => t.id !== tripId);
        setTrips(updatedTrips);
        deleteTripFromDb(user.id, tripId);
        setCurrentTripId(null);
        showToast("Trip deleted.", 'info');
    };

    // Regenerar sugerencia dentro del overlay (sin duplicar ID)
    const regenerateAiSuggestion = async () => {
        if (!user || !pendingNewTrip) return;
        setAiPhase('loading');
        setAiError(null);
        setAiSuggestedBudget(null);
        const sug = generateQuickSuggestion();
        const mappedType = (['Leisure', 'Adventure', 'Family', 'Romantic', 'Solo', 'Business'].includes(sug.tripType) ? (sug.tripType as any) : 'Leisure');
        const updatedTrip = {
            ...pendingNewTrip,
            destination: sug.destination,
            startDate: sug.startDate,
            endDate: sug.endDate,
            type: mappedType
        };
        setPendingNewTrip(updatedTrip);
        upsertTrip(user.id, updatedTrip);
        try {
            const computed = await generateBudgetSuggestion(sug.destination, sug.days, sug.tripType, 'USD');
            if (computed) {
                setAiSuggestedBudget(computed);
                setAiPhase('ready');
            } else {
                setAiPhase('error');
                setAiError('No se pudo generar nuevo presupuesto.');
            }
        } catch (e: any) {
            setAiPhase('error');
            setAiError(e?.message || 'Error al regenerar presupuesto.');
        }
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

    // Reinicia todos los createdAt para facilitar testing de la ventana de borrado
    const resetDeletionTimers = useCallback(() => {
        if (!user) return;
        const nowIso = new Date().toISOString();
        const updated = trips.map(t => ({ ...t, createdAt: nowIso }));
        setTrips(updated);
        updated.forEach(trip => { try { upsertTrip(user.id, trip); } catch {} });
        showToast('Timers reiniciados.', 'success');
    }, [trips, user, showToast]);

    // Exponer múltiples alias en dev para evitar errores tipográficos
    useEffect(() => {
        // @ts-ignore
        if (import.meta.env.DEV) {
            (window as any).__resetDeletionTimers = resetDeletionTimers;
            (window as any)._resetDeletionTimers = resetDeletionTimers;
            (window as any).resetDeletionTimers = resetDeletionTimers;
        }
    }, [resetDeletionTimers]);

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

    if (loading) return <div className="h-screen flex items-center justify-center bg-obsidian text-acid"><Loader2 className="animate-spin" size={48} /></div>;

    if (!user) {
        return (
            <AuthScreen
                onLogin={handleLogin}
                lang={language}
                toggleLanguage={toggleLanguage}
            />
        );
    }

    // Ensure we always have something to render after accept; fallback to pending
    const currentTrip = trips.find(t => t.id === currentTripId) || (pendingNewTrip && pendingNewTrip.id === currentTripId ? pendingNewTrip : undefined as any);

    return (
        <div className={`min-h-screen ${settings.theme === 'light' ? 'bg-neutral-50 text-neutral-900' : 'bg-obsidian text-text'} font-sans selection:bg-acid selection:text-black`}>
            {currentTripId && currentTrip ? (
                <TripDetailView
                    trip={currentTrip}
                    updateTrip={handleUpdateTrip}
                    goBack={() => { setCurrentTripId(null); setInitialTab('overview'); }}
                    lang={language}
                    theme={settings.theme as 'light' | 'dark'}
                    onDeleteRequest={() => handleDeleteTrip(currentTrip.id)}
                    resizeImageUtil={resizeImage}
                    handleCoverImageUploadUtil={handleCoverImageUpload}
                    allImages={getAllImages(currentTrip)}
                    onDeleteImage={(img) => handleDeleteImage(img, currentTrip)}
                    apiKey={apiKey}
                    showToast={showToast}
                    initialTab={initialTab}
                    isAuthenticated={!!user}
                />
            ) : currentTripId && !currentTrip ? (
                <div className="fixed inset-0 z-[200] pointer-events-none">
                    <div className="absolute top-6 right-6">
                        <div className="flex items-center gap-2 bg-surface/80 border border-border rounded-xl px-3 py-2 shadow-2xl">
                            <Loader2 className="animate-spin text-acid" size={16} />
                            <span className="text-[10px] font-mono text-dim">{t.openingTrip}</span>
                        </div>
                    </div>
                </div>
            ) : (
                <>
                    {/* Header styled to reference */}
                    <header className={`sticky top-0 z-50 backdrop-blur-sm ${settings.theme === 'light' ? 'bg-neutral-50/70 border-neutral-200' : 'bg-neutral-950/70 border-white/10'} border-b px-4 md:px-6 h-16 flex items-center justify-between`}>
                        <div className="flex items-center gap-3">
                            <div className={`${settings.theme === 'light' ? 'bg-neutral-100 ring-1 ring-neutral-300' : 'bg-neutral-900 ring-1 ring-white/10'} flex items-center justify-center w-9 h-9 rounded-md`}>
                                <Plane size={18} className="text-emerald-400" />
                            </div>
                            <span className={`hidden sm:inline text-sm font-semibold ${settings.theme === 'light' ? 'text-neutral-700' : 'text-neutral-200'}`}>{t.appTitle}</span>
                        </div>

                        <nav className="hidden md:flex items-center gap-7 text-sm text-neutral-300">
                            <button onClick={() => setShowStories(true)} className="hover:text-white transition-colors">{t.community}</button>
                            <button onClick={() => setShowPricing(true)} className="hover:text-white transition-colors">{t.pricing}</button>
                            <button onClick={() => setShowDemo(true)} className="hover:text-white transition-colors">{t.demo}</button>
                        </nav>

                        <div className="hidden md:flex flex-1 max-w-2xl mx-8 gap-3 items-center">
                            <div className="w-full relative group flex-1">
                                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-dim group-focus-within:text-acid transition-colors" size={16} />
                                <input
                                    type="text"
                                    placeholder={t.searchQuery}
                                    value={globalSearch}
                                    onChange={(e) => setGlobalSearch(e.target.value)}
                                    className={`w-full rounded-2xl py-2 pl-12 pr-10 text-xs font-mono focus:border-acid focus:ring-1 focus:ring-acid outline-none transition-all border ${settings.theme === 'light' ? 'bg-white border-neutral-600 placeholder-neutral-400' : 'bg-surface border-border placeholder-dim'}`}
                                />
                                {globalSearch && (
                                    <button
                                        onClick={() => setGlobalSearch('')}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-dim hover:text-acid transition-colors p-1"
                                        title={t.clearSearch}
                                    >
                                        <X size={16} />
                                    </button>
                                )}
                            </div>
                            <a
                                onClick={() => setShowAuthModal(true)}
                                className="inline-flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium bg-emerald-500 text-neutral-950 hover:bg-emerald-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/60 transition cursor-pointer"
                            >
                                {t.startFree}
                            </a>
                        </div>

                        <div className="flex items-center gap-4">
                            <button
                                onClick={() => {
                                    const newTheme = settings.theme === 'light' ? 'dark' : 'light';
                                    setSettings({ ...settings, theme: newTheme });
                                    saveSettings({ ...settings, theme: newTheme });
                                }}
                                className="p-2 text-dim hover:text-text transition-colors"
                            >
                                {settings.theme === 'light' ? <Moon size={18} /> : <Sun size={18} />}
                            </button>
                            <div className="h-4 w-px bg-border"></div>
                            <button onClick={toggleLanguage} className="text-[10px] font-mono font-bold uppercase border border-border px-2 py-1 rounded-md hover:border-acid transition-colors text-dim hover:text-acid">
                                [{language?.toUpperCase()}]
                            </button>
                            {/** Botón DEV para reiniciar timers de borrado **/}
                            {/** @ts-ignore */}
                            {import.meta.env.DEV && (
                                <button
                                    onClick={() => {
                                        if (!user) return;
                                        const nowIso = new Date().toISOString();
                                        const updated = trips.map(t => ({ ...t, createdAt: nowIso }));
                                        setTrips(updated);
                                        updated.forEach(trip => { try { upsertTrip(user.id, trip); } catch {} });
                                        showToast('Timers reiniciados.', 'success');
                                    }}
                                    className="hidden md:inline-flex items-center gap-1 text-[10px] font-mono uppercase border border-acid/30 text-acid px-2 py-1 rounded-md hover:bg-acid hover:text-black transition-colors"
                                    title="Reiniciar ventana de borrado"
                                >
                                    <ArrowRightLeft size={14} /> Reset
                                </button>
                            )}
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
                    </header>

                    {/* Mobile Actions Bar */}
                    <div className="md:hidden sticky top-16 z-40 bg-obsidian px-4 py-3 border-b border-border">
                        <div className="grid grid-cols-3 gap-2">
                            <button
                                onClick={() => setShowPricing(true)}
                                className="flex items-center justify-center gap-2 text-[11px] font-mono font-bold uppercase border border-border px-3 py-2 rounded-lg hover:border-acid transition-colors text-dim hover:text-acid"
                            >
                                <CreditCard size={14} /> {t.pricing}
                            </button>
                            <button
                                onClick={() => setShowStories(true)}
                                className="flex items-center justify-center gap-2 text-[11px] font-mono font-bold uppercase border border-border px-3 py-2 rounded-lg hover:border-acid transition-colors text-dim hover:text-acid"
                            >
                                <Users size={14} /> {t.travelerStories}
                            </button>
                            <button
                                onClick={() => setShowDemo(true)}
                                className="flex items-center justify-center gap-2 text-[11px] font-mono font-bold uppercase border border-border px-3 py-2 rounded-lg hover:border-acid transition-colors text-dim hover:text-acid"
                            >
                                <Play size={14} /> {t.watchDemo}
                            </button>
                        </div>
                    </div>

                    <div className="px-6 md:px-8 max-w-7xl mx-auto animate-fade-in relative z-10">
                        {/* HERO SECTION — Reference-inspired */}
                        <section className="pt-16 md:pt-24 pb-10">
                            <div className="grid lg:grid-cols-12 gap-10 items-center">
                                <div className="lg:col-span-6">
                                    <div className="inline-flex items-center gap-2 rounded-full px-3 py-1 ring-1 ring-white/10 bg-white/5 text-xs text-neutral-300 mb-5">
                                        <Wand2 className="text-emerald-400" size={14} />
                                        {t.heroSubtitle}
                                    </div>
                                    <h1 className="text-5xl md:text-6xl lg:text-7xl font-semibold tracking-tight leading-[1.05]">{t.landingHeroTitle}</h1>
                                    <p className="mt-5 text-neutral-300 text-base md:text-lg max-w-xl">{t.landingHeroSubtitle}</p>
                                    <div className="mt-8 flex flex-col sm:flex-row gap-3">
                                        <button onClick={handleCreateTrip} className="group inline-flex items-center justify-center gap-2 rounded-md px-5 py-3 text-sm font-medium bg-emerald-500 text-neutral-950 hover:bg-emerald-400 transition">
                                            <Plane size={16} className="transition-transform duration-300 group-hover:rotate-45" /> {t.createFirstTrip}
                                        </button>
                                        <button onClick={() => setShowStories(true)} className="inline-flex items-center justify-center gap-2 rounded-md px-5 py-3 text-sm text-neutral-200 ring-1 ring-white/10 hover:ring-white/20 hover:bg-white/5 transition">
                                            <Users size={16} /> {t.travelerStories}
                                        </button>
                                    </div>

                                    <div className="mt-10 grid grid-cols-3 gap-4 max-w-xl">
                                        <div className="rounded-lg bg-neutral-900/60 ring-1 ring-white/10 p-4">
                                            <div className="text-xs text-neutral-400">Trips planned</div>
                                            <div className="mt-1 text-2xl font-semibold tracking-tight">3k+</div>
                                        </div>
                                        <div className="rounded-lg bg-neutral-900/60 ring-1 ring-white/10 p-4">
                                            <div className="text-xs text-neutral-400">Avg. budget optimization</div>
                                            <div className="mt-1 text-2xl font-semibold tracking-tight">18%</div>
                                        </div>
                                        <div className="rounded-lg bg-neutral-900/60 ring-1 ring-white/10 p-4">
                                            <div className="text-xs text-neutral-400">Documents managed</div>
                                            <div className="mt-1 text-2xl font-semibold tracking-tight">12k+</div>
                                        </div>
                                    </div>
                                </div>

                                <div className="lg:col-span-6">
                                    <div className="relative rounded-2xl overflow-hidden ring-1 ring-white/10 bg-neutral-900/50">
                                        <LazyImage src="https://images.unsplash.com/photo-1505761671935-60b3a7427bad?q=80&w=1600&auto=format&fit=crop" alt="hero city night" className="w-full h-80 md:h-[28rem] object-cover" />
                                        <div className="absolute inset-x-0 bottom-0 p-5 bg-gradient-to-t from-neutral-950/90 via-neutral-950/60 to-transparent">
                                            <div className="flex items-center gap-2 text-xs text-neutral-300">
                                                <Compass className="text-emerald-400" size={14} /> Live route hints • Budget sync
                                            </div>
                                        </div>
                                        <div className="absolute top-4 right-4">
                                            <span className="inline-flex items-center gap-1 rounded-md bg-emerald-500/10 text-emerald-300 px-2 py-1 text-[11px] ring-1 ring-emerald-500/30">
                                                <Sparkles size={12} /> Featured
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </section>

                        {filteredTrips.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-20 border-2 border-dashed border-dim/30 rounded-3xl bg-panel/20 group">
                                <div className="w-24 h-24 bg-surface rounded-full flex items-center justify-center mb-6 shadow-xl border border-border">
                                    <Plane size={48} className="text-acid animate-pulse-slow rotate-45 group-hover:rotate-[405deg] transition-transform duration-700" />
                                </div>
                                <h3 className={`text-2xl font-display font-bold uppercase mb-2 ${settings.theme === 'light' ? 'text-neutral-900' : 'text-white'}`}>{t.emptyStateTitle}</h3>
                                <p className={`font-mono text-sm mb-8 ${settings.theme === 'light' ? 'text-neutral-700' : 'text-dim'}`}>{t.emptyStateDesc}</p>
                                <button
                                    onClick={handleCreateTrip}
                                    className="px-6 py-3 border border-acid text-acid hover:bg-acid hover:text-black font-mono text-xs uppercase font-bold rounded-xl transition-all"
                                >
                                    {t.createFirstTrip}
                                </button>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6 justify-items-center">
                                {/* New Trip Card */}
                                <div
                                    onClick={handleCreateTrip}
                                    className={`group relative h-[300px] md:h-[360px] rounded-3xl overflow-hidden cursor-pointer transition-all hover:-translate-y-1.5 border flex flex-col w-[380px] ${settings.theme === 'light' ? 'bg-white border-neutral-300 shadow-[0_2px_8px_rgba(0,0,0,0.12)] hover:shadow-[0_4px_16px_rgba(0,0,0,0.16)]' : 'bg-surface border-border shadow-xl hover:shadow-acid/20'}`}
                                >
                                    <div className="flex-1 flex flex-col items-center justify-center gap-4 p-6 text-center">
                                        <Plane size={48} className="text-acid animate-pulse transition-transform duration-300 group-hover:rotate-45" />
                                        <h3 className="text-xl font-display font-bold uppercase tracking-tight">{t.initiateTrip}</h3>
                                        <p className="text-[11px] font-mono uppercase tracking-widest text-dim">{t.createFirstTrip}</p>
                                        <button className="px-4 py-2 border border-acid text-acid hover:bg-acid hover:text-black text-[10px] font-mono font-bold uppercase rounded-lg transition-colors">{t.createFirstTrip}</button>
                                    </div>
                                </div>
                                {filteredTrips.map(trip => (
                                    <div
                                        key={trip.id}
                                        onClick={() => setCurrentTripId(trip.id)}
                                        className={`group relative h-[300px] md:h-[360px] rounded-3xl overflow-hidden cursor-pointer transition-all hover:-translate-y-1.5 border flex flex-col w-[380px] ${settings.theme === 'light' ? 'bg-white border-neutral-300 shadow-[0_2px_8px_rgba(0,0,0,0.12)] hover:shadow-[0_4px_16px_rgba(0,0,0,0.16)]' : 'bg-surface border-border shadow-xl hover:shadow-acid/20'}`}
                                    >
                                        <div className="h-[72%] relative overflow-hidden">
                                            <LazyImage src={trip.coverImage} alt={trip.destination} className={`w-full h-full object-cover group-hover:scale-110 transition-transform duration-700 ${settings.theme === 'light' ? 'brightness-85 contrast-115 saturate-110' : ''}`} />
                                            <div className={`absolute inset-0 bg-gradient-to-t ${settings.theme === 'light' ? 'from-white/95 via-white/70 to-transparent' : 'from-black via-black/60 to-transparent'}`}></div>

                                            <div className="absolute top-4 left-4 flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-all z-10">
                                                <button
                                                    onClick={(e) => {
                    	                                e.stopPropagation();
                                                        const enforceWindow = !user; // sólo modo free/demo
                                                        const expired = enforceWindow && (!trip.createdAt || Date.now() - new Date(trip.createdAt).getTime() > DELETION_WINDOW_MS);
                                                        if (expired) {
                                                            showToast('El tiempo para eliminar este viaje ha expirado.', 'info');
                                                            return;
                                                        }
                                                        setTripToDelete(trip.id);
                                                    }}
                                                    className={`p-2 rounded-full backdrop-blur-md transition-all ${((!trip.createdAt || Date.now() - new Date(trip.createdAt).getTime() > DELETION_WINDOW_MS) && !user)
                                                        ? 'bg-black/20 text-red-600 border border-red-600/30 cursor-not-allowed'
                                                        : 'bg-black/40 hover:bg-red-500/80 text-white'}`}
                                                    title={t.deleteMission}
                                                >
                                                    <Trash2 size={16} />
                                                </button>
                                                <DeletionCountdown createdAt={trip.createdAt} windowMs={DELETION_WINDOW_MS} />
                                            </div>

                                            {trip.status !== 'Booked' && (
                                                <div className="absolute top-4 right-4">
                                                    <span className={`px-3 py-1 text-[10px] font-mono uppercase font-bold rounded-full backdrop-blur-md border flex items-center gap-1.5 shadow-sm ${trip.status === 'Completed' ? (settings.theme === 'light' ? 'bg-white/70 text-emerald-600 border-emerald-600/40' : 'bg-black/60 text-emerald-400 border-emerald-500/50') :
                                                        (settings.theme === 'light' ? 'bg-white/70 text-violet-600 border-violet-600/40' : 'bg-black/60 text-violet-400 border-violet-500/50')
                                                        }`}>
                                                        <span className={`w-1.5 h-1.5 rounded-full ${trip.status === 'Completed' ? (settings.theme === 'light' ? 'bg-emerald-600' : 'bg-emerald-400') :
                                                            (settings.theme === 'light' ? 'bg-violet-600' : 'bg-violet-400')
                                                            }`}></span>
                                                        {trip.status}
                                                    </span>
                                                </div>
                                            )}

                                            <div className="absolute bottom-6 left-6 right-6">
                                                <h3 className={`text-2xl md:text-4xl font-display font-bold uppercase truncate leading-none mb-1 ${settings.theme === 'light' ? 'text-neutral-900' : 'text-white'}`}>{trip.destination}</h3>
                                                <p className={`text-xs font-mono uppercase tracking-widest ${settings.theme === 'light' ? 'text-neutral-800' : 'text-white/70'}`}>{trip.type}</p>
                                            </div>
                                        </div>

                                        <div className={`flex-1 p-4 md:p-5 flex flex-col justify-between border-t transition-colors ${settings.theme === 'light' ? 'bg-white border-neutral-200 group-hover:bg-neutral-50' : 'bg-panel border-border group-hover:bg-surface'}`}>
                                            <div className="space-y-4">
                                                <div className="flex justify-between items-end border-b border-border/50 pb-3">
                                                    <div>
                                                        <span className={`text-[10px] font-mono uppercase tracking-widest block mb-1 font-semibold ${settings.theme === 'light' ? 'text-neutral-700' : 'text-dim'}`}>{t.dates}</span>
                                                        <div className={`text-[13px] font-bold flex items-center gap-2 ${settings.theme === 'light' ? 'text-neutral-900' : 'text-text'}`}>
                                                            {new Date(trip.startDate).toLocaleDateString()} - {new Date(trip.endDate).toLocaleDateString()}
                                                        </div>
                                                    </div>
                                                    <div className="text-right">
                                                        <span className={`text-[10px] font-mono uppercase tracking-widest block mb-1 font-semibold ${settings.theme === 'light' ? 'text-neutral-700' : 'text-dim'}`}>{t.budget}</span>
                                                        <div className={`text-[18px] font-display font-bold ${settings.theme === 'light' ? 'text-neutral-900' : 'text-text'}`}>{trip.currency} {trip.budget}</div>
                                                    </div>
                                                </div>

                                                <div className={`flex justify-between items-center font-mono text-[10px] uppercase font-medium ${settings.theme === 'light' ? 'text-neutral-700' : 'text-dim'}`}>
                                                    <span className="flex items-center gap-1">
                                                        <CalendarIcon size={11} />
                                                        {Math.ceil((new Date(trip.endDate).getTime() - new Date(trip.startDate).getTime()) / (1000 * 3600 * 24))} {t.days}
                                                    </span>
                                                    <span className={settings.theme === 'light' ? 'text-neutral-700' : ''}>ID: #{trip.id.substring(0, 4)}</span>
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            setInitialTab('documents');
                                                            setCurrentTripId(trip.id);
                                                        }}
                                                        className={`flex items-center gap-1 transition-colors ${settings.theme === 'light' ? 'text-acid hover:text-neutral-900' : 'text-acid hover:text-white'}`}
                                                        title={t.documents}
                                                    >
                                                        <FileText size={11} />
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* Freemium notice below trips */}
                        <div className="p-2 md:p-4 text-center mt-8 md:mt-12">
                            <Tooltip content={t.freemiumTooltip} position="top">
                                <button
                                    onClick={() => { setAuthInitialMode('signup'); setShowAuthModal(true); }}
                                    className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-acid/20 bg-acid/5 text-acid text-[12px] font-mono uppercase tracking-widest cursor-pointer mx-auto w-fit"
                                >
                                    {t.freemiumNotice} <Info size={12} />
                                </button>
                            </Tooltip>
                        </div>

                        {/* Pricing Section (adjusted to reference, slightly smaller) */}
                        <PricingSection
                            onStartFree={() => { setAuthInitialMode('signup'); setShowAuthModal(true); }}
                            onStandard={() => setShowPricing(true)}
                            onPro={() => setShowPricing(true)}
                        />

                        {/* FAQ Section */}
                        <section className="relative mt-10 md:mt-14">
                            <div className="mx-auto max-w-4xl px-0">
                                <h2 className="text-3xl md:text-4xl font-semibold tracking-tight text-center">Preguntas frecuentes</h2>
                                <div className="mt-8 space-y-3">
                                    <details className="group rounded-lg ring-1 ring-white/10 open:ring-white/20 bg-neutral-900/60 open:bg-neutral-900/70 transition">
                                        <summary className="flex cursor-pointer items-center justify-between gap-3 px-5 py-4 text-sm">
                                            <span>¿Cómo funciona el modo IA?</span>
                                            <ChevronRight className="transition duration-200 group-open:rotate-90" size={16} />
                                        </summary>
                                        <div className="px-5 pb-4 pt-0 text-sm text-neutral-300">
                                            Genera destino, fechas y presupuesto estimado. Puedes editar todo.
                                        </div>
                                    </details>
                                    <details className="group rounded-lg ring-1 ring-white/10 open:ring-white/20 bg-neutral-900/60 open:bg-neutral-900/70 transition">
                                        <summary className="flex cursor-pointer items-center justify-between gap-3 px-5 py-4 text-sm">
                                            <span>¿Puedo adjuntar documentos?</span>
                                            <ChevronRight className="transition duration-200 group-open:rotate-90" size={16} />
                                        </summary>
                                        <div className="px-5 pb-4 pt-0 text-sm text-neutral-300">
                                            Sí, gestiona tickets, reservas y fotos en Documentos.
                                        </div>
                                    </details>
                                    <details className="group rounded-lg ring-1 ring-white/10 open:ring-white/20 bg-neutral-900/60 open:bg-neutral-900/70 transition">
                                        <summary className="flex cursor-pointer items-center justify-between gap-3 px-5 py-4 text-sm">
                                            <span>¿Modo oscuro?</span>
                                            <ChevronRight className="transition duration-200 group-open:rotate-90" size={16} />
                                        </summary>
                                        <div className="px-5 pb-4 pt-0 text-sm text-neutral-300">
                                            Sí, alterna desde el ícono de luna/sol.
                                        </div>
                                    </details>
                                </div>
                            </div>
                        </section>
                    </div>

                    

                    {/* World Map Background Layer */}
                    <div className={`fixed inset-0 z-0 pointer-events-none ${settings.theme === 'light' ? 'opacity-[0.1] invert' : 'opacity-[0.02] dark:invert'}`}>
                        <img
                            src="https://static.vecteezy.com/system/resources/previews/020/997/828/non_2x/detailed-world-map-in-black-and-white-free-vector.jpg"
                            alt="World Map"
                            className="w-full h-full object-cover"
                        />
                        <div className={`absolute inset-0 bg-gradient-to-t ${settings.theme === 'light' ? 'from-neutral-50 via-transparent to-neutral-50' : 'from-obsidian via-transparent to-obsidian'}`}></div>
                    </div>
                </>
            )}

            <ChatAssistant
                lang={language}
                trip={currentTrip}
                isOpen={false}
            />            {toast && <Toast message={toast.msg} type={toast.type} onClose={() => setToast(null)} />}

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
                                    <h3 className="text-2xl font-display font-bold text-white mb-2">{t.demoSimulationTitle}</h3>
                                    <p className="text-dim font-mono text-sm">{t.demoSimulationSubtitle}</p>
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

            {/* Plane hover micro-interaction handled on buttons */}

            {/* Pricing Modal */}
            {showPricing && (
                <Suspense fallback={null}>
                    <PricingModal
                        onClose={() => setShowPricing(false)}
                        onSelectFree={() => { setAuthInitialMode('signup'); setShowAuthModal(true); setShowPricing(false); }}
                    />
                </Suspense>
            )}

            {/* Trip Mode Selector Modal */}
            {showTripModeSelector && (
                <Suspense fallback={null}>
                    <TripModeSelector
                        onManualMode={handleCreateTripManual}
                        onAIMode={handleCreateTripWithAI}
                        onClose={() => setShowTripModeSelector(false)}
                    />
                </Suspense>
            )}

            {/* Auth Modal (signup) triggered from freemium footer) */}
            {showAuthModal && (
                <div className="fixed inset-0 z-[130] bg-black/85 backdrop-blur-sm flex items-center justify-center p-4 md:p-6 animate-fade-in">
                    <div className="w-full max-w-md md:max-w-lg bg-surface border border-border rounded-3xl shadow-2xl overflow-hidden">
                        <div className="p-4 md:p-6">
                            <AuthScreen
                                onLogin={(u) => { handleLogin(u); setShowAuthModal(false); }}
                                lang={language}
                                toggleLanguage={toggleLanguage}
                                initialMode={authInitialMode}
                                onClose={() => setShowAuthModal(false)}
                            />
                        </div>
                    </div>
                </div>
            )}

            {/* Delete Trip Confirmation Modal */}
            {tripToDelete && (
                <div className="fixed inset-0 bg-black/90 backdrop-blur-sm z-[200] flex items-center justify-center p-4 animate-fade-in">
                    <div className="bg-surface w-full max-w-sm border border-border p-8 shadow-2xl rounded-3xl">
                        <div className="flex items-center gap-3 mb-4 text-danger">
                            <AlertTriangle size={32} />
                            <h3 className="font-display text-lg uppercase">{t.confirmDeleteTripTitle}</h3>
                        </div>
                        <p className="text-sm text-dim font-mono mb-8 leading-relaxed">
                            {t.confirmDeleteTripMsg}
                        </p>
                        <div className="flex justify-end gap-3">
                            <button onClick={() => setTripToDelete(null)} className="px-5 py-2.5 border border-border text-dim hover:text-text text-xs uppercase rounded-xl">{t.cancel}</button>
                            <button onClick={() => { handleDeleteTrip(tripToDelete); setTripToDelete(null); }} className="px-5 py-2.5 bg-danger text-white hover:bg-red-600 text-xs font-bold uppercase rounded-xl shadow-lg">{t.purge}</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Overlay AI unificado: carga + resultado + acciones */}
            {creatingAiTrip && pendingNewTrip && (
                <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/85 backdrop-blur-sm animate-fade-in">
                    <div className="w-full max-w-sm bg-surface border border-border rounded-3xl p-8 shadow-2xl flex flex-col gap-6">
                        <div className="flex items-center gap-3">
                            <Wand2 className="text-acid" size={28} />
                            <h3 className="font-display text-lg uppercase tracking-wide">
                                {aiPhase === 'loading' ? t.generating : aiPhase === 'ready' ? (t.travelSuggestionTitle || 'Sugerencia de Viaje') : 'Error'}
                            </h3>
                        </div>
                        {aiPhase === 'loading' && (
                            <>
                                <p className="text-dim text-xs font-mono leading-relaxed">
                                    Preparando tu viaje inteligente: generando sugerencia de destino, duración y presupuesto estimado. Por favor espera...
                                </p>
                                <div className="space-y-3">
                                    <div className="h-2 w-full bg-panel rounded-full overflow-hidden">
                                        <div className="h-full bg-acid animate-[pulse_1.2s_linear_infinite]" style={{ width: '60%' }}></div>
                                    </div>
                                    <div className="flex items-center gap-2 text-[10px] font-mono text-acid">
                                        <Loader2 size={14} className="animate-spin" /> IA calibrando presupuesto...
                                    </div>
                                </div>
                            </>
                        )}
                        {aiPhase === 'error' && (
                            <div className="text-xs text-red-400 font-mono bg-red-500/10 border border-red-500/30 p-3 rounded-xl">
                                {aiError}
                                <button onClick={regenerateAiSuggestion} className="mt-3 w-full px-3 py-2 bg-red-500 hover:bg-red-400 text-white rounded-md text-[10px] font-bold uppercase">Reintentar</button>
                            </div>
                        )}
                        {aiPhase === 'ready' && (
                            <div className="space-y-4">
                                <div className="bg-panel/50 border border-border/50 rounded-lg p-4 space-y-2 text-xs">
                                    <p className="text-text font-bold text-sm">Propuesta IA</p>
                                    <div className="text-dim space-y-1">
                                        <p>📍 {pendingNewTrip.destination}</p>
                                        <p>📅 {Math.ceil((new Date(pendingNewTrip.endDate).getTime() - new Date(pendingNewTrip.startDate).getTime()) / (1000*60*60*24))} días • {pendingNewTrip.type}</p>
                                        <p>💱 {pendingNewTrip.currency}</p>
                                    </div>
                                </div>
                                {aiSuggestedBudget && (
                                    <div className="bg-acid/5 border border-acid/30 rounded-lg p-4 text-center">
                                        <p className="text-dim text-[11px] mb-1">Presupuesto estimado</p>
                                        <div className="text-3xl font-display font-bold text-acid">{pendingNewTrip.currency} {aiSuggestedBudget.toLocaleString()}</div>
                                        <p className="text-[10px] text-dim mt-1">≈ {pendingNewTrip.currency} {Math.round(aiSuggestedBudget / Math.max(1, Math.ceil((new Date(pendingNewTrip.endDate).getTime() - new Date(pendingNewTrip.startDate).getTime()) / (1000*60*60*24))))} / día</p>
                                    </div>
                                )}
                                <div className="flex gap-2 pt-2">
                                    <button
                                        onClick={regenerateAiSuggestion}
                                        className="flex-1 px-4 py-2 border border-acid/40 text-acid hover:bg-acid hover:text-black rounded-lg transition-colors text-xs font-bold uppercase"
                                    >Buscar otra</button>
                                    <button
                                        onClick={() => {
                                            if (aiSuggestedBudget) {
                                                handleBudgetSuggested(aiSuggestedBudget);
                                                setCreatingAiTrip(false);
                                                setAiPhase('idle');
                                            }
                                        }}
                                        disabled={!aiSuggestedBudget}
                                        className="flex-1 px-4 py-2 bg-green-600 disabled:opacity-40 hover:bg-green-500 text-white rounded-lg transition-colors text-xs font-bold uppercase"
                                    >Aceptar viaje</button>
                                </div>
                                <button
                                    onClick={() => { setCreatingAiTrip(false); setPendingNewTrip(null); setAiPhase('idle'); }}
                                    className="w-full mt-2 text-[10px] font-mono text-dim hover:text-text transition-colors"
                                >Cancelar</button>
                            </div>
                        )}
                    </div>
                </div>
            )}

        </div>
    );
};

export default App;
