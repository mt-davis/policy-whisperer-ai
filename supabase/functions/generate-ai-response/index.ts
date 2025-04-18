
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
const openAIApiKey = Deno.env.get('OPENAI_API_KEY') || '';
const supabase = createClient(supabaseUrl, supabaseServiceKey);

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { prompt, policyContent, conversationId, formatAsHtml = true } = await req.json();
    
    if (!prompt) {
      throw new Error('Missing required field: prompt');
    }

    console.log('Processing AI response for prompt:', prompt.substring(0, 50) + '...');

    // Get conversation history if conversationId is provided
    let conversationHistory = [];
    let context = policyContent;
    let documentId = null;

    if (conversationId) {
      // First, store the user message in the database
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

      // Get the conversation history
      const { data: messagesData, error: messagesError } = await supabase
        .from('messages')
        .select('*')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true })
        .limit(10); // Limit to last 10 messages to stay within token limits

      if (messagesError) {
        throw messagesError;
      }

      if (messagesData && messagesData.length > 0) {
        conversationHistory = messagesData.map(msg => ({
          role: msg.sender === 'user' ? 'user' : 'assistant',
          content: msg.content
        }));
      }

      // Get policy content from database if not provided directly
      if (!context) {
        const { data: conversation, error: conversationError } = await supabase
          .from('conversations')
          .select('policy_document_id')
          .eq('id', conversationId)
          .single();

        if (conversationError) {
          throw conversationError;
        }

        documentId = conversation.policy_document_id;

        const { data: document, error: documentError } = await supabase
          .from('policy_documents')
          .select('content')
          .eq('id', documentId)
          .single();

        if (documentError) {
          throw documentError;
        }

        context = document.content;
      }
    }

    // Prepare messages for OpenAI API
    const messages = [];
    
    // Add system message with context and formatting instructions
    const systemMessage = `You are an AI assistant specializing in policy analysis. 
                Use the following policy content as context for your responses: 
                ${context ? context.substring(0, 10000) : 'No specific policy content provided.'}`;
    
    const formattingInstructions = formatAsHtml ? 
      `Format your responses using proper HTML tags for better readability:
       - Use <p> tags for paragraphs
       - Use <ul> and <li> tags for unordered lists
       - Use <ol> and <li> tags for ordered lists
       - Use <h3> tags for subheadings
       - Use <b> or <strong> tags for emphasis
       - When presenting steps or a numbered list, use an ordered list with <ol> and <li> tags
       - For key points that aren't sequential, use an unordered list with <ul> and <li> tags
       - Structure your content logically with clear sections` : '';
    
    messages.push({ 
      role: 'system', 
      content: systemMessage + (formatAsHtml ? '\n\n' + formattingInstructions : '')
    });
    
    // Add conversation history if available
    if (conversationHistory.length > 0) {
      messages.push(...conversationHistory);
    } else {
      // If no history, just add the current prompt
      messages.push({ role: 'user', content: prompt });
    }

    // Generate AI response
    const openAIResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: messages,
        max_tokens: 800
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
