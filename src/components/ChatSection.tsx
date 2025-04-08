
import React, { useState, useEffect, useRef } from 'react';
import { Send, Loader2 } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';
import DOMPurify from 'dompurify';

interface Message {
  id: string;
  text: string;
  sender: 'user' | 'ai';
  timestamp: Date;
  isHtml?: boolean;
}

interface ChatSectionProps {
  policyContent?: string;
  conversationId?: string;
}

type MessageRow = Database['public']['Tables']['messages']['Row'];

const ChatSection: React.FC<ChatSectionProps> = ({ policyContent, conversationId }) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [activeConversationId, setActiveConversationId] = useState<string | undefined>(conversationId);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (conversationId) {
      setActiveConversationId(conversationId);
      fetchMessages(conversationId);
    } else {
      setMessages([
        {
          id: '1',
          text: "I've analyzed the policy document. What questions do you have about it?",
          sender: 'ai',
          timestamp: new Date()
        }
      ]);
    }
  }, [conversationId]);

  const fetchMessages = async (convId: string) => {
    try {
      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .eq('conversation_id', convId)
        .order('created_at', { ascending: true });
      
      if (error) throw error;
      
      if (data && data.length > 0) {
        const formattedMessages: Message[] = data.map((msg: MessageRow) => ({
          id: msg.id,
          text: msg.content,
          sender: msg.sender as 'user' | 'ai',
          timestamp: new Date(msg.created_at),
          isHtml: msg.sender === 'ai' && (msg.content.includes('<p>') || msg.content.includes('<ul>'))
        }));
        setMessages(formattedMessages);
      } else {
        setMessages([
          {
            id: '1',
            text: "I've analyzed the policy document. What questions do you have about it?",
            sender: 'ai',
            timestamp: new Date()
          }
        ]);
      }
    } catch (error) {
      console.error('Error fetching messages:', error);
    }
  };

  const formatAIResponse = (text: string): string => {
    // Check if the text is already in HTML format
    if (text.includes('<p>') || text.includes('<ul>')) {
      return text;
    }
    
    // Simple formatting for plain text
    return `<p>${text.replace(/\n\n/g, '</p><p>').replace(/\n/g, '<br>')}</p>`;
  };

  const handleSendMessage = async () => {
    if (!input.trim()) return;
    
    const userMessage: Message = {
      id: `temp-${Date.now()}`,
      text: input,
      sender: 'user',
      timestamp: new Date()
    };
    
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsTyping(true);
    
    try {
      const { data, error } = await supabase.functions.invoke('generate-ai-response', {
        body: JSON.stringify({ 
          prompt: input, 
          policyContent, 
          conversationId: activeConversationId,
          formatAsHtml: true
        })
      });

      if (error) throw error;

      if (data.conversationId && !activeConversationId) {
        setActiveConversationId(data.conversationId);
      }

      if (activeConversationId) {
        await fetchMessages(activeConversationId);
      } else {
        const formattedResponse = formatAIResponse(data.response || "I'm sorry, I couldn't generate a response.");
        const aiResponse: Message = {
          id: `ai-${Date.now()}`,
          text: formattedResponse,
          sender: 'ai',
          timestamp: new Date(),
          isHtml: true
        };
        
        setMessages(prev => [...prev, aiResponse]);
      }
    } catch (error) {
      console.error('Error generating AI response:', error);
      const errorMessage: Message = {
        id: `error-${Date.now()}`,
        text: "Sorry, there was an error processing your request.",
        sender: 'ai',
        timestamp: new Date()
      };
      
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsTyping(false);
    }
  };

  useEffect(() => {
    // Scroll to the bottom when messages change
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  return (
    <Card className="w-full h-[600px] flex flex-col">
      <CardHeader className="pb-3">
        <CardTitle className="text-primary">Ask About This Policy</CardTitle>
      </CardHeader>
      <CardContent className="flex-1 flex flex-col overflow-hidden p-4">
        <ScrollArea className="flex-1 pr-4 mb-4 max-h-[480px] overflow-y-auto chat-scroll-area">
          <div className="space-y-4">
            {messages.map(message => (
              <div
                key={message.id}
                className={`${message.sender === 'user' ? 'user-bubble' : 'ai-bubble'} ${message.isHtml ? 'html-content' : ''}`}
              >
                {message.isHtml ? (
                  <div 
                    dangerouslySetInnerHTML={{ 
                      __html: DOMPurify.sanitize(message.text) 
                    }} 
                  />
                ) : (
                  message.text
                )}
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
        
        <div className="flex gap-2 mt-2">
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
