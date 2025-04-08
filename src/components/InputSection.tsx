import React, { useState } from 'react';
import { Upload, Link, FileText, Loader2 } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface InputSectionProps {
  onProcess: (text: string, source: string, documentId?: string, conversationId?: string) => void;
  isProcessing: boolean;
}

const InputSection: React.FC<InputSectionProps> = ({ onProcess, isProcessing }) => {
  const [url, setUrl] = useState('');
  const [text, setText] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [isFetchingUrl, setIsFetchingUrl] = useState(false);
  const { toast } = useToast();

  const fetchContentFromUrl = async (urlToFetch: string) => {
    setIsFetchingUrl(true);
    try {
      const { data, error } = await supabase.functions.invoke('fetch-url-content', {
        body: { url: urlToFetch }
      });
      
      if (error) {
        throw error;
      }
      
      if (!data.content || data.content.trim().length < 10) {
        throw new Error('Could not extract meaningful content from the URL');
      }
      
      return data.content;
    } catch (error) {
      console.error('Error fetching URL:', error);
      throw error;
    } finally {
      setIsFetchingUrl(false);
    }
  };

  const processContent = async (content: string, sourceType: string, sourceReference?: string) => {
    try {
      const sanitizedContent = content
        .replace(/\u0000/g, '') // Remove null bytes
        .replace(/[\uD800-\uDBFF][\uDC00-\uDFFF]|[^\x00-\x7F]/g, char => {
          try {
            return encodeURIComponent(char);
          } catch (e) {
            return '';
          }
        });

      const { data, error } = await supabase.functions.invoke('process-policy-document', {
        body: { 
          content: sanitizedContent,
          sourceType,
          sourceReference: sourceReference || '',
          title: sourceType === 'url' ? sourceReference : 
                 sourceType === 'file' ? file?.name || 'Uploaded Document' : 
                 'Pasted Text Document'
        }
      });

      if (error) {
        console.error('Function error:', error);
        throw error;
      }

      onProcess(
        content, 
        sourceType, 
        data.document.id, 
        data.conversation.id
      );
      
      toast({
        title: "Success",
        description: "Document has been processed successfully",
      });
    } catch (error) {
      console.error('Error processing document:', error);
      toast({
        title: "Error",
        description: "Failed to process document. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleUrlSubmit = async () => {
    if (!url.trim()) {
      toast({
        title: "Error",
        description: "Please enter a valid URL",
        variant: "destructive",
      });
      return;
    }
    
    try {
      let urlToFetch = url;
      if (!/^https?:\/\//i.test(url)) {
        urlToFetch = 'https://' + url;
      }
      
      const content = await fetchContentFromUrl(urlToFetch);
      await processContent(content, 'url', urlToFetch);
    } catch (error) {
      console.error('Error processing URL:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to process URL content",
        variant: "destructive",
      });
    }
  };

  const handleTextSubmit = async () => {
    if (!text.trim()) {
      toast({
        title: "Error",
        description: "Please enter some text to analyze",
        variant: "destructive",
      });
      return;
    }
    
    await processContent(text, 'text');
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
    }
  };

  const handleFileSubmit = async () => {
    if (!file) {
      toast({
        title: "Error",
        description: "Please select a file to upload",
        variant: "destructive",
      });
      return;
    }

    try {
      if (file.type.includes('text') || 
        file.name.endsWith('.txt') || 
        file.name.endsWith('.md')) {
        const fileContent = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = (e) => {
            if (e.target?.result) {
              resolve(e.target.result as string);
            } else {
              reject(new Error('Failed to read file'));
            }
          };
          reader.onerror = reject;
          reader.readAsText(file);
        });
        
        await processContent(fileContent, 'file', file.name);
      } else {
        toast({
          title: "File type not supported",
          description: "Currently only text files (.txt) are supported",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('Error reading file:', error);
      toast({
        title: "Error",
        description: "Failed to read file content",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="bg-white p-6 rounded-lg shadow-md">
      <h2 className="text-2xl font-bold text-primary mb-4">
        Import Policy Documents
      </h2>
      
      <Tabs defaultValue="url" className="w-full">
        <TabsList className="grid grid-cols-3 mb-4">
          <TabsTrigger value="url" className="flex items-center gap-2">
            <Link className="h-4 w-4" />
            URL
          </TabsTrigger>
          <TabsTrigger value="upload" className="flex items-center gap-2">
            <Upload className="h-4 w-4" />
            Upload
          </TabsTrigger>
          <TabsTrigger value="paste" className="flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Copy-Paste
          </TabsTrigger>
        </TabsList>
        
        <TabsContent value="url" className="space-y-4">
          <div>
            <label htmlFor="url-input" className="block text-sm font-medium text-gray-700 mb-1">
              Enter a URL to a policy document or article
            </label>
            <Input
              id="url-input"
              placeholder="https://www.example.gov/policy-document"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              className="mb-4"
            />
          </div>
          <Button onClick={handleUrlSubmit} disabled={isProcessing || isFetchingUrl} className="w-full">
            {isProcessing || isFetchingUrl ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {isFetchingUrl ? "Fetching URL..." : "Processing..."}
              </>
            ) : (
              "Analyze Document"
            )}
          </Button>
        </TabsContent>
        
        <TabsContent value="upload" className="space-y-4">
          <div>
            <label htmlFor="file-input" className="block text-sm font-medium text-gray-700 mb-1">
              Upload a policy document (PDF, DOCX, TXT)
            </label>
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
              <input
                id="file-input"
                type="file"
                accept=".pdf,.docx,.txt"
                onChange={handleFileChange}
                className="hidden"
              />
              <label htmlFor="file-input" className="cursor-pointer">
                <Upload className="h-8 w-8 mx-auto mb-2 text-gray-500" />
                <p className="text-sm text-gray-500 mb-2">Click to browse or drag and drop</p>
                <p className="text-xs text-gray-400">Supported formats: PDF, DOCX, TXT</p>
              </label>
              {file && (
                <div className="mt-4 p-2 bg-blue-50 rounded text-sm">
                  Selected: {file.name}
                </div>
              )}
            </div>
          </div>
          <Button onClick={handleFileSubmit} disabled={isProcessing} className="w-full">
            {isProcessing ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Processing...
              </>
            ) : (
              "Upload & Analyze"
            )}
          </Button>
        </TabsContent>
        
        <TabsContent value="paste" className="space-y-4">
          <div>
            <label htmlFor="text-input" className="block text-sm font-medium text-gray-700 mb-1">
              Paste text from a policy document
            </label>
            <Textarea
              id="text-input"
              placeholder="Paste the policy text here..."
              value={text}
              onChange={(e) => setText(e.target.value)}
              className="h-40 mb-4"
            />
          </div>
          <Button onClick={handleTextSubmit} disabled={isProcessing} className="w-full">
            {isProcessing ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Processing...
              </>
            ) : (
              "Analyze Text"
            )}
          </Button>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default InputSection;
