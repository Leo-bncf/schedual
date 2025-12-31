import React, { useState, useEffect, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { MessageCircle, Send, Loader2 } from 'lucide-react';
import ReactMarkdown from 'react-markdown';

export default function TrainingChat({ agentName, agentTitle, colors }) {
  const [conversation, setConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const scrollRef = useRef(null);

  useEffect(() => {
    initConversation();
  }, [agentName]);

  useEffect(() => {
    if (!conversation?.id) return;

    const unsubscribe = base44.agents.subscribeToConversation(conversation.id, (data) => {
      setMessages(data.messages || []);
    });

    return () => unsubscribe();
  }, [conversation?.id]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const initConversation = async () => {
    try {
      const conv = await base44.agents.createConversation({
        agent_name: agentName,
        metadata: {
          name: `${agentTitle} Training Chat`,
          description: 'Direct training and correction chat'
        }
      });
      setConversation(conv);
      setMessages(conv.messages || []);
    } catch (error) {
      console.error('Failed to create conversation:', error);
    }
  };

  const handleSend = async () => {
    if (!input.trim() || !conversation || sending) return;

    setSending(true);
    try {
      await base44.agents.addMessage(conversation, {
        role: 'user',
        content: input
      });
      setInput('');
    } catch (error) {
      console.error('Failed to send message:', error);
    } finally {
      setSending(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <MessageCircle className="w-5 h-5 text-blue-600" />
          <CardTitle className="text-base">Training Assistant Chat</CardTitle>
        </div>
        <p className="text-xs text-slate-500">
          Ask questions, provide corrections, or give feedback to improve the AI's extraction accuracy
        </p>
      </CardHeader>
      <CardContent>
        <ScrollArea ref={scrollRef} className="h-[400px] pr-4 mb-4">
          <div className="space-y-4">
            {messages.length === 0 ? (
              <div className="text-center py-12 text-slate-400">
                <MessageCircle className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p className="text-sm">Start a conversation to train and correct the AI</p>
                <p className="text-xs mt-1">You can reference extracted data and provide corrections</p>
              </div>
            ) : (
              messages.map((msg, idx) => (
                <div
                  key={idx}
                  className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[80%] rounded-lg px-4 py-2.5 ${
                      msg.role === 'user'
                        ? 'bg-blue-900 text-white'
                        : 'bg-slate-100 text-slate-900'
                    }`}
                  >
                    {msg.role === 'user' ? (
                      <p className="text-sm leading-relaxed">{msg.content}</p>
                    ) : (
                      <ReactMarkdown
                        className="text-sm prose prose-sm max-w-none [&>*:first-child]:mt-0 [&>*:last-child]:mb-0"
                        components={{
                          p: ({ children }) => <p className="my-1 leading-relaxed">{children}</p>,
                          ul: ({ children }) => <ul className="my-1 ml-4 list-disc">{children}</ul>,
                          ol: ({ children }) => <ol className="my-1 ml-4 list-decimal">{children}</ol>,
                          li: ({ children }) => <li className="my-0.5">{children}</li>,
                          code: ({ inline, children }) =>
                            inline ? (
                              <code className="px-1 py-0.5 rounded bg-slate-200 text-slate-800 text-xs">
                                {children}
                              </code>
                            ) : (
                              <pre className="bg-slate-200 rounded p-2 overflow-x-auto my-2">
                                <code className="text-xs">{children}</code>
                              </pre>
                            ),
                        }}
                      >
                        {msg.content}
                      </ReactMarkdown>
                    )}
                    {msg.tool_calls && msg.tool_calls.length > 0 && (
                      <div className="mt-2 pt-2 border-t border-slate-200 space-y-1">
                        {msg.tool_calls.map((call, i) => (
                          <div key={i} className="text-xs text-slate-600 flex items-center gap-1">
                            <span className="font-medium">⚙️ {call.name}</span>
                            {call.status === 'completed' && <span className="text-green-600">✓</span>}
                            {call.status === 'running' && <Loader2 className="w-3 h-3 animate-spin" />}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </ScrollArea>

        <div className="flex gap-2">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Type your message or correction..."
            disabled={sending}
            className="flex-1"
          />
          <Button
            onClick={handleSend}
            disabled={!input.trim() || sending}
            className="bg-blue-900 hover:bg-blue-800"
          >
            {sending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}