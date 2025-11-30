
import { GoogleGenAI, Chat, Type } from "@google/genai";
import { MapsSearchResult, Trip } from "../types";

// Helper to safely get API Key in both Vite (Vercel) and Node environments
const getApiKey = (): string => {
  let key = '';
  try {
    // @ts-ignore
    if (typeof import.meta !== 'undefined' && import.meta.env) {
        // @ts-ignore
        key = import.meta.env.VITE_API_KEY || import.meta.env.API_KEY;
    }
  } catch (e) {}
  
  if (!key) {
    try {
      // @ts-ignore
      if (typeof process !== 'undefined' && process.env) {
        // @ts-ignore
        key = process.env.API_KEY;
      }
    } catch (e) {}
  }
  return key || '';
};

// Lazy singleton for AI Client
let aiInstance: GoogleGenAI | null = null;

const getAi = (): GoogleGenAI => {
  const key = getApiKey();
  if (!key) {
      throw new Error("API Key is missing. Please check your configuration.");
  }
  if (!aiInstance) {
    aiInstance = new GoogleGenAI({ apiKey: key });
  }
  return aiInstance;
};

// Simple memory cache for weather to avoid redundant API calls (Rate Limit mitigation)
const weatherCache = new Map<string, { temp: string; condition: string; description: string }>();

// Helper to check for Quota/Rate Limit errors
const isQuotaError = (error: any): boolean => {
    const msg = error?.message || JSON.stringify(error);
    return (
        msg.includes('429') || 
        msg.includes('quota') || 
        msg.includes('RESOURCE_EXHAUSTED') ||
        error?.status === 429 ||
        error?.error?.code === 429
    );
};

// CHATBOT SERVICE
export const createChatSession = (systemInstruction: string): Chat => {
  try {
      return getAi().chats.create({
        model: 'gemini-3-pro-preview',
        config: {
          systemInstruction: systemInstruction,
          temperature: 0.7,
        },
      });
  } catch (e) {
      console.error("Failed to create chat session:", e);
      // Return a dummy object or throw? Throwing is better if we want to handle it upstream.
      throw e;
  }
};

export const sendMessageToGemini = async (chat: Chat, message: string): Promise<string> => {
  try {
    const response = await chat.sendMessage({ message });
    return response.text || "I'm sorry, I couldn't process that request.";
  } catch (error: any) {
    if (isQuotaError(error)) {
        return "I'm currently overloaded with requests (Quota Exceeded). Please try again in a moment.";
    }
    console.error("Gemini Chat Error:", error);
    return "Sorry, I'm having trouble connecting to the travel network right now.";
  }
};

// MAPS GROUNDING SERVICE
export const searchPlacesWithGemini = async (query: string, locationHint?: string): Promise<MapsSearchResult[]> => {
  try {
    const model = 'gemini-2.5-flash';
    
    const contents = `Find places matching this request: "${query}". ${locationHint ? `Focus on this area: ${locationHint}.` : ''} 
    Provide a list of relevant places with their names and addresses.`;

    const response = await getAi().models.generateContent({
      model,
      contents,
      config: {
        tools: [{ googleMaps: {} }],
      },
    });

    const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks;
    const results: MapsSearchResult[] = [];

    if (chunks) {
      chunks.forEach((chunk: any) => {
        if (chunk.maps) {
           // We extract what we can from the grounding metadata
           results.push({
             title: chunk.maps.title,
             address: chunk.maps.formattedAddress || 'Address not available',
             uri: chunk.maps.uri,
             summary: 'Found via Google Maps'
           });
        }
      });
    }
    
    return results;

  } catch (error: any) {
    if (isQuotaError(error)) {
        console.warn("Maps search quota exceeded.");
        throw new Error("Search limit reached. Please try again later.");
    }
    console.error("Gemini Maps Error:", error);
    return [];
  }
};

