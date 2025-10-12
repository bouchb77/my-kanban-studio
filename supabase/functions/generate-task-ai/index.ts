import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const lovableApiKey = Deno.env.get('LOVABLE_API_KEY');

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { prompt, userCategories = [] } = await req.json();

    if (!prompt) {
      throw new Error('Prompt is required');
    }

    if (!lovableApiKey) {
      throw new Error('Lovable API key not configured');
    }

    const categoryList = userCategories.length > 0 
      ? userCategories.map((cat: any) => cat.name).join(', ')
      : 'general';

    const systemPrompt = `Tu es un assistant IA spécialisé dans la création de tâches de travail. 
    Ton rôle est d'analyser une description en français et de générer une tâche structurée.

    Catégories disponibles: ${categoryList}

    Tu dois répondre UNIQUEMENT avec un objet JSON valide (sans bloc markdown) contenant:
    {
      "title": "Titre concis et clair de la tâche (max 60 caractères)",
      "description": "Description détaillée expliquant les étapes et objectifs",
      "priority": "low|medium|high|urgent",
      "category": "une des catégories disponibles ou 'general'",
      "estimatedDuration": "estimation en heures ou jours",
      "tags": ["tag1", "tag2", "tag3"]
    }

    Règles:
    - Le titre doit être actionnable et précis
    - La description doit être détaillée et utile
    - La priorité doit être basée sur l'urgence et l'importance
    - Les tags doivent être pertinents et en français
    - Choisis la catégorie la plus appropriée parmi celles disponibles
    - Réponds UNIQUEMENT avec le JSON, sans texte avant ou après`;

    console.log('Calling Lovable AI Gateway with prompt:', prompt);

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${lovableApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: prompt }
        ],
        temperature: 0.7,
        max_tokens: 1000,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Lovable AI Gateway error:', response.status, errorText);
      
      if (response.status === 429) {
        throw new Error('Limite de requêtes atteinte. Veuillez réessayer dans quelques instants.');
      }
      if (response.status === 402) {
        throw new Error('Crédits épuisés. Veuillez ajouter des crédits à votre workspace Lovable.');
      }
      
      throw new Error(`Lovable AI Gateway error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    const generatedContent = data.choices?.[0]?.message?.content;

    if (!generatedContent) {
      console.error('No content in response:', JSON.stringify(data));
      throw new Error('No content generated from AI');
    }

    console.log('Generated content:', generatedContent);

    // Parse the JSON response (remove markdown code blocks if present)
    let taskData;
    try {
      const cleanedContent = generatedContent
        .replace(/```json\n?/g, '')
        .replace(/```\n?/g, '')
        .trim();
      
      taskData = JSON.parse(cleanedContent);
    } catch (parseError) {
      console.error('Failed to parse AI response:', generatedContent);
      console.error('Parse error:', parseError);
      throw new Error('Invalid response format from AI');
    }

    // Validate required fields
    if (!taskData.title || !taskData.description) {
      console.error('Missing required fields in task data:', taskData);
      throw new Error('AI response missing required fields');
    }

    return new Response(JSON.stringify({
      success: true,
      task: taskData
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in generate-task-ai function:', error);
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
