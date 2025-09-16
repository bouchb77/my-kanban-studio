import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface GeocodeRequest {
  address: string;
}

interface GeocodeResult {
  lat: number;
  lng: number;
  display_name: string;
  confidence?: number;
  source: string;
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
      timeout: 5000
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
    source: 'OpenRouteService'
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
      timeout: 5000
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
    source: 'Google Maps'
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
        'User-Agent': 'TaskFlow-Isochrone/1.0',
        'Accept': 'application/json'
      },
      timeout: 5000
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
    source: 'Nominatim OSM'
  };
}

// Fonction principale de géocodage avec fallbacks
async function geocodeAddress(address: string): Promise<GeocodeResult> {
  const services = [
    geocodeWithOpenRouteService,
    geocodeWithGoogle,
    geocodeWithNominatim
  ];

  let lastError: Error | null = null;

  for (const service of services) {
    try {
      const result = await service(address);
      console.log(`Geocoding successful with ${result.source}`);
      return result;
    } catch (error) {
      console.warn(`Geocoding failed with ${service.name}:`, error.message);
      lastError = error;
      continue;
    }
  }

  throw new Error(`All geocoding services failed. Last error: ${lastError?.message}`);
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { address }: GeocodeRequest = await req.json();

    if (!address || address.trim().length === 0) {
      throw new Error('Address is required');
    }

    console.log(`Geocoding address: ${address}`);

    const result = await geocodeAddress(address.trim());

    // Validation des coordonnées pour la France métropolitaine et DOM-TOM
    const isValidFrenchCoordinates = (lat: number, lng: number): boolean => {
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
    };

    if (!isValidFrenchCoordinates(result.lat, result.lng)) {
      console.warn(`Coordinates outside France: ${result.lat}, ${result.lng} for address: ${address}`);
      // Ne pas rejeter, mais avertir
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in geocode-address function:', error);
    return new Response(
      JSON.stringify({ 
        error: error.message,
        details: 'Failed to geocode address with all available services'
      }), 
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});