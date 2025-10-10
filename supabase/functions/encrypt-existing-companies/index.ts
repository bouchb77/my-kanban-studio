import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Encryption utilities using Web Crypto API
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

  async encrypt(text: string): Promise<string> {
    if (!text) return text;
    if (!this.key) await this.init();
    
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const encoder = new TextEncoder();
    const data = encoder.encode(text);

    const encrypted = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      this.key!,
      data
    );

    const combined = new Uint8Array(iv.length + encrypted.byteLength);
    combined.set(iv);
    combined.set(new Uint8Array(encrypted), iv.length);

    return btoa(String.fromCharCode(...combined));
  }

  isEncrypted(data: string): boolean {
    if (!data || data.length < 20) return false;
    
    const base64Regex = /^[A-Za-z0-9+/]*={0,2}$/;
    if (!base64Regex.test(data)) return false;
    
    return data.length >= 32;
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

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      return new Response('Unauthorized', { 
        status: 401,
        headers: corsHeaders 
      });
    }

    // Check if user is admin
    const { data: roles } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .eq('role', 'admin')
      .single();

    if (!roles) {
      return new Response('Forbidden - Admin access required', { 
        status: 403,
        headers: corsHeaders 
      });
    }

    console.log('Starting encryption of existing companies data...');

    // Fetch all companies in batches
    let allCompanies: any[] = [];
    let from = 0;
    const batchSize = 100;
    let hasMore = true;

    while (hasMore) {
      const { data, error } = await supabase
        .from('companies')
        .select('*')
        .range(from, from + batchSize - 1);

      if (error) {
        throw new Error(`Error fetching companies: ${error.message}`);
      }

      if (data && data.length > 0) {
        allCompanies = [...allCompanies, ...data];
        from += batchSize;
        hasMore = data.length === batchSize;
      } else {
        hasMore = false;
      }
    }

    console.log(`Found ${allCompanies.length} companies to process`);

    let encrypted = 0;
    let alreadyEncrypted = 0;
    let errors = 0;

    // Process each company
    for (const company of allCompanies) {
      try {
        // Check if already encrypted
        const isAlreadyEncrypted = 
          encryption.isEncrypted(company.company_name || '') ||
          encryption.isEncrypted(company.sipi_number || '');

        if (isAlreadyEncrypted) {
          alreadyEncrypted++;
          console.log(`Company ${company.id} already encrypted, skipping...`);
          continue;
        }

        // Encrypt sensitive fields
        const encryptedData: any = {};

        if (company.company_name) {
          encryptedData.company_name = await encryption.encrypt(company.company_name);
        }
        if (company.sipi_number) {
          encryptedData.sipi_number = await encryption.encrypt(company.sipi_number);
        }
        if (company.address1) {
          encryptedData.address1 = await encryption.encrypt(company.address1);
        }
        if (company.address2) {
          encryptedData.address2 = await encryption.encrypt(company.address2);
        }
        if (company.city) {
          encryptedData.city = await encryption.encrypt(company.city);
        }
        if (company.postal_code) {
          encryptedData.postal_code = await encryption.encrypt(company.postal_code);
        }

        // Update the company
        const { error: updateError } = await supabase
          .from('companies')
          .update(encryptedData)
          .eq('id', company.id);

        if (updateError) {
          console.error(`Error updating company ${company.id}:`, updateError);
          errors++;
        } else {
          encrypted++;
          if (encrypted % 10 === 0) {
            console.log(`Progress: ${encrypted}/${allCompanies.length} companies encrypted`);
          }
        }
      } catch (error) {
        console.error(`Error processing company ${company.id}:`, error);
        errors++;
      }
    }

    const result = {
      success: true,
      total: allCompanies.length,
      encrypted,
      alreadyEncrypted,
      errors,
      message: `Encryption complete: ${encrypted} companies encrypted, ${alreadyEncrypted} already encrypted, ${errors} errors`
    };

    console.log('Encryption process completed:', result);

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in encrypt-existing-companies function:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return new Response(JSON.stringify({ 
      success: false,
      error: errorMessage 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
