import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
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

    const mapboxToken = Deno.env.get('MAPBOX_ACCESS_TOKEN')
    if (!mapboxToken) {
      throw new Error('MAPBOX_ACCESS_TOKEN not configured')
    }

    // Get companies without coordinates
    const { data: companies, error: fetchError } = await supabaseClient
      .from('companies')
      .select('id, company_name, address1, address2, city, postal_code, sipi_number')
      .or('latitude.is.null,longitude.is.null')
      .limit(50) // Process 50 at a time to avoid rate limits

    if (fetchError) {
      throw fetchError
    }

    console.log(`Processing ${companies?.length || 0} companies`)

    let processed = 0
    let succeeded = 0
    let failed = 0

    for (const company of companies || []) {
      try {
        // Build address string
        const addressParts = [
          company.address1,
          company.address2,
          company.city,
          company.postal_code,
          'France'
        ].filter(Boolean)
        
        const address = addressParts.join(', ')
        
        if (!address.trim()) {
          console.log(`Skipping company ${company.sipi_number} - no address`)
          failed++
          continue
        }

        // Geocode with Mapbox
        const geocodeUrl = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(address)}.json?access_token=${mapboxToken}&country=FR&limit=1`
        
        const response = await fetch(geocodeUrl)
        const data = await response.json()

        if (data.features && data.features.length > 0) {
          const feature = data.features[0]
          const [longitude, latitude] = feature.center
          const geocodedAddress = feature.place_name

          // Update company with coordinates
          const { error: updateError } = await supabaseClient
            .from('companies')
            .update({
              latitude,
              longitude,
              geocoded_address: geocodedAddress,
              geocoding_date: new Date().toISOString()
            })
            .eq('id', company.id)

          if (updateError) {
            console.error(`Failed to update company ${company.sipi_number}:`, updateError)
            failed++
          } else {
            console.log(`Geocoded ${company.company_name}: ${latitude}, ${longitude}`)
            succeeded++
          }
        } else {
          console.log(`No coordinates found for ${company.company_name} at ${address}`)
          failed++
        }
        
        processed++
        
        // Rate limiting - wait 100ms between requests
        await new Promise(resolve => setTimeout(resolve, 100))
        
      } catch (error) {
        console.error(`Error processing company ${company.sipi_number}:`, error)
        failed++
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        processed,
        succeeded,
        failed,
        message: `Processed ${processed} companies. ${succeeded} geocoded successfully, ${failed} failed.`
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      },
    )

  } catch (error) {
    console.error('Error:', error)
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      },
    )
  }
})