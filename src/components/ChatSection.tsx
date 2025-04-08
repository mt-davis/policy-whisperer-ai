
import React, { useState, useEffect, useRef } from 'react';
import { Send, Loader2 } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";

interface Message {
  id: number;
  text: string;
  sender: 'user' | 'ai';
  timestamp: Date;
}

interface ChatSectionProps {
  policyContent: string;
}

const ChatSection: React.FC<ChatSectionProps> = ({ policyContent }) => {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 1,
      text: "I've analyzed the policy document. What questions do you have about it?",
      sender: 'ai',
      timestamp: new Date()
    }
  ]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Sample AI responses based on user queries
  const getAIResponse = (userMessage: string): string => {
    const normalizedMessage = userMessage.toLowerCase();
    
    // In a real app, we would integrate with an actual AI model
    // For now, we'll use some pre-defined responses
    if (normalizedMessage.includes('impact') && normalizedMessage.includes('local')) {
      return "Based on my analysis, this policy would likely impact your local area in several ways. Local businesses may need to adapt to new reporting requirements, but could also benefit from the $2 billion infrastructure investment, particularly if they're in the construction or renewable energy sectors.";
    } else if (normalizedMessage.includes('timeline') || normalizedMessage.includes('when')) {
      return "The policy implementation is staggered: carbon tax begins in January 2023, reporting requirements start in July 2023, and the infrastructure projects will be awarded through a competitive process over the next 3 years.";
    } else if (normalizedMessage.includes('cost') || normalizedMessage.includes('expense')) {
      return "For the average household, this policy may increase energy costs by approximately $150-300 per year initially. However, the tax rebate program should offset this for households earning under $75,000 annually. For businesses, costs will vary significantly based on energy usage and emissions levels.";
    } else if (normalizedMessage.includes('benefit') || normalizedMessage.includes('advantage')) {
      return "The primary benefits include improved air quality, estimated creation of 5,000 new jobs in green sectors, and long-term energy cost stability. Additionally, the policy includes provisions for workforce development programs to help workers transition from fossil fuel industries.";
    } else {
      return "That's an interesting question about the policy. Based on my analysis, the policy aims to balance economic growth with environmental protection through a mix of incentives and regulations. Could you specify which aspect you'd like me to elaborate on?";
    }
  };

  const handleSendMessage = () => {
    if (!input.trim()) return;
    
    // Add user message
    const userMessage: Message = {
      id: messages.length + 1,
      text: input,
      sender: 'user',
      timestamp: new Date()
    };
    
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsTyping(true);
    
    // Simulate AI thinking and responding
    setTimeout(() => {
      const aiResponse: Message = {
        id: messages.length + 2,
        text: getAIResponse(input),
        sender: 'ai',
        timestamp: new Date()
      };
      
      setMessages(prev => [...prev, aiResponse]);
      setIsTyping(false);
    }, 1500);
  };

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  return (
    <Card className="w-full h-[600px] flex flex-col">
      <CardHeader>
        <CardTitle className="text-primary">Ask About This Policy</CardTitle>
      </CardHeader>
      <CardContent className="flex-1 flex flex-col">
        <ScrollArea className="flex-1 px-1 mb-4">
          <div className="space-y-4">
            {messages.map(message => (
              <div
                key={message.id}
                className={message.sender === 'user' ? 'user-bubble' : 'ai-bubble'}
              >
                {message.text}
              </div>
            ))}
            
            {isTyping && (
              <div className="ai-bubble typing-indicator">
                <span></span>
                <span></span>
                <span></span>
              </div>
            )}
            
            <div ref={messagesEndRef} />
          </div>
        </ScrollArea>
        
        <div className="flex gap-2">
          <Input
            placeholder="Ask a question about this policy..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
          />
          <Button onClick={handleSendMessage} disabled={isTyping || !input.trim()}>
            {isTyping ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default ChatSection;
