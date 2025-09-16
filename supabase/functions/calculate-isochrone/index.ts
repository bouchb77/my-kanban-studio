import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface IsochroneRequest {
  lat: number;
  lng: number;
  time: number; // in minutes
  profile: 'driving-car' | 'cycling-regular' | 'foot-walking';
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { lat, lng, time, profile }: IsochroneRequest = await req.json();

    const openRouteServiceKey = Deno.env.get('OPENROUTESERVICE_API_KEY');
    if (!openRouteServiceKey) {
      throw new Error('OpenRouteService API key not configured');
    }

    console.log(`Calculating isochrone for coordinates: ${lat}, ${lng}, time: ${time} minutes, profile: ${profile}`);

    // Call OpenRouteService Isochrone API
    const response = await fetch('https://api.openrouteservice.org/v2/isochrones/driving-car', {
      method: 'POST',
      headers: {
        'Authorization': openRouteServiceKey,
        'Content-Type': 'application/json',
        'Accept': 'application/json, application/geo+json, application/gpx+xml, img/png; charset=utf-8'
      },
      body: JSON.stringify({
        locations: [[lng, lat]], // OpenRouteService expects [longitude, latitude]
        range: [time * 60], // Convert minutes to seconds
        range_type: 'time',
        attributes: ["area", "reachfactor"],
        smoothing: 0.9,
        area_units: 'km'
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('OpenRouteService error:', response.status, errorText);
      throw new Error(`OpenRouteService API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    console.log('OpenRouteService response received successfully');

    // Extract the polygon coordinates from the GeoJSON response
    const feature = data.features[0];
    if (!feature || !feature.geometry || !feature.geometry.coordinates) {
      throw new Error('Invalid isochrone response format');
    }

    // Convert coordinates from [lng, lat] to {lat, lng} format
    const coordinates = feature.geometry.coordinates[0].map((coord: [number, number]) => ({
      lat: coord[1],
      lng: coord[0]
    }));

    const result = {
      polygon: coordinates,
      area: feature.properties.area,
      center: { lat, lng },
      time,
      profile
    };

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in calculate-isochrone function:', error);
    return new Response(
      JSON.stringify({ 
        error: error.message,
        details: 'Failed to calculate isochrone'
      }), 
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});