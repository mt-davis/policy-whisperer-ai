
import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, AlertTriangle, Info } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

interface ImpactDetailsProps {
  legislationId: string | null;
  stateCode: string | null;
}

const ImpactDetails: React.FC<ImpactDetailsProps> = ({ 
  legislationId, 
  stateCode 
}) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [impactData, setImpactData] = useState<any | null>(null);
  const [legislation, setLegislation] = useState<any | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  
  // Get impact details for the selected state
  useEffect(() => {
    const fetchImpactDetails = async () => {
      if (!legislationId || !stateCode) {
        setImpactData(null);
        return;
      }
      
      setLoading(true);
      setError(null);
      
      try {
        // First get legislation details
        const { data: legData, error: legError } = await supabase
          .from('legislation')
          .select('*')
          .eq('id', legislationId)
          .single();
        
        if (legError) throw legError;
        setLegislation(legData);
        
        // Check if we have existing impact data
        const { data: existingImpact, error: impactError } = await supabase
          .from('legislation_impact')
          .select('*')
          .eq('legislation_id', legislationId)
          .eq('state_code', stateCode)
          .maybeSingle();
        
        if (impactError) {
          console.error('Error fetching impact data:', impactError);
          // Continue with generation if we don't have data
        }
        
        if (existingImpact) {
          setImpactData(existingImpact);
          return;
        }
        
        // Generate impact data for this state
        setIsGenerating(true);
        toast({
          title: "Analyzing Impact",
          description: `Generating impact analysis for ${getStateName(stateCode)}. This may take a moment.`,
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
              stateCode,
              storeResults: true
            }),
          }
        );
        
        if (!response.ok) {
          throw new Error(`Error analyzing impact: ${response.statusText}`);
        }
        
        const data = await response.json();
        
        if (data.error) {
          throw new Error(data.error);
        }
        
        // Fetch the newly stored impact data
        const { data: newImpact, error: newImpactError } = await supabase
          .from('legislation_impact')
          .select('*')
          .eq('legislation_id', legislationId)
          .eq('state_code', stateCode)
          .maybeSingle();
        
        if (newImpactError) throw newImpactError;
        
        if (newImpact) {
          setImpactData(newImpact);
          toast({
            title: "Analysis Complete",
            description: `Impact analysis for ${getStateName(stateCode)} is ready.`,
          });
        } else {
          throw new Error('Failed to generate impact data');
        }
      } catch (err: any) {
        console.error('Error fetching impact details:', err);
        setError(err.message || 'Failed to load impact details');
        toast({
          title: "Error",
          description: err.message || 'Failed to load impact details',
          variant: "destructive"
        });
      } finally {
        setLoading(false);
        setIsGenerating(false);
      }
    };
    
    fetchImpactDetails();
  }, [legislationId, stateCode]);
  
  if (!legislationId || !stateCode) {
    return (
      <Card>
        <CardContent className="p-6 text-center text-muted-foreground">
          <Info className="h-8 w-8 mx-auto mb-2 opacity-50" />
          <p>Select a state on the map to view detailed impact analysis</p>
        </CardContent>
      </Card>
    );
  }
  
  // Get impact level color
  const getImpactColor = (level: string): string => {
    switch (level?.toLowerCase()) {
      case 'high': return 'text-red-500 border-red-500';
      case 'medium': return 'text-orange-500 border-orange-500';
      case 'low': return 'text-yellow-500 border-yellow-500';
      case 'neutral': return 'text-blue-500 border-blue-500';
      default: return 'text-gray-500 border-gray-500';
    }
  };
  
  // Get state name from code
  const getStateName = (code: string): string => {
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
    
    return stateMap[code] || code;
  };
  
  // Function to retry fetching impact data
  const handleRetry = () => {
    if (legislationId && stateCode) {
      setError(null);
      setImpactData(null);
      // This will trigger the useEffect to run again
    }
  };
  
  const renderLoadingState = () => {
    return (
      <div className="p-6 text-center">
        <Loader2 className="h-8 w-8 animate-spin mx-auto mb-2" />
        <p className="font-medium text-primary">
          {isGenerating ? 'Generating Analysis' : 'Loading Analysis'}
        </p>
        <p className="text-sm text-muted-foreground mt-1">
          {isGenerating
            ? `AI is analyzing the impact of this legislation on ${getStateName(stateCode)}...`
            : `Loading impact data for ${getStateName(stateCode)}...`
          }
        </p>
      </div>
    );
  };
  
  const renderErrorState = () => {
    return (
      <div className="p-6 text-center">
        <AlertTriangle className="h-8 w-8 text-destructive mx-auto mb-2" />
        <p className="font-medium text-destructive mb-2">{error}</p>
        <Button onClick={handleRetry} variant="outline">
          Retry Analysis
        </Button>
      </div>
    );
  };
  
  const renderEmptyState = () => {
    return (
      <div className="p-6 text-center">
        <Info className="h-8 w-8 mx-auto mb-2 opacity-50" />
        <p className="mb-2">No impact data available for {getStateName(stateCode)} yet.</p>
        <Button onClick={handleRetry}>
          Generate Analysis
        </Button>
      </div>
    );
  };
  
  const renderImpactData = () => {
    return (
      <div className="space-y-4">
        {legislation && (
          <div className="mb-4">
            <h3 className="font-medium text-sm text-muted-foreground">
              {legislation.level.charAt(0).toUpperCase() + legislation.level.slice(1)} Legislation
            </h3>
            <h2 className="text-xl font-semibold">{legislation.title}</h2>
          </div>
        )}
        
        <div className="space-y-4">
          <div className="flex justify-between items-start">
            <div>
              <h4 className="text-sm font-medium text-muted-foreground mb-1">
                Impact Level
              </h4>
              <div className={`inline-flex items-center px-3 py-1 rounded-full border ${getImpactColor(impactData.impact_level)}`}>
                <span className="font-semibold uppercase">{impactData.impact_level}</span>
              </div>
            </div>
            
            <div className="text-right">
              <p className="text-xs text-muted-foreground">
                Last updated: {new Date(impactData.updated_at).toLocaleDateString()}
              </p>
              <Button 
                variant="ghost" 
                size="sm" 
                className="text-xs h-6 px-2 mt-1" 
                onClick={handleRetry}
              >
                Refresh
              </Button>
            </div>
          </div>
          
          <div>
            <h4 className="text-sm font-medium text-muted-foreground mb-1">
              Summary
            </h4>
            <p className="border-l-2 pl-4 py-1 border-primary/20 text-primary/90">{impactData.summary}</p>
          </div>
          
          <Collapsible className="w-full">
            <div className="flex justify-between items-center">
              <h4 className="text-sm font-medium text-muted-foreground">
                Detailed Analysis
              </h4>
              <CollapsibleTrigger asChild>
                <Button variant="ghost" size="sm" className="p-0 h-6 w-6">
                  <Info className="h-4 w-4" />
                  <span className="sr-only">Toggle details</span>
                </Button>
              </CollapsibleTrigger>
            </div>
            
            <CollapsibleContent className="mt-2">
              <div className="rounded-md bg-muted/50 p-4 text-sm">
                <div className="prose prose-sm max-w-none">
                  <p>{impactData.details}</p>
                </div>
              </div>
            </CollapsibleContent>
          </Collapsible>
        </div>
      </div>
    );
  };
  
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>
            Impact on {getStateName(stateCode)}
          </span>
          {loading && <Loader2 className="h-4 w-4 animate-spin" />}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {error ? renderErrorState() : 
         loading ? renderLoadingState() : 
         impactData ? renderImpactData() : 
         renderEmptyState()}
      </CardContent>
    </Card>
  );
};

export default ImpactDetails;
