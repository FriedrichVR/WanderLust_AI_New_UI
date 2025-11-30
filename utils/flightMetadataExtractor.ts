import type { PDFDocumentProxy } from 'pdfjs-dist';

// Lazy loader for pdfjs to avoid bundling heavy worker upfront
async function loadPdfjs() {
  const pdfjs = await import('pdfjs-dist');
  // @ts-ignore - workerSrc may not exist depending on build
  if (pdfjs.GlobalWorkerOptions) {
    // Attempt to use a CDN worker to avoid bundling
    // @ts-ignore
    pdfjs.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.js`;
  }
  return pdfjs;
}

// Basic regex helpers
const IATA_RE = /\b[A-Z]{3}\b/g; // crude: three uppercase letters
const TIME_RE = /\b([01]?\d|2[0-3]):[0-5]\d\b/g; // HH:MM 24h
const DATE_RE = /\b(\d{1,2}[\/-]\d{1,2}[\/-]\d{2,4}|\d{4}-\d{2}-\d{2})\b/g; // dd/mm/yyyy or yyyy-mm-dd
const BOOKING_RE = /\b([A-Z0-9]{5,8})\b(?=[^a-z]|$)/g; // common 6 char codes

// Airline list for quick detection
const AIRLINES = [
  'AEROLINEAS ARGENTINAS','AEROLÍNEAS ARGENTINAS','LATAM','AMERICAN AIRLINES','DELTA','UNITED','LUFTHANSA','IBERIA','AIR FRANCE','KLM','COPA','EMIRATES','QATAR','JETSMART','GOL','VOLOTEA','RYANAIR','EASYJET'
];

export interface LocalFlightMeta {
  bookingReference?: string | null;
  outbound?: Partial<Leg>;
  return?: Partial<Leg>;
}

interface Leg {
  checkInCode?: string | null;
  passengers?: string[] | null;
  airline?: string | null;
  departureDate?: string | null;
  departureTime?: string | null;
  arrivalDate?: string | null;
  arrivalTime?: string | null;
  route?: string | null;
  destination?: string | null;
  duration?: string | null;
  layover?: { airport?: string | null; waitDuration?: string | null } | null;
}

export async function extractFlightMetadataLocal(base64Data: string): Promise<LocalFlightMeta | null> {
  try {
    const pdfjs = await loadPdfjs();
    // Strip prefix
    let clean = base64Data;
    const comma = clean.indexOf(',');
    if (clean.startsWith('data:') && comma !== -1) clean = clean.slice(comma + 1);
    const binary = atob(clean);
    const len = binary.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) bytes[i] = binary.charCodeAt(i);

    const doc: PDFDocumentProxy = await pdfjs.getDocument({ data: bytes }).promise;
    let fullText = '';
    for (let p = 1; p <= doc.numPages; p++) {
      const page = await doc.getPage(p);
      const content = await page.getTextContent();
      const pageText = content.items.map((it: any) => it.str).join(' ');
      fullText += '\n' + pageText.toUpperCase();
    }

    // Airline detection
    const airline = AIRLINES.find(a => fullText.includes(a)) || null;

    // Booking reference candidate
    const bookingCandidates = Array.from(new Set(fullText.match(BOOKING_RE) || []));
    const bookingReference = bookingCandidates.find(c => c.length >= 5 && c.length <= 8) || null;

    // Times & Dates
    const times = Array.from(new Set(fullText.match(TIME_RE) || []));
    const datesRaw = Array.from(new Set(fullText.match(DATE_RE) || []));
    const normaliseDate = (d: string): string => {
      if (/\d{4}-\d{2}-\d{2}/.test(d)) return d; // already ISO
      const parts = d.replace(/\//g,'-').split('-');
      if (parts[2] && parts[2].length === 2) parts[2] = '20' + parts[2];
      // dd-mm-yyyy -> yyyy-mm-dd guess
      if (parts[2]?.length === 4) {
        const [dd,mm,yyyy] = parts.map(p=>p.padStart(2,'0'));
        return `${yyyy}-${mm}-${dd}`;
      }
      return d;
    };
    const dates = datesRaw.map(normaliseDate);

    // IATA codes
    const iatas = Array.from(new Set(fullText.match(IATA_RE) || []));

    // Heuristic: first two distinct IATA codes form outbound route; last two form return route
    const firstTwo = iatas.slice(0,2);
    const lastTwo = iatas.slice(-2);
    const outboundRoute = firstTwo.length === 2 ? `${firstTwo[0]} → ${firstTwo[1]}` : null;
    const returnRoute = lastTwo.length === 2 ? `${lastTwo[0]} → ${lastTwo[1]}` : null;

    const outboundDestination = firstTwo[1] || null;
    const returnDestination = lastTwo[1] || null;

    // Assign times: earliest two times outbound dep/arr; latest two times return dep/arr
    const outboundTimes = times.slice(0,2);
    const returnTimes = times.slice(-2);

    const outboundDates = dates.slice(0,2);
    const returnDates = dates.slice(-2);

    // Layover heuristic: look for word ESCALA or LAYOVER followed by an IATA code and duration pattern
    let layoverAirport: string | null = null;
    let layoverWait: string | null = null;
    const LAYOVER_RE = /(ESCALA|LAYOVER)[^A-Z]{0,10}([A-Z]{3})[^0-9]{0,15}((\d+h\s?\d*m?)|(\d+h))/;
    const layMatch = fullText.match(LAYOVER_RE);
    if (layMatch) {
      layoverAirport = layMatch[2] || null;
      layoverWait = layMatch[3] || null;
    }

    // Check-in code (fallback to booking reference if pattern missing)
    const CHECKIN_RE = /(CHECK[- ]?IN CODE|CHECK[- ]?IN|CODIGO DE CHECK[- ]?IN|CÓDIGO DE CHECK[- ]?IN|CODIGO CHECK[- ]?IN)[:\s\-]*([A-Z0-9]{5,8})/;
    const checkInMatch = fullText.match(CHECKIN_RE);
    const checkInCode = checkInMatch ? checkInMatch[2] : bookingReference;

    // Passengers extraction: look for PASAJEROS or PASSENGERS section
    let passengers: string[] | null = null;
    const passengerMarker = fullText.includes('PASAJEROS') ? 'PASAJEROS' : (fullText.includes('PASSENGERS') ? 'PASSENGERS' : null);
    if (passengerMarker) {
      const idx = fullText.indexOf(passengerMarker);
      if (idx !== -1) {
        const snippet = fullText.slice(idx + passengerMarker.length, idx + passengerMarker.length + 180);
        const NAME_RE = /[A-ZÁÉÍÓÚÜÑ]{2,}(?:\s+[A-ZÁÉÍÓÚÜÑ]{2,})+/g;
        const rawNames = snippet.match(NAME_RE) || [];
        const filtered = rawNames.filter(n => !AIRLINES.includes(n));
        if (filtered.length > 0) passengers = Array.from(new Set(filtered.map(n => n.trim())));
      }
    }

    const outbound: Leg = {
      airline,
      departureDate: outboundDates[0] || null,
      arrivalDate: outboundDates[1] || outboundDates[0] || null,
      departureTime: outboundTimes[0] || null,
      arrivalTime: outboundTimes[1] || null,
      route: outboundRoute,
      destination: outboundDestination,
      layover: layoverAirport ? { airport: layoverAirport, waitDuration: layoverWait } : null,
      checkInCode: checkInCode || null,
      passengers: passengers || null
    };

    const ret: Leg = {
      airline,
      departureDate: returnDates[0] || null,
      arrivalDate: returnDates[1] || returnDates[0] || null,
      departureTime: returnTimes[0] || null,
      arrivalTime: returnTimes[1] || null,
      route: returnRoute,
      destination: returnDestination,
      layover: layoverAirport ? { airport: layoverAirport, waitDuration: layoverWait } : null,
      checkInCode: checkInCode || null,
      passengers: passengers || null
    };

    return {
      bookingReference,
      outbound,
      return: ret
    };
  } catch (e) {
    console.warn('[LocalFlightMeta] extraction failed', e);
    return null;
  }
}

// Merge helper: prefer existing metadata -> then local -> then AI
export function mergeFlightMeta(base: any, local: LocalFlightMeta | null, ai: any | null) {
  const pick = (path: (obj: any) => any): any => {
    const b = path(base); if (b) return b;
    const l = local ? path(local) : null; if (l) return l;
    const a = ai ? path(ai) : null; return a || null;
  };
  return {
    bookingReference: pick(o=>o.bookingReference),
    outboundCheckInCode: pick(o=>o.outbound?.checkInCode),
    outboundPassengers: pick(o=>o.outbound?.passengers),
    outboundAirline: pick(o=>o.outbound?.airline),
    outboundDepartureDate: pick(o=>o.outbound?.departureDate),
    outboundDepartureTime: pick(o=>o.outbound?.departureTime),
    outboundArrivalDate: pick(o=>o.outbound?.arrivalDate),
    outboundArrivalTime: pick(o=>o.outbound?.arrivalTime),
    outboundRoute: pick(o=>o.outbound?.route),
    outboundDestination: pick(o=>o.outbound?.destination),
    outboundLayoverAirport: pick(o=>o.outbound?.layover?.airport),
    outboundLayoverWait: pick(o=>o.outbound?.layover?.waitDuration),
    returnCheckInCode: pick(o=>o.return?.checkInCode),
    returnPassengers: pick(o=>o.return?.passengers),
    returnAirline: pick(o=>o.return?.airline),
    returnDepartureDate: pick(o=>o.return?.departureDate),
    returnDepartureTime: pick(o=>o.return?.departureTime),
    returnArrivalDate: pick(o=>o.return?.arrivalDate),
    returnArrivalTime: pick(o=>o.return?.arrivalTime),
    returnRoute: pick(o=>o.return?.route),
    returnDestination: pick(o=>o.return?.destination),
    returnLayoverAirport: pick(o=>o.return?.layover?.airport),
    returnLayoverWait: pick(o=>o.return?.layover?.waitDuration),
  };
}
