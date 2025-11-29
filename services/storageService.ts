
import { Trip, AppState, Currency, TripStatus } from '../types';
import { supabase } from './supabaseClient';

const STORAGE_KEY = 'wanderlust_settings_v2';
const TRIPS_CACHE_PREFIX = 'wanderlust_trips_cache_v2_';
const SYNC_TTL = 15 * 60 * 1000; // 15 Minutes Cache Validity (Aggressive Caching)

const DEFAULT_DOC_CATEGORIES = ['flight', 'hotel', 'airbnb', 'food', 'other'];

// Optimized Unsplash URLs (w=600, q=50) to save bandwidth on initial load
export const INITIAL_TRIPS: Trip[] = [
  {
    id: '1',
    destination: 'Bali, Indonesia',
    coverImage: 'https://images.unsplash.com/photo-1537996194471-e657df975ab4?q=50&w=600&auto=format&fit=crop',
    startDate: '2024-06-10',
    endDate: '2024-06-20',
    budget: 3000,
    currency: Currency.USD,
    status: TripStatus.PLANNING,
    type: 'Leisure',
    notes: 'Enfoque en relajación y yoga. Tal vez visitar las islas Gili por un par de días.',
    expenses: [
      { id: 'e1', description: 'Depósito Vuelo', amount: 500, currency: Currency.USD, category: 'Transport', date: '2024-01-15' },
      { id: 'e2', description: 'Reserva Villa', amount: 1200, currency: Currency.USD, category: 'Accommodation', date: '2024-02-01' },
    ],
    itinerary: [
      { 
        id: 'd1', 
        date: '2024-06-10', 
        activities: [
          { id: 'a1', title: 'Llegada a Denpasar', startTime: '14:00', completed: false, description: 'Recoger tarjeta SIM en aeropuerto', locationName: 'Aeropuerto Ngurah Rai' },
          { id: 'a2', title: 'Check in Villa', startTime: '16:00', completed: false, description: 'Villa privada en Ubud', locationName: 'Ubud' }
        ] 
      },
      {
        id: 'd2',
        date: '2024-06-11',
        activities: [
            { id: 'a3', title: 'Monkey Forest', startTime: '09:00', completed: false, description: 'Visitar el santuario sagrado', locationName: 'Sacred Monkey Forest Sanctuary' }
        ]
      }
    ],
    checklist: [{ id: 'c1', task: 'Renovar Pasaporte', completed: true }, { id: 'c2', task: 'Comprar Protector Solar', completed: false }, { id: 'c3', task: 'Reservar Scooter', completed: false }],
    documents: [],
    documentCategories: DEFAULT_DOC_CATEGORIES
  },
  {
    id: '2',
    destination: 'Tokio, Japón',
    coverImage: 'https://images.unsplash.com/photo-1503899036084-c55cdd92da26?q=50&w=600&auto=format&fit=crop',
    startDate: '2024-10-05',
    endDate: '2024-10-15',
    budget: 5000,
    currency: Currency.USD,
    status: TripStatus.BOOKED,
    type: 'Adventure',
    notes: 'Obligatorio comer sushi en cinta. Buscar tiendas de videojuegos retro en Akihabara.',
    expenses: [
        { id: 't1', description: 'Vuelos Ida/Vuelta (ANA)', amount: 1400, currency: Currency.USD, category: 'Transport', date: '2024-03-10' },
        { id: 't2', description: 'JR Pass (7 Días)', amount: 200, currency: Currency.USD, category: 'Transport', date: '2024-03-12' },
        { id: 't3', description: 'Depósito Hotel Shinjuku', amount: 400, currency: Currency.USD, category: 'Accommodation', date: '2024-04-01' }
    ],
    itinerary: [
        {
            id: 'jp1',
            date: '2024-10-05',
            activities: [
                { id: 'act1', title: 'Llegada a Narita', startTime: '15:30', completed: false, description: 'Tomar Narita Express a Shinjuku', locationName: 'Aeropuerto Narita' },
                { id: 'act2', title: 'Cena en Omoide Yokocho', startTime: '19:00', completed: false, description: 'Exploración de callejón Yakitori', locationName: 'Shinjuku' }
            ]
        },
        {
            id: 'jp2',
            date: '2024-10-06',
            activities: [
                { id: 'act3', title: 'Cruce de Shibuya', startTime: '10:00', completed: false, description: 'Foto y café en Starbucks', locationName: 'Shibuya' },
                { id: 'act4', title: 'Santuario Meiji', startTime: '13:00', completed: false, description: 'Caminata por Parque Yoyogi', locationName: 'Harajuku' }
            ]
        }
    ],
    checklist: [
        { id: 'l1', task: 'Canjear voucher JR Pass', completed: true },
        { id: 'l2', task: 'Descargar App Suica', completed: false },
        { id: 'l3', task: 'Reservar TeamLabs Planets', completed: true },
        { id: 'l4', task: 'Sacar efectivo Yen', completed: false }
    ],
    documents: [],
    documentCategories: DEFAULT_DOC_CATEGORIES
  },
  {
    id: '3',
    destination: 'Barcelona, España',
    coverImage: 'https://images.unsplash.com/photo-1583422409516-2895a77efded?q=50&w=600&auto=format&fit=crop',
    startDate: '2023-09-15',
    endDate: '2023-09-22',
    budget: 2500,
    currency: Currency.EUR,
    status: TripStatus.COMPLETED,
    type: 'Family',
    notes: 'Buscar parques para niños cerca del apartamento.',
    expenses: [
        { id: 'b1', description: 'Vuelos (Iberia)', amount: 450, currency: Currency.EUR, category: 'Transport', date: '2023-06-01' },
        { id: 'b2', description: 'Airbnb Gracia', amount: 800, currency: Currency.EUR, category: 'Accommodation', date: '2023-06-05' },
        { id: 'b3', description: 'Entradas Sagrada Familia', amount: 60, currency: Currency.EUR, category: 'Activities', date: '2023-08-10' },
        { id: 'b4', description: 'Tour de Tapas', amount: 120, currency: Currency.EUR, category: 'Food', date: '2023-09-16' },
        { id: 'b5', description: 'Compras en Corte Inglés', amount: 300, currency: Currency.EUR, category: 'Shopping', date: '2023-09-20' }
    ],
    itinerary: [
        {
            id: 'bar1',
            date: '2023-09-15',
            activities: [
                { id: 'ba1', title: 'Check-in Airbnb', startTime: '14:00', completed: true, description: 'Apartamento en distrito Gracia', locationName: 'Gracia' },
                { id: 'ba2', title: 'Atardecer Bunkers del Carmel', startTime: '19:30', completed: true, description: 'Mejor vista de la ciudad', locationName: 'El Carmel' }
            ]
        },
        {
            id: 'bar2',
            date: '2023-09-16',
            activities: [
                 { id: 'ba3', title: 'Tour Sagrada Familia', startTime: '10:00', completed: true, description: 'Visita guiada a la basílica', locationName: 'Sagrada Familia' },
                 { id: 'ba4', title: 'Park Güell', startTime: '15:00', completed: true, description: 'Arquitectura de Gaudí', locationName: 'Park Güell' }
            ]
        }
    ],
    checklist: [
        { id: 'cl1', task: 'Comprar adaptador', completed: true },
        { id: 'cl2', task: 'Check-in Online', completed: true }
    ],
    documents: [],
    documentCategories: DEFAULT_DOC_CATEGORIES
  },
  {
    id: '4',
    destination: 'Patagonia, Argentina',
    coverImage: 'https://images.ctfassets.net/m5us57n7qfgl/5xT4hfqq0WO3uxjkIjKBOS/5c90cce3a084f72d63a5740d95f2ddb2/Fizt-roy-patagonia-host.jpg?w=1200&h=630&fm=jpg&q=70&f=center',
    startDate: '2025-01-10',
    endDate: '2025-01-25',
    budget: 1800,
    currency: Currency.USD,
    status: TripStatus.PLANNING,
    type: 'Adventure',
    notes: 'Necesito entrenar para las caminatas. Verificar requisitos de ropa térmica.',
    expenses: [
        { id: 'p1', description: 'Equipo Senderismo', amount: 300, currency: Currency.USD, category: 'Shopping', date: '2024-11-01' }
    ],
    itinerary: [
        {
            id: 'pat1',
            date: '2025-01-10',
            activities: [
                { id: 'pa1', title: 'Vuelo a El Calafate', startTime: '08:00', completed: false, description: 'Conexión vía Buenos Aires', locationName: 'Aeropuerto EZE' }
            ]
        },
        {
            id: 'pat2',
            date: '2025-01-12',
            activities: [
                { id: 'pa2', title: 'Glaciar Perito Moreno', startTime: '09:00', completed: false, description: 'Día completo trekking en el hielo', locationName: 'Parque Nacional Los Glaciares' }
            ]
        }
    ],
    checklist: [
        { id: 'pt1', task: 'Reservar Tour Trekking', completed: false },
        { id: 'pt2', task: 'Comprar capas térmicas', completed: true },
        { id: 'pt3', task: 'Verificar clima', completed: true }
    ],
    documents: [],
    documentCategories: DEFAULT_DOC_CATEGORIES
  }
];

