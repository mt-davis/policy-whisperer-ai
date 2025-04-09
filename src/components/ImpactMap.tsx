
import React, { useEffect, useRef, useState } from 'react';
import { toast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';

interface ImpactMapProps {
  legislationId: string | null;
  onStateSelect: (stateCode: string, stateName: string) => void;
}

// Define impact level colors
const IMPACT_COLORS = {
  high: '#ea384c', // Red
  medium: '#F97316', // Orange
  low: '#EAB308', // Yellow
  neutral: '#0EA5E9', // Blue
  none: '#8E9196' // Gray
};

const ImpactMap: React.FC<ImpactMapProps> = ({ 
  legislationId, 
  onStateSelect 
}) => {
  const mapContainer = useRef<HTMLDivElement | null>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [mapboxToken, setMapboxToken] = useState<string | null>(null);
  const [impactData, setImpactData] = useState<any[]>([]);
  
  // Try to get mapbox token from Supabase
  useEffect(() => {
    const fetchMapboxToken = async () => {
      try {
        const response = await fetch(
          "https://cyzpqzvrssgamdtqvyze.supabase.co/functions/v1/fetch-mapbox-token",
          { 
            method: "GET",
            headers: { "Content-Type": "application/json" }
          }
        );
        
        if (response.ok) {
          const data = await response.json();
          if (data.token) {
            setMapboxToken(data.token);
            return;
          }
        }
        
        // If token not in Supabase, check localStorage as fallback
        const storedToken = localStorage.getItem("mapbox_token");
        if (storedToken) {
          setMapboxToken(storedToken);
        }
      } catch (err) {
        console.error("Error fetching Mapbox token:", err);
        // Check localStorage as fallback
        const storedToken = localStorage.getItem("mapbox_token");
        if (storedToken) {
          setMapboxToken(storedToken);
        }
      }
    };
    
    fetchMapboxToken();
  }, []);
  
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
        .eq('legislation_id', legislationId) as { data: any[], error: any };
      
      if (fetchError) throw fetchError;
      
      // If we have existing data, use it
      if (existingImpact && existingImpact.length > 0) {
        setImpactData(existingImpact);
        updateMapWithImpactData(existingImpact);
        return;
      }
      
      // Otherwise, generate new impact data
      const response = await fetch(
        "https://cyzpqzvrssgamdtqvyze.supabase.co/functions/v1/analyze-legislation-impact",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
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
        .eq('legislation_id', legislationId) as { data: any[], error: any };
      
      if (updatedError) throw updatedError;
      
      if (updatedImpact && updatedImpact.length > 0) {
        setImpactData(updatedImpact);
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
  
  // Update map with impact data
  const updateMapWithImpactData = (impactData: any[]) => {
    if (!map.current || !mapLoaded) return;
    
    // Clear any existing data
    if (map.current.getSource('states')) {
      map.current.removeLayer('state-fills');
      map.current.removeLayer('state-borders');
      map.current.removeLayer('state-fills-hover');
      map.current.removeSource('states');
    }
    
    // Create a lookup object for quick access to impact data by state code
    const impactByState: Record<string, any> = {};
    impactData.forEach(impact => {
      impactByState[impact.state_code] = impact;
    });

    // Add the states source
    map.current.addSource('states', {
      type: 'geojson',
      data: 'https://docs.mapbox.com/mapbox-gl-js/assets/us_states.geojson'
    });
    
    // Add fill layer for states
    map.current.addLayer({
      id: 'state-fills',
      type: 'fill',
      source: 'states',
      layout: {},
      paint: {
        'fill-color': [
          'case',
          ['has', ['get', 'STATE_ABBR'], ['literal', impactByState]],
          [
            'match',
            ['get', ['get', 'impact_level'], ['literal', impactByState]],
            'high', IMPACT_COLORS.high,
            'medium', IMPACT_COLORS.medium,
            'low', IMPACT_COLORS.low,
            'neutral', IMPACT_COLORS.neutral,
            IMPACT_COLORS.none
          ],
          IMPACT_COLORS.none
        ],
        'fill-opacity': 0.7
      }
    });
    
    // Add border layer for states
    map.current.addLayer({
      id: 'state-borders',
      type: 'line',
      source: 'states',
      layout: {},
      paint: {
        'line-color': '#ffffff',
        'line-width': 1
      }
    });
    
    // Add hover effects
    map.current.addLayer({
      id: 'state-fills-hover',
      type: 'fill',
      source: 'states',
      layout: {},
      paint: {
        'fill-color': [
          'case',
          ['has', ['get', 'STATE_ABBR'], ['literal', impactByState]],
          [
            'match',
            ['get', ['get', 'impact_level'], ['literal', impactByState]],
            'high', IMPACT_COLORS.high,
            'medium', IMPACT_COLORS.medium,
            'low', IMPACT_COLORS.low,
            'neutral', IMPACT_COLORS.neutral,
            IMPACT_COLORS.none
          ],
          IMPACT_COLORS.none
        ],
        'fill-opacity': [
          'case',
          ['boolean', ['feature-state', 'hover'], false],
          0.9,
          0
        ]
      }
    });
    
    // Set up hover state
    let hoveredStateId: string | null = null;
    
    // Add hover effects
    map.current.on('mousemove', 'state-fills', (e) => {
      if (e.features && e.features.length > 0) {
        if (hoveredStateId) {
          map.current!.setFeatureState(
            { source: 'states', id: hoveredStateId },
            { hover: false }
          );
        }
        
        hoveredStateId = e.features[0].id as string;
        
        map.current!.setFeatureState(
          { source: 'states', id: hoveredStateId },
          { hover: true }
        );
        
        // Change cursor to pointer
        map.current!.getCanvas().style.cursor = 'pointer';
      }
    });
    
    // Reset hover state when mouse leaves
    map.current.on('mouseleave', 'state-fills', () => {
      if (hoveredStateId) {
        map.current!.setFeatureState(
          { source: 'states', id: hoveredStateId },
          { hover: false }
        );
      }
      hoveredStateId = null;
      
      // Reset cursor
      map.current!.getCanvas().style.cursor = '';
    });
    
    // Set up click handler for states
    map.current.on('click', 'state-fills', (e) => {
      if (e.features && e.features.length > 0) {
        const feature = e.features[0];
        const stateProps = feature.properties;
        
        if (stateProps && stateProps.STATE_ABBR) {
          const stateCode = stateProps.STATE_ABBR;
          const stateName = stateProps.STATE_NAME;
          onStateSelect(stateCode, stateName);
        }
      }
    });
    
    // Fit the map to the continental US
    map.current.fitBounds([
      [-124.848974, 24.396308], // Southwest coordinates
      [-66.885444, 49.384358]   // Northeast coordinates
    ], { padding: 20 });
    
    toast({
      title: "Map Updated",
      description: `Showing impact data for ${impactData.length} states`,
    });
  };
  
  // Initialize map
  useEffect(() => {
    if (mapboxToken && !map.current && mapContainer.current) {
      // Save token to localStorage for future sessions
      localStorage.setItem("mapbox_token", mapboxToken);
      
      // Initialize Mapbox
      mapboxgl.accessToken = mapboxToken;
      
      map.current = new mapboxgl.Map({
        container: mapContainer.current,
        style: 'mapbox://styles/mapbox/light-v11',
        center: [-98.5795, 39.8283], // Center of US
        zoom: 3,
        minZoom: 2,
        maxZoom: 7
      });
      
      // Add navigation controls
      map.current.addControl(new mapboxgl.NavigationControl(), 'top-right');
      
      // Set up event listener for when the map is done loading
      map.current.on('load', () => {
        setMapLoaded(true);
        toast({
          title: "Map Ready",
          description: "Map is now ready. Select legislation to view impact data.",
        });
      });
      
      // Clean up on unmount
      return () => {
        map.current?.remove();
        map.current = null;
      };
    }
  }, [mapboxToken]);
  
  // Load impact data when legislation changes and map is ready
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
          </div>
        )}
      </div>
      
      {legislationId && impactData.length > 0 && (
        <div>
          <h3 className="text-sm font-medium mb-2">Impact Legend</h3>
          <div className="grid grid-cols-5 gap-2">
            {Object.entries(IMPACT_COLORS).map(([level, color]) => (
              <div key={level} className="flex items-center gap-2">
                <div className="w-4 h-4 rounded" style={{ backgroundColor: color }}></div>
                <span className="text-xs capitalize">{level}</span>
              </div>
            ))}
          </div>
        </div>
      )}
      
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
