import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Get the Mapbox token from Supabase secrets
    const mapboxToken = Deno.env.get('MAPBOX_ACCESS_TOKEN');
    
    if (!mapboxToken) {
      console.error('MAPBOX_ACCESS_TOKEN not found in environment variables');
      return new Response(
        JSON.stringify({ 
          error: 'Mapbox token not configured',
          token: 'pk.eyJ1IjoidGVzdCIsImEiOiJ0ZXN0In0.demo' // Fallback demo token
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200
        }
      );
    }

    console.log('Mapbox token retrieved successfully');

    return new Response(
      JSON.stringify({ 
        token: mapboxToken,
        success: true 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      }
    );

  } catch (error) {
    console.error('Error in get-mapbox-token function:', error);
    
    return new Response(
      JSON.stringify({ 
        error: 'Internal server error',
        token: 'pk.eyJ1IjoidGVzdCIsImEiOiJ0ZXN0In0.demo' // Fallback demo token
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      }
    );
  }
});