
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

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
    const { url } = await req.json();

    if (!url) {
      throw new Error('URL is required');
    }

    console.log(`Fetching content from URL: ${url}`);
    
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`Failed to fetch URL: ${response.status} ${response.statusText}`);
    }

    const contentType = response.headers.get('content-type') || '';
    let content = '';
    
    if (contentType.includes('text/html')) {
      // For HTML, we extract the text content server-side
      const html = await response.text();
      
      // Basic HTML processing to extract text
      // Remove script and style tags (simplified approach, server-side)
      content = html
        .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
        .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
        .replace(/<[^>]*>/g, ' ') // Replace remaining HTML tags with spaces
        .replace(/\s+/g, ' ')     // Replace multiple whitespace with single space
        .trim();
    } else {
      // For other text formats, get the raw text
      content = await response.text();
    }

    // Sanitize content to handle problematic characters
    const sanitizedContent = content
      .replace(/\u0000/g, '') // Remove null bytes
      .replace(/[\uD800-\uDBFF][\uDC00-\uDFFF]|[^\x00-\x7F]/g, char => {
        try {
          return encodeURIComponent(char);
        } catch (e) {
          return '';
        }
      });

    return new Response(JSON.stringify({ content: sanitizedContent }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error fetching URL:', error);
    
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
