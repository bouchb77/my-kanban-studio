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

    const { method, body } = await req.json();

    switch (method) {
      case 'SELECT':
        return await handleSelect(supabase);
      case 'SELECT_BY_ARTICLES':
        return await handleSelectByArticles(supabase, body);
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
    company_name: company.company_name ? await encryption.decrypt(company.company_name) : company.company_name,
    sipi_number: company.sipi_number ? await encryption.decrypt(company.sipi_number) : company.sipi_number,
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
    address1: data.address1 ? await encryption.encrypt(data.address1) : data.address1,
    address2: data.address2 ? await encryption.encrypt(data.address2) : data.address2,
    city: data.city ? await encryption.encrypt(data.city) : data.city,
    postal_code: data.postal_code ? await encryption.encrypt(data.postal_code) : data.postal_code,
  };
}

async function handleSelect(supabase: any) {
  // Charger toutes les entreprises avec pagination (limite Supabase = 1000 par requête)
  let allCompanies: any[] = [];
  let from = 0;
  const batchSize = 1000;
  let hasMore = true;

  console.log('Début du chargement paginé des entreprises...');

  while (hasMore) {
    const { data, error } = await supabase
      .from('companies')
      .select('*')
      .order('company_name', { ascending: true })
      .range(from, from + batchSize - 1);

    if (error) {
      throw new Error(`Database error: ${error.message}`);
    }

    if (data && data.length > 0) {
      allCompanies = [...allCompanies, ...data];
      from += batchSize;
      hasMore = data.length === batchSize;
      console.log(`Lot chargé: ${data.length} entreprises (total: ${allCompanies.length})`);
    } else {
      hasMore = false;
    }
  }

  console.log(`Total entreprises chargées depuis la DB: ${allCompanies.length}`);
  
  // Log sample avant décryptage
  if (allCompanies.length > 0) {
    console.log('📋 Sample company from DB:', {
      id: allCompanies[0].id,
      company_name: allCompanies[0].company_name?.substring(0, 30),
      sipi_number: allCompanies[0].sipi_number?.substring(0, 30),
    });
  }

  const decryptedCompanies = await Promise.all(
    allCompanies.map(async (company: any) => await decryptCompany(company))
  );

  console.log(`Entreprises décryptées: ${decryptedCompanies.length}`);
  
  // Log sample après décryptage
  if (decryptedCompanies.length > 0) {
    console.log('✅ Sample decrypted company:', {
      id: decryptedCompanies[0].id,
      company_name: decryptedCompanies[0].company_name,
      sipi_number: decryptedCompanies[0].sipi_number,
    });
  }

  return new Response(JSON.stringify({ data: decryptedCompanies, error: null }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

async function handleSelectByArticles(supabase: any, body: any) {
  const { article_codes, lis_only } = body;

  console.log(`Paramètres reçus - article_codes: ${article_codes}, lis_only: ${lis_only}`);

  // Charger les SIPI à filtrer UNE SEULE FOIS avant la boucle
  let allowedSipiNumbers: string[] | null = null;

  if (article_codes && article_codes.length > 0) {
    const { data: orderDetails, error: odError } = await supabase
      .from('order_details')
      .select('order_number')
      .in('article_code', article_codes);
    
    if (odError) {
      throw new Error(`Error fetching order details: ${odError.message}`);
    }

    const orderNumbers = [...new Set(orderDetails?.map((od: any) => od.order_number) || [])];
    
    const { data: orders, error: ordersError } = await supabase
      .from('orders')
      .select('sipi_number')
      .in('order_number', orderNumbers);
    
    if (ordersError) {
      throw new Error(`Error fetching orders: ${ordersError.message}`);
    }

    allowedSipiNumbers = [...new Set(orders?.map((o: any) => o.sipi_number) || [])];
    console.log(`SIPI numbers trouvés pour les articles: ${allowedSipiNumbers.length}`);
  }

  if (lis_only === true) {
    const { data: allOrderDetails, error: aodError } = await supabase
      .from('order_details')
      .select('order_number, article_code');
    
    if (aodError) {
      throw new Error(`Error fetching all order details: ${aodError.message}`);
    }

    const orderNumbersLisOnly = new Set<string>();
    const orderArticles = new Map<string, Set<string>>();
    
    allOrderDetails?.forEach((od: any) => {
      if (!orderArticles.has(od.order_number)) {
        orderArticles.set(od.order_number, new Set());
      }
      orderArticles.get(od.order_number)!.add(od.article_code);
    });

    orderArticles.forEach((articles, orderNumber) => {
      if (articles.size === 1 && articles.has('LIS')) {
        orderNumbersLisOnly.add(orderNumber);
      }
    });

    const { data: lisOrders, error: lisError } = await supabase
      .from('orders')
      .select('sipi_number')
      .in('order_number', Array.from(orderNumbersLisOnly));
    
    if (lisError) {
      throw new Error(`Error fetching LIS orders: ${lisError.message}`);
    }

    const lisSipiNumbers = [...new Set(lisOrders?.map((o: any) => o.sipi_number) || [])];
    console.log(`SIPI numbers LIS only: ${lisSipiNumbers.length}`);
    
    // Intersect with previous filter if any
    if (allowedSipiNumbers !== null) {
      const lisSet = new Set(lisSipiNumbers);
      allowedSipiNumbers = allowedSipiNumbers.filter(sipi => lisSet.has(sipi));
    } else {
      allowedSipiNumbers = lisSipiNumbers;
    }
  }

  // Maintenant charger les entreprises avec pagination
  let allFilteredCompanies: any[] = [];
  let from = 0;
  const batchSize = 1000;
  let hasMore = true;

  console.log('Début du chargement paginé des entreprises filtrées...');

  while (hasMore) {
    let batchQuery = supabase
      .from('companies')
      .select('*')
      .order('company_name', { ascending: true })
      .range(from, from + batchSize - 1);

    // Appliquer le filtre SIPI si nécessaire
    if (allowedSipiNumbers !== null && allowedSipiNumbers.length > 0) {
      batchQuery = batchQuery.in('sipi_number', allowedSipiNumbers);
    }

    const { data, error } = await batchQuery;

    if (error) {
      throw new Error(`Database error: ${error.message}`);
    }

    if (data && data.length > 0) {
      allFilteredCompanies = [...allFilteredCompanies, ...data];
      from += batchSize;
      hasMore = data.length === batchSize;
      console.log(`Lot filtré chargé: ${data.length} entreprises (total: ${allFilteredCompanies.length})`);
    } else {
      hasMore = false;
    }
  }

  console.log(`Total entreprises filtrées chargées: ${allFilteredCompanies.length}`);

  const decryptedCompanies = await Promise.all(
    allFilteredCompanies.map(async (company: any) => await decryptCompany(company))
  );

  console.log(`Entreprises décryptées: ${decryptedCompanies.length}`);

  return new Response(JSON.stringify({ data: decryptedCompanies, error: null }), {
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
