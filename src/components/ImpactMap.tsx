import React, { useState, useEffect, memo } from 'react';
import { toast } from "@/hooks/use-toast";
import { Loader2, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { 
  ComposableMap,
  Geographies,
  Geography,
  ZoomableGroup
} from "react-simple-maps";
import { 
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";

// Import US states GeoJSON
import usaStates from '../data/us-states.json';

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
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [impactData, setImpactData] = useState<any[]>([]);
  const [hoveredState, setHoveredState] = useState<{
    code: string;
    name: string;
    impact?: string;
  } | null>(null);
  const [selectedStateId, setSelectedStateId] = useState<string | null>(null);
  
  const loadImpactData = async () => {
    if (!legislationId) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const { data: existingImpact, error: fetchError } = await supabase
        .from('legislation_impact')
        .select('*')
        .eq('legislation_id', legislationId);
      
      if (fetchError) throw fetchError;
      
      if (existingImpact && existingImpact.length > 0) {
        setImpactData(existingImpact);
        return;
      }
      
      toast({
        title: "Generating Impact Data",
        description: "This may take a moment. We're analyzing the legislation impact across states.",
      });
      
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
      
      const { data: updatedImpact, error: updatedError } = await supabase
        .from('legislation_impact')
        .select('*')
        .eq('legislation_id', legislationId);
      
      if (updatedError) throw updatedError;
      
      if (updatedImpact && updatedImpact.length > 0) {
        setImpactData(updatedImpact);
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
  
  // Get impact level for a specific state
  const getStateImpact = (stateCode: string) => {
    const stateImpact = impactData.find(impact => impact.state_code === stateCode);
    return stateImpact?.impact_level || 'none';
  };
  
  // Get state fill color based on impact level
  const getStateFillColor = (stateCode: string) => {
    const impactLevel = getStateImpact(stateCode);
    return IMPACT_COLORS[impactLevel as keyof typeof IMPACT_COLORS] || IMPACT_COLORS.none;
  };
  
  useEffect(() => {
    if (legislationId) {
      loadImpactData();
      setSelectedStateId(null);
    }
  }, [legislationId]);
  
  // Function to handle state clicks
  const handleStateClick = (geo: any) => {
    const stateCode = geo.properties.ISO_3166_2;
    const stateName = geo.properties.name;
    
    if (stateCode) {
      setSelectedStateId(stateCode);
      onStateSelect(stateCode, stateName);
      
      toast({
        title: "State Selected",
        description: `Showing impact analysis for ${stateName}`,
      });
    }
  };
  
  // Function to retry fetching impact data
  const handleRetry = () => {
    setError(null);
    loadImpactData();
  };
  
  const renderLoadingState = () => {
    return (
      <div className="p-6 text-center">
        <Loader2 className="h-8 w-8 animate-spin mx-auto mb-2" />
        <p className="font-medium text-primary">Loading Impact Data</p>
        <p className="text-sm text-muted-foreground mt-1">
          Analyzing legislation impact across states...
        </p>
      </div>
    );
  };
  
  const renderErrorState = () => {
    return (
      <div className="p-6 text-center">
        <div className="flex items-center justify-center text-destructive mb-2">
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
            <line x1="12" y1="9" x2="12" y2="13"/>
            <line x1="12" y1="17" x2="12.01" y2="17"/>
          </svg>
        </div>
        <p className="font-medium text-destructive mb-2">{error}</p>
        <Button onClick={handleRetry} variant="outline">
          Retry
        </Button>
      </div>
    );
  };
  
  return (
    <div className="space-y-4">
      <div className="bg-muted rounded-md p-4">
        <div className="flex justify-between items-center mb-2">
          <h3 className="font-medium">Impact Map</h3>
          {loading && <Loader2 className="h-4 w-4 animate-spin" />}
        </div>
        
        <div className="h-[400px] bg-background rounded-md border relative">
          {error ? (
            renderErrorState()
          ) : loading ? (
            renderLoadingState()
          ) : (
            <>
              <ComposableMap 
                projection="geoAlbersUsa"
                projectionConfig={{ scale: 1000, center: [0, 0] }}
                className="w-full h-full"
                width={800}
                height={400}
              >
                <ZoomableGroup>
                  <Geographies geography={usaStates}>
                    {({ geographies }) =>
                      geographies.map(geo => {
                        const stateCode = geo.properties.ISO_3166_2;
                        const stateName = geo.properties.name;
                        const isSelected = selectedStateId === stateCode;
                        return (
                          <Geography
                            key={geo.rsmKey}
                            geography={geo}
                            onClick={() => handleStateClick(geo)}
                            onMouseEnter={() => {
                              setHoveredState({
                                code: stateCode,
                                name: stateName,
                                impact: getStateImpact(stateCode)
                              });
                            }}
                            onMouseLeave={() => {
                              setHoveredState(null);
                            }}
                            style={{
                              default: {
                                fill: getStateFillColor(stateCode),
                                stroke: "#FFFFFF",
                                strokeWidth: 0.5,
                                outline: "none"
                              },
                              hover: {
                                fill: getStateFillColor(stateCode),
                                stroke: "#FFFFFF",
                                strokeWidth: 1,
                                outline: "none",
                                opacity: 0.9
                              },
                              pressed: {
                                fill: getStateFillColor(stateCode),
                                stroke: "#FFFFFF",
                                strokeWidth: 2,
                                outline: "none"
                              }
                            }}
                            className={`cursor-pointer ${isSelected ? 'stroke-2 stroke-white' : ''}`}
                          />
                        );
                      })
                    }
                  </Geographies>
                </ZoomableGroup>
              </ComposableMap>
              
              {!legislationId && (
                <div className="absolute inset-0 flex items-center justify-center bg-background/80">
                  <p className="text-center text-muted-foreground">
                    Select legislation to view impact data
                  </p>
                </div>
              )}
              
              {hoveredState && (
                <div 
                  className="absolute pointer-events-none bg-white px-3 py-2 rounded shadow-md border text-xs z-10"
                  style={{ 
                    left: '50%', 
                    top: '10px',
                    transform: 'translateX(-50%)' 
                  }}
                >
                  <p className="font-semibold">{hoveredState.name} ({hoveredState.code})</p>
                  {hoveredState.impact && (
                    <div className="flex items-center gap-1 mt-1">
                      <div 
                        className="w-3 h-3 rounded-full" 
                        style={{ backgroundColor: IMPACT_COLORS[hoveredState.impact as keyof typeof IMPACT_COLORS] || IMPACT_COLORS.none }}
                      />
                      <span className="capitalize">{hoveredState.impact} impact</span>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
          
          <div className="absolute top-2 left-2 z-10">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="bg-white p-1.5 rounded-full shadow-md cursor-help">
                    <Info className="h-4 w-4 text-muted-foreground" />
                  </div>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="max-w-[300px]">
                  <p>Click on a state to view detailed impact analysis. States are colored by impact level.</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        </div>
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
        <div>
          <h3 className="text-sm font-medium mb-2">Quick Access States</h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2">
            {["CA", "TX", "NY", "FL", "IL"].map((code) => (
              <Button 
                key={code}
                variant="outline" 
                size="sm"
                onClick={() => onStateSelect(code, getStateName(code))}
                className={selectedStateId === code ? "border-primary bg-primary/10" : ""}
              >
                {code}
              </Button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

// Function to get state name from state code
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

export default memo(ImpactMap);
