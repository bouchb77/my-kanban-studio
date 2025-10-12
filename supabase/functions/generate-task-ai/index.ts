import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const geminiApiKey = Deno.env.get('GEMINI_API_KEY');

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

    if (!geminiApiKey) {
      throw new Error('Gemini API key not configured');
    }

    const categoryList = userCategories.length > 0 
      ? userCategories.map((cat: any) => cat.name).join(', ')
      : 'general';

    const systemPrompt = `Tu es un assistant IA spécialisé dans la création de tâches de travail. 
    Ton rôle est d'analyser une description en français et de générer une tâche structurée.

    Catégories disponibles: ${categoryList}

    Tu dois répondre UNIQUEMENT avec un objet JSON valide contenant:
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
    - Choisis la catégorie la plus appropriée parmi celles disponibles`;

    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${geminiApiKey}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [{
          parts: [{
            text: `${systemPrompt}\n\nUtilisateur: ${prompt}`
          }]
        }],
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 1000,
        }
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error('Gemini API error:', errorData);
      throw new Error(`Gemini API error: ${errorData.error?.message || 'Unknown error'}`);
    }

    const data = await response.json();
    const generatedContent = data.candidates[0].content.parts[0].text;

    console.log('Generated content:', generatedContent);

    // Parse the JSON response
    let taskData;
    try {
      taskData = JSON.parse(generatedContent);
    } catch (parseError) {
      console.error('Failed to parse AI response:', generatedContent);
      throw new Error('Invalid response format from AI');
    }

    // Validate required fields
    if (!taskData.title || !taskData.description) {
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