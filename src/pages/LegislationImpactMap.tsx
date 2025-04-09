
import React, { useState } from 'react';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { Button } from "@/components/ui/button";
import { PlusCircle } from "lucide-react";
import LegislationSearch from '@/components/LegislationSearch';
import LegislationForm from '@/components/LegislationForm';
import ImpactMap from '@/components/ImpactMap';
import ImpactDetails from '@/components/ImpactDetails';

const LegislationImpactMap = () => {
  const [selectedLegislation, setSelectedLegislation] = useState<any | null>(null);
  const [selectedState, setSelectedState] = useState<{ code: string; name: string } | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  
  const handleStateSelect = (stateCode: string, stateName: string) => {
    setSelectedState({ code: stateCode, name: stateName });
  };
  
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
          
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-1 space-y-6">
              <div className="bg-white p-4 rounded-lg shadow">
                <h2 className="text-xl font-semibold mb-4">Find Legislation</h2>
                <LegislationSearch 
                  onLegislationSelect={(legislation) => {
                    setSelectedLegislation(legislation);
                    setSelectedState(null);
                  }}
                />
              </div>
              
              {selectedLegislation && (
                <div className="bg-white p-4 rounded-lg shadow">
                  <h2 className="text-xl font-semibold mb-2">
                    {selectedLegislation.title}
                  </h2>
                  <p className="text-sm text-muted-foreground mb-2">
                    {selectedLegislation.level.charAt(0).toUpperCase() + selectedLegislation.level.slice(1)} 
                    {selectedLegislation.state ? ` • ${selectedLegislation.state}` : ''}
                  </p>
                  {selectedLegislation.description && (
                    <p className="text-sm mb-4">
                      {selectedLegislation.description}
                    </p>
                  )}
                  {selectedLegislation.source_url && (
                    <div className="mt-2">
                      <a 
                        href={selectedLegislation.source_url} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-sm text-primary hover:underline"
                      >
                        View Source
                      </a>
                    </div>
                  )}
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
