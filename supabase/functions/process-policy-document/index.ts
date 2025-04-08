
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
    const { content, title, sourceType, sourceReference } = await req.json();

    if (!content || !sourceType) {
      throw new Error('Missing required fields: content and sourceType are required');
    }

    // Store the policy document in the database
    const { data: document, error: documentError } = await supabase
      .from('policy_documents')
      .insert({
        title: title || 'Untitled Policy Document',
        content,
        source_type: sourceType,
        source_reference: sourceReference || null,
      })
      .select()
      .single();

    if (documentError) {
      throw documentError;
    }

    // Create an initial conversation for this document
    const { data: conversation, error: conversationError } = await supabase
      .from('conversations')
      .insert({
        policy_document_id: document.id,
        title: 'Initial Conversation',
      })
      .select()
      .single();

    if (conversationError) {
      throw conversationError;
    }

    // Add initial AI message to the conversation
    const { error: messageError } = await supabase
      .from('messages')
      .insert({
        conversation_id: conversation.id,
        content: "I've analyzed the policy document. What questions do you have about it?",
        sender: 'ai'
      });

    if (messageError) {
      throw messageError;
    }

    // Create a summary of the document (in a real app, this would use AI to generate)
    const summary = {
      document,
      conversation,
      keySummary: "This policy has been stored in our database for analysis. Ask questions to learn more.",
      keyPoints: [
        "Document has been successfully processed",
        "You can ask questions about this policy",
        "AI will analyze the content to provide insights"
      ]
    };

    return new Response(JSON.stringify(summary), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error processing policy document:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
