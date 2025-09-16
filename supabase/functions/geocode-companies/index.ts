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

    // Test Nominatim API availability
    console.log('Testing Nominatim API connectivity...')
    try {
      const testResponse = await fetch('https://nominatim.openstreetmap.org/search?q=paris,france&format=json&limit=1&countrycodes=fr')
      if (!testResponse.ok) {
        const errorText = await testResponse.text()
        console.error('Nominatim API test failed:', testResponse.status, errorText)
        throw new Error(`Nominatim API test failed: ${testResponse.status} - ${errorText}`)
      }
      const testData = await testResponse.json()
      console.log('Nominatim API test successful:', testData?.length > 0 ? 'API is accessible' : 'API may have issues')
    } catch (error) {
      console.error('Nominatim API connectivity test failed:', error)
      throw new Error(`Nominatim API connectivity test failed: ${error.message}`)
    }

    // Function to process companies in background
    async function processCompaniesInBackground() {
      let totalProcessed = 0
      let totalSucceeded = 0
      let totalFailed = 0
      let batchNumber = 1

      console.log('Starting background geocoding process...')

      try {
        // Process companies in batches of 10 (reduced for Nominatim rate limits)
        while (true) {
          // Get companies without coordinates (batch of 10)
          const { data: companies, error: fetchError } = await supabaseClient
            .from('companies')
            .select('id, company_name, address1, address2, city, postal_code, sipi_number')
            .or('latitude.is.null,longitude.is.null')
            .limit(10)

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
        // Build address string prioritizing postal code over city name
        let address = '';
        
        // Primary geocoding attempt: Use postal code + basic address
        if (company.postal_code) {
          const addressParts = [
            company.address1,
            company.postal_code,
            'France'
          ].filter(Boolean);
          address = addressParts.join(', ');
        } else {
          // Fallback: Use full address if no postal code
          const addressParts = [
            company.address1,
            company.address2,
            company.city,
            'France'
          ].filter(Boolean);
          address = addressParts.join(', ');
        }
        
        if (!address.trim()) {
          console.log(`Skipping company ${company.sipi_number} - no address data`)
          batchFailed++
          continue
        }

        // Geocode with Nominatim (OpenStreetMap) - free alternative
        let geocodeUrl = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(address)}&format=json&limit=1&countrycodes=fr&addressdetails=1`
        
        console.log(`Geocoding ${company.company_name} with address: "${address}"`)
        
        const response = await fetch(geocodeUrl, {
          headers: {
            'User-Agent': 'Lovable-App-Geocoding/1.0'
          }
        })
        
        if (!response.ok) {
          const errorText = await response.text()
          console.error(`Nominatim API error for ${company.company_name}: ${response.status} - ${errorText}`)
          batchFailed++
          continue
        }
        
        const data = await response.json()
        
        if (!Array.isArray(data) || data.length === 0) {
          console.log(`No coordinates found for ${company.company_name} at "${address}"`)
          console.log(`Nominatim response:`, JSON.stringify(data, null, 2))
          batchFailed++
          continue
        }
        
        const result = data[0]
        const latitude = parseFloat(result.lat)
        const longitude = parseFloat(result.lon)
        const geocodedAddress = result.display_name

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

        // Enhanced validation with Nominatim address details
        let qualityScore = 100
        let validationWarnings = []
        
        // Nominatim provides structured address data
        const addressDetails = result.address || {}
        
        if (company.postal_code && (geocodedAddress || addressDetails.postcode)) {
          const postalCode = company.postal_code.replace(/\s/g, '')
          
          // Check postal code match in structured data first, then fallback to display name
          const nominatimPostcode = addressDetails.postcode?.replace(/\s/g, '') || ''
          const geocodedLower = geocodedAddress.toLowerCase()
          
          if (nominatimPostcode && nominatimPostcode !== postalCode) {
            qualityScore -= 30
            validationWarnings.push(`Postal code mismatch: expected ${postalCode}, got ${nominatimPostcode}`)
          } else if (!nominatimPostcode && !geocodedLower.includes(postalCode)) {
            qualityScore -= 20
            validationWarnings.push(`Postal code not found in address: ${postalCode}`)
          }
          
          // Check department consistency using structured data
          if (expectedDepartment && addressDetails.postcode) {
            const nominatimDept = addressDetails.postcode.substring(0, 2)
            if (nominatimDept !== expectedDepartment) {
              qualityScore -= 15
              validationWarnings.push(`Department mismatch: expected ${expectedDepartment}, got ${nominatimDept}`)
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
        
        // Rate limiting for Nominatim - wait 1 second between requests (recommended by OSM)
        await new Promise(resolve => setTimeout(resolve, 1000))
          
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
      
      // Wait 3 seconds between batches to avoid rate limits
      await new Promise(resolve => setTimeout(resolve, 3000))
      
      // Break if we've processed too many batches in one run to avoid timeouts
      if (batchNumber > 30) {
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