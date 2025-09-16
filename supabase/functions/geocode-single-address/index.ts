import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface GeocodeRequest {
  address: string;
  strategies?: string[]; // Optionnel: stratégies d'adresses multiples
}

interface GeocodeResult {
  lat: number;
  lng: number;
  display_name: string;
  confidence?: number;
  source: string;
  quality_score: number;
  validation_warnings: string[];
  strategy_used?: string;
}

// Service de géocodage avec OpenRouteService
async function geocodeWithOpenRouteService(address: string): Promise<GeocodeResult> {
  const apiKey = Deno.env.get('OPENROUTESERVICE_API_KEY');
  if (!apiKey) {
    throw new Error('OpenRouteService API key not configured');
  }

  console.log('Trying OpenRouteService for:', address);
  
  const response = await fetch(
    `https://api.openrouteservice.org/geocode/search?api_key=${apiKey}&text=${encodeURIComponent(address)}&boundary.country=FR&size=1`,
    {
      method: 'GET',
      headers: { 'Accept': 'application/json' },
      signal: AbortSignal.timeout(8000)
    }
  );

  if (!response.ok) {
    throw new Error(`OpenRouteService error: ${response.status}`);
  }

  const data = await response.json();
  
  if (!data.features || data.features.length === 0) {
    throw new Error('No results from OpenRouteService');
  }

  const feature = data.features[0];
  const [lng, lat] = feature.geometry.coordinates;

  return {
    lat,
    lng,
    display_name: feature.properties.label,
    confidence: feature.properties.confidence,
    source: 'OpenRouteService',
    quality_score: 100,
    validation_warnings: []
  };
}

// Service de géocodage avec Google Maps (fallback)
async function geocodeWithGoogle(address: string): Promise<GeocodeResult> {
  const apiKey = Deno.env.get('GOOGLE_MAPS_API_KEY');
  if (!apiKey) {
    throw new Error('Google Maps API key not configured');
  }

  console.log('Trying Google Maps for:', address);
  
  const response = await fetch(
    `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&region=fr&key=${apiKey}`,
    {
      method: 'GET',
      signal: AbortSignal.timeout(8000)
    }
  );

  if (!response.ok) {
    throw new Error(`Google Maps error: ${response.status}`);
  }

  const data = await response.json();
  
  if (data.status !== 'OK' || !data.results || data.results.length === 0) {
    throw new Error(`Google Maps API error: ${data.status}`);
  }

  const result = data.results[0];
  const { lat, lng } = result.geometry.location;

  return {
    lat,
    lng,
    display_name: result.formatted_address,
    source: 'Google Maps',
    quality_score: 100,
    validation_warnings: []
  };
}

// Service de géocodage avec Nominatim OSM (fallback gratuit)
async function geocodeWithNominatim(address: string): Promise<GeocodeResult> {
  console.log('Trying Nominatim OSM for:', address);
  
  const response = await fetch(
    `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}&countrycodes=fr&limit=1&addressdetails=1`,
    {
      method: 'GET',
      headers: { 
        'User-Agent': 'TaskFlow-SingleGeocode/1.0',
        'Accept': 'application/json'
      },
      signal: AbortSignal.timeout(8000)
    }
  );

  if (!response.ok) {
    throw new Error(`Nominatim error: ${response.status}`);
  }

  const data = await response.json();
  
  if (!data || data.length === 0) {
    throw new Error('No results from Nominatim');
  }

  const result = data[0];

  return {
    lat: parseFloat(result.lat),
    lng: parseFloat(result.lon),
    display_name: result.display_name,
    source: 'Nominatim OSM',
    quality_score: 100,
    validation_warnings: []
  };
}

// Fonction principale de géocodage avec fallbacks
async function geocodeAddress(address: string): Promise<GeocodeResult> {
  const services = [
    geocodeWithGoogle,           // 1er: Google Maps (plus fiable)
    geocodeWithOpenRouteService, // 2ème: OpenRouteService
    geocodeWithNominatim         // 3ème: Nominatim OSM (gratuit)
  ];

  let lastError: Error | null = null;

  for (const service of services) {
    try {
      const result = await service(address);
      console.log(`Geocoding successful with ${result.source} for: ${address}`);
      return result;
    } catch (error) {
      console.warn(`Geocoding failed with ${service.name} for "${address}":`, error.message);
      lastError = error;
      
      // Attendre un peu avant d'essayer le service suivant
      await new Promise(resolve => setTimeout(resolve, 500));
      continue;
    }
  }

  throw new Error(`All geocoding services failed for "${address}". Last error: ${lastError?.message}`);
}