// IMAGE GENERATION SERVICE
export const generateTripImage = async (destination: string, type: string): Promise<string> => {
  try {
    // Search for images on Unsplash using their API
    const query = encodeURIComponent(`${destination} travel ${type}`);
    const unsplashAccessKey = 'krNc1QqQ2tN4iXfDyyTKj73uvLGpFMqfrx1dUCcuFzs';
    
    // Try Unsplash API first
    try {
      const response = await fetch(
        `https://api.unsplash.com/search/photos?query=${query}&per_page=1&orientation=landscape`,
        {
          headers: {
            'Authorization': `Client-ID ${unsplashAccessKey}`
          }
        }
      );
      
      if (response.ok) {
        const data = await response.json();
        if (data.results && data.results.length > 0) {
          return data.results[0].urls.regular;
        }
      }
    } catch (unsplashError) {
      console.warn('Unsplash API failed, falling back to direct URL', unsplashError);
    }
    
    // Fallback: Use Unsplash source URL (doesn't require API key)
    const fallbackQuery = encodeURIComponent(destination);
    return `https://source.unsplash.com/1600x900/?${fallbackQuery},travel,landscape`;
  } catch (error: any) {
    console.error("Image Search Error:", error);
    throw new Error("Failed to fetch destination image.");
  }
}

// TRIP SUMMARY SERVICE
export const generateTripSummary = async (trip: Trip): Promise<string> => {
  try {
    const activityCount = trip.itinerary.reduce((acc, day) => acc + day.activities.length, 0);
    const activitySamples = trip.itinerary
      .flatMap(day => day.activities.map(a => a.title))
      .slice(0, 5)
      .join(', ');

    const prompt = `
      Write a short, engaging, and exciting summary paragraph (max 80 words) for a trip to ${trip.destination}.
      
      Details:
      - Type: ${trip.type}
      - Dates: ${new Date(trip.startDate).toLocaleDateString()} to ${new Date(trip.endDate).toLocaleDateString()}
      - Budget: ${trip.budget} ${trip.currency}
      - Key Activities: ${activitySamples}
      
      Make it sound adventurous and inviting. Do not use markdown or lists, just a paragraph.
    `;

    const response = await getAi().models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt
    });

    return response.text || "";
  } catch (error: any) {
    if (isQuotaError(error)) {
        throw new Error("AI Summary limit reached. Please try again later.");
    }
    console.error("Summary Generation Error:", error);
    throw new Error("Failed to generate summary.");
  }
}

// RECOMMENDATION SERVICE
export const getTravelSuggestions = async (destination: string, type: string): Promise<any> => {
  try {
    const prompt = `
      Provide 3 top-tier recommendations for a "${type}" style trip to ${destination}.
      Return strictly a JSON object with this schema:
      {
        "restaurants": [{"name": "Name", "desc": "Short description"}],
        "bars": [{"name": "Name", "desc": "Short description"}],
        "museums": [{"name": "Name", "desc": "Short description"}]
      }
      Do not include markdown code blocks.
    `;

    const response = await getAi().models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        responseMimeType: "application/json",
      }
    });

    const text = response.text?.replace(/```json|```/g, '').trim();
    if (!text) return null;
    return JSON.parse(text);
  } catch (error) {
    console.error("Suggestions Error:", error);
    return null;
  }
};

// WEATHER FORECAST SERVICE
export const getWeatherForecast = async (location: string, date: string): Promise<{ temp: string; condition: string; description: string } | null> => {
  const cacheKey = `${location}-${date}`;
  if (weatherCache.has(cacheKey)) {
      return weatherCache.get(cacheKey) || null;
  }

  try {
    const prompt = `
      Provide a realistic weather forecast snapshot for ${location} on ${date}.
      Based on historical climate data for this region and season.
      Return strictly a JSON object with this schema:
      {
        "temp": "string (e.g., 24°C / 75°F)",
        "condition": "string (Short summary, e.g., Sunny, Rain, Cloudy)",
        "description": "string (Short clothing advice, max 10 words)"
      }
    `;

    const response = await getAi().models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            temp: { type: Type.STRING },
            condition: { type: Type.STRING },
            description: { type: Type.STRING },
          }
        }
      }
    });
    
    const text = response.text?.replace(/```json|```/g, '').trim();
    if (!text) return null;
    
    const data = JSON.parse(text);
    weatherCache.set(cacheKey, data);
    return data;

  } catch (error: any) {
    if (isQuotaError(error)) {
        console.warn("Weather service quota exceeded. Returning null.");
        return null; // Fail silently for weather widget
    }
    console.error("Weather Generation Error:", error);
    return null;
  }
}

