
import React, { useState, useEffect, useRef } from 'react';
import { X, Send, Sparkles, Terminal, User } from 'lucide-react';
import { createChatSession, sendMessageToGemini, analyzeSpendingPatterns, generatePackingList } from '../services/geminiService';
import { Chat } from "@google/genai";
import { translations, Language } from '../utils/translations';
import { Trip, Expense } from '../types';

interface Message { id: string; role: 'user' | 'model'; text: string; }

interface ChatAssistantProps {
    trip?: Trip;  // Added full trip context instead of just tripContext string
    lang: Language;
    isOpen?: boolean;
    onClose?: () => void;
}

const ChatAssistant: React.FC<ChatAssistantProps> = ({ trip, lang, isOpen: externalIsOpen, onClose }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<Message[]>([{ id: 'welcome', role: 'model', text: 'System Online. How can I assist with your itinerary today?' }]);
  const [isLoading, setIsLoading] = useState(false);
  const chatSessionRef = useRef<Chat | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const t = translations[lang];

  useEffect(() => {
    if (externalIsOpen !== undefined) {
      setIsOpen(externalIsOpen);
    }
  }, [externalIsOpen]);

  useEffect(() => {
    if (isOpen && !chatSessionRef.current) {
      // Build rich context from trip data
      let context = `You are a helpful, knowledgeable travel assistant.`;
      
      if (trip) {
        const totalSpent = trip.expenses.reduce((sum, exp) => sum + exp.amount, 0);
        const spendingByCategory = trip.expenses.reduce((acc: any, exp: any) => {
          acc[exp.category] = (acc[exp.category] || 0) + exp.amount;
          return acc;
        }, {});
        
        const activityCount = trip.itinerary.reduce((sum, day) => sum + day.activities.length, 0);
        const remainingBudget = trip.budget - totalSpent;
        
        context = `You are a helpful travel assistant. The user is currently planning a trip with these details:
- Destination: ${trip.destination}
- Trip Type: ${trip.type}
- Duration: ${Math.ceil((new Date(trip.endDate).getTime() - new Date(trip.startDate).getTime()) / (1000 * 60 * 60 * 24))} days
- Total Budget: ${trip.currency} ${trip.budget}
- Already Spent: ${trip.currency} ${totalSpent.toFixed(2)} (${remainingBudget > 0 ? `remaining: ${trip.currency} ${remainingBudget.toFixed(2)}` : 'OVER BUDGET'})
- Spending by Category: ${Object.entries(spendingByCategory).map(([cat, amount]: [string, any]) => `${cat}: ${trip.currency} ${amount.toFixed(2)}`).join(', ')}
- Planned Activities: ${activityCount} activities across ${trip.itinerary.length} days

Provide budget-conscious recommendations and flag high spending categories. Be encouraging but realistic about budget constraints.`;
      }
      
      chatSessionRef.current = createChatSession(context);
    }
  }, [isOpen, trip]);

  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  const handleClose = () => {
    setIsOpen(false);
    if (onClose) onClose();
  };

  const handleSend = async () => {
    if (!input.trim() || !chatSessionRef.current) return;
    const userMsg: Message = { id: Date.now().toString(), role: 'user', text: input };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsLoading(true);
    try {
      // Check for special commands
      const lowerInput = input.toLowerCase();
      
      // Packing list command
      if (lowerInput.includes('packing') || lowerInput.includes('pack')) {
        if (trip) {
          const duration = Math.ceil((new Date(trip.endDate).getTime() - new Date(trip.startDate).getTime()) / (1000 * 60 * 60 * 24));
          const season = getSeason(new Date(trip.startDate));
          const packingItems = await generatePackingList(trip.destination, duration, season, trip.type);
          const packingText = `Here's a packing list for your ${trip.type} trip to ${trip.destination}:\n\n${packingItems.map((item, i) => `${i + 1}. ${item}`).join('\n')}`;
          setMessages(prev => [...prev, { id: (Date.now() + 1).toString(), role: 'model', text: packingText }]);
          setIsLoading(false);
          return;
        }
      }
      
      // Spending analysis command
      if (lowerInput.includes('spending') || lowerInput.includes('budget') || lowerInput.includes('money')) {
        if (trip && trip.expenses.length > 0) {
          const analysis = await analyzeSpendingPatterns(trip.expenses, trip.budget, trip.currency);
          setMessages(prev => [...prev, { id: (Date.now() + 1).toString(), role: 'model', text: analysis }]);
          setIsLoading(false);
          return;
        }
      }
      
      // Regular chat
      const responseText = await sendMessageToGemini(chatSessionRef.current, userMsg.text);
      setMessages(prev => [...prev, { id: (Date.now() + 1).toString(), role: 'model', text: responseText }]);
    } catch (e) { console.error(e); } finally { setIsLoading(false); }
  };

  // Helper to determine season
  const getSeason = (date: Date): string => {
    const month = date.getMonth();
    if (month >= 2 && month <= 4) return 'Spring';
    if (month >= 5 && month <= 7) return 'Summer';
    if (month >= 8 && month <= 10) return 'Fall';
    return 'Winter';
  };

  return (
    <>
      {/* Floating Toggle Button */}
      <button 
        onClick={() => setIsOpen(true)} 
        className={`fixed bottom-6 right-6 p-4 bg-acid text-obsidian hover:bg-white hover:scale-105 transition-all duration-300 shadow-[0_0_20px_rgba(34,211,238,0.3)] z-[500] rounded-full group ${isOpen ? 'translate-y-24 opacity-0 pointer-events-none' : 'translate-y-0 opacity-100'}`}
        title="Open AI Assistant"
      >
        <Sparkles size={24} className="group-hover:rotate-12 transition-transform" />
      </button>

      {/* Main Chat Window */}
      <div className={`fixed bottom-4 md:bottom-6 right-4 md:right-6 w-[calc(100vw-2rem)] md:w-[400px] h-[calc(100vh-6rem)] md:h-[600px] max-h-[85vh] bg-obsidian/95 backdrop-blur-xl border border-border flex flex-col z-[500] transition-all duration-500 origin-bottom-right shadow-2xl rounded-[24px] md:rounded-[32px] overflow-hidden ${isOpen ? 'scale-100 opacity-100' : 'scale-90 opacity-0 pointer-events-none translate-y-8'}`}>
        
        {/* Header */}
        <div className="p-3 md:p-5 border-b border-border bg-surface/50 flex justify-between items-center backdrop-blur-md">
          <div className="flex items-center gap-2 md:gap-3">
            <div className="w-8 h-8 md:w-10 md:h-10 rounded-full bg-gradient-to-br from-acid/20 to-blue-500/20 border border-acid/30 flex items-center justify-center shadow-inner">
                <Sparkles size={16} className="md:hidden text-acid" />
                <Sparkles size={18} className="hidden md:block text-acid" />
            </div>
            <div>
                <h3 className="font-display font-bold text-xs md:text-sm text-text tracking-wide">{t.aiAdvisor}</h3>
                <div className="flex items-center gap-1.5">
                    <span className="relative flex h-1.5 w-1.5 md:h-2 md:w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-acid opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-1.5 w-1.5 md:h-2 md:w-2 bg-acid"></span>
                    </span>
                    <span className="text-[9px] md:text-[10px] font-mono text-dim uppercase tracking-wider">{t.neuralLink}</span>
                </div>
            </div>
          </div>
          <button 
            onClick={handleClose} 
            className="p-1.5 md:p-2 text-dim hover:text-text hover:bg-surface rounded-full transition-colors"
          >
            <X size={18} className="md:hidden" />
            <X size={20} className="hidden md:block" />
          </button>
        </div>

        {/* Messages Area */}
        <div className="flex-1 overflow-y-auto p-3 md:p-5 space-y-4 md:space-y-6 bg-gradient-to-b from-surface to-obsidian custom-scrollbar scroll-smooth">
          {messages.map((msg) => (
            <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} animate-slide-up`}>
              <div className={`flex gap-2 md:gap-3 max-w-[85%] ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                
                {/* Avatar */}
                <div className={`w-7 h-7 md:w-8 md:h-8 rounded-full flex items-center justify-center shrink-0 border shadow-sm ${msg.role === 'user' ? 'bg-surface border-border' : 'bg-acid/10 border-acid/20'}`}>
                    {msg.role === 'user' ? (
                        <>
                          <User size={12} className="md:hidden text-dim"/>
                          <User size={14} className="hidden md:block text-dim"/>
                        </>
                    ) : (
                        <>
                          <Sparkles size={12} className="md:hidden text-acid"/>
                          <Sparkles size={14} className="hidden md:block text-acid"/>
                        </>
                    )}
                </div>

                {/* Bubble */}
                <div className={`p-3 md:p-4 text-xs md:text-sm leading-relaxed shadow-md relative group ${
                    msg.role === 'user' 
                    ? 'bg-gradient-to-br from-acid to-cyan-400 text-black rounded-3xl rounded-tr-sm font-medium' 
                    : 'bg-panel border border-border text-text rounded-3xl rounded-tl-sm'
                }`}>
                    {msg.text}
                    {/* Timestamp on hover */}
                    <div className={`absolute -bottom-5 ${msg.role === 'user' ? 'right-0' : 'left-0'} text-[9px] font-mono text-dim opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap px-2 py-0.5 rounded-md`}>
                        {new Date(parseInt(msg.id) || Date.now()).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                    </div>
                </div>
              </div>
            </div>
          ))}
          
          {isLoading && (
            <div className="flex justify-start animate-fade-in">
                <div className="flex gap-3 max-w-[85%]">
                    <div className="w-8 h-8 rounded-full bg-acid/10 border border-acid/20 flex items-center justify-center shrink-0">
                        <Sparkles size={14} className="text-acid"/>
                    </div>
                    <div className="bg-panel border border-border p-4 rounded-3xl rounded-tl-sm flex items-center gap-1.5 h-12 shadow-sm">
                        <div className="w-1.5 h-1.5 bg-acid rounded-full animate-bounce [animation-delay:-0.3s]"></div>
                        <div className="w-1.5 h-1.5 bg-acid rounded-full animate-bounce [animation-delay:-0.15s]"></div>
                        <div className="w-1.5 h-1.5 bg-acid rounded-full animate-bounce"></div>
                    </div>
                </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input Area */}
        <div className="p-3 md:p-5 bg-surface/95 backdrop-blur-md border-t border-border">
          <div className="relative flex items-center gap-1.5 md:gap-2 bg-gradient-to-r from-panel to-surface border border-border rounded-2xl md:rounded-3xl px-1.5 md:px-2 py-1.5 md:py-2 focus-within:border-acid/50 transition-all shadow-inner">
            <input 
                type="text" 
                value={input} 
                onChange={(e) => setInput(e.target.value)} 
                onKeyDown={(e) => e.key === 'Enter' && handleSend()} 
                placeholder={t.enterCommand} 
                className="flex-1 bg-transparent px-3 md:px-4 text-xs md:text-sm text-text placeholder:text-dim outline-none font-sans" 
            />
            <button 
                onClick={handleSend} 
                disabled={isLoading || !input.trim()} 
                className="p-2 md:p-2.5 bg-acid text-black rounded-full hover:bg-white hover:scale-105 transition-all disabled:opacity-50 disabled:scale-100 shadow-lg shadow-acid/10"
            >
                <Send size={16} className="md:hidden" />
                <Send size={18} className="hidden md:block" />
            </button>
          </div>
        </div>
      </div>
    </>
  );
};

export default ChatAssistant;
