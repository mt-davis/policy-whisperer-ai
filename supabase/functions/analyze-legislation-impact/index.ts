import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.23.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || '';
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY') || '';

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { legislationId, stateCode, storeResults } = await req.json();

    if (!legislationId) {
      return new Response(
        JSON.stringify({ error: 'Legislation ID is required' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    // Initialize Supabase client
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Get legislation content
    const { data: legislation, error: legError } = await supabase
      .from('legislation')
      .select('*')
      .eq('id', legislationId)
      .single();

    if (legError) {
      console.error('Error fetching legislation:', legError);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch legislation data' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      );
    }

    if (!legislation) {
      return new Response(
        JSON.stringify({ error: 'Legislation not found' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 404 }
      );
    }

    // If stateCode is provided, analyze for that specific state
    // Otherwise, analyze for all states or general impact
    const statesToAnalyze = stateCode ? [stateCode] : getStatesToAnalyze(legislation);
    
    const analyzePromises = statesToAnalyze.map(async (code) => {
      const analysis = await analyzeImpact(legislation, code);
      
      if (storeResults) {
        await storeAnalysisResults(supabase, legislation.id, code, analysis);
      }
      
      return { stateCode: code, ...analysis };
    });
    
    const analysisResults = await Promise.all(analyzePromises);
    
    return new Response(
      JSON.stringify({ 
        success: true, 
        results: analysisResults
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error processing request:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'An error occurred during analysis' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});

// Get states to analyze based on legislation level
function getStatesToAnalyze(legislation: any): string[] {
  if (legislation.level === 'state' && legislation.state) {
    // For state-level legislation, just analyze the specific state
    // Get state code from full name
    const stateCode = getStateCodeFromName(legislation.state);
    return stateCode ? [stateCode] : [];
  }
  
  // For federal legislation, return major states for demo purposes
  // In a real implementation, you might want to analyze all states
  return ['CA', 'TX', 'NY', 'FL', 'IL'];
}

// Convert state name to code (simple implementation)
function getStateCodeFromName(stateName: string): string | null {
  const stateMap: Record<string, string> = {
    'alabama': 'AL',
    'alaska': 'AK',
    'arizona': 'AZ',
    'arkansas': 'AR',
    'california': 'CA',
    'colorado': 'CO',
    'connecticut': 'CT',
    'delaware': 'DE',
    'florida': 'FL',
    'georgia': 'GA',
    'hawaii': 'HI',
    'idaho': 'ID',
    'illinois': 'IL',
    'indiana': 'IN',
    'iowa': 'IA',
    'kansas': 'KS',
    'kentucky': 'KY',
    'louisiana': 'LA',
    'maine': 'ME',
    'maryland': 'MD',
    'massachusetts': 'MA',
    'michigan': 'MI',
    'minnesota': 'MN',
    'mississippi': 'MS',
    'missouri': 'MO',
    'montana': 'MT',
    'nebraska': 'NE',
    'nevada': 'NV',
    'new hampshire': 'NH',
    'new jersey': 'NJ',
    'new mexico': 'NM',
    'new york': 'NY',
    'north carolina': 'NC',
    'north dakota': 'ND',
    'ohio': 'OH',
    'oklahoma': 'OK',
    'oregon': 'OR',
    'pennsylvania': 'PA',
    'rhode island': 'RI',
    'south carolina': 'SC',
    'south dakota': 'SD',
    'tennessee': 'TN',
    'texas': 'TX',
    'utah': 'UT',
    'vermont': 'VT',
    'virginia': 'VA',
    'washington': 'WA',
    'west virginia': 'WV',
    'wisconsin': 'WI',
    'wyoming': 'WY'
  };
  
  return stateMap[stateName.toLowerCase()] || null;
}

// Analyze the impact of legislation using OpenAI
async function analyzeImpact(legislation: any, stateCode: string): Promise<any> {
  const stateName = getStateNameFromCode(stateCode);
  
  try {
    if (!OPENAI_API_KEY) {
      console.warn('OpenAI API key not found, using mock analysis');
      return generateMockAnalysis(legislation, stateCode);
    }
    
    const prompt = `
    Analyze the impact of the following ${legislation.level} legislation on the state of ${stateName}:
    
    Title: ${legislation.title}
    ${legislation.description ? `Description: ${legislation.description}` : ''}
    
    Content of the legislation:
    ${legislation.content.substring(0, 3000)}... 
    
    Please provide:
    1. An impact level (high, medium, low, or neutral)
    2. A concise summary of the impact (2-3 sentences)
    3. A detailed analysis of how this legislation would affect ${stateName} specifically (2-3 paragraphs)
    
    Format your response as a JSON object with the fields "impact_level", "summary", and "details".
    `;
    
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: 'You are an AI specialized in legislative analysis and its impacts on different states.' },
          { role: 'user', content: prompt }
        ],
        temperature: 0.7,
        max_tokens: 1000
      })
    });
    
    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.statusText}`);
    }
    
    const data = await response.json();
    let result;
    
    try {
      // Try to parse the content as JSON first
      result = JSON.parse(data.choices[0].message.content);
    } catch (e) {
      // If parsing fails, use a regex approach to extract the JSON part
      const content = data.choices[0].message.content;
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      
      if (jsonMatch) {
        try {
          result = JSON.parse(jsonMatch[0]);
        } catch (e2) {
          console.error('Failed to parse JSON from OpenAI response', e2);
          result = extractStructuredData(content);
        }
      } else {
        result = extractStructuredData(content);
      }
    }
    
    // Ensure we have all required fields
    return {
      impact_level: result.impact_level || 'medium',
      summary: result.summary || 'No summary available',
      details: result.details || 'No detailed analysis available'
    };
  } catch (error) {
    console.error('Error analyzing impact with OpenAI:', error);
    return generateMockAnalysis(legislation, stateCode);
  }
}

// Extract structured data from unstructured text
function extractStructuredData(text: string): any {
  const impactLevelMatch = text.match(/impact level:?\s*(high|medium|low|neutral)/i);
  const impactLevel = impactLevelMatch ? impactLevelMatch[1].toLowerCase() : 'medium';
  
  // Look for summary section
  let summary = '';
  const summaryMatch = text.match(/summary:?\s*([^#]+)/i);
  if (summaryMatch) {
    summary = summaryMatch[1].trim();
  }
  
  // Look for details section
  let details = '';
  const detailsMatch = text.match(/details:?\s*([^#]+)$/i);
  if (detailsMatch) {
    details = detailsMatch[1].trim();
  }
  
  return {
    impact_level: impactLevel,
    summary: summary || 'Impact analysis summary not available',
    details: details || 'Detailed impact analysis not available'
  };
}

// Generate mock analysis for testing or when OpenAI is not available
function generateMockAnalysis(legislation: any, stateCode: string): any {
  const stateName = getStateNameFromCode(stateCode);
  const impactLevels = ['high', 'medium', 'low', 'neutral'];
  const randomImpact = impactLevels[Math.floor(Math.random() * impactLevels.length)];
  
  return {
    impact_level: randomImpact,
    summary: `This ${legislation.level} legislation would have a ${randomImpact} impact on ${stateName}. Key sectors affected would include economy, infrastructure, and public services.`,
    details: `The legislation titled "${legislation.title}" would affect ${stateName} in several ways. 
    
    First, it would influence the state's economic landscape by potentially changing regulations that govern key industries present in ${stateName}. The changes could lead to shifts in employment rates and business operations.
    
    Second, there would be social impacts as citizens adapt to the new requirements or benefits provided by this legislation. This may include changes to healthcare access, educational opportunities, or other public services.
    
    The long-term effects would depend on implementation details and how well the state's existing infrastructure can accommodate the changes mandated by this legislation.`
  };
}

