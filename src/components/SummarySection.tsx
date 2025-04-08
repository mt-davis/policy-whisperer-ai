
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FileText, Info, TrendingUp, Users } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface SummarySectionProps {
  policyContent?: string;
  source?: string;
  documentId?: string;
}

const SummarySection: React.FC<SummarySectionProps> = ({ policyContent, source, documentId }) => {
  const [document, setDocument] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  
  // Fetch document data if a documentId is provided
  useEffect(() => {
    if (documentId) {
      fetchDocument(documentId);
    }
  }, [documentId]);
  
  const fetchDocument = async (docId: string) => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('policy_documents')
        .select('*')
        .eq('id', docId)
        .single();
      
      if (error) throw error;
      setDocument(data);
    } catch (error) {
      console.error('Error fetching document:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // In a real app, we would process the policy content to generate these summaries
  // For now, we'll use placeholder content
  
  const keySummary = "This policy aims to reduce carbon emissions by 30% by 2030 through a combination of regulatory measures and incentives for renewable energy adoption.";
  
  const keyPoints = [
    "Establishes a carbon tax of $25 per ton starting in 2023",
    "Creates tax incentives for renewable energy investments",
    "Mandates emission reporting for companies with over 500 employees",
    "Allocates $2 billion for green infrastructure projects"
  ];
  
  const localImpact = "Based on regional economic indicators, this policy is likely to create 5,000 new jobs in the renewable energy sector while potentially impacting 1,200 jobs in traditional energy industries.";
  
  const demographicImpact = "Lower-income households may experience a 2-3% increase in energy costs in the short term, offset by tax rebates. Small businesses with high energy usage will be eligible for transition assistance programs.";

  const getSourceText = () => {
    if (document) {
      switch (document.source_type) {
        case 'url':
          return `Extracted from URL: ${document.source_reference}`;
        case 'file':
          return `Extracted from file: ${document.source_reference}`;
        case 'text':
          return "Analyzed from pasted text";
        default:
          return "Source: Unknown";
      }
    } else if (source) {
      switch (source) {
        case 'url':
          return "Extracted from provided URL";
        case 'file':
          return "Extracted from uploaded document";
        case 'text':
          return "Analyzed from pasted text";
        default:
          return "Source: Unknown";
      }
    } else {
      return "Source: Unknown";
    }
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="text-primary">Policy Analysis</CardTitle>
        <CardDescription>{getSourceText()}</CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="summary">
          <TabsList className="grid grid-cols-4 mb-4">
            <TabsTrigger value="summary" className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Summary
            </TabsTrigger>
            <TabsTrigger value="key-points" className="flex items-center gap-2">
              <Info className="h-4 w-4" />
              Key Points
            </TabsTrigger>
            <TabsTrigger value="local-impact" className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              Local Impact
            </TabsTrigger>
            <TabsTrigger value="demographic" className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              Demographics
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="summary">
            <div className="p-4 bg-gray-50 rounded-md">
              <h3 className="font-medium mb-2">Executive Summary</h3>
              <p>{keySummary}</p>
            </div>
          </TabsContent>
          
          <TabsContent value="key-points">
            <div className="p-4 bg-gray-50 rounded-md">
              <h3 className="font-medium mb-2">Key Policy Points</h3>
              <ul className="list-disc pl-5 space-y-2">
                {keyPoints.map((point, index) => (
                  <li key={index}>{point}</li>
                ))}
              </ul>
            </div>
          </TabsContent>
          
          <TabsContent value="local-impact">
            <div className="p-4 bg-gray-50 rounded-md">
              <h3 className="font-medium mb-2">Local Economic Impact</h3>
              <p>{localImpact}</p>
            </div>
          </TabsContent>
          
          <TabsContent value="demographic">
            <div className="p-4 bg-gray-50 rounded-md">
              <h3 className="font-medium mb-2">Demographic Considerations</h3>
              <p>{demographicImpact}</p>
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
};

export default SummarySection;
