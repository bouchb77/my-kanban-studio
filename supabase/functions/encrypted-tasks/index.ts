import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Encryption/Decryption utilities using Web Crypto API
class TaskEncryption {
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
    if (!this.key) await this.init();
    
    const iv = crypto.getRandomValues(new Uint8Array(12)); // 96-bit IV for AES-GCM
    const encoder = new TextEncoder();
    const data = encoder.encode(text);

    const encrypted = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      this.key!,
      data
    );

    // Combine IV and encrypted data, then base64 encode
    const combined = new Uint8Array(iv.length + encrypted.byteLength);
    combined.set(iv);
    combined.set(new Uint8Array(encrypted), iv.length);

    return btoa(String.fromCharCode(...combined));
  }

  async decrypt(encryptedData: string): Promise<string> {
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
      console.error('Decryption error:', error);
      // Return the original data if decryption fails (backward compatibility)
      return encryptedData;
    }
  }
}

const encryption = new TaskEncryption();

serve(async (req) => {
  // Handle CORS preflight requests
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

    // Verify the user's JWT token
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
        return await handleSelect(supabase, user.id, body);
      case 'INSERT':
        return await handleInsert(supabase, user.id, body);
      case 'UPDATE':
        return await handleUpdate(supabase, user.id, body);
      case 'DELETE':
        return await handleDelete(supabase, user.id, body);
      default:
        return new Response('Method not supported', { 
          status: 400,
          headers: corsHeaders 
        });
    }
  } catch (error) {
    console.error('Error in encrypted-tasks function:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

async function handleSelect(supabase: any, userId: string, body: any) {
  const { data, error } = await supabase
    .from('tasks')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error(`Database error: ${error.message}`);
  }

  // Decrypt sensitive fields
  const decryptedTasks = await Promise.all(
    (data || []).map(async (task: any) => ({
      ...task,
      title: await encryption.decrypt(task.title),
      description: task.description ? await encryption.decrypt(task.description) : task.description,
      company_name: task.company_name ? await encryption.decrypt(task.company_name) : task.company_name,
    }))
  );

  return new Response(JSON.stringify({ data: decryptedTasks, error: null }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

async function handleInsert(supabase: any, userId: string, body: any) {
  const { taskData } = body;

  // Encrypt sensitive fields
  const encryptedTask = {
    ...taskData,
    user_id: userId,
    title: await encryption.encrypt(taskData.title),
    description: taskData.description ? await encryption.encrypt(taskData.description) : taskData.description,
    company_name: taskData.company_name ? await encryption.encrypt(taskData.company_name) : taskData.company_name,
  };

  const { data, error } = await supabase
    .from('tasks')
    .insert([encryptedTask])
    .select()
    .single();

  if (error) {
    throw new Error(`Database error: ${error.message}`);
  }

  // Decrypt the returned data
  const decryptedTask = {
    ...data,
    title: await encryption.decrypt(data.title),
    description: data.description ? await encryption.decrypt(data.description) : data.description,
    company_name: data.company_name ? await encryption.decrypt(data.company_name) : data.company_name,
  };

  return new Response(JSON.stringify({ data: decryptedTask, error: null }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

async function handleUpdate(supabase: any, userId: string, body: any) {
  const { taskId, updates } = body;

  // Encrypt sensitive fields in updates
  const encryptedUpdates: any = { ...updates };
  
  if (updates.title) {
    encryptedUpdates.title = await encryption.encrypt(updates.title);
  }
  
  if (updates.description !== undefined) {
    encryptedUpdates.description = updates.description ? await encryption.encrypt(updates.description) : updates.description;
  }
  
  if (updates.company_name !== undefined) {
    encryptedUpdates.company_name = updates.company_name ? await encryption.encrypt(updates.company_name) : updates.company_name;
  }

  const { data, error } = await supabase
    .from('tasks')
    .update(encryptedUpdates)
    .eq('id', taskId)
    .eq('user_id', userId)
    .select()
    .single();

  if (error) {
    throw new Error(`Database error: ${error.message}`);
  }

  // Decrypt the returned data
  const decryptedTask = {
    ...data,
    title: await encryption.decrypt(data.title),
    description: data.description ? await encryption.decrypt(data.description) : data.description,
    company_name: data.company_name ? await encryption.decrypt(data.company_name) : data.company_name,
  };

  return new Response(JSON.stringify({ data: decryptedTask, error: null }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

async function handleDelete(supabase: any, userId: string, body: any) {
  const { taskId } = body;

  const { error } = await supabase
    .from('tasks')
    .delete()
    .eq('id', taskId)
    .eq('user_id', userId);

  if (error) {
    throw new Error(`Database error: ${error.message}`);
  }

  return new Response(JSON.stringify({ data: null, error: null }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}