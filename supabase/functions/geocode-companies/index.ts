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
      console.error('MAPBOX_ACCESS_TOKEN not configured in environment variables')
      throw new Error('MAPBOX_ACCESS_TOKEN not configured')
    }

    // Test Mapbox API availability with a simple request
    console.log('Testing Mapbox API connectivity...')
    try {
      const testResponse = await fetch(`https://api.mapbox.com/geocoding/v5/mapbox.places/paris.json?access_token=${mapboxToken}&limit=1`)
      if (!testResponse.ok) {
        const errorText = await testResponse.text()
        console.error('Mapbox API test failed:', testResponse.status, errorText)
        throw new Error(`Mapbox API test failed: ${testResponse.status} - ${errorText}`)
      }
      const testData = await testResponse.json()
      console.log('Mapbox API test successful:', testData.features?.length > 0 ? 'Token is valid' : 'Token may be invalid')
    } catch (error) {
      console.error('Mapbox API connectivity test failed:', error)
      throw new Error(`Mapbox API connectivity test failed: ${error.message}`)
    }

    // Function to process companies in background
    async function processCompaniesInBackground() {
      let totalProcessed = 0
      let totalSucceeded = 0
      let totalFailed = 0
      let batchNumber = 1

      console.log('Starting background geocoding process...')

      try {
        // Process companies in batches of 25 (reduced for better performance)
        while (true) {
          // Get companies without coordinates (batch of 25)
          const { data: companies, error: fetchError } = await supabaseClient
            .from('companies')
            .select('id, company_name, address1, address2, city, postal_code, sipi_number')
            .or('latitude.is.null,longitude.is.null')
            .limit(25)

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

        // Geocode with Mapbox - prioritize postal code precision
        let geocodeUrl = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(address)}.json?access_token=${mapboxToken}&country=FR&limit=1`
        
        // If we have postal code, add it as a proximity bias
        if (company.postal_code) {
          geocodeUrl += `&types=postcode,address,poi`
        }
        
        console.log(`Geocoding ${company.company_name} with address: "${address}"`)
        
        const response = await fetch(geocodeUrl)
        
        if (!response.ok) {
          const errorText = await response.text()
          console.error(`Mapbox API error for ${company.company_name}: ${response.status} - ${errorText}`)
          batchFailed++
          continue
        }
        
        const data = await response.json()
        
        if (!data.features || data.features.length === 0) {
          console.log(`No coordinates found for ${company.company_name} at "${address}"`)
          console.log(`Mapbox response:`, JSON.stringify(data, null, 2))
          batchFailed++
          continue
        }
        
        const feature = data.features[0]
        const [longitude, latitude] = feature.center
        const geocodedAddress = feature.place_name

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

          // Enhanced validation: Check postal code match in geocoded result
          let qualityScore = 100
          let validationWarnings = []
          
          if (company.postal_code && geocodedAddress) {
            const geocodedLower = geocodedAddress.toLowerCase()
            const postalCode = company.postal_code.replace(/\s/g, '')
            
            // Check if postal code appears in geocoded address
            if (!geocodedLower.includes(postalCode)) {
              qualityScore -= 30
              validationWarnings.push(`Postal code mismatch: ${postalCode}`)
            }
            
            // Check department consistency
            if (expectedDepartment) {
              const departmentNames: { [key: string]: string[] } = {
                '01': ['ain'], '02': ['aisne'], '03': ['allier'], '04': ['alpes-de-haute-provence'],
                '05': ['hautes-alpes'], '06': ['alpes-maritimes'], '07': ['ardèche'], '08': ['ardennes'],
                '09': ['ariège'], '10': ['aube'], '11': ['aude'], '12': ['aveyron'],
                '13': ['bouches-du-rhône'], '14': ['calvados'], '15': ['cantal'], '16': ['charente'],
                '17': ['charente-maritime'], '18': ['cher'], '19': ['corrèze'], '21': ['côte-d\'or'],
                '22': ['côtes-d\'armor'], '23': ['creuse'], '24': ['dordogne'], '25': ['doubs'],
                '26': ['drôme'], '27': ['eure'], '28': ['eure-et-loir'], '29': ['finistère'],
                '30': ['gard'], '31': ['haute-garonne'], '32': ['gers'], '33': ['gironde'],
                '34': ['hérault'], '35': ['ille-et-vilaine'], '36': ['indre'], '37': ['indre-et-loire'],
                '38': ['isère'], '39': ['jura'], '40': ['landes'], '41': ['loir-et-cher'],
                '42': ['loire'], '43': ['haute-loire'], '44': ['loire-atlantique'], '45': ['loiret'],
                '46': ['lot'], '47': ['lot-et-garonne'], '48': ['lozère'], '49': ['maine-et-loire'],
                '50': ['manche'], '51': ['marne'], '52': ['haute-marne'], '53': ['mayenne'],
                '54': ['meurthe-et-moselle'], '55': ['meuse'], '56': ['morbihan'], '57': ['moselle'],
                '58': ['nièvre'], '59': ['nord'], '60': ['oise'], '61': ['orne'],
                '62': ['pas-de-calais'], '63': ['puy-de-dôme'], '64': ['pyrénées-atlantiques'],
                '65': ['hautes-pyrénées'], '66': ['pyrénées-orientales'], '67': ['bas-rhin'],
                '68': ['haut-rhin'], '69': ['rhône'], '70': ['haute-saône'], '71': ['saône-et-loire'],
                '72': ['sarthe'], '73': ['savoie'], '74': ['haute-savoie'], '75': ['paris'],
                '76': ['seine-maritime'], '77': ['seine-et-marne'], '78': ['yvelines'],
                '79': ['deux-sèvres'], '80': ['somme'], '81': ['tarn'], '82': ['tarn-et-garonne'],
                '83': ['var'], '84': ['vaucluse'], '85': ['vendée'], '86': ['vienne'],
                '87': ['haute-vienne'], '88': ['vosges'], '89': ['yonne'], '90': ['territoire de belfort'],
                '91': ['essonne'], '92': ['hauts-de-seine'], '93': ['seine-saint-denis'],
                '94': ['val-de-marne'], '95': ['val-d\'oise'], '2A': ['corse-du-sud'], '2B': ['haute-corse']
              }
              
              const expectedDeptNames = departmentNames[expectedDepartment] || []
              const hasDepartmentMatch = expectedDeptNames.some(name => 
                geocodedLower.includes(name) || geocodedLower.includes(expectedDepartment)
              )
              
              if (!hasDepartmentMatch) {
                qualityScore -= 20
                validationWarnings.push(`Department mismatch: expected ${expectedDepartment}`)
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
        } else {
          console.log(`No coordinates found for ${company.company_name} at ${address}`)
          batchFailed++
        }
        
          batchProcessed++
          
          // Rate limiting - wait 200ms between requests for stability
          await new Promise(resolve => setTimeout(resolve, 200))
          
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