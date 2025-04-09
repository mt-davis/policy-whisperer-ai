
import React, { useState, useEffect } from 'react';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { Button } from "@/components/ui/button";
import { PlusCircle, MapPin, RefreshCw, Map, Info } from "lucide-react";
import LegislationSearch from '@/components/LegislationSearch';
import LegislationForm from '@/components/LegislationForm';
import ImpactMap from '@/components/ImpactMap';
import ImpactDetails from '@/components/ImpactDetails';
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { Card, CardContent } from "@/components/ui/card";

const LegislationImpactMap = () => {
  const [selectedLegislation, setSelectedLegislation] = useState<any | null>(null);
  const [selectedState, setSelectedState] = useState<{ code: string; name: string } | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  
  // Fetch full legislation details when selection changes
  useEffect(() => {
    const fetchLegislationDetails = async () => {
      if (!selectedLegislation?.id) return;
      
      setIsLoading(true);
      try {
        const { data, error } = await supabase
          .from('legislation')
          .select('*')
          .eq('id', selectedLegislation.id)
          .single();
        
        if (error) throw error;
        
        if (data) {
          setSelectedLegislation(prev => ({
            ...prev,
            ...data
          }));
        }
      } catch (err) {
        console.error('Error fetching legislation details:', err);
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchLegislationDetails();
  }, [selectedLegislation?.id]);
  
  const handleStateSelect = (stateCode: string, stateName: string) => {
    setSelectedState({ code: stateCode, name: stateName });
    toast({
      title: "State Selected",
      description: `Showing impact information for ${stateName}`,
    });
  };
  
  const handleLegislationSelect = (legislation: any) => {
    setSelectedLegislation(legislation);
    setSelectedState(null);
    toast({
      title: "Legislation Selected",
      description: `Analyzing impact of "${legislation.title}"`,
    });
  };
  
  const resetSelection = () => {
    setSelectedState(null);
  };
  
  const showInstructions = !selectedLegislation && !selectedState;
  
  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <Header />
      
      <main className="flex-1 container mx-auto py-8 px-4">
        <div className="max-w-7xl mx-auto">
          <div className="flex justify-between items-center mb-6">
            <h1 className="text-3xl font-bold text-primary">
              Legislation Impact Map
            </h1>
            <Button onClick={() => setFormOpen(true)} className="flex items-center gap-1">
              <PlusCircle className="h-4 w-4" />
              Add Legislation
            </Button>
          </div>
          
          {showInstructions && (
            <Card className="mb-6 bg-blue-50 border-blue-200">
              <CardContent className="p-4 flex items-start gap-3">
                <Info className="h-5 w-5 text-blue-500 mt-0.5 flex-shrink-0" />
                <div>
                  <h3 className="font-medium text-blue-700">How to use this tool</h3>
                  <p className="text-sm text-blue-600">
                    1. Search for legislation using the search box on the left<br />
                    2. Click on a state in the map to see the impact analysis<br />
                    3. Use the quick access buttons to view popular states
                  </p>
                </div>
              </CardContent>
            </Card>
          )}
          
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-1 space-y-6">
              <div className="bg-white p-4 rounded-lg shadow">
                <h2 className="text-xl font-semibold mb-4">Find Legislation</h2>
                <LegislationSearch 
                  onLegislationSelect={handleLegislationSelect}
                />
              </div>
              
              {selectedLegislation && (
                <div className="bg-white p-4 rounded-lg shadow">
                  <h2 className="text-xl font-semibold mb-2">
                    {selectedLegislation.title}
                  </h2>
                  <p className="text-sm text-muted-foreground mb-2 flex items-center gap-1">
                    {selectedLegislation.level.charAt(0).toUpperCase() + selectedLegislation.level.slice(1)} 
                    {selectedLegislation.state && (
                      <>
                        <span className="mx-1">•</span>
                        <MapPin className="h-3 w-3" />
                        {selectedLegislation.state}
                      </>
                    )}
                  </p>
                  
                  {selectedLegislation.status && (
                    <div className="mb-2">
                      <span className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-primary/10 text-primary">
                        Status: {selectedLegislation.status}
                      </span>
                    </div>
                  )}
                  
                  {selectedLegislation.description && (
                    <p className="text-sm mb-4">
                      {selectedLegislation.description}
                    </p>
                  )}
                  
                  <div className="flex flex-wrap gap-2 mt-3">
                    {selectedLegislation.source_url && (
                      <a 
                        href={selectedLegislation.source_url} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-sm text-primary hover:underline inline-flex items-center gap-1"
                      >
                        <Map className="h-3 w-3" />
                        View Source
                      </a>
                    )}
                    
                    {selectedState && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2 text-xs"
                        onClick={resetSelection}
                      >
                        <RefreshCw className="h-3 w-3 mr-1" />
                        Reset Selection
                      </Button>
                    )}
                  </div>
                </div>
              )}
            </div>
            
            <div className="lg:col-span-2 space-y-6">
              <div className="bg-white p-4 rounded-lg shadow">
                <ImpactMap 
                  legislationId={selectedLegislation?.id || null} 
                  onStateSelect={handleStateSelect} 
                />
              </div>
              
              <div className="bg-white rounded-lg shadow">
                <ImpactDetails 
                  legislationId={selectedLegislation?.id || null}
                  stateCode={selectedState?.code || null}
                />
              </div>
            </div>
          </div>
        </div>
      </main>
      
      <Footer />
      
      <LegislationForm 
        open={formOpen} 
        onOpenChange={setFormOpen} 
        onSuccess={setSelectedLegislation}
      />
    </div>
  );
};

export default LegislationImpactMap;