// Store analysis results in the database
async function storeAnalysisResults(
  supabase: any, 
  legislationId: string, 
  stateCode: string, 
  analysis: any
): Promise<void> {
  try {
    // Check if analysis for this legislation and state already exists
    const { data: existing, error: selectError } = await supabase
      .from('legislation_impact')
      .select('id')
      .eq('legislation_id', legislationId)
      .eq('state_code', stateCode)
      .maybeSingle();
    
    if (selectError && selectError.code !== 'PGRST116') {
      throw selectError;
    }
    
    if (existing) {
      // Update existing analysis
      const { error: updateError } = await supabase
        .from('legislation_impact')
        .update({
          impact_level: analysis.impact_level,
          summary: analysis.summary,
          details: analysis.details,
          updated_at: new Date().toISOString()
        })
        .eq('id', existing.id);
      
      if (updateError) throw updateError;
    } else {
      // Insert new analysis
      const { error: insertError } = await supabase
        .from('legislation_impact')
        .insert({
          legislation_id: legislationId,
          state_code: stateCode,
          impact_level: analysis.impact_level,
          summary: analysis.summary,
          details: analysis.details
        });
      
      if (insertError) throw insertError;
    }
  } catch (error) {
    console.error('Error storing analysis results:', error);
    throw error;
  }
}

// Get state name from code
function getStateNameFromCode(stateCode: string): string {
  const stateMap: Record<string, string> = {
    'AL': 'Alabama',
    'AK': 'Alaska',
    'AZ': 'Arizona',
    'AR': 'Arkansas',
    'CA': 'California',
    'CO': 'Colorado',
    'CT': 'Connecticut',
    'DE': 'Delaware',
    'FL': 'Florida',
    'GA': 'Georgia',
    'HI': 'Hawaii',
    'ID': 'Idaho',
    'IL': 'Illinois',
    'IN': 'Indiana',
    'IA': 'Iowa',
    'KS': 'Kansas',
    'KY': 'Kentucky',
    'LA': 'Louisiana',
    'ME': 'Maine',
    'MD': 'Maryland',
    'MA': 'Massachusetts',
    'MI': 'Michigan',
    'MN': 'Minnesota',
    'MS': 'Mississippi',
    'MO': 'Missouri',
    'MT': 'Montana',
    'NE': 'Nebraska',
    'NV': 'Nevada',
    'NH': 'New Hampshire',
    'NJ': 'New Jersey',
    'NM': 'New Mexico',
    'NY': 'New York',
    'NC': 'North Carolina',
    'ND': 'North Dakota',
    'OH': 'Ohio',
    'OK': 'Oklahoma',
    'OR': 'Oregon',
    'PA': 'Pennsylvania',
    'RI': 'Rhode Island',
    'SC': 'South Carolina',
    'SD': 'South Dakota',
    'TN': 'Tennessee',
    'TX': 'Texas',
    'UT': 'Utah',
    'VT': 'Vermont',
    'VA': 'Virginia',
    'WA': 'Washington',
    'WV': 'West Virginia',
    'WI': 'Wisconsin',
    'WY': 'Wyoming',
    'DC': 'District of Columbia'
  };
  
  return stateMap[stateCode] || stateCode;
}
