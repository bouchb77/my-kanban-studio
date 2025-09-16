import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface GeocodeRequest {
  address: string;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { address }: GeocodeRequest = await req.json();

    const openRouteServiceKey = Deno.env.get('OPENROUTESERVICE_API_KEY');
    if (!openRouteServiceKey) {
      throw new Error('OpenRouteService API key not configured');
    }

    console.log(`Geocoding address: ${address}`);

    // Call OpenRouteService Geocoding API
    const response = await fetch(`https://api.openrouteservice.org/geocode/search?api_key=${openRouteServiceKey}&text=${encodeURIComponent(address)}&boundary.country=FR&size=1`, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('OpenRouteService geocoding error:', response.status, errorText);
      throw new Error(`OpenRouteService geocoding API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    console.log('OpenRouteService geocoding response received successfully');

    // Extract coordinates from the response
    if (!data.features || data.features.length === 0) {
      throw new Error('Address not found');
    }

    const feature = data.features[0];
    const [lng, lat] = feature.geometry.coordinates;

    const result = {
      lat,
      lng,
      display_name: feature.properties.label,
      confidence: feature.properties.confidence
    };

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in geocode-address function:', error);
    return new Response(
      JSON.stringify({ 
        error: error.message,
        details: 'Failed to geocode address'
      }), 
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});