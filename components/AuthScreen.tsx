
import React, { useState } from 'react';
import { ArrowRight, Loader2, AlertCircle, Globe, Hexagon, MapPin, UserCircle, Database, Copy, Check, Plane, Sparkles, Phone } from 'lucide-react';
import { translations, Language } from '../utils/translations';
import { supabase } from '../services/supabaseClient';
import { detectLanguageByCountry, getCountriesList } from '../utils/countryLanguageDetector';
import LazyImage from './LazyImage';

interface Props {
  onLogin: (userData: { name: string; email: string; id: string; country?: string; language?: Language }) => void;
  lang: Language;
  toggleLanguage: () => void;
}

const AuthScreen: React.FC<Props> = ({ onLogin, lang, toggleLanguage }) => {
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [showDevHelp, setShowDevHelp] = useState(false);
  const [copied, setCopied] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    phone: '',
    country: ''
  });

  const t = translations[lang];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setErrorMsg(null);

    try {
        if (mode === 'signup') {
            // Detect language based on country
            const detectedLanguage = detectLanguageByCountry(formData.country);

            const { data, error } = await supabase.auth.signUp({
                email: formData.email,
                password: formData.password,
                options: {
                    data: { 
                        full_name: formData.name,
                        phone: formData.phone,
                        country: formData.country,
                        language: detectedLanguage
                    }
                }
            });
            if (error) throw error;
            if (data.user) {
                alert("Registration successful! Please check your email to confirm.");
                // Pass detected language to parent so app can initialize with correct language
                onLogin({
                    id: data.user.id,
                    name: formData.name,
                    email: data.user.email || '',
                    country: formData.country,
                    language: detectedLanguage
                });
            }
        } else {
            const { data, error } = await supabase.auth.signInWithPassword({
                email: formData.email,
                password: formData.password,
            });
            if (error) throw error;
            
            // Explicitly call onLogin on success to update App state
            if (data.user) {
                const userLanguage = data.user.user_metadata?.language as Language || 'en';
                const userCountry = data.user.user_metadata?.country as string || '';
                
                onLogin({
                    id: data.user.id,
                    name: data.user.user_metadata.full_name || data.user.email?.split('@')[0] || 'Traveler',
                    email: data.user.email || '',
                    country: userCountry,
                    language: userLanguage
                });
            }
        }
    } catch (err: any) {
        setErrorMsg(err.message || 'An error occurred during authentication.');
    } finally {
        setIsLoading(false);
    }
  };

  const handleGuestAccess = () => {
    onLogin({
        id: 'guest_user',
        name: 'Guest Traveler',
        email: 'guest@wanderlust.ai'
    });
  };

  const copySQL = () => {
    const sql = `-- 1. Create table
create table if not exists public.trips (
  id text not null primary key,
  user_id uuid not null references auth.users on delete cascade,
  trip_data jsonb not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 2. Security
alter table public.trips enable row level security;

-- 3. Policies
drop policy if exists "Users can manage their own trips" on public.trips;

create policy "Users can manage their own trips"
on public.trips for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);`;
    navigator.clipboard.writeText(sql);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="relative min-h-screen bg-obsidian flex items-center justify-center p-0 md:p-6 overflow-hidden">
      
      {/* Background Decor */}
      <div className="absolute inset-0 bg-grid opacity-[0.03] pointer-events-none"></div>

      {/* Main Card Container */}
      <div className="relative w-full max-w-7xl h-screen md:h-[800px] grid lg:grid-cols-12 bg-surface shadow-2xl rounded-2xl overflow-hidden border border-border animate-fade-in">
        
        {/* LEFT COLUMN: Visual & Branding (Hidden on Mobile) */}
        <div className="hidden lg:flex lg:col-span-7 relative flex-col justify-between p-12 overflow-hidden">
            
            {/* Immersive Image Background */}
            <div className="absolute inset-0 z-0">
                <LazyImage 
                    src="https://images.unsplash.com/photo-1469854523086-cc02fe5d8800?q=60&w=1200&auto=format&fit=crop" 
                    alt="Wanderlust Adventure" 
                    className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-black/30"></div>
                <div className="absolute inset-0 bg-acid/10 mix-blend-overlay"></div>
            </div>

            {/* Top Brand Tag */}
            <div className="relative z-10 flex items-center gap-3">
                <div className="w-10 h-10 bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center rounded-xl shadow-lg">
                    <Hexagon size={20} className="text-white fill-white/20" />
                </div>
                <span className="font-display font-bold text-lg tracking-widest text-white drop-shadow-md">
                  WanderLust<span className="text-white/50">AI</span>
                </span>
            </div>
            
            {/* Bottom Content */}
            <div className="relative z-10 space-y-6">
                <h1 className="font-display font-bold text-6xl leading-tight text-white drop-shadow-xl">
                    {t.planExplore}<br/>
                    <span className="text-acid">{t.travelLimitless}</span>
                </h1>
                
                <div className="flex flex-col gap-4 max-w-md">
                     <p className="font-sans text-lg text-gray-200 font-light leading-relaxed">
                        {t.tagline}
                    </p>
                    
                    <div className="flex items-center gap-6 pt-4 border-t border-white/20">
                        <div className="flex items-center gap-2 text-white/90">
                            <Globe size={16} className="text-acid" />
                            <span className="font-mono text-xs uppercase tracking-widest">{t.globalCoverage}</span>
                        </div>
                        <div className="flex items-center gap-2 text-white/90">
                            <div className="w-2 h-2 bg-acid rounded-full animate-pulse shadow-[0_0_10px_#22d3ee]"></div>
                            <span className="font-mono text-xs uppercase tracking-widest">{t.aiOnline}</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        {/* RIGHT COLUMN: Form */}
        <div className="col-span-12 lg:col-span-5 bg-surface flex flex-col relative h-full">
            
            {/* Mobile Branding Header */}
            <div className="lg:hidden absolute top-0 left-0 right-0 p-6 flex justify-between items-center z-20 bg-surface/80 backdrop-blur-md border-b border-border">
                 <div className="flex items-center gap-2">
                    <Hexagon size={24} className="text-acid fill-acid/20" />
                    <span className="font-display font-bold text-lg tracking-widest text-text">
                      WanderLust<span className="text-dim">AI</span>
                    </span>
                 </div>
                 <button onClick={toggleLanguage} className="text-xs font-mono font-bold uppercase border border-border px-2 py-1 rounded">
                    {lang}
                 </button>
            </div>

            {/* Top Controls (Desktop) */}
            <div className="hidden lg:flex absolute top-8 right-8 items-center gap-4 z-20">
                <button 
                    onClick={() => setShowDevHelp(true)} 
                    className="text-dim hover:text-text transition-colors flex items-center gap-2 text-xs font-mono uppercase tracking-wider hover:underline"
                >
                    <Database size={14} /> SQL Setup
                </button>
                <button onClick={toggleLanguage} className="text-dim hover:text-acid transition-colors flex items-center gap-2 text-xs font-mono font-bold uppercase border border-border px-3 py-1.5 rounded-full hover:border-acid">
                    <Globe size={14} /> {lang}
                </button>
            </div>

            <div className="flex-1 flex flex-col justify-center px-8 md:px-16 py-12 overflow-y-auto">
                <div className="w-full max-w-sm mx-auto space-y-8">
                    
                    <div className="space-y-2 text-center lg:text-left pt-16 lg:pt-0">
                        <h2 className="font-display text-2xl md:text-3xl font-bold text-text uppercase tracking-tight">
                            {mode === 'login' ? t.signIn : t.createAccount}
                        </h2>
                        <p className="font-sans text-dim text-xs">
                            {mode === 'login' ? t.authWelcome : t.authBeginJourney}
                        </p>
                    </div>

                    {errorMsg && (
                        <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2 animate-slide-up">
                            <AlertCircle size={16} className="text-red-600 shrink-0 mt-0.5" />
                            <div>
                                <h4 className="text-xs font-bold text-red-700 uppercase mb-0.5">Error</h4>
                                <p className="text-xs text-red-600 leading-relaxed">{errorMsg}</p>
                            </div>
                        </div>
                    )}

                    <form onSubmit={handleSubmit} className="space-y-4">
                        {mode === 'signup' && (
                            <div className="space-y-1 group">
                                <label className="text-[9px] font-mono font-bold uppercase text-dim tracking-widest group-focus-within:text-acid transition-colors">{t.fullName}</label>
                                <div className="relative">
                                    <div className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none">
                                        <UserCircle className="text-gray-400 group-focus-within:text-text transition-colors" size={16} />
                                    </div>
                                    <input 
                                        type="text" 
                                        required
                                        value={formData.name}
                                        onChange={(e) => setFormData({...formData, name: e.target.value})}
                                        className="w-full bg-white border border-gray-200 text-slate-900 px-3 py-2.5 pl-9 text-xs rounded-lg focus:border-acid focus:ring-1 focus:ring-acid outline-none transition-all placeholder-gray-300"
                                        placeholder="John Doe"
                                    />
                                </div>
                            </div>
                        )}

                        <div className="space-y-1 group">
                            <label className="text-[9px] font-mono font-bold uppercase text-dim tracking-widest group-focus-within:text-acid transition-colors">{t.email}</label>
                            <input 
                                type="email" 
                                required
                                value={formData.email}
                                onChange={(e) => setFormData({...formData, email: e.target.value})}
                                className="w-full bg-white border border-gray-200 text-slate-900 px-3 py-2.5 text-xs rounded-lg focus:border-acid focus:ring-1 focus:ring-acid outline-none transition-all placeholder-gray-300"
                                placeholder="name@example.com"
                            />
                        </div>

                        <div className="space-y-1 group">
                            <label className="text-[9px] font-mono font-bold uppercase text-dim tracking-widest group-focus-within:text-acid transition-colors">{t.password}</label>
                            <input 
                                type="password" 
                                required
                                value={formData.password}
                                onChange={(e) => setFormData({...formData, password: e.target.value})}
                                className="w-full bg-white border border-gray-200 text-slate-900 px-3 py-2.5 text-xs rounded-lg focus:border-acid focus:ring-1 focus:ring-acid outline-none transition-all placeholder-gray-300"
                                placeholder="••••••••"
                            />
                        </div>

                        {mode === 'signup' && (
                            <>
                                <div className="space-y-1 group">
                                    <label className="text-[9px] font-mono font-bold uppercase text-dim tracking-widest group-focus-within:text-acid transition-colors">{t.phone}</label>
                                    <div className="relative">
                                        <div className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none">
                                            <Phone className="text-gray-400 group-focus-within:text-text transition-colors" size={16} />
                                        </div>
                                        <input 
                                            type="tel" 
                                            value={formData.phone}
                                            onChange={(e) => setFormData({...formData, phone: e.target.value})}
                                            className="w-full bg-white border border-gray-200 text-slate-900 px-3 py-2.5 pl-9 text-xs rounded-lg focus:border-acid focus:ring-1 focus:ring-acid outline-none transition-all placeholder-gray-300"
                                            placeholder="+1 555 123 4567"
                                        />
                                    </div>
                                </div>

                                <div className="space-y-1 group">
                                    <label className="text-[9px] font-mono font-bold uppercase text-dim tracking-widest group-focus-within:text-acid transition-colors">{t.country}</label>
                                    <div className="relative">
                                        <div className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none">
                                            <Globe className="text-gray-400 group-focus-within:text-text transition-colors" size={16} />
                                        </div>
                                        <select 
                                            required
                                            value={formData.country}
                                            onChange={(e) => setFormData({...formData, country: e.target.value})}
                                            className="w-full bg-white border border-gray-200 text-slate-900 px-3 py-2.5 pl-9 text-xs rounded-lg focus:border-acid focus:ring-1 focus:ring-acid outline-none transition-all placeholder-gray-300 appearance-none cursor-pointer"
                                        >
                                            <option value="">{t.selectCountry}</option>
                                            {getCountriesList().map(country => (
                                                <option key={country.code} value={country.code}>
                                                    {country.name}
                                                </option>
                                            ))}
                                        </select>
                                        <div className="absolute inset-y-0 right-0 pr-2.5 flex items-center pointer-events-none">
                                            <svg className="w-3.5 h-3.5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                                            </svg>
                                        </div>
                                    </div>
                                </div>
                            </>
                        )}

                        <button 
                            type="submit" 
                            disabled={isLoading || (mode === 'signup' && !formData.country)}
                            className="w-full bg-slate-900 text-white hover:bg-acid hover:text-black py-3 rounded-lg font-mono text-xs font-bold uppercase tracking-widest transition-all shadow-lg hover:shadow-xl disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2 group mt-3"
                        >
                            {isLoading ? <Loader2 className="animate-spin" size={16} /> : (
                                <>
                                    {mode === 'login' ? t.signIn : t.signUp} <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
                                </>
                            )}
                        </button>
                    </form>

                    <div className="pt-4 border-t border-border flex flex-col items-center gap-4">
                        <button 
                            onClick={() => { setMode(mode === 'login' ? 'signup' : 'login'); setErrorMsg(null); }}
                            className="text-xs font-medium text-dim hover:text-text transition-colors"
                        >
                            {mode === 'login' ? (
                                <span>{t.noAccountText} <strong className="text-acid hover:underline">{t.registerNow}</strong></span>
                            ) : (
                                <span>{t.hasAccountText} <strong className="text-acid hover:underline">{t.signInNow}</strong></span>
                            )}
                        </button>

                        <button 
                            onClick={handleGuestAccess}
                            className="w-full py-2.5 border-2 border-dashed border-acid/50 text-acid hover:bg-acid hover:text-obsidian hover:border-acid font-mono text-xs font-bold uppercase tracking-widest rounded-xl transition-all flex items-center justify-center gap-2 group shadow-sm hover:shadow-acid/20"
                        >
                            <Sparkles size={14} className="group-hover:rotate-12 transition-transform" />
                            {t.guestAccess}
                            <ArrowRight size={14} className="opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all" />
                        </button>
                    </div>
                </div>
            </div>
        </div>
      </div>

      {/* Developer Help Modal */}
      {showDevHelp && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-fade-in">
            <div className="bg-white max-w-2xl w-full p-8 shadow-2xl rounded-2xl border border-gray-100">
                <div className="flex justify-between items-center mb-6">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-slate-100 rounded-lg"><Database size={20} className="text-slate-900" /></div>
                        <h3 className="font-display font-bold text-xl text-slate-900 uppercase">Supabase SQL Setup</h3>
                    </div>
                    <button onClick={() => setShowDevHelp(false)} className="text-gray-400 hover:text-slate-900 transition-colors"><Hexagon size={24} /></button>
                </div>
                
                <p className="text-sm text-gray-600 mb-6 leading-relaxed">
                    Copy and run the following script in your Supabase Project's <strong>SQL Editor</strong> to initialize the database tables correctly.
                </p>

                <div className="bg-slate-900 rounded-xl p-4 relative group overflow-hidden border border-slate-800">
                    <pre className="text-xs font-mono text-emerald-400 whitespace-pre-wrap overflow-x-auto max-h-[300px] custom-scrollbar selection:bg-emerald-900">
{`-- 1. Create table
create table if not exists public.trips (
  id text not null primary key,
  user_id uuid not null references auth.users on delete cascade,
  trip_data jsonb not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 2. Security
alter table public.trips enable row level security;

-- 3. Policies
drop policy if exists "Users can manage their own trips" on public.trips;

create policy "Users can manage their own trips"
on public.trips for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);`}
                    </pre>
                    <button 
                        onClick={copySQL}
                        className="absolute top-3 right-3 p-2 bg-slate-800 text-gray-300 hover:text-white hover:bg-slate-700 transition-colors rounded-lg shadow-lg border border-slate-700"
                        title="Copy Code"
                    >
                        {copied ? <Check size={16} className="text-emerald-400"/> : <Copy size={16}/>}
                    </button>
                </div>

                <div className="mt-8 flex justify-end">
                    <button onClick={() => setShowDevHelp(false)} className="px-6 py-2.5 bg-slate-900 text-white text-xs font-bold uppercase tracking-widest hover:bg-acid hover:text-black transition-colors rounded-lg shadow-md">
                        Done
                    </button>
                </div>
            </div>
        </div>
      )}
    </div>
  );
};

export default AuthScreen;
