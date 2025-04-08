
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
const supabase = createClient(supabaseUrl, supabaseServiceKey);

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { prompt, policyContent, conversationId } = await req.json();
    
    if (!prompt) {
      throw new Error('Missing required field: prompt');
    }

    // First, store the user message in the database if a conversationId is provided
    if (conversationId) {
      const { error: messageError } = await supabase
        .from('messages')
        .insert({
          conversation_id: conversationId,
          content: prompt,
          sender: 'user'
        });

      if (messageError) {
        throw messageError;
      }
    }

    // Get policy content from database if not provided directly
    let context = policyContent;
    if (!context && conversationId) {
      const { data: conversation, error: conversationError } = await supabase
        .from('conversations')
        .select('policy_document_id')
        .eq('id', conversationId)
        .single();

      if (conversationError) {
        throw conversationError;
      }

      const { data: document, error: documentError } = await supabase
        .from('policy_documents')
        .select('content')
        .eq('id', conversation.policy_document_id)
        .single();

      if (documentError) {
        throw documentError;
      }

      context = document.content;
    }

    // Generate AI response
    const openAIResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${Deno.env.get('OPENAI_API_KEY')}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { 
            role: 'system', 
            content: `You are an AI assistant specializing in policy analysis. 
                      Use the following policy content as context for your responses: 
                      ${context || 'No specific policy content provided.'}` 
          },
          { role: 'user', content: prompt }
        ],
        max_tokens: 500
      }),
    });

    const data = await openAIResponse.json();
    
    if (!data.choices || !data.choices[0]) {
      throw new Error('Invalid response from OpenAI API');
    }
    
    const generatedText = data.choices[0].message.content;

    // Store the AI response in the database if a conversationId is provided
    if (conversationId) {
      const { error: messageError } = await supabase
        .from('messages')
        .insert({
          conversation_id: conversationId,
          content: generatedText,
          sender: 'ai'
        });

      if (messageError) {
        throw messageError;
      }
    }

    return new Response(JSON.stringify({ response: generatedText, conversationId }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error in AI response generation:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
