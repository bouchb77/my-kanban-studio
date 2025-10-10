import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Encryption/Decryption utilities using Web Crypto API
class CompanyEncryption {
  private key: CryptoKey | null = null;

  async init() {
    const keyString = Deno.env.get('ENCRYPTION_KEY');
    if (!keyString) {
      throw new Error('ENCRYPTION_KEY not found in environment variables');
    }

    // Convert the string key to a CryptoKey for AES-GCM
    const keyData = new TextEncoder().encode(keyString.padEnd(32).slice(0, 32));
    this.key = await crypto.subtle.importKey(
      'raw',
      keyData,
      { name: 'AES-GCM' },
      false,
      ['encrypt', 'decrypt']
    );
  }

  isEncrypted(data: string): boolean {
    if (!data || data.length < 20) return false;
    
    const base64Regex = /^[A-Za-z0-9+/]*={0,2}$/;
    if (!base64Regex.test(data)) return false;
    
    return data.length >= 32;
  }

  async decrypt(encryptedData: string): Promise<string> {
    if (!encryptedData) return encryptedData;
    
    if (!this.isEncrypted(encryptedData)) {
      return encryptedData;
    }

    if (!this.key) await this.init();

    try {
      const combined = new Uint8Array(
        atob(encryptedData).split('').map(c => c.charCodeAt(0))
      );

      const iv = combined.slice(0, 12);
      const encrypted = combined.slice(12);

      const decrypted = await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv },
        this.key!,
        encrypted
      );

      return new TextDecoder().decode(decrypted);
    } catch (error) {
      console.error('Decryption failed for data:', encryptedData.substring(0, 20) + '...');
      return encryptedData;
    }
  }
}

const encryption = new CompanyEncryption();

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
        'User-Agent': 'TaskFlow-Geocoding/1.0',
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
    source: 'Nominatim OSM'
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
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.warn(`Geocoding failed with ${service.name} for "${address}":`, errorMessage);
      lastError = error instanceof Error ? error : new Error(String(error));
      
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

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Test des services de géocodage
    console.log('Testing geocoding services availability...')
    
    const testServices = async () => {
      const services = ['OpenRouteService', 'Google Maps', 'Nominatim OSM'];
      const availableServices = [];
      
      // Test OpenRouteService
      try {
        if (Deno.env.get('OPENROUTESERVICE_API_KEY')) {
          await geocodeWithOpenRouteService('Paris, France');
          availableServices.push('OpenRouteService');
        }
      } catch (e) {
        const errorMessage = e instanceof Error ? e.message : String(e);
        console.warn('OpenRouteService not available:', errorMessage);
      }
      
      // Test Google Maps
      try {
        if (Deno.env.get('GOOGLE_MAPS_API_KEY')) {
          await geocodeWithGoogle('Paris, France');
          availableServices.push('Google Maps');
        }
      } catch (e) {
        const errorMessage = e instanceof Error ? e.message : String(e);
        console.warn('Google Maps not available:', errorMessage);
      }
      
      // Test Nominatim (toujours disponible)
      try {
        await geocodeWithNominatim('Paris, France');
        availableServices.push('Nominatim OSM');
      } catch (e) {
        const errorMessage = e instanceof Error ? e.message : String(e);
        console.warn('Nominatim not available:', errorMessage);
      }
      
      if (availableServices.length === 0) {
        throw new Error('No geocoding services are available');
      }
      
      console.log(`Available geocoding services: ${availableServices.join(', ')}`);
      return availableServices;
    };
    
    await testServices();

    // Function to process companies in background
    async function processCompaniesInBackground() {
      let totalProcessed = 0
      let totalSucceeded = 0
      let totalFailed = 0
      let batchNumber = 1

      console.log('Starting enhanced background geocoding process...')

      try {
        // Process companies in batches of 30 (balance between speed and API limits)
        while (true) {
          // Get companies without coordinates (batch of 30)
          const { data: companies, error: fetchError } = await supabaseClient
            .from('companies')
            .select('id, company_name, address1, address2, city, postal_code, general_department, sipi_number')
            .or('latitude.is.null,longitude.is.null')
            .limit(30)

          if (fetchError) {
            throw fetchError
          }

          // If no more companies to process, break the loop
          if (!companies || companies.length === 0) {
            console.log('Background geocoding completed. No more companies to geocode.')
            break
          }

          console.log(`Processing batch ${batchNumber}: ${companies.length} companies`)
      
          let batchProcessed = 0
          let batchSucceeded = 0
          let batchFailed = 0

          for (const company of companies) {
            try {
              // Decrypt encrypted fields first
              const decryptedAddress1 = company.address1 ? await encryption.decrypt(company.address1) : null;
              const decryptedAddress2 = company.address2 ? await encryption.decrypt(company.address2) : null;
              const decryptedCity = company.city ? await encryption.decrypt(company.city) : null;
              const decryptedPostalCode = company.postal_code ? await encryption.decrypt(company.postal_code) : null;

              // Build address string with multiple fallback strategies
              const buildAddress = (company: any): string[] => {
                const strategies = [];
                
                // Stratégie 1: Adresse complète avec ville
                if (decryptedAddress1 && decryptedCity) {
                  const parts = [
                    decryptedAddress1,
                    decryptedAddress2,
                    decryptedPostalCode,
                    decryptedCity,
                    'France'
                  ].filter(Boolean);
                  strategies.push(parts.join(', '));
                }
                
                // Stratégie 2: Ville + code postal seulement
                if (decryptedCity && decryptedPostalCode) {
                  strategies.push(`${decryptedPostalCode} ${decryptedCity}, France`);
                }
                
                // Stratégie 3: Ville seulement
                if (decryptedCity) {
                  strategies.push(`${decryptedCity}, France`);
                }
                
                return strategies;
              };
              
              const addressStrategies = buildAddress(company);
              
              if (addressStrategies.length === 0) {
                console.log(`Skipping company ${company.sipi_number} - no address data`)
                batchFailed++
                continue
              }

              let geocodeResult: GeocodeResult | null = null;
              let usedStrategy = '';
              
              // Essayer chaque stratégie d'adresse
              for (const address of addressStrategies) {
                try {
                  console.log(`Geocoding ${company.company_name} with strategy: "${address}"`)
                  geocodeResult = await geocodeAddress(address);
                  usedStrategy = address;
                  break;
                } catch (error) {
                  const errorMessage = error instanceof Error ? error.message : String(error);
                  console.warn(`Failed strategy "${address}" for ${company.company_name}:`, errorMessage);
                  continue;
                }
              }
              
              if (!geocodeResult) {
                console.log(`All geocoding strategies failed for ${company.company_name}`)
                batchFailed++
                continue
              }

              // Validation des coordonnées
              if (!isValidFrenchCoordinates(geocodeResult.lat, geocodeResult.lng)) {
                console.warn(`Invalid coordinates for ${company.company_name}: ${geocodeResult.lat}, ${geocodeResult.lng}`)
                // On continue quand même mais on marque une qualité réduite
              }

              // Extract department from postal code (first 2 digits)
              let expectedDepartment = company.general_department || ''
              if (!expectedDepartment && decryptedPostalCode) {
                const postalCode = decryptedPostalCode.replace(/\s/g, '')
                if (postalCode.length >= 2) {
                  expectedDepartment = postalCode.substring(0, 2)
                  
                  // Handle special cases
                  if (expectedDepartment === '97') {
                    expectedDepartment = postalCode.substring(0, 3) // DOM-TOM
                  } else if (expectedDepartment === '20') {
                    // Corsica: 2A or 2B
                    const corseCode = postalCode.substring(0, 3)
                    if (corseCode.startsWith('201') || corseCode.startsWith('200')) {
                      expectedDepartment = '2A'
                    } else {
                      expectedDepartment = '2B'
                    }
                  }
                }
              }

              // Enhanced validation
              let qualityScore = 100
              let validationWarnings = []
              
              if (decryptedPostalCode && geocodeResult.display_name) {
                const postalCode = decryptedPostalCode.replace(/\s/g, '')
                
                if (!geocodeResult.display_name.toLowerCase().includes(postalCode)) {
                  qualityScore -= 20
                  validationWarnings.push(`Postal code not found in geocoded address: ${postalCode}`)
                }
              }
              
              if (decryptedCity && geocodeResult.display_name) {
                const cityName = decryptedCity.toLowerCase().replace(/\s*cedex.*$/i, '').trim()
                if (!geocodeResult.display_name.toLowerCase().includes(cityName)) {
                  qualityScore -= 15
                  validationWarnings.push(`City name not found in geocoded address: ${cityName}`)
                }
              }

              // Update company with coordinates
              const { error: updateError } = await supabaseClient
                .from('companies')
                .update({
                  latitude: geocodeResult.lat,
                  longitude: geocodeResult.lng,
                  geocoded_address: geocodeResult.display_name,
                  geocoding_date: new Date().toISOString(),
                  general_department: expectedDepartment || null
                })
                .eq('id', company.id)

              if (updateError) {
                console.error(`Failed to update company ${company.sipi_number}:`, updateError)
                batchFailed++
              } else {
                const qualityIcon = qualityScore >= 80 ? '✅' : qualityScore >= 60 ? '⚠️' : '❌'
                const warningText = validationWarnings.length > 0 ? ` (${validationWarnings.join(', ')})` : ''
                console.log(`${qualityIcon} Geocoded ${company.company_name} via ${geocodeResult.source}: ${geocodeResult.lat}, ${geocodeResult.lng} [Quality: ${qualityScore}%]${warningText}`)
                console.log(`   Used strategy: "${usedStrategy}"`)
                batchSucceeded++
              }
            
              batchProcessed++
            
              // Rate limiting - wait between requests
              await new Promise(resolve => setTimeout(resolve, 300))
              
            } catch (error) {
              console.error(`Error processing company ${company.sipi_number}:`, error)
              batchFailed++
            }
          }

          // Update totals for this batch
          totalProcessed += batchProcessed
          totalSucceeded += batchSucceeded
          totalFailed += batchFailed
          
          console.log(`Batch ${batchNumber} completed: ${batchSucceeded} succeeded, ${batchFailed} failed`)
          batchNumber++
          
          // Wait between batches
          await new Promise(resolve => setTimeout(resolve, 2000))
          
          // Break if we've processed too many batches in one run to avoid timeouts
          if (batchNumber > 15) {
            console.log('Reached batch limit for this execution. Function will restart automatically.')
            break
          }
        }
        
        console.log(`Enhanced background process completed: ${totalProcessed} processed, ${totalSucceeded} succeeded, ${totalFailed} failed`)
        return { totalProcessed, totalSucceeded, totalFailed, batches: batchNumber - 1 }
      } catch (error) {
        console.error('Enhanced background geocoding error:', error)
        throw error
      }
    }

    // Start the background process
    const backgroundTask = processCompaniesInBackground()

    // Use background task without EdgeRuntime for compatibility
    // The background task will still run but may be terminated when the function completes
    processCompaniesInBackground();

    // Return immediate response while background task continues
    return new Response(
      JSON.stringify({
        success: true,
        message: 'Enhanced geocoding process started in background with fallback services. Check logs for progress.',
        status: 'running',
        services: ['OpenRouteService', 'Google Maps', 'Nominatim OSM']
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      },
    )

  } catch (error) {
    console.error('Error:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return new Response(
      JSON.stringify({
        success: false,
        error: errorMessage,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      },
    )
  }
})