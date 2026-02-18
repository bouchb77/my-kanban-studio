import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface GeocodeResult {
  lat: number;
  lng: number;
  display_name: string;
  source: string;
}

// Validation des coordonnées pour l'Allemagne
function isValidGermanCoordinates(lat: number, lng: number): boolean {
  return lat >= 47.0 && lat <= 55.5 && lng >= 5.5 && lng <= 15.5;
}

// Nominatim OSM (gratuit, pas de clé requise)
async function geocodeWithNominatim(address: string): Promise<GeocodeResult> {
  const response = await fetch(
    `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}&countrycodes=de&limit=1`,
    {
      headers: {
        'User-Agent': 'TaskFlow-DEGeocode/1.0',
        'Accept': 'application/json',
      },
      signal: AbortSignal.timeout(8000),
    }
  );

  if (!response.ok) throw new Error(`Nominatim error: ${response.status}`);

  const data = await response.json();
  if (!data || data.length === 0) throw new Error('No results from Nominatim');

  return {
    lat: parseFloat(data[0].lat),
    lng: parseFloat(data[0].lon),
    display_name: data[0].display_name,
    source: 'Nominatim OSM',
  };
}

// Google Maps (fallback)
async function geocodeWithGoogle(address: string): Promise<GeocodeResult> {
  const apiKey = Deno.env.get('GOOGLE_MAPS_API_KEY');
  if (!apiKey) throw new Error('Google Maps API key not configured');

  const response = await fetch(
    `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&region=de&key=${apiKey}`,
    { signal: AbortSignal.timeout(8000) }
  );

  if (!response.ok) throw new Error(`Google Maps error: ${response.status}`);

  const data = await response.json();
  if (data.status !== 'OK' || !data.results?.length) throw new Error(`Google Maps: ${data.status}`);

  const { lat, lng } = data.results[0].geometry.location;
  return { lat, lng, display_name: data.results[0].formatted_address, source: 'Google Maps' };
}

async function geocodeAddress(address: string): Promise<GeocodeResult> {
  // Essayer Nominatim d'abord (pas de coût), puis Google
  const services = [geocodeWithNominatim, geocodeWithGoogle];
  let lastError: Error | null = null;

  for (const service of services) {
    try {
      const result = await service(address);
      console.log(`Geocoding OK with ${result.source}: ${address}`);
      return result;
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      console.warn(`Failed with ${service.name}:`, lastError.message);
      await new Promise(r => setTimeout(r, 300));
    }
  }

  throw new Error(`All services failed for "${address}": ${lastError?.message}`);
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    let totalProcessed = 0;
    let totalSucceeded = 0;
    let totalFailed = 0;

    // Traiter par batch de 30
    while (true) {
      const { data: companies, error } = await supabase
        .from('companies_de')
        .select('id, company_name, address1, address2, city, postal_code, region')
        .or('latitude.is.null,longitude.is.null')
        .limit(30);

      if (error) throw error;
      if (!companies || companies.length === 0) break;

      console.log(`Processing ${companies.length} companies DE...`);

      for (const company of companies) {
        try {
          // Construire les stratégies d'adresse
          const strategies: string[] = [];

          if (company.address1 && company.city) {
            const parts = [company.address1, company.address2, company.postal_code, company.city, 'Deutschland'].filter(Boolean);
            strategies.push(parts.join(', '));
          }
          if (company.city && company.postal_code) {
            strategies.push(`${company.postal_code} ${company.city}, Deutschland`);
          }
          if (company.city) {
            strategies.push(`${company.city}, Deutschland`);
          }

          if (strategies.length === 0) {
            console.log(`Skipping ${company.company_name} - no address`);
            totalFailed++;
            continue;
          }

          let geocodeResult: GeocodeResult | null = null;

          for (const address of strategies) {
            try {
              geocodeResult = await geocodeAddress(address);
              if (isValidGermanCoordinates(geocodeResult.lat, geocodeResult.lng)) break;
              console.warn(`Coordinates outside Germany for ${company.company_name}: ${geocodeResult.lat}, ${geocodeResult.lng}`);
              geocodeResult = null;
            } catch {
              continue;
            }
          }

          if (!geocodeResult) {
            console.log(`All strategies failed for ${company.company_name}`);
            totalFailed++;
            continue;
          }

          const { error: updateError } = await supabase
            .from('companies_de')
            .update({ latitude: geocodeResult.lat, longitude: geocodeResult.lng })
            .eq('id', company.id);

          if (updateError) {
            console.error(`Update failed for ${company.company_name}:`, updateError);
            totalFailed++;
          } else {
            console.log(`✅ ${company.company_name}: ${geocodeResult.lat}, ${geocodeResult.lng}`);
            totalSucceeded++;
          }

          totalProcessed++;
          await new Promise(r => setTimeout(r, 350)); // Rate limiting
        } catch (err) {
          console.error(`Error processing ${company.company_name}:`, err);
          totalFailed++;
        }
      }
    }

    return new Response(
      JSON.stringify({ success: true, processed: totalProcessed, succeeded: totalSucceeded, failed: totalFailed }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    console.error('Error:', err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
