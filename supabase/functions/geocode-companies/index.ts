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

    // Test Google Maps API availability
    console.log('Testing Google Maps API connectivity...')
    const googleMapsApiKey = Deno.env.get('GOOGLE_MAPS_API_KEY')
    if (!googleMapsApiKey) {
      throw new Error('Google Maps API key is not configured')
    }
    
    try {
      const testResponse = await fetch(`https://maps.googleapis.com/maps/api/geocode/json?address=Paris,France&key=${googleMapsApiKey}`)
      if (!testResponse.ok) {
        const errorText = await testResponse.text()
        console.error('Google Maps API test failed:', testResponse.status, errorText)
        throw new Error(`Google Maps API test failed: ${testResponse.status} - ${errorText}`)
      }
      const testData = await testResponse.json()
      if (testData.status !== 'OK') {
        console.error('Google Maps API test failed:', testData.status, testData.error_message)
        throw new Error(`Google Maps API test failed: ${testData.status} - ${testData.error_message}`)
      }
      console.log('Google Maps API test successful:', testData?.results?.length > 0 ? 'API is accessible' : 'API may have issues')
    } catch (error) {
      console.error('Google Maps API connectivity test failed:', error)
      throw new Error(`Google Maps API connectivity test failed: ${error.message}`)
    }

    // Function to process companies in background
    async function processCompaniesInBackground() {
      let totalProcessed = 0
      let totalSucceeded = 0
      let totalFailed = 0
      let batchNumber = 1

      console.log('Starting background geocoding process...')

      try {
        // Process companies in batches of 50 (Google Maps has higher rate limits)
        while (true) {
          // Get companies without coordinates (batch of 50)
          const { data: companies, error: fetchError } = await supabaseClient
            .from('companies')
            .select('id, company_name, address1, address2, city, postal_code, sipi_number')
            .or('latitude.is.null,longitude.is.null')
            .limit(50)

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
        // Build address string using address1, address2, and postal_code
        const addressParts = [
          company.address1,
          company.address2,
          company.postal_code,
          'France'
        ].filter(Boolean);
        const address = addressParts.join(', ');
        
        if (!address.trim()) {
          console.log(`Skipping company ${company.sipi_number} - no address data`)
          batchFailed++
          continue
        }

        // Geocode with Google Maps API
        const googleMapsApiKey = Deno.env.get('GOOGLE_MAPS_API_KEY')
        const geocodeUrl = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${googleMapsApiKey}&region=fr`
        
        console.log(`Geocoding ${company.company_name} with address: "${address}"`)
        
        const response = await fetch(geocodeUrl)
        
        if (!response.ok) {
          const errorText = await response.text()
          console.error(`Google Maps API error for ${company.company_name}: ${response.status} - ${errorText}`)
          batchFailed++
          continue
        }
        
        const data = await response.json()
        
        if (data.status !== 'OK' || !data.results || data.results.length === 0) {
          console.log(`No coordinates found for ${company.company_name} at "${address}"`)
          console.log(`Google Maps response:`, JSON.stringify(data, null, 2))
          batchFailed++
          continue
        }
        
        const result = data.results[0]
        const latitude = result.geometry.location.lat
        const longitude = result.geometry.location.lng
        const geocodedAddress = result.formatted_address

        // Extract department from postal code (first 2 digits)
        let expectedDepartment = ''
        if (company.postal_code) {
          const postalCode = company.postal_code.replace(/\s/g, '')
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

        // Enhanced validation with Google Maps address components
        let qualityScore = 100
        let validationWarnings = []
        
        // Google Maps provides structured address components
        const addressComponents = result.address_components || []
        
        if (company.postal_code && geocodedAddress) {
          const postalCode = company.postal_code.replace(/\s/g, '')
          
          // Find postal code in address components
          const postalCodeComponent = addressComponents.find(component => 
            component.types.includes('postal_code')
          )
          
          if (postalCodeComponent && postalCodeComponent.long_name !== postalCode) {
            qualityScore -= 30
            validationWarnings.push(`Postal code mismatch: expected ${postalCode}, got ${postalCodeComponent.long_name}`)
          } else if (!postalCodeComponent && !geocodedAddress.toLowerCase().includes(postalCode)) {
            qualityScore -= 20
            validationWarnings.push(`Postal code not found in address: ${postalCode}`)
          }
          
          // Check department consistency using postal code
          if (expectedDepartment && postalCodeComponent) {
            const geocodedDept = postalCodeComponent.long_name.substring(0, 2)
            if (geocodedDept !== expectedDepartment) {
              qualityScore -= 15
              validationWarnings.push(`Department mismatch: expected ${expectedDepartment}, got ${geocodedDept}`)
            }
          }
        }
        // Update company with coordinates and validation info
        const { error: updateError } = await supabaseClient
          .from('companies')
          .update({
            latitude,
            longitude,
            geocoded_address: geocodedAddress,
            geocoding_date: new Date().toISOString(),
            general_department: expectedDepartment || null,
            quality: qualityScore >= 80 ? 'high' : qualityScore >= 60 ? 'medium' : 'low'
          })
          .eq('id', company.id)

          if (updateError) {
            console.error(`Failed to update company ${company.sipi_number}:`, updateError)
            batchFailed++
          } else {
            const qualityIcon = qualityScore >= 80 ? '✅' : qualityScore >= 60 ? '⚠️' : '❌'
            const warningText = validationWarnings.length > 0 ? ` (${validationWarnings.join(', ')})` : ''
            console.log(`${qualityIcon} Geocoded ${company.company_name}: ${latitude}, ${longitude} [Quality: ${qualityScore}%]${warningText}`)
            batchSucceeded++
          }
        
        batchProcessed++
        
        // Rate limiting for Google Maps - wait 100ms between requests
        await new Promise(resolve => setTimeout(resolve, 100))
          
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
      
      // Wait 1 second between batches
      await new Promise(resolve => setTimeout(resolve, 1000))
      
      // Break if we've processed too many batches in one run to avoid timeouts
      if (batchNumber > 20) {
        console.log('Reached batch limit for this execution. Function will restart automatically.')
        break
      }
    }
    
    console.log(`Background process completed: ${totalProcessed} processed, ${totalSucceeded} succeeded, ${totalFailed} failed`)
    return { totalProcessed, totalSucceeded, totalFailed, batches: batchNumber - 1 }
  } catch (error) {
    console.error('Background geocoding error:', error)
    throw error
  }
}

// Start the background process
const backgroundTask = processCompaniesInBackground()

// Use EdgeRuntime.waitUntil to prevent timeout
if (typeof EdgeRuntime !== 'undefined') {
  EdgeRuntime.waitUntil(backgroundTask)
}

    // Return immediate response while background task continues
    return new Response(
      JSON.stringify({
        success: true,
        message: 'Geocoding process started in background. Check logs for progress.',
        status: 'running'
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