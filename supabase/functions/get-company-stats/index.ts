import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { maxThreshold } = await req.json();
    console.log('Starting company stats calculation with threshold:', maxThreshold);

    // Requête SQL optimisée qui fait tout en une fois
    const { data: companyStats, error } = await supabase.rpc('get_company_stats_optimized', {
      max_threshold: maxThreshold || 999999999
    });

    if (error) {
      console.error('Error calling RPC:', error);
      throw error;
    }

    console.log('Company stats calculated:', companyStats?.length || 0);

    return new Response(
      JSON.stringify(companyStats || []),
      { 
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json' 
        } 
      }
    );

  } catch (error) {
    console.error('Error in get-company-stats:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 500,
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json' 
        } 
      }
    );
  }
});
