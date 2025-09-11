import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface IcsEvent {
  id: string;
  subject: string;
  start: {
    dateTime: string;
    timeZone: string;
  };
  end: {
    dateTime: string;
    timeZone: string;
  };
  location?: {
    displayName: string;
  };
  bodyPreview?: string;
  categories?: string[];
}

function parseIcsDate(dateStr: string): string {
  // Parse YYYYMMDDTHHMMSS or YYYYMMDDTHHMMSSZ format
  const cleanDate = dateStr.replace(/[TZ]/g, '');
  const year = cleanDate.substring(0, 4);
  const month = cleanDate.substring(4, 6);
  const day = cleanDate.substring(6, 8);
  const hour = cleanDate.substring(8, 10) || '00';
  const minute = cleanDate.substring(10, 12) || '00';
  const second = cleanDate.substring(12, 14) || '00';
  
  return `${year}-${month}-${day}T${hour}:${minute}:${second}`;
}

function parseIcsContent(icsContent: string): IcsEvent[] {
  const events: IcsEvent[] = [];
  const lines = icsContent.split(/\r?\n/);
  
  let currentEvent: Partial<IcsEvent> = {};
  let inEvent = false;
  
  for (let i = 0; i < lines.length; i++) {
    let line = lines[i].trim();
    
    // Handle line continuations (lines starting with space or tab)
    while (i + 1 < lines.length && /^[\s\t]/.test(lines[i + 1])) {
      i++;
      line += lines[i].trim();
    }
    
    if (line === 'BEGIN:VEVENT') {
      inEvent = true;
      currentEvent = {};
    } else if (line === 'END:VEVENT' && inEvent) {
      if (currentEvent.subject && currentEvent.start && currentEvent.end) {
        events.push(currentEvent as IcsEvent);
      }
      currentEvent = {};
      inEvent = false;
    } else if (inEvent) {
      const colonIndex = line.indexOf(':');
      if (colonIndex > 0) {
        const property = line.substring(0, colonIndex);
        const value = line.substring(colonIndex + 1);
        
        if (property === 'UID') {
          currentEvent.id = value;
        } else if (property === 'SUMMARY') {
          currentEvent.subject = value.replace(/\\n/g, ' ').replace(/\\,/g, ',');
        } else if (property.startsWith('DTSTART')) {
          const dateTime = parseIcsDate(value);
          currentEvent.start = {
            dateTime: dateTime,
            timeZone: 'UTC'
          };
        } else if (property.startsWith('DTEND')) {
          const dateTime = parseIcsDate(value);
          currentEvent.end = {
            dateTime: dateTime,
            timeZone: 'UTC'
          };
        } else if (property === 'LOCATION') {
          currentEvent.location = {
            displayName: value.replace(/\\n/g, ' ').replace(/\\,/g, ',')
          };
        } else if (property === 'DESCRIPTION') {
          currentEvent.bodyPreview = value.replace(/\\n/g, ' ').replace(/\\,/g, ',').substring(0, 200);
        } else if (property === 'CATEGORIES' || property === 'X-MICROSOFT-CDO-CATEGORIES' || property === 'X-OUTLOOK-CATEGORY') {
          // Handle different Outlook category formats
          const categories = value.split(',').map(cat => cat.trim()).filter(cat => cat.length > 0);
          if (!currentEvent.categories) {
            currentEvent.categories = [];
          }
          // Merge categories from different properties, avoiding duplicates
          categories.forEach(cat => {
            if (!currentEvent.categories!.includes(cat)) {
              currentEvent.categories!.push(cat);
            }
          });
        }
      }
    }
  }
  
  // Sort events by start date
  return events.sort((a, b) => new Date(a.start.dateTime).getTime() - new Date(b.start.dateTime).getTime());
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { icsUrl } = await req.json();
    
    if (!icsUrl) {
      return new Response(
        JSON.stringify({ error: 'URL ICS requis' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    console.log('Récupération du flux ICS:', icsUrl);

    // Convert webcal:// to https://
    const httpsUrl = icsUrl.replace(/^webcal:\/\//, 'https://');
    
    // Fetch ICS content
    const response = await fetch(httpsUrl);
    
    if (!response.ok) {
      throw new Error(`Erreur HTTP: ${response.status}`);
    }
    
    const icsContent = await response.text();
    console.log('Contenu ICS récupéré, taille:', icsContent.length);
    
    // Parse ICS content
    const events = parseIcsContent(icsContent);
    console.log('Événements parsés:', events.length);
    
    // Filter events for today and future (next 30 days)
    const now = new Date();
    const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    
    const filteredEvents = events.filter(event => {
      const eventDate = new Date(event.start.dateTime);
      return eventDate >= now && eventDate <= thirtyDaysFromNow;
    });

    return new Response(
      JSON.stringify({ events: filteredEvents }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('Erreur lors de la synchronisation ICS:', error);
    
    return new Response(
      JSON.stringify({ 
        error: 'Erreur lors de la récupération du calendrier',
        details: error.message 
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
})