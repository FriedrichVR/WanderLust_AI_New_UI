export interface QuickSuggestion {
  destination: string;
  days: number;
  startDate: string;
  endDate: string;
  tripType: string;
  currency: string;
}

const DESTINATIONS = [
  { name: 'Lisbon, Portugal', currency: '€' },
  { name: 'Reykjavík, Iceland', currency: '€' },
  { name: 'Buenos Aires, Argentina', currency: '$' },
  { name: 'Tokyo, Japan', currency: '¥' },
  { name: 'Chiang Mai, Thailand', currency: '$' },
  { name: 'Valparaíso, Chile', currency: '$' },
  { name: 'Granada, Spain', currency: '€' },
  { name: 'Osaka, Japan', currency: '¥' },
  { name: 'Lofoten Islands, Norway', currency: 'kr' },
  { name: 'Plitvice Lakes, Croatia', currency: '€' },
  { name: 'Marrakech, Morocco', currency: 'MAD' },
  { name: 'Rome, Italy', currency: '€' },
  { name: 'Prague, Czechia', currency: '€' },
  { name: 'Istanbul, Turkey', currency: '₺' }
];

const TRIP_TYPES = ['Leisure', 'Adventure', 'Cultural', 'Relaxation', 'Foodie'];

export const generateQuickSuggestion = (): QuickSuggestion => {
  const dest = DESTINATIONS[Math.floor(Math.random() * DESTINATIONS.length)];
  const days = Math.floor(Math.random() * 12) + 1; // 1 to 12
  const start = new Date();
  // small bias: if days <=2, schedule a near weekend (within 7 days)
  const offsetDays = days <= 2 ? Math.floor(Math.random() * 7) : Math.floor(Math.random() * 30);
  start.setDate(start.getDate() + offsetDays);
  const end = new Date(start);
  end.setDate(start.getDate() + Math.max(1, days - 1));

  const tripType = TRIP_TYPES[Math.floor(Math.random() * TRIP_TYPES.length)];

  return {
    destination: dest.name,
    days,
    startDate: start.toISOString(),
    endDate: end.toISOString(),
    tripType,
    currency: dest.currency || '$'
  };
};

export default generateQuickSuggestion;
