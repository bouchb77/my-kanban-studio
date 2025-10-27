import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Encryption/Decryption utilities using Web Crypto API
class ContactEncryption {
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
    // Empty or null strings are not encrypted
    if (!data || data.trim() === '') return false;
    
    // Check if it looks like base64 (encrypted data)
    const base64Regex = /^[A-Za-z0-9+/]*={0,2}$/;
    if (!base64Regex.test(data)) {
      // Not base64, so it's plain text (not encrypted)
      return false;
    }
    
    // AES-GCM encrypted data with 12-byte IV is at least 28 bytes (IV + data + tag)
    // In base64, that's at least ~37 characters
    return data.length >= 37;
  }

  async decrypt(encryptedData: string): Promise<string> {
    // Return empty strings as-is
    if (!encryptedData || encryptedData.trim() === '') return encryptedData;
    
    // If it doesn't look encrypted, return as-is
    if (!this.isEncrypted(encryptedData)) {
      console.log('🔓 Données non cryptées (length: ' + encryptedData.length + '), retour direct:', encryptedData.substring(0, 30));
      return encryptedData;
    }

    console.log('🔐 Tentative de décryptage (length: ' + encryptedData.length + ')...');

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

      const result = new TextDecoder().decode(decrypted);
      console.log('✅ Décryptage réussi:', result.substring(0, 30));
      return result;
    } catch (error) {
      console.error('❌ Erreur décryptage:', error);
      return encryptedData;
    }
  }
}

const encryption = new ContactEncryption();

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
        return await handleSelect(supabase, body);
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
    console.error('Error in encrypted-contacts function:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

async function decryptContact(contact: any) {
  console.log('🔍 Décryptage contact SIPI:', contact.sipi_number);
  
  const decryptedName = contact.contact_name ? await encryption.decrypt(contact.contact_name) : contact.contact_name;
  const decryptedEmail = contact.email ? await encryption.decrypt(contact.email) : contact.email;
  const decryptedPhone = contact.phone ? await encryption.decrypt(contact.phone) : contact.phone;
  
  console.log('  ✓ Nom:', contact.contact_name?.substring(0, 20), '=>', decryptedName?.substring(0, 20));
  console.log('  ✓ Email:', contact.email?.substring(0, 20), '=>', decryptedEmail?.substring(0, 20));
  console.log('  ✓ Tél:', contact.phone?.substring(0, 20), '=>', decryptedPhone?.substring(0, 20));
  
  return {
    ...contact,
    contact_name: decryptedName,
    email: decryptedEmail,
    phone: decryptedPhone,
  };
}

async function encryptContactData(data: any) {
  return {
    ...data,
    contact_name: data.contact_name ? await encryption.encrypt(data.contact_name) : data.contact_name,
    email: data.email ? await encryption.encrypt(data.email) : data.email,
    phone: data.phone ? await encryption.encrypt(data.phone) : data.phone,
  };
}

async function handleSelect(supabase: any, body: any) {
  const { sipi_numbers } = body;

  let allContacts: any[] = [];
  let from = 0;
  const batchSize = 1000;
  let hasMore = true;

  console.log('Début du chargement des contacts...');

  while (hasMore) {
    let query = supabase
      .from('contacts')
      .select('*')
      .order('sipi_number', { ascending: true })
      .range(from, from + batchSize - 1);

    // Si des SIPI spécifiques sont demandés
    if (sipi_numbers && sipi_numbers.length > 0) {
      query = query.in('sipi_number', sipi_numbers);
    }

    const { data, error } = await query;

    if (error) {
      throw new Error(`Database error: ${error.message}`);
    }

    if (data && data.length > 0) {
      allContacts = [...allContacts, ...data];
      from += batchSize;
      hasMore = data.length === batchSize;
      console.log(`Lot chargé: ${data.length} contacts (total: ${allContacts.length})`);
    } else {
      hasMore = false;
    }
  }

  console.log(`Total contacts chargés: ${allContacts.length}`);

  const decryptedContacts = await Promise.all(
    allContacts.map(async (contact: any) => await decryptContact(contact))
  );

  console.log(`Contacts décryptés: ${decryptedContacts.length}`);

  return new Response(JSON.stringify({ data: decryptedContacts, error: null }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

async function handleInsert(supabase: any, body: any) {
  const { contactData } = body;

  const encryptedContact = await encryptContactData(contactData);

  const { data, error } = await supabase
    .from('contacts')
    .insert([encryptedContact])
    .select()
    .single();

  if (error) {
    throw new Error(`Database error: ${error.message}`);
  }

  const decryptedContact = await decryptContact(data);

  return new Response(JSON.stringify({ data: decryptedContact, error: null }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

async function handleUpdate(supabase: any, body: any) {
  const { contactId, updates } = body;

  const encryptedUpdates = await encryptContactData(updates);

  const { data, error } = await supabase
    .from('contacts')
    .update(encryptedUpdates)
    .eq('id', contactId)
    .select()
    .single();

  if (error) {
    throw new Error(`Database error: ${error.message}`);
  }

  const decryptedContact = await decryptContact(data);

  return new Response(JSON.stringify({ data: decryptedContact, error: null }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

async function handleDelete(supabase: any, body: any) {
  const { contactId } = body;

  const { error } = await supabase
    .from('contacts')
    .delete()
    .eq('id', contactId);

  if (error) {
    throw new Error(`Database error: ${error.message}`);
  }

  return new Response(JSON.stringify({ data: null, error: null }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

async function handleBulkUpsert(supabase: any, body: any) {
  const { contacts } = body;

  console.log(`Début de l'upsert de ${contacts.length} contacts...`);

  // Traiter les contacts par lots de 50 pour éviter le dépassement CPU
  const batchSize = 50;
  let processedCount = 0;

  for (let i = 0; i < contacts.length; i += batchSize) {
    const batch = contacts.slice(i, i + batchSize);
    
    console.log(`Traitement du lot ${Math.floor(i / batchSize) + 1}/${Math.ceil(contacts.length / batchSize)} (${batch.length} contacts)...`);
    
    // Crypter le lot
    const encryptedBatch = await Promise.all(
      batch.map(async (contact: any) => await encryptContactData(contact))
    );

    // Insérer le lot
    const { error } = await supabase
      .from('contacts')
      .upsert(encryptedBatch, { onConflict: 'sipi_number' });

    if (error) {
      throw new Error(`Database error on batch ${Math.floor(i / batchSize) + 1}: ${error.message}`);
    }

    processedCount += batch.length;
    console.log(`✅ ${processedCount}/${contacts.length} contacts traités`);
  }

  console.log(`✅ Upsert terminé: ${processedCount} contacts`);

  return new Response(JSON.stringify({ data: null, error: null }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
