
import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

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
          .single();
        
        if (impactError && impactError.code !== 'PGRST116') { // Not found is ok
          throw impactError;
        }
        
        if (existingImpact) {
          setImpactData(existingImpact);
          return;
        }
        
        // Generate impact data for this state
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
          .single();
        
        if (newImpactError) throw newImpactError;
        setImpactData(newImpact);
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
      }
    };
    
    fetchImpactDetails();
  }, [legislationId, stateCode]);
  
  if (!legislationId || !stateCode) {
    return (
      <Card>
        <CardContent className="p-6 text-center text-muted-foreground">
          Select a state to view detailed impact analysis
        </CardContent>
      </Card>
    );
  }
  
  // Get impact level color
  const getImpactColor = (level: string): string => {
    switch (level?.toLowerCase()) {
      case 'high': return 'text-red-500';
      case 'medium': return 'text-orange-500';
      case 'low': return 'text-yellow-500';
      case 'neutral': return 'text-blue-500';
      default: return 'text-gray-500';
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
        {error ? (
          <div className="text-destructive p-4 text-center">
            <p>{error}</p>
          </div>
        ) : loading ? (
          <div className="p-6 text-center">
            <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">
              Analyzing impact for {getStateName(stateCode)}...
            </p>
          </div>
        ) : impactData ? (
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
              <div>
                <h4 className="text-sm font-medium text-muted-foreground mb-1">
                  Impact Level
                </h4>
                <p className={`font-semibold ${getImpactColor(impactData.impact_level)}`}>
                  {impactData.impact_level.toUpperCase()}
                </p>
              </div>
              
              <div>
                <h4 className="text-sm font-medium text-muted-foreground mb-1">
                  Summary
                </h4>
                <p>{impactData.summary}</p>
              </div>
              
              <div>
                <h4 className="text-sm font-medium text-muted-foreground mb-1">
                  Detailed Analysis
                </h4>
                <div className="prose prose-sm max-w-none">
                  <p>{impactData.details}</p>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="p-6 text-center text-muted-foreground">
            No impact data available for this state yet.
            Select a state to generate an impact analysis.
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default ImpactDetails;
