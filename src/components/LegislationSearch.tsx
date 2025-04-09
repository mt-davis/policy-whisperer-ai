
import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";

interface LegislationSearchProps {
  onLegislationSelect: (legislation: any) => void;
}

const LegislationSearch: React.FC<LegislationSearchProps> = ({ 
  onLegislationSelect
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      toast({
        title: "Search query required",
        description: "Please enter a search term to find legislation.",
        variant: "destructive"
      });
      return;
    }

    setIsLoading(true);
    try {
      // Search legislation by title (case insensitive)
      const { data, error } = await supabase
        .from('legislation')
        .select('*')
        .ilike('title', `%${searchQuery}%`)
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      setSearchResults(data || []);
      
      if (data.length === 0) {
        toast({
          title: "No results found",
          description: "Try a different search term or try adding legislation first.",
          variant: "default"
        });
      }
    } catch (error) {
      console.error('Error searching legislation:', error);
      toast({
        title: "Error searching legislation",
        description: "An error occurred while searching. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center space-x-2">
        <Input
          placeholder="Search for legislation by title..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
          className="flex-1"
        />
        <Button onClick={handleSearch} disabled={isLoading}>
          {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Search"}
        </Button>
      </div>

      {searchResults.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-medium">Search Results</h3>
          <div className="border rounded-md divide-y">
            {searchResults.map((legislation) => (
              <div 
                key={legislation.id} 
                className="p-3 hover:bg-muted cursor-pointer transition-colors"
                onClick={() => onLegislationSelect(legislation)}
              >
                <h4 className="font-medium">{legislation.title}</h4>
                <p className="text-sm text-muted-foreground">
                  {legislation.level.charAt(0).toUpperCase() + legislation.level.slice(1)} 
                  {legislation.state ? ` • ${legislation.state}` : ''}
                </p>
                {legislation.description && (
                  <p className="text-sm mt-1 line-clamp-2">{legislation.description}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default LegislationSearch;