// -- Settings Persistence (Local Storage) --

export const loadSettings = (): Partial<AppState> => {
  try {
    const serialized = window.localStorage.getItem(STORAGE_KEY);
    if (serialized) {
      return JSON.parse(serialized);
    }
  } catch (e) {
    console.error("Failed to load settings", e);
  }
  return { theme: 'dark', language: 'es' }; // Default to Dark Mode and Spanish
};

export const saveSettings = (state: Partial<AppState>) => {
  try {
    const settings = { theme: state.theme, language: state.language };
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch (e) {
    console.error("Failed to save settings", e);
  }
};

// -- Data Persistence with Differential Sync & Caching --

const getCacheKey = (userId: string) => `${TRIPS_CACHE_PREFIX}${userId}`;

// Debounce Helper
let saveTimeout: number | null = null;
const DEBOUNCE_DELAY = 1000; // 1 second debounce for writing to LS

const updateLocalCache = (userId: string, trips: Trip[], timestamps: Record<string, string>) => {
    if (saveTimeout) window.clearTimeout(saveTimeout);
    
    saveTimeout = window.setTimeout(() => {
        try {
            const cacheData = { trips, timestamps, lastSync: new Date().toISOString() };
            localStorage.setItem(getCacheKey(userId), JSON.stringify(cacheData));
        } catch (e) {
            console.warn("Failed to update local cache", e);
        }
    }, DEBOUNCE_DELAY);
};

export const getLocalCache = (userId: string): { trips: Trip[], timestamps: Record<string, string>, lastSync?: string } | null => {
    try {
        const cached = localStorage.getItem(getCacheKey(userId));
        if (!cached) return null;
        const data = JSON.parse(cached);
        return {
            trips: data.trips || [],
            timestamps: data.timestamps || {},
            lastSync: data.lastSync
        };
    } catch (e) {
        return null;
    }
}

export const getTrips = async (userId: string, page: number = 0, pageSize: number = 20): Promise<Trip[]> => {
    if (userId === 'guest_user') {
        const cached = getLocalCache(userId);
        return cached ? cached.trips : INITIAL_TRIPS;
    }

    const localCache = getLocalCache(userId);
    
    // TTL Optimization: Use local cache as DB if synced recently AND we are on the first page (Dashboard)
    // This allows for instant load on startup but ensures we check server for pagination.
    if (page === 0 && localCache && localCache.lastSync) {
        const lastSyncTime = new Date(localCache.lastSync).getTime();
        const now = Date.now();
        if (now - lastSyncTime < SYNC_TTL) { 
            console.log(`Using local cache (TTL valid) for Dashboard`);
            // Return ALL cached trips for the dashboard to handle sorting/filtering instantly
            // Pagination logic in App.tsx will handle display limits if needed, but for "Instant Access" we give what we have.
            return localCache.trips;
        }
    }

    const localTripsMap = new Map<string, Trip>(localCache?.trips.map(t => [t.id, t]) || []);
    const localTimestamps = localCache?.timestamps || {};
    let newTimestamps: Record<string, string> = { ...localTimestamps };

    try {
        // 1. Fetch Metadata with Pagination (Explicit Select & Range)
        // Always fetch metadata for the requested page to ensure we have the correct IDs from server source of truth
        const from = page * pageSize;
        const to = from + pageSize - 1;

        const { data: serverMeta, error } = await supabase
            .from('trips')
            .select('id, updated_at') // Optimization: Only fetch what's needed
            .eq('user_id', userId) // Server-side Filter
            .order('updated_at', { ascending: false }) // Order for pagination
            .range(from, to); // Server-side Pagination

        if (error) throw error;

        // 2. Calculate Delta
        const idsToFetch: string[] = [];
        
        const pageTrips: Trip[] = [];

        if (serverMeta) {
            serverMeta.forEach(meta => {
                const localTime = localTimestamps[meta.id];
                
                // If we have it locally and it's fresh, use local
                if (localTime && new Date(meta.updated_at) <= new Date(localTime) && localTripsMap.has(meta.id)) {
                    pageTrips.push(localTripsMap.get(meta.id)!);
                    // Ensure timestamp is synced
                    newTimestamps[meta.id] = meta.updated_at;
                } else {
                    // Otherwise fetch full data
                    idsToFetch.push(meta.id);
                }
            });
        }

        // 3. Fetch ONLY changed/new data for this page
        if (idsToFetch.length > 0) {
            console.log(`Fetching ${idsToFetch.length} updated trips for page ${page}...`);
            const { data: newTripsData, error: fetchError } = await supabase
                .from('trips')
                .select('id, trip_data') // Optimization: Explicit fields
                .in('id', idsToFetch);
            
            if (fetchError) throw fetchError;

            if (newTripsData) {
                newTripsData.forEach(row => {
                    const trip = { ...row.trip_data, id: row.id };
                    pageTrips.push(trip);
                    // Update local map for caching
                    localTripsMap.set(row.id, trip);
                    // Update timestamp
                    const meta = serverMeta?.find(m => m.id === row.id);
                    if (meta) newTimestamps[row.id] = meta.updated_at;
                });
            }
        }

        // 4. Update Local Cache (Merge this page's fresh data into the full cache)
        const allCachedTrips = Array.from(localTripsMap.values());
        updateLocalCache(userId, allCachedTrips, newTimestamps);

        // Sort pageTrips to match request order (updated_at desc)
        return pageTrips.sort((a, b) => {
            const metaA = serverMeta?.find(m => m.id === a.id);
            const metaB = serverMeta?.find(m => m.id === b.id);
            return new Date(metaB?.updated_at || 0).getTime() - new Date(metaA?.updated_at || 0).getTime();
        });

    } catch (e: any) {
        console.warn("Sync failed, using local cache:", e.message);
        // Fallback to local cache if offline
        const start = page * pageSize;
        const end = start + pageSize;
        const sortedLocal = localCache ? [...localCache.trips].sort((a, b) => 0) : INITIAL_TRIPS; 
        return sortedLocal.slice(start, end);
    }
}

export const upsertTrip = async (userId: string, trip: Trip) => {
    // 1. Optimistic Update (Local Cache)
    const timestamp = new Date().toISOString();
    try {
        const cache = getLocalCache(userId);
        const currentTrips = cache?.trips || INITIAL_TRIPS;
        const currentTimestamps = cache?.timestamps || {};
        
        const existingIndex = currentTrips.findIndex(t => t.id === trip.id);
        const newTrips = [...currentTrips];
        
        if (existingIndex >= 0) {
            newTrips[existingIndex] = trip;
        } else {
            newTrips.push(trip);
        }
        
        currentTimestamps[trip.id] = timestamp;
        updateLocalCache(userId, newTrips, currentTimestamps);
    } catch (e) {
        console.warn("Local cache update failed", e);
    }

    // 2. Sync to Backend
    try {
        if (userId === 'guest_user') return; 
        
        const { error } = await supabase
            .from('trips')
            .upsert({
                id: trip.id,
                user_id: userId,
                trip_data: trip,
                updated_at: timestamp
            });
        
        if (error) throw error;
    } catch (e: any) {
        console.warn("Sync to backend failed (saved locally):", e.message);
    }
}

export const deleteTripFromDb = async (userId: string, tripId: string) => {
    // 1. Optimistic Delete
    try {
        const cache = getLocalCache(userId);
        if (cache) {
            const newTrips = cache.trips.filter(t => t.id !== tripId);
            const newTimestamps = { ...cache.timestamps };
            delete newTimestamps[tripId];
            updateLocalCache(userId, newTrips, newTimestamps);
        }
    } catch (e) {
        console.warn("Local cache update failed", e);
    }

    // 2. Sync Delete
    try {
        if (userId === 'guest_user') return;

        const { error } = await supabase
            .from('trips')
            .delete()
            .eq('id', tripId)
            .eq('user_id', userId);
            
        if (error) throw error;
    } catch (e: any) {
        console.warn("Sync to backend failed (deleted locally):", e.message);
    }
}
