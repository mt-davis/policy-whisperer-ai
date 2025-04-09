
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

// List of U.S. states with their codes
const statesList = [
  { code: 'AL', name: 'Alabama' }, { code: 'AK', name: 'Alaska' },
  { code: 'AZ', name: 'Arizona' }, { code: 'AR', name: 'Arkansas' },
  { code: 'CA', name: 'California' }, { code: 'CO', name: 'Colorado' },
  { code: 'CT', name: 'Connecticut' }, { code: 'DE', name: 'Delaware' },
  { code: 'FL', name: 'Florida' }, { code: 'GA', name: 'Georgia' },
  { code: 'HI', name: 'Hawaii' }, { code: 'ID', name: 'Idaho' },
  { code: 'IL', name: 'Illinois' }, { code: 'IN', name: 'Indiana' },
  { code: 'IA', name: 'Iowa' }, { code: 'KS', name: 'Kansas' },
  { code: 'KY', name: 'Kentucky' }, { code: 'LA', name: 'Louisiana' },
  { code: 'ME', name: 'Maine' }, { code: 'MD', name: 'Maryland' },
  { code: 'MA', name: 'Massachusetts' }, { code: 'MI', name: 'Michigan' },
  { code: 'MN', name: 'Minnesota' }, { code: 'MS', name: 'Mississippi' },
  { code: 'MO', name: 'Missouri' }, { code: 'MT', name: 'Montana' },
  { code: 'NE', name: 'Nebraska' }, { code: 'NV', name: 'Nevada' },
  { code: 'NH', name: 'New Hampshire' }, { code: 'NJ', name: 'New Jersey' },
  { code: 'NM', name: 'New Mexico' }, { code: 'NY', name: 'New York' },
  { code: 'NC', name: 'North Carolina' }, { code: 'ND', name: 'North Dakota' },
  { code: 'OH', name: 'Ohio' }, { code: 'OK', name: 'Oklahoma' },
  { code: 'OR', name: 'Oregon' }, { code: 'PA', name: 'Pennsylvania' },
  { code: 'RI', name: 'Rhode Island' }, { code: 'SC', name: 'South Carolina' },
  { code: 'SD', name: 'South Dakota' }, { code: 'TN', name: 'Tennessee' },
  { code: 'TX', name: 'Texas' }, { code: 'UT', name: 'Utah' },
  { code: 'VT', name: 'Vermont' }, { code: 'VA', name: 'Virginia' },
  { code: 'WA', name: 'Washington' }, { code: 'WV', name: 'West Virginia' },
  { code: 'WI', name: 'Wisconsin' }, { code: 'WY', name: 'Wyoming' },
  { code: 'DC', name: 'District of Columbia' }
];

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { legislationId, stateCode, storeResults = true } = await req.json();
    
    if (!legislationId) {
      throw new Error('Missing required field: legislationId');
    }

    console.log('Analyzing legislation impact for legislation ID:', legislationId);

    // Get legislation content
    const { data: legislation, error: legislationError } = await supabase
      .from('legislation')
      .select('*')
      .eq('id', legislationId)
      .single();

    if (legislationError) {
      throw legislationError;
    }

    if (!legislation) {
      throw new Error('Legislation not found');
    }

    // If a specific state is requested, analyze just that state
    if (stateCode) {
      const stateName = statesList.find(s => s.code === stateCode)?.name || stateCode;
      
      const impactData = await analyzeImpactForState(
        legislation.content, 
        legislation.title,
        stateCode,
        stateName
      );
      
      // Store the result if requested
      if (storeResults) {
        await storeStateImpact(legislationId, stateCode, impactData);
      }
      
      return new Response(JSON.stringify({ 
        state: stateCode,
        impact: impactData
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    } else {
      // Analyze all states (this would be expensive in a real app)
      // For demo purposes, we'll analyze a few representative states
      const sampleStates = ['CA', 'TX', 'NY', 'FL', 'IL'];
      
      const results = [];
      
      for (const code of sampleStates) {
        const stateName = statesList.find(s => s.code === code)?.name || code;
        console.log(`Analyzing impact for ${stateName}...`);
        
        const impactData = await analyzeImpactForState(
          legislation.content, 
          legislation.title,
          code,
          stateName
        );
        
        results.push({
          state: code,
          impact: impactData
        });
        
        // Store the result if requested
        if (storeResults) {
          await storeStateImpact(legislationId, code, impactData);
        }
      }
      
      return new Response(JSON.stringify({ results }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
  } catch (error) {
    console.error('Error analyzing legislation impact:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

async function analyzeImpactForState(
  legislationContent: string, 
  legislationTitle: string,
  stateCode: string,
  stateName: string
) {
  try {
    // Truncate content if it's too long
    const truncatedContent = legislationContent.length > 8000 
      ? legislationContent.substring(0, 8000) + "..." 
      : legislationContent;
    
    console.log(`Generating impact analysis for ${stateName} using OpenAI...`);
    
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
            content: `You are an AI specialized in analyzing the potential impact of legislation on different states.
                      For the given legislation, analyze its potential impact on ${stateName} (${stateCode}).
                      Consider economic, social, environmental, and legal factors specific to ${stateName}.
                      Respond in JSON format with the following structure:
                      {
                        "impactLevel": "high", "medium", "low", "neutral", or "unknown",
                        "summary": "A brief one-sentence overview of the impact",
                        "details": "A paragraph with more detailed analysis of how this legislation would impact ${stateName} specifically"
                      }` 
          },
          { 
            role: 'user', 
            content: `Legislation Title: ${legislationTitle}\n\nContent: ${truncatedContent}` 
          }
        ],
        response_format: { type: "json_object" },
        max_tokens: 800
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
        impactLevel: parsedResponse.impactLevel || "unknown",
        summary: parsedResponse.summary || `Impact analysis for ${stateName} is available.`,
        details: parsedResponse.details || `Detailed impact analysis for ${stateName} is available upon request.`
      };
    } catch (parseError) {
      console.error('Error parsing OpenAI response as JSON:', parseError);
      
      // Fallback if parsing fails
      return {
        impactLevel: "unknown",
        summary: `Impact analysis for ${stateName} has been processed.`,
        details: `Please request detailed information about how this legislation impacts ${stateName}.`
      };
    }
  } catch (error) {
    console.error('Error generating impact analysis with OpenAI:', error);
    
    // Fallback if OpenAI call fails
    return {
      impactLevel: "unknown",
      summary: `Unable to analyze impact for ${stateName} at this time.`,
      details: `Technical issues prevented a detailed analysis for ${stateName}. Please try again later.`
    };
  }
}

async function storeStateImpact(
  legislationId: string, 
  stateCode: string, 
  impactData: { 
    impactLevel: string, 
    summary: string, 
    details: string 
  }
) {
  try {
    // Check if impact data already exists for this state
    const { data: existingImpact } = await supabase
      .from('legislation_impact')
      .select('id')
      .eq('legislation_id', legislationId)
      .eq('state_code', stateCode)
      .single();
    
    if (existingImpact) {
      // Update existing impact data
      const { error: updateError } = await supabase
        .from('legislation_impact')
        .update({
          impact_level: impactData.impactLevel,
          summary: impactData.summary,
          details: impactData.details,
          updated_at: new Date().toISOString()
        })
        .eq('id', existingImpact.id);
      
      if (updateError) {
        throw updateError;
      }
    } else {
      // Insert new impact data
      const { error: insertError } = await supabase
        .from('legislation_impact')
        .insert({
          legislation_id: legislationId,
          state_code: stateCode,
          impact_level: impactData.impactLevel,
          summary: impactData.summary,
          details: impactData.details
        });
      
      if (insertError) {
        throw insertError;
      }
    }
    
    console.log(`Successfully stored impact data for ${stateCode}`);
  } catch (error) {
    console.error(`Error storing impact data for ${stateCode}:`, error);
    throw error;
  }
}
