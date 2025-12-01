
export enum Currency {
  USD = 'USD',
  EUR = 'EUR',
  GBP = 'GBP',
  JPY = 'JPY',
  AUD = 'AUD',
  MXN = 'MXN',
  CLP = 'CLP',
  BRL = 'BRL',
  ARS = 'ARS',
}

export enum TripStatus {
  PLANNING = 'Planning',
  BOOKED = 'Booked',
  COMPLETED = 'Completed',
}

export type TripType = 'Leisure' | 'Business' | 'Adventure' | 'Family' | 'Romantic' | 'Solo';

export interface TripDocument {
  id: string;
  name: string;
  type: string; // Changed from union to string to support custom categories
  category?: string; // For Insights filtering (flight, hotel, airbnb, etc.)
  dataUrl: string; // Base64 string for local storage display
  dateAdded: string;
  tags?: string[];
  metadata?: {
    airline?: string;
    flightNumber?: string;
    departureAirport?: string;
    arrivalAirport?: string;
    hotelName?: string;
    checkInDate?: string;
    checkOutDate?: string;
    bookingReference?: string;
  };
  extractedMetadata?: {
    // Flight metadata
    bookingReference?: string;
    outboundCheckInCode?: string;
    outboundPassengers?: string[];
    outboundAirline?: string;
    outboundDepartureDate?: string;
    outboundDepartureTime?: string;
    outboundArrivalDate?: string;
    outboundArrivalTime?: string;
    outboundRoute?: string;
    outboundDestination?: string;
    outboundDuration?: string;
    outboundLayoverAirport?: string;
    outboundLayoverWait?: string;
    returnCheckInCode?: string;
    returnPassengers?: string[];
    returnAirline?: string;
    returnDepartureDate?: string;
    returnDepartureTime?: string;
    returnArrivalDate?: string;
    returnArrivalTime?: string;
    returnRoute?: string;
    returnDestination?: string;
    returnDuration?: string;
    returnLayoverAirport?: string;
    returnLayoverWait?: string;
    // Hotel/Airbnb metadata
    hotelName?: string;
    hostName?: string;
    checkInDate?: string;
    checkOutDate?: string;
    address?: string;
    whatsappNumber?: string;
    guestName?: string;
    totalPrice?: string;
    [key: string]: any;
  };
  notes?: string;
}

export interface Expense {
  id: string;
  description: string;
  amount: number;
  currency: Currency;
  category: 'Accommodation' | 'Food' | 'Transport' | 'Activities' | 'Shopping' | 'Other';
  date: string;
  notes?: string;
  receiptUrl?: string; 
}

export interface Activity {
  id: string;
  title: string;
  description?: string;
  startTime?: string; // HH:MM
  costEstimated?: number;
  locationName?: string;
  locationAddress?: string; // Populated by Maps Grounding
  completed: boolean;
}

export interface InfoBlock {
  id: string;
  title: string;
  content: string;
  location?: string;
  images?: string[];
}

export interface DayPlan {
  id: string;
  date: string;
  activities: Activity[];
  notes?: string;
  location?: string;
  images?: string[];
  infoBlocks?: InfoBlock[];
}

export interface Trip {
  id: string;
  destination: string;
  coverImage: string;
  startDate: string;
  endDate: string;
  budget: number;
  currency: Currency;
  status: TripStatus;
  type: TripType;
  createdAt?: string; // ISO timestamp for creation; used for deletion window
  notes?: string;
  expenses: Expense[];
  itinerary: DayPlan[];
  checklist: { id: string; task: string; completed: boolean; dueDate?: string }[];
  documents: TripDocument[];
  documentCategories?: string[]; // Custom categories for documents
  passengers?: string[]; // Passenger names for display
}

export interface AppState {
  trips: Trip[];
  currentTripId: string | null;
  theme: 'light' | 'dark';
  language: 'en' | 'es';
}

export interface MapsSearchResult {
  title: string;
  address: string;
  rating?: number;
  summary?: string;
  uri?: string;
}