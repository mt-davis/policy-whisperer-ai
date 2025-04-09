import React, { useEffect, useRef, useState } from 'react';
import { toast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

// Note to implementer: You'll need to add mapbox-gl to your project
// and set up a Mapbox API key in your Supabase Edge Function secrets

interface ImpactMapProps {
  legislationId: string | null;
  onStateSelect: (stateCode: string, stateName: string) => void;
}

const ImpactMap: React.FC<ImpactMapProps> = ({ 
  legislationId, 
  onStateSelect 
}) => {
  const mapContainer = useRef<HTMLDivElement | null>(null);
  const map = useRef<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mapLoaded, setMapLoaded] = useState(false);
  
  // Placeholder for mapbox token - will need to be set properly
  const [mapboxToken, setMapboxToken] = useState<string | null>(null);
  
  // Load impact data for all states and display on map
  const loadImpactData = async () => {
    if (!legislationId) return;
    
    setLoading(true);
    setError(null);
    
    try {
      // First check if we already have impact data for this legislation
      const { data: existingImpact, error: fetchError } = await supabase
        .from('legislation_impact')
        .select('*')
        .eq('legislation_id', legislationId);
      
      if (fetchError) throw fetchError;
      
      // If we have existing data, use it
      if (existingImpact && existingImpact.length > 0) {
        updateMapWithImpactData(existingImpact);
        return;
      }
      
      // Otherwise, generate new impact data
      const response = await fetch(
        "https://cyzpqzvrssgamdtqvyze.supabase.co/functions/v1/analyze-legislation-impact",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${supabase.auth.session()?.access_token || ""}`
          },
          body: JSON.stringify({ 
            legislationId,
            storeResults: true
          }),
        }
      );
      
      if (!response.ok) {
        throw new Error(`Error analyzing legislation impact: ${response.statusText}`);
      }
      
      const data = await response.json();
      
      if (data.error) {
        throw new Error(data.error);
      }
      
      // Fetch the stored impact data
      const { data: updatedImpact, error: updatedError } = await supabase
        .from('legislation_impact')
        .select('*')
        .eq('legislation_id', legislationId);
      
      if (updatedError) throw updatedError;
      
      if (updatedImpact && updatedImpact.length > 0) {
        updateMapWithImpactData(updatedImpact);
      }
    } catch (err: any) {
      console.error('Error loading impact data:', err);
      setError(err.message || 'Failed to load impact data');
      toast({
        title: "Error",
        description: err.message || 'Failed to load impact data',
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };
  
  // This is a placeholder function since we don't have mapbox-gl installed yet
  const updateMapWithImpactData = (impactData: any[]) => {
    if (!map.current || !mapLoaded) return;
    
    console.log('Updating map with impact data:', impactData);
    
    // This would need to be implemented with actual mapbox-gl
    // For now we'll just log the data
    toast({
      title: "Map Updated",
      description: `Loaded impact data for ${impactData.length} states`,
    });
  };
  
  // Initialize map (placeholder)
  useEffect(() => {
    // In a real implementation, this would initialize mapbox-gl
    // For now, we'll just handle the UI state
    
    if (mapboxToken && !map.current && mapContainer.current) {
      toast({
        title: "Map Loading",
        description: "Map component would initialize here with proper Mapbox token",
      });
      
      // Simulate map loading
      const timer = setTimeout(() => {
        setMapLoaded(true);
        toast({
          title: "Map Ready",
          description: "Map is now ready. Select legislation to view impact data.",
        });
      }, 1000);
      
      return () => clearTimeout(timer);
    }
  }, [mapboxToken, mapContainer.current]);
  
  // Load impact data when legislation changes
  useEffect(() => {
    if (legislationId && mapLoaded) {
      loadImpactData();
    }
  }, [legislationId, mapLoaded]);
  
  // For development purposes, allow setting a mapbox token
  const promptForMapboxToken = () => {
    const token = prompt("Enter your Mapbox access token to enable the map");
    if (token) {
      setMapboxToken(token);
      toast({
        title: "Token Set",
        description: "Mapbox token has been set temporarily for this session",
      });
    }
  };
  
  return (
    <div className="space-y-4">
      <div className="bg-muted rounded-md p-4">
        <div className="flex justify-between items-center mb-2">
          <h3 className="font-medium">Impact Map</h3>
          {loading && <Loader2 className="h-4 w-4 animate-spin" />}
        </div>
        
        {!mapboxToken ? (
          <div className="text-center p-6 space-y-3 bg-background rounded-md">
            <p className="text-sm text-muted-foreground">
              Mapbox token is required to display the interactive map.
            </p>
            <Button onClick={promptForMapboxToken} size="sm">
              Set Mapbox Token
            </Button>
          </div>
        ) : (
          <div 
            ref={mapContainer} 
            className="h-[400px] bg-background rounded-md border relative"
          >
            {!mapLoaded && (
              <div className="absolute inset-0 flex items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            )}
            
            {error && (
              <div className="absolute inset-0 flex items-center justify-center bg-background/80">
                <div className="text-center p-4">
                  <p className="text-destructive mb-2">{error}</p>
                  <Button size="sm" onClick={loadImpactData}>
                    Retry
                  </Button>
                </div>
              </div>
            )}
            
            {!legislationId && mapLoaded && (
              <div className="absolute inset-0 flex items-center justify-center bg-background/80">
                <p className="text-center text-muted-foreground">
                  Select legislation to view impact data
                </p>
              </div>
            )}
            
            {/* This is where the actual map would be rendered */}
          </div>
        )}
      </div>
      
      {legislationId && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2">
          {["CA", "TX", "NY", "FL", "IL"].map((code) => (
            <Button 
              key={code}
              variant="outline" 
              size="sm"
              onClick={() => onStateSelect(code, getStateName(code))}
            >
              {code}
            </Button>
          ))}
        </div>
      )}
    </div>
  );
};

// Helper function to get state name from code
function getStateName(stateCode: string): string {
  const stateMap: Record<string, string> = {
    "AL": "Alabama", "AK": "Alaska", "AZ": "Arizona", "AR": "Arkansas",
    "CA": "California", "CO": "Colorado", "CT": "Connecticut", "DE": "Delaware",
    "FL": "Florida", "GA": "Georgia", "HI": "Hawaii", "ID": "Idaho",
    "IL": "Illinois", "IN": "Indiana", "IA": "Iowa", "KS": "Kansas",
    "KY": "Kentucky", "LA": "Louisiana", "ME": "Maine", "MD": "Maryland",
    "MA": "Massachusetts", "MI": "Michigan", "MN": "Minnesota", "MS": "Mississippi",
    "MO": "Missouri", "MT": "Montana", "NE": "Nebraska", "NV": "Nevada",
    "NH": "New Hampshire", "NJ": "New Jersey", "NM": "New Mexico", "NY": "New York",
    "NC": "North Carolina", "ND": "North Dakota", "OH": "Ohio", "OK": "Oklahoma",
    "OR": "Oregon", "PA": "Pennsylvania", "RI": "Rhode Island", "SC": "South Carolina",
    "SD": "South Dakota", "TN": "Tennessee", "TX": "Texas", "UT": "Utah",
    "VT": "Vermont", "VA": "Virginia", "WA": "Washington", "WV": "West Virginia",
    "WI": "Wisconsin", "WY": "Wyoming", "DC": "District of Columbia"
  };
  
  return stateMap[stateCode] || stateCode;
}

export default ImpactMap;
