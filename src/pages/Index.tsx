
import React, { useState } from 'react';
import Header from '@/components/Header';
import InputSection from '@/components/InputSection';
import SummarySection from '@/components/SummarySection';
import ChatSection from '@/components/ChatSection';
import Footer from '@/components/Footer';
import { Card, CardContent } from "@/components/ui/card";

const Index = () => {
  const [policyContent, setPolicyContent] = useState<string>('');
  const [contentSource, setContentSource] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [documentId, setDocumentId] = useState<string | undefined>();
  const [conversationId, setConversationId] = useState<string | undefined>();

  const handleProcessContent = (
    content: string, 
    source: string, 
    docId?: string,
    convId?: string
  ) => {
    setIsProcessing(true);
    
    // Store the content and IDs
    setPolicyContent(content);
    setContentSource(source);
    if (docId) setDocumentId(docId);
    if (convId) setConversationId(convId);
    
    setIsProcessing(false);
    setShowResults(true);
  };

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <Header />
      
      <main className="flex-1 container mx-auto py-8 px-4">
        {!showResults ? (
          <div className="max-w-3xl mx-auto">
            <div className="text-center mb-8">
              <h1 className="text-4xl font-bold text-primary mb-4">
                Policy Whisperer AI
              </h1>
              <p className="text-lg text-gray-600 mb-6">
                Translating dense policy documents into clear, personalized insights you can understand and act on.
              </p>
            </div>
            
            <InputSection 
              onProcess={handleProcessContent} 
              isProcessing={isProcessing} 
            />
            
            <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-6">
              <Card className="text-center p-4">
                <CardContent className="pt-4">
                  <h3 className="font-semibold text-primary mb-2">Clear Explanations</h3>
                  <p className="text-sm text-gray-600">
                    Transform complex legal language into plain English everyone can understand.
                  </p>
                </CardContent>
              </Card>
              
              <Card className="text-center p-4">
                <CardContent className="pt-4">
                  <h3 className="font-semibold text-primary mb-2">Personalized Impact</h3>
                  <p className="text-sm text-gray-600">
                    See how policies affect you, your family, and your community specifically.
                  </p>
                </CardContent>
              </Card>
              
              <Card className="text-center p-4">
                <CardContent className="pt-4">
                  <h3 className="font-semibold text-primary mb-2">Interactive Exploration</h3>
                  <p className="text-sm text-gray-600">
                    Ask questions and dive deeper into any aspect of the policy that interests you.
                  </p>
                </CardContent>
              </Card>
            </div>
          </div>
        ) : (
          <div className="max-w-5xl mx-auto">
            <h2 className="text-2xl font-bold text-primary mb-6">
              Your Policy Analysis
            </h2>
            
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
              <SummarySection 
                policyContent={policyContent}
                source={contentSource}
                documentId={documentId}
              />
              
              <ChatSection 
                policyContent={policyContent}
                conversationId={conversationId}
              />
            </div>
            
            <div className="flex justify-center mt-8">
              <button
                onClick={() => {
                  setShowResults(false);
                  setPolicyContent('');
                  setContentSource('');
                  setDocumentId(undefined);
                  setConversationId(undefined);
                }}
                className="text-primary hover:text-primary-dark underline"
              >
                Analyze another document
              </button>
            </div>
          </div>
        )}
      </main>
      
      <Footer />
    </div>
  );
};

export default Index;
