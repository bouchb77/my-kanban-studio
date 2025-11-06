import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Classe de décryptage (identique à encrypted-companies)
class CompanyEncryption {
  private key: CryptoKey | null = null;

  async init() {
    const keyString = Deno.env.get('ENCRYPTION_KEY');
    if (!keyString) {
      throw new Error('ENCRYPTION_KEY not found in environment variables');
    }

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

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response('Unauthorized', { 
        status: 401,
        headers: corsHeaders 
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Verify user is admin
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      return new Response('Unauthorized', { 
        status: 401,
        headers: corsHeaders 
      });
    }

    // Check if user is admin
    const { data: userRoles } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id);

    const isAdmin = userRoles?.some(r => r.role === 'admin');
    if (!isAdmin) {
      return new Response('Forbidden: Admin access required', { 
        status: 403,
        headers: corsHeaders 
      });
    }

    // Initialize encryption
    await encryption.init();

    console.log('Starting SIPI decryption process...');

    // Load all companies
    let allCompanies: any[] = [];
    let from = 0;
    const batchSize = 1000;
    let hasMore = true;

    while (hasMore) {
      const { data, error } = await supabase
        .from('companies')
        .select('id, sipi_number')
        .range(from, from + batchSize - 1);

      if (error) {
        throw new Error(`Database error: ${error.message}`);
      }

      if (data && data.length > 0) {
        allCompanies = [...allCompanies, ...data];
        from += batchSize;
        hasMore = data.length === batchSize;
        console.log(`Loaded batch: ${data.length} companies (total: ${allCompanies.length})`);
      } else {
        hasMore = false;
      }
    }

    console.log(`Total companies loaded: ${allCompanies.length}`);

    // Decrypt SIPI numbers and update
    let updatedCount = 0;
    let alreadyDecryptedCount = 0;
    let errorCount = 0;

    for (const company of allCompanies) {
      try {
        const decryptedSipi = await encryption.decrypt(company.sipi_number);
        
        // Only update if it was actually encrypted
        if (decryptedSipi !== company.sipi_number) {
          const { error: updateError } = await supabase
            .from('companies')
            .update({ sipi_number: decryptedSipi })
            .eq('id', company.id);

          if (updateError) {
            console.error(`Error updating company ${company.id}:`, updateError);
            errorCount++;
          } else {
            updatedCount++;
            if (updatedCount % 100 === 0) {
              console.log(`Progress: ${updatedCount} companies updated`);
            }
          }
        } else {
          alreadyDecryptedCount++;
        }
      } catch (error) {
        console.error(`Error processing company ${company.id}:`, error);
        errorCount++;
      }
    }

    console.log(`Decryption complete. Updated: ${updatedCount}, Already decrypted: ${alreadyDecryptedCount}, Errors: ${errorCount}`);

    return new Response(
      JSON.stringify({
        success: true,
        updated: updatedCount,
        alreadyDecrypted: alreadyDecryptedCount,
        errors: errorCount,
        total: allCompanies.length
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error) {
    console.error('Error in decrypt-sipi-numbers function:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
