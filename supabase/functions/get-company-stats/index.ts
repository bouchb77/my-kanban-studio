import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Classe de décryptage (identique à encrypted-companies)
class CompanyEncryption {
  private encryptionKey: CryptoKey | null = null;

  async init() {
    const keyString = Deno.env.get('ENCRYPTION_KEY');
    if (!keyString) {
      throw new Error('ENCRYPTION_KEY not found in environment');
    }

    const keyData = new Uint8Array(
      keyString.match(/.{1,2}/g)!.map(byte => parseInt(byte, 16))
    );

    this.encryptionKey = await crypto.subtle.importKey(
      'raw',
      keyData,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt', 'decrypt']
    );
  }

  async decrypt(encryptedData: string): Promise<string> {
    if (!this.encryptionKey) {
      throw new Error('Encryption key not initialized');
    }

    try {
      const parts = encryptedData.split(':');
      if (parts.length !== 2) {
        return encryptedData;
      }

      const iv = new Uint8Array(
        atob(parts[0]).split('').map(char => char.charCodeAt(0))
      );
      const data = new Uint8Array(
        atob(parts[1]).split('').map(char => char.charCodeAt(0))
      );

      const decryptedData = await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv },
        this.encryptionKey,
        data
      );

      return new TextDecoder().decode(decryptedData);
    } catch (error) {
      console.error('Decryption error:', error);
      return encryptedData;
    }
  }

  isEncrypted(data: string): boolean {
    if (!data) return false;
    return data.includes(':') && data.split(':').length === 2;
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
