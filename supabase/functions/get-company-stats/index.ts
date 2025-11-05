import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Classe de décryptage (compatible avec encrypted-companies)
class CompanyEncryption {
  private key: CryptoKey | null = null;

  async init() {
    const keyString = Deno.env.get('ENCRYPTION_KEY');
    if (!keyString) {
      throw new Error('ENCRYPTION_KEY not found in environment variables');
    }

    // Convert the string key to a CryptoKey for AES-GCM (identique à encrypted-companies)
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
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Initialiser le décryptage
    await encryption.init();

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

    console.log('Company stats calculated (encrypted):', companyStats?.length || 0);

    // Décrypter les données des entreprises
    const decryptedStats = await Promise.all(
      (companyStats || []).map(async (company: any) => {
        const decrypted: any = { ...company };
        
        if (encryption.isEncrypted(company.company_name)) {
          decrypted.company_name = await encryption.decrypt(company.company_name);
        }
        if (company.address1 && encryption.isEncrypted(company.address1)) {
          decrypted.address1 = await encryption.decrypt(company.address1);
        }
        if (company.address2 && encryption.isEncrypted(company.address2)) {
          decrypted.address2 = await encryption.decrypt(company.address2);
        }
        if (company.city && encryption.isEncrypted(company.city)) {
          decrypted.city = await encryption.decrypt(company.city);
        }
        if (company.postal_code && encryption.isEncrypted(company.postal_code)) {
          decrypted.postal_code = await encryption.decrypt(company.postal_code);
        }
        
        return decrypted;
      })
    );

    console.log('Company stats decrypted:', decryptedStats.length);

    return new Response(
      JSON.stringify(decryptedStats),
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
