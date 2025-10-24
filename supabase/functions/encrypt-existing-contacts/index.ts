import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Encryption utility using Web Crypto API
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
    if (!text || text.trim() === '') return text;
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
    if (!data || data.trim() === '' || data.length < 20) return true; // Consider empty/null as already "encrypted"
    
    const base64Regex = /^[A-Za-z0-9+/]*={0,2}$/;
    if (!base64Regex.test(data)) return false;
    
    return data.length >= 32;
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { 
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    
    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Missing Supabase environment variables');
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { 
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Check if user is admin using a user-context client
    const userSupabase = createClient(
      supabaseUrl,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    );
    
    const { data: isAdmin, error: adminCheckError } = await userSupabase
      .rpc('is_current_user_admin');

    if (adminCheckError || !isAdmin) {
      console.error('Admin check failed:', adminCheckError);
      return new Response(JSON.stringify({ error: 'Forbidden: Admin access required' }), { 
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Parse request body for batch parameters
    const body = await req.json().catch(() => ({}));
    const batchSize = body.batchSize || 500; // Traiter 500 contacts par appel
    const offset = body.offset || 0;

    const encryption = new ContactEncryption();
    await encryption.init();

    console.log(`Starting contact encryption batch (offset: ${offset}, size: ${batchSize})...`);

    // Count total contacts needing processing
    const { count: totalCount } = await supabase
      .from('contacts')
      .select('*', { count: 'exact', head: true });

    console.log(`Total contacts in database: ${totalCount}`);

    // Fetch batch of contacts
    const { data: contacts, error: fetchError } = await supabase
      .from('contacts')
      .select('*')
      .range(offset, offset + batchSize - 1);

    if (fetchError) {
      throw new Error(`Error fetching contacts: ${fetchError.message}`);
    }

    if (!contacts || contacts.length === 0) {
      return new Response(JSON.stringify({
        total: totalCount || 0,
        processed: 0,
        encrypted: 0,
        alreadyEncrypted: 0,
        errors: 0,
        hasMore: false,
        nextOffset: offset
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`Processing ${contacts.length} contacts from offset ${offset}`);

    let processedCount = 0;
    let encryptedCount = 0;
    let alreadyEncryptedCount = 0;
    let errorCount = 0;

    for (const contact of contacts) {
      try {
        let needsUpdate = false;
        const updates: any = {};

        // Check and encrypt contact_name (only if not null/empty and not already encrypted)
        if (contact.contact_name && contact.contact_name.trim() !== '' && !encryption.isEncrypted(contact.contact_name)) {
          updates.contact_name = await encryption.encrypt(contact.contact_name);
          needsUpdate = true;
        }

        // Check and encrypt email (only if not null/empty and not already encrypted)
        if (contact.email && contact.email.trim() !== '' && !encryption.isEncrypted(contact.email)) {
          updates.email = await encryption.encrypt(contact.email);
          needsUpdate = true;
        }

        // Check and encrypt phone (only if not null/empty and not already encrypted)
        if (contact.phone && contact.phone.trim() !== '' && !encryption.isEncrypted(contact.phone)) {
          updates.phone = await encryption.encrypt(contact.phone);
          needsUpdate = true;
        }

        if (needsUpdate) {
          const { error: updateError } = await supabase
            .from('contacts')
            .update(updates)
            .eq('id', contact.id);

          if (updateError) {
            console.error(`Error updating contact ${contact.id}:`, updateError);
            errorCount++;
          } else {
            encryptedCount++;
            if (encryptedCount % 50 === 0) {
              console.log(`Encrypted ${encryptedCount} contacts so far...`);
            }
          }
        } else {
          alreadyEncryptedCount++;
        }

        processedCount++;
      } catch (error) {
        console.error(`Error processing contact ${contact.id}:`, error);
        errorCount++;
      }
    }

    const nextOffset = offset + batchSize;
    const hasMore = nextOffset < (totalCount || 0);

    const summary = {
      total: totalCount || 0,
      processed: processedCount,
      encrypted: encryptedCount,
      alreadyEncrypted: alreadyEncryptedCount,
      errors: errorCount,
      hasMore,
      nextOffset,
      currentBatch: {
        start: offset,
        end: offset + contacts.length - 1,
        size: contacts.length
      }
    };

    console.log('Batch encryption completed:', summary);

    return new Response(JSON.stringify(summary), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in encrypt-existing-contacts function:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
