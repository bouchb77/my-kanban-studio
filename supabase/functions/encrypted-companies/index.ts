import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Encryption/Decryption utilities using Web Crypto API
class CompanyEncryption {
  private key: CryptoKey | null = null;

  async init() {
    const keyString = Deno.env.get('ENCRYPTION_KEY');
    if (!keyString) {
      throw new Error('ENCRYPTION_KEY not found in environment variables');
    }

    // Convert the string key to a CryptoKey for AES-GCM
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

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      return new Response('Unauthorized', { 
        status: 401,
        headers: corsHeaders 
      });
    }

    const requestBody = await req.json();
    const { method, ...body } = requestBody;

    switch (method) {
      case 'SELECT':
        return await handleSelect(supabase);
      case 'SELECT_BY_ARTICLES':
        return await handleSelectByArticles(supabase, body);
      case 'SEARCH':
        return await handleSearch(supabase, body);
      case 'INSERT':
        return await handleInsert(supabase, body);
      case 'UPDATE':
        return await handleUpdate(supabase, body);
      case 'DELETE':
        return await handleDelete(supabase, body);
      case 'BULK_UPSERT':
        return await handleBulkUpsert(supabase, body);
      default:
        return new Response('Method not supported', { 
          status: 400,
          headers: corsHeaders 
        });
    }
  } catch (error) {
    console.error('Error in encrypted-companies function:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

async function decryptCompany(company: any) {
  return {
    ...company,
    company_name: await encryption.decrypt(company.company_name),
    sipi_number: await encryption.decrypt(company.sipi_number),
    address1: company.address1 ? await encryption.decrypt(company.address1) : company.address1,
    address2: company.address2 ? await encryption.decrypt(company.address2) : company.address2,
    city: company.city ? await encryption.decrypt(company.city) : company.city,
    postal_code: company.postal_code ? await encryption.decrypt(company.postal_code) : company.postal_code,
  };
}

async function encryptCompanyData(data: any) {
  return {
    ...data,
    company_name: await encryption.encrypt(data.company_name),
    sipi_number: await encryption.encrypt(data.sipi_number),
    address1: data.address1 ? await encryption.encrypt(data.address1) : data.address1,
    address2: data.address2 ? await encryption.encrypt(data.address2) : data.address2,
    city: data.city ? await encryption.encrypt(data.city) : data.city,
    postal_code: data.postal_code ? await encryption.encrypt(data.postal_code) : data.postal_code,
  };
}

async function handleSelect(supabase: any) {
  const { data, error } = await supabase
    .from('companies')
    .select('*')
    .order('company_name', { ascending: true });

  if (error) {
    throw new Error(`Database error: ${error.message}`);
  }

  const decryptedCompanies = await Promise.all(
    (data || []).map(async (company: any) => await decryptCompany(company))
  );

  return new Response(JSON.stringify({ data: decryptedCompanies, error: null }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

async function handleSelectByArticles(supabase: any, body: any) {
  const { article_codes, lis_only } = body;

  const { data, error } = await supabase.rpc('get_companies_by_articles', {
    article_codes,
    lis_only
  });

  if (error) {
    throw new Error(`Database error: ${error.message}`);
  }

  const decryptedCompanies = await Promise.all(
    (data || []).map(async (company: any) => await decryptCompany(company))
  );

  return new Response(JSON.stringify({ data: decryptedCompanies, error: null }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

async function handleSearch(supabase: any, body: any) {
  const { query, limit = 20 } = body;

  console.log('🔍 Searching companies with query:', query, 'limit:', limit);

  if (!query || query.length < 2) {
    return new Response(JSON.stringify({ data: [], error: null }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // Récupérer toutes les entreprises avec pagination
  // On récupère plus que nécessaire pour compenser le filtrage post-décryptage
  const batchSize = Math.min(5000, limit * 50);
  
  const { data, error } = await supabase
    .from('companies')
    .select('id, company_name, sipi_number')
    .order('company_name', { ascending: true })
    .limit(batchSize);

  if (error) {
    throw new Error(`Database error: ${error.message}`);
  }

  console.log(`📦 Retrieved ${data?.length || 0} companies from database`);

  // Déchiffrer les entreprises
  const decryptedCompanies = await Promise.all(
    (data || []).map(async (company: any) => ({
      id: company.id,
      company_name: await encryption.decrypt(company.company_name),
      sipi_number: await encryption.decrypt(company.sipi_number),
    }))
  );

  console.log(`🔓 Decrypted ${decryptedCompanies.length} companies`);

  // Filtrer les résultats
  const cleanQuery = query.toLowerCase().trim();
  const filteredCompanies = decryptedCompanies
    .filter((c: any) => {
      if (!c.sipi_number && !c.company_name) return false;
      const sipiMatch = c.sipi_number && c.sipi_number.toLowerCase().includes(cleanQuery);
      const nameMatch = c.company_name && c.company_name.toLowerCase().includes(cleanQuery);
      return sipiMatch || nameMatch;
    })
    .slice(0, limit);

  console.log(`✅ Found ${filteredCompanies.length} matching companies`);

  return new Response(JSON.stringify({ data: filteredCompanies, error: null }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

async function handleInsert(supabase: any, body: any) {
  const { companyData } = body;

  const encryptedCompany = await encryptCompanyData(companyData);

  const { data, error } = await supabase
    .from('companies')
    .insert([encryptedCompany])
    .select()
    .single();

  if (error) {
    throw new Error(`Database error: ${error.message}`);
  }

  const decryptedCompany = await decryptCompany(data);

  return new Response(JSON.stringify({ data: decryptedCompany, error: null }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

async function handleUpdate(supabase: any, body: any) {
  const { companyId, updates } = body;

  const encryptedUpdates = await encryptCompanyData(updates);

  const { data, error } = await supabase
    .from('companies')
    .update(encryptedUpdates)
    .eq('id', companyId)
    .select()
    .single();

  if (error) {
    throw new Error(`Database error: ${error.message}`);
  }

  const decryptedCompany = await decryptCompany(data);

  return new Response(JSON.stringify({ data: decryptedCompany, error: null }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

async function handleDelete(supabase: any, body: any) {
  const { companyId } = body;

  const { error } = await supabase
    .from('companies')
    .delete()
    .eq('id', companyId);

  if (error) {
    throw new Error(`Database error: ${error.message}`);
  }

  return new Response(JSON.stringify({ data: null, error: null }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

async function handleBulkUpsert(supabase: any, body: any) {
  const { companies } = body;

  const encryptedCompanies = await Promise.all(
    companies.map(async (company: any) => await encryptCompanyData(company))
  );

  const { error } = await supabase
    .from('companies')
    .upsert(encryptedCompanies, { onConflict: 'sipi_number' });

  if (error) {
    throw new Error(`Database error: ${error.message}`);
  }

  return new Response(JSON.stringify({ data: null, error: null }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
