
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
    const { content, title, sourceType, sourceReference } = await req.json();

    if (!content || !sourceType) {
      throw new Error('Missing required fields: content and sourceType are required');
    }

    console.log('Processing policy document with content length:', content.length);

    // Generate summary and key points using OpenAI
    const summaryData = await generateSummary(content);
    
    // Store the policy document in the database
    const { data: document, error: documentError } = await supabase
      .from('policy_documents')
      .insert({
        title: title || 'Untitled Policy Document',
        content,
        source_type: sourceType,
        source_reference: sourceReference || null,
        key_summary: summaryData.keySummary,
        key_points: summaryData.keyPoints,
        local_impact: summaryData.localImpact,
        demographic_impact: summaryData.demographicImpact
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

    return new Response(JSON.stringify({ 
      document,
      conversation,
      summary: summaryData
    }), {
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

async function generateSummary(content: string) {
  try {
    // Truncate content if it's too long for the API call
    const truncatedContent = content.length > 15000 ? content.substring(0, 15000) + "..." : content;
    
    console.log('Generating summary using OpenAI...');
    
    const openAIResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { 
            role: 'system', 
            content: `You are an AI specialized in analyzing policy documents and extracting key information. 
                      For the given policy document, provide the following in JSON format:
                      1. keySummary: A concise 2-3 sentence executive summary of the policy's main purpose
                      2. keyPoints: An array of 4-5 specific key provisions or requirements in the policy
                      3. localImpact: A paragraph on how this policy might affect local economies or communities
                      4. demographicImpact: A paragraph on how different demographic groups might be affected differently` 
          },
          { role: 'user', content: truncatedContent }
        ],
        response_format: { type: "json_object" },
        max_tokens: 1000
      }),
    });

    const data = await openAIResponse.json();
    
    if (!data.choices || !data.choices[0]) {
      throw new Error('Invalid response from OpenAI API');
    }
    
    const generatedText = data.choices[0].message.content;
    
    try {
      // Parse the JSON response
      const parsedResponse = JSON.parse(generatedText);
      
      return {
        keySummary: parsedResponse.keySummary || "This policy document has been analyzed. Key insights are available.",
        keyPoints: parsedResponse.keyPoints || ["Document has been successfully processed"],
        localImpact: parsedResponse.localImpact || "Analysis of local impact is available upon request.",
        demographicImpact: parsedResponse.demographicImpact || "Analysis of demographic considerations is available upon request."
      };
    } catch (parseError) {
      console.error('Error parsing OpenAI response as JSON:', parseError);
      
      // Fallback summary if parsing fails
      return {
        keySummary: "This policy has been analyzed. Please ask specific questions to learn more.",
        keyPoints: ["Document has been successfully processed", "AI analysis available", "Ask questions for detailed insights"],
        localImpact: "Analysis of local impact is available upon request.",
        demographicImpact: "Analysis of demographic considerations is available upon request."
      };
    }
  } catch (error) {
    console.error('Error generating summary with OpenAI:', error);
    
    // Fallback if OpenAI call fails
    return {
      keySummary: "This policy has been stored in our database for analysis. Ask questions to learn more.",
      keyPoints: ["Document has been successfully processed", "You can ask questions about this policy", "AI will analyze the content to provide insights"],
      localImpact: "Please ask specific questions about local impact to get detailed information.",
      demographicImpact: "Please ask specific questions about demographic considerations to get detailed information."
    };
  }
}