// PACKING LIST GENERATOR SERVICE
export const generatePackingList = async (destination: string, duration: number, season: string, tripType: string): Promise<string[]> => {
  try {
    const prompt = `
      Generate a practical packing list for a ${duration}-day ${tripType} trip to ${destination} during ${season}.
      Consider climate, activities, and cultural norms.
      Return strictly a JSON array of packing items (strings), like:
      ["Item 1", "Item 2", "Item 3"]
      Include 15-20 essential items.
      Do not include markdown code blocks or extra text.
    `;

    const response = await getAi().models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        responseMimeType: "application/json",
      }
    });

    const text = response.text?.replace(/```json|```/g, '').trim();
    if (!text) return [];
    
    const items = JSON.parse(text);
    return Array.isArray(items) ? items : [];
  } catch (error) {
    console.error("Packing List Generation Error:", error);
    return [];
  }
}

// AUTO-BUDGET GENERATOR SERVICE
export const generateBudgetSuggestion = async (destination: string, duration: number, tripType: string, currency: string): Promise<number | null> => {
  try {
    const prompt = `
      Based on typical travel costs, suggest a realistic daily budget per person (in ${currency}) for a ${tripType} trip to ${destination}.
      Consider accommodation, food, activities, and transportation for this destination.
      Return strictly a JSON object:
      {
        "dailyBudget": <number>,
        "reasoning": "<brief explanation of budget breakdown>"
      }
      Do not include markdown code blocks.
    `;

    const response = await getAi().models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        responseMimeType: "application/json",
      }
    });

    const text = response.text?.replace(/```json|```/g, '').trim();
    if (!text) return null;
    
    const data = JSON.parse(text);
    const totalBudget = (data.dailyBudget || 0) * duration;
    return Math.round(totalBudget);
  } catch (error) {
    console.error("Budget Suggestion Error:", error);
    return null;
  }
}

// PDF DATA EXTRACTION SERVICE
export const extractPDFData = async (base64Data: string, documentType: string): Promise<any> => {
  try {
    const prompt = `
      Extract structured data from this ${documentType} document.
      
      Extract the following fields if available:
      - Property Name / Hotel Name
      - Host / Anfitrión Name
      - Booking Reference / Confirmation Number
      - Check-in Date
      - Check-out Date
      - Address / Location
      - WhatsApp Number / Contact Number
      - Guest Name
      - Total Price
      
      Return strictly a JSON object with these fields (use null if not found):
      {
        "propertyName": "string or null",
        "hostName": "string or null",
        "bookingReference": "string or null",
        "checkInDate": "YYYY-MM-DD or null",
        "checkOutDate": "YYYY-MM-DD or null",
        "address": "string or null",
        "whatsappNumber": "string or null",
        "guestName": "string or null",
        "totalPrice": "string or null"
      }
    `;

    // Remove data URL prefix if present
    const cleanBase64 = base64Data.replace(/^data:application\/pdf;base64,/, '');

    const response = await getAi().models.generateContent({
      model: 'gemini-2.5-flash',
      contents: {
        parts: [
          { text: prompt },
          { 
            inlineData: {
              mimeType: 'application/pdf',
              data: cleanBase64
            }
          }
        ]
      },
      config: {
        responseMimeType: "application/json",
      }
    });

    const text = response.text?.replace(/```json|```/g, '').trim();
    if (!text) return null;
    
    return JSON.parse(text);
  } catch (error) {
    console.error("PDF Extraction Error:", error);
    return null;
  }
}

// SPENDING PATTERN ANALYSIS SERVICE
export const analyzeSpendingPatterns = async (expenses: any[], budget: number, currency: string): Promise<string> => {
  try {
    const totalSpent = expenses.reduce((sum, exp) => sum + exp.amount, 0);
    const byCategory = expenses.reduce((acc: any, exp: any) => {
      acc[exp.category] = (acc[exp.category] || 0) + exp.amount;
      return acc;
    }, {});

    const categoryList = Object.entries(byCategory)
      .map(([cat, amount]: [string, any]) => `${cat}: ${currency} ${amount.toFixed(2)}`)
      .join(', ');

    const prompt = `
      Analyze this trip spending pattern:
      - Total Spent: ${currency} ${totalSpent.toFixed(2)}
      - Budget: ${currency} ${budget}
      - By Category: ${categoryList}
      
      Provide 2-3 concise money-saving suggestions specific to this spending pattern.
      Be friendly and practical. Max 100 words.
    `;

    const response = await getAi().models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt
    });

    return response.text || "Keep monitoring your spending!";
  } catch (error) {
    console.error("Spending Analysis Error:", error);
    return "Unable to analyze spending at this moment.";
  }
}