// Validation des coordonnées pour la France métropolitaine et DOM-TOM
function isValidFrenchCoordinates(lat: number, lng: number): boolean {
  // France métropolitaine
  const metropolitan = lat >= 41.0 && lat <= 51.5 && lng >= -5.5 && lng <= 10.0;
  
  // DOM-TOM approximatifs
  const domTom = (
    // Guadeloupe, Martinique
    (lat >= 14.0 && lat <= 17.0 && lng >= -63.0 && lng <= -60.0) ||
    // Guyane
    (lat >= 2.0 && lat <= 6.0 && lng >= -55.0 && lng <= -51.0) ||
    // Réunion
    (lat >= -22.0 && lat <= -20.5 && lng >= 55.0 && lng <= 56.0) ||
    // Mayotte
    (lat >= -13.5 && lat <= -12.5 && lng >= 45.0 && lng <= 46.0) ||
    // Nouvelle-Calédonie
    (lat >= -23.0 && lat <= -19.5 && lng >= 163.0 && lng <= 169.0) ||
    // Polynésie française
    (lat >= -28.0 && lat <= -7.5 && lng >= -155.0 && lng <= -134.0)
  );
  
  return metropolitan || domTom;
}

// Évaluer la qualité du géocodage
function assessGeocodingQuality(address: string, result: GeocodeResult): GeocodeResult {
  let qualityScore = 100;
  const validationWarnings: string[] = [];

  // Validation des coordonnées
  if (!isValidFrenchCoordinates(result.lat, result.lng)) {
    qualityScore -= 30;
    validationWarnings.push('Coordinates outside France territory');
  }

  // Analyse de la correspondance d'adresse
  const normalizeText = (text: string) => text.toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Supprimer les accents
    .replace(/[^\w\s\d]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  const normalizedOriginal = normalizeText(address);
  const normalizedResult = normalizeText(result.display_name);

  // Vérifier si des mots clés de l'adresse originale sont présents
  const originalWords = normalizedOriginal.split(' ').filter(word => word.length > 2);
  const resultWords = normalizedResult.split(' ');
  
  let matchingWords = 0;
  for (const word of originalWords) {
    if (resultWords.some(rWord => rWord.includes(word) || word.includes(rWord))) {
      matchingWords++;
    }
  }
  
  const matchRatio = originalWords.length > 0 ? matchingWords / originalWords.length : 0;
  
  if (matchRatio < 0.3) {
    qualityScore -= 25;
    validationWarnings.push('Low address similarity between input and result');
  } else if (matchRatio < 0.6) {
    qualityScore -= 10;
    validationWarnings.push('Moderate address similarity between input and result');
  }

  // Bonus pour certains services plus fiables
  if (result.source === 'OpenRouteService' && result.confidence && result.confidence > 0.8) {
    qualityScore += 5;
  } else if (result.source === 'Google Maps') {
    qualityScore += 3;
  }

  return {
    ...result,
    quality_score: Math.max(0, Math.min(100, qualityScore)),
    validation_warnings: validationWarnings
  };
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { address, strategies }: GeocodeRequest = await req.json();

    if (!address || address.trim().length === 0) {
      throw new Error('Address is required');
    }

    console.log(`Single geocoding request for: ${address}`);

    // Stratégies d'adresse multiples si fournies
    const addressesToTry = strategies && strategies.length > 0 ? strategies : [address.trim()];
    
    let bestResult: GeocodeResult | null = null;
    let bestQuality = -1;
    let usedStrategy = '';

    // Essayer chaque stratégie d'adresse
    for (const addressStrategy of addressesToTry) {
      try {
        console.log(`Trying strategy: "${addressStrategy}"`);
        const rawResult = await geocodeAddress(addressStrategy);
        const assessedResult = assessGeocodingQuality(addressStrategy, rawResult);
        
        // Garder le meilleur résultat
        if (assessedResult.quality_score > bestQuality) {
          bestResult = assessedResult;
          bestQuality = assessedResult.quality_score;
          usedStrategy = addressStrategy;
        }
        
        // Si on obtient un excellent résultat, pas besoin d'essayer les autres stratégies
        if (assessedResult.quality_score >= 85) {
          break;
        }
      } catch (error) {
        console.warn(`Strategy "${addressStrategy}" failed:`, error.message);
        continue;
      }
    }

    if (!bestResult) {
      throw new Error(`All geocoding strategies failed for address variations`);
    }

    const finalResult = {
      ...bestResult,
      strategy_used: usedStrategy
    };

    console.log(`Geocoding completed with ${finalResult.source}, quality: ${finalResult.quality_score}%`);

    return new Response(JSON.stringify(finalResult), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in geocode-single-address function:', error);
    return new Response(
      JSON.stringify({ 
        error: error.message,
        details: 'Failed to geocode address with enhanced fallback system'
      }), 
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});