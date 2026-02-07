
import React, { useState, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { 
  Search, 
  Settings, 
  Trophy, 
  Plus, 
  Trash2, 
  RefreshCcw, 
  ShieldCheck,
  LayoutDashboard,
  Gift,
  Lock
} from 'lucide-react';

// --- Types ---
interface Skin {
  name: string;
  price: number;
  image: string;
  rarity?: string;
}

interface Giveaway {
  id: string;
  skin: Skin;
  endTime: number;
  winnersCount: number;
  status: 'active' | 'ended';
  participants: number;
  messageId?: number;
}

interface Config {
  tgToken: string;
  marketKey: string;
  chatId: string;
}

// --- Constants ---
const STORAGE_KEY = 'cs2_giveaway_config';
const GIVEAWAYS_KEY = 'cs2_active_giveaways';

// --- App Component ---
function App() {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'search' | 'settings'>('dashboard');
  const [isAdmin, setIsAdmin] = useState<boolean>(true); // Default to true, will check if ENV is set
  
  // Try to get defaults from process.env (Vercel)
  const envDefaults = {
    tgToken: process.env.TG_BOT_TOKEN || '',
    chatId: process.env.TG_CHAT_ID || '',
    marketKey: process.env.MARKET_API_KEY || ''
  };

  const [config, setConfig] = useState<Config>(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    const parsed = saved ? JSON.parse(saved) : {};
    return {
      tgToken: parsed.tgToken || envDefaults.tgToken,
      chatId: parsed.chatId || envDefaults.chatId,
      marketKey: parsed.marketKey || envDefaults.marketKey,
    };
  });
  
  const [giveaways, setGiveaways] = useState<Giveaway[]>(() => {
    const saved = localStorage.getItem(GIVEAWAYS_KEY);
    return saved ? JSON.parse(saved) : [];
  });

  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Skin[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  // Telegram WebApp Integration & Admin Check
  useEffect(() => {
    const tg = (window as any).Telegram?.WebApp;
    if (tg) {
      tg.expand();
      tg.ready();
      
      // Simple Admin Check if env var is provided
      const allowedAdminId = process.env.ADMIN_ID;
      const currentUser = tg.initDataUnsafe?.user;
      
      if (allowedAdminId && currentUser) {
        if (currentUser.id.toString() !== allowedAdminId.toString()) {
          setIsAdmin(false);
        }
      }
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
  }, [config]);

  useEffect(() => {
    localStorage.setItem(GIVEAWAYS_KEY, JSON.stringify(giveaways));
  }, [giveaways]);

  const handleSearch = async () => {
    if (searchQuery.length < 3) return;
    
    setIsSearching(true);
    try {
      // Logic for market API would go here, using config.marketKey
      await new Promise(resolve => setTimeout(resolve, 800));
      
      const mockResults: Skin[] = [
        { 
          name: `AK-47 | Asiimov`, 
          price: 4500, 
          image: 'https://community.cloudflare.steamstatic.com/economy/image/-9a81dlWLwJ2UUGcVs_nsVtzdOEdtWwKGZZLQHTxDZ7I56KU0Zwwo4NUX4oFJZEHLbXH5ApeO4dlqB9FAubRuvqkhI_fLhJ7IAtRvb6pLAs00vX3cmhD5sS4nI-OluX2Z-uGkD9QuJ0m3rvAot2m3VvtrUdpY2r6d9fGIVA2YVjT8wO4x7i9hce9vJzOznZruyVxsyrD30vgTOnX34k/360fx360f',
          rarity: 'Covert'
        },
        { 
          name: `M4A1-S | Printstream`, 
          price: 12000, 
          image: 'https://community.cloudflare.steamstatic.com/economy/image/-9a81dlWLwJ2UUGcVs_nsVtzdOEdtWwKGZZLQHTxDZ7I56KU0Zwwo4NUX4oFJZEHLbXH5ApeO4dlqB9FAubRuvqkhI_fLhJ7IAtRvb6pLAsy0fH_c2oSu9m0mIWKk_X3Y-jUlz9Xup0p0uvH8Y_23Fex-kZqamD7dYSVJAQ2ZF_Z-AK7x-u9g5Dqu5qfmHcx7CEn-z-DyG2v7pGf/360fx360f',
          rarity: 'Covert'
        }
      ];
      setSearchResults(mockResults);
    } catch (error) {
      console.error('Search failed:', error);
    } finally {
      setIsSearching(false);
    }
  };

  const createGiveaway = async (skin: Skin) => {
    if (!config.tgToken || !config.chatId) {
      alert('Сначала настройте Telegram токен и ID чата!');
      setActiveTab('settings');
      return;
    }

    const newGiveaway: Giveaway = {
      id: Math.random().toString(36).substr(2, 9),
      skin,
      endTime: Date.now() + 3600000,
      winnersCount: 1,
      status: 'active',
      participants: 0
    };

    try {
      const message = `🎁 РОЗЫГРЫШ SKINS CS2!\n\n🔹 Предмет: ${skin.name}\n💰 Цена: ~${skin.price} RUB\n🏆 Победителей: ${newGiveaway.winnersCount}\n\nНажмите кнопку ниже, чтобы участвовать!`;
      
      const response = await fetch(`https://api.telegram.org/bot${config.tgToken}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: config.chatId,
          text: message,
          reply_markup: {
            inline_keyboard: [[{ text: "💎 Участвовать", callback_data: `join_${newGiveaway.id}` }]]
          }
        })
      });

      const data = await response.json();
      if (data.ok) {
        newGiveaway.messageId = data.result.message_id;
        setGiveaways([newGiveaway, ...giveaways]);
        setActiveTab('dashboard');
      } else {
        alert('Ошибка Telegram: ' + data.description);
      }
    } catch (err) {
      alert('Ошибка при создании розыгрыша');
    }
  };

  const deleteGiveaway = (id: string) => {
    setGiveaways(giveaways.filter(g => g.id !== id));
  };

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-[#0d0f13] flex items-center justify-center p-8 text-center">
        <div className="space-y-6">
          <div className="w-20 h-20 bg-red-500/10 rounded-full flex items-center justify-center mx-auto border border-red-500/20">
            <Lock className="text-red-500" size={32} />
          </div>
          <h1 className="text-2xl font-black text-white">Access Denied</h1>
          <p className="text-gray-500 text-sm max-w-xs mx-auto">This admin panel is restricted to the authorized developer only.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0d0f13] text-gray-100 font-sans flex flex-col pb-24">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-[#0d0f13]/90 backdrop-blur-xl border-b border-white/5 px-6 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-black tracking-tight flex items-center">
            {activeTab === 'dashboard' && 'Giveaways'}
            {activeTab === 'search' && 'Market Search'}
            {activeTab === 'settings' && 'Bot Config'}
            <span className="ml-2 w-1.5 h-1.5 bg-orange-500 rounded-full animate-pulse" />
          </h1>
          <p className="text-[10px] text-gray-500 uppercase font-bold tracking-widest leading-none mt-1">CS2 Mini App</p>
        </div>
        <div className="bg-white/5 p-2 rounded-full border border-white/5">
          <Trophy size={18} className="text-orange-500" />
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 px-4 py-6">
        
        {/* DASHBOARD */}
        {activeTab === 'dashboard' && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-3">
              <StatsCard title="Active" value={giveaways.filter(g => g.status === 'active').length} icon={<Gift size={16} />} />
              <StatsCard title="Users" value={giveaways.reduce((acc, g) => acc + g.participants, 0)} icon={<Trophy size={16} />} />
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between px-2">
                <h2 className="text-sm font-bold uppercase tracking-wider text-gray-500">Recently Created</h2>
                <button onClick={() => setGiveaways([])} className="text-[10px] font-bold text-red-500 uppercase">Clear all</button>
              </div>
              
              {giveaways.length === 0 ? (
                <div className="bg-[#161920] rounded-3xl p-10 text-center border border-dashed border-white/10">
                  <div className="bg-orange-500/10 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Gift className="text-orange-500" size={32} />
                  </div>
                  <h3 className="font-bold mb-1">No Giveaways yet</h3>
                  <p className="text-xs text-gray-500 mb-6">Create your first skin giveaway by searching the market.</p>
                  <button 
                    onClick={() => setActiveTab('search')}
                    className="w-full bg-orange-500 py-4 rounded-2xl font-bold text-sm shadow-lg shadow-orange-500/20 active:scale-95 transition-transform"
                  >
                    Go to Search
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  {giveaways.map(g => (
                    <div key={g.id} className="bg-[#161920] rounded-2xl p-4 flex items-center border border-white/5 active:bg-white/[0.02] transition-colors">
                      <div className="w-14 h-14 bg-black/40 rounded-xl p-2 flex items-center justify-center shrink-0 mr-4">
                        <img src={g.skin.image} alt="" className="max-w-full max-h-full object-contain" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="font-bold text-sm truncate">{g.skin.name}</h4>
                        <p className="text-[10px] text-gray-500 flex items-center mt-1 font-bold">
                          <Gift size={10} className="mr-1" /> {g.participants} PARTICIPANTS
                        </p>
                      </div>
                      <button onClick={() => deleteGiveaway(g.id)} className="p-2 text-gray-600 hover:text-red-500">
                        <Trash2 size={18} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* SEARCH */}
        {activeTab === 'search' && (
          <div className="space-y-6">
            <div className="relative group">
              <input 
                type="text" 
                placeholder="Search skins..."
                className="w-full bg-[#161920] border border-white/10 rounded-2xl py-4 pl-12 pr-4 text-sm focus:border-orange-500 focus:outline-none transition-all placeholder:text-gray-600"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              />
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-600 group-focus-within:text-orange-500 transition-colors" size={20} />
              <button 
                onClick={handleSearch}
                className="absolute right-2 top-1/2 -translate-y-1/2 bg-orange-500/10 text-orange-500 text-[10px] font-black uppercase px-3 py-1.5 rounded-lg border border-orange-500/20 active:bg-orange-500 active:text-white transition-all"
              >
                Find
              </button>
            </div>

            <div className="grid grid-cols-1 gap-4">
              {isSearching ? (
                Array(2).fill(0).map((_, i) => (
                  <div key={i} className="bg-[#161920] rounded-2xl h-40 animate-pulse border border-white/5" />
                ))
              ) : searchResults.length > 0 ? (
                searchResults.map((skin, i) => (
                  <div key={i} className="bg-[#161920] rounded-3xl border border-white/5 overflow-hidden flex flex-col p-5 active:bg-white/[0.01] transition-all">
                    <div className="flex items-center space-x-4 mb-4">
                      <div className="w-24 h-24 bg-black/40 rounded-2xl p-4 shrink-0 flex items-center justify-center">
                        <img src={skin.image} alt={skin.name} className="max-w-full max-h-full object-contain" />
                      </div>
                      <div className="flex-1">
                        <div className={`inline-block text-[9px] font-black uppercase px-2 py-0.5 border rounded-full mb-2 ${
                          skin.rarity === 'Covert' ? 'text-red-500 border-red-500/30 bg-red-500/5' :
                          skin.rarity === 'Classified' ? 'text-pink-500 border-pink-500/30 bg-pink-500/5' :
                          'text-blue-400 border-blue-400/30 bg-blue-400/5'
                        }`}>
                          {skin.rarity || 'Common'}
                        </div>
                        <h3 className="font-bold text-base leading-tight mb-1">{skin.name}</h3>
                        <p className="text-orange-500 font-black text-lg">{skin.price} <span className="text-[10px]">RUB</span></p>
                      </div>
                    </div>
                    <button 
                      onClick={() => createGiveaway(skin)}
                      className="w-full bg-white text-black py-4 rounded-2xl font-black text-xs uppercase tracking-widest flex items-center justify-center active:scale-95 transition-transform"
                    >
                      <Plus size={14} className="mr-2" /> Start Giveaway
                    </button>
                  </div>
                ))
              ) : searchQuery.length > 0 ? (
                <div className="text-center py-10 opacity-40">
                  <Search size={40} className="mx-auto mb-4" />
                  <p className="text-sm font-bold">Press 'Find' to search</p>
                </div>
              ) : null}
            </div>
          </div>
        )}

        {/* SETTINGS */}
        {activeTab === 'settings' && (
          <div className="space-y-6">
            <div className="bg-[#161920] rounded-3xl p-6 border border-white/5 space-y-5">
              <h2 className="text-xs font-black uppercase tracking-[0.2em] text-orange-500 flex items-center">
                <ShieldCheck size={14} className="mr-2" /> API Access
              </h2>
              
              <div className="space-y-4">
                <InputGroup 
                  label="Bot Token" 
                  value={config.tgToken} 
                  onChange={v => setConfig({...config, tgToken: v})} 
                  type="password" 
                  placeholder="Telegram Bot API Token" 
                  isSystem={!!process.env.TG_BOT_TOKEN}
                />
                <InputGroup 
                  label="Chat ID" 
                  value={config.chatId} 
                  onChange={v => setConfig({...config, chatId: v})} 
                  type="text" 
                  placeholder="-100xxxxxxx" 
                  isSystem={!!process.env.TG_CHAT_ID}
                />
                <InputGroup 
                  label="Market API" 
                  value={config.marketKey} 
                  onChange={v => setConfig({...config, marketKey: v})} 
                  type="password" 
                  placeholder="CS2 Market Key" 
                  isSystem={!!process.env.MARKET_API_KEY}
                />
              </div>

              <div className="pt-2">
                <button 
                  onClick={() => alert('Saved to local storage!')}
                  className="w-full bg-white/5 border border-white/10 py-4 rounded-2xl font-bold text-sm hover:bg-white/10 active:scale-95 transition-all"
                >
                  Update Credentials
                </button>
              </div>
            </div>

            <div className="bg-orange-500/10 border border-orange-500/20 rounded-2xl p-4 flex items-center">
              <div className="bg-orange-500/20 p-2 rounded-lg mr-3">
                <RefreshCcw size={16} className="text-orange-500" />
              </div>
              <p className="text-[11px] text-orange-100/60 leading-relaxed font-medium">
                {process.env.TG_BOT_TOKEN ? 'Configuration loaded from system environment.' : 'Data is stored locally on your device.'}
              </p>
            </div>
          </div>
        )}

      </main>

      {/* Bottom Tab Bar */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 bg-[#161920]/80 backdrop-blur-2xl border-t border-white/5 px-6 pb-safe pt-2 flex justify-between items-center h-20">
        <TabButton 
          active={activeTab === 'dashboard'} 
          onClick={() => setActiveTab('dashboard')} 
          icon={<LayoutDashboard size={22} />} 
          label="Home" 
        />
        <TabButton 
          active={activeTab === 'search'} 
          onClick={() => setActiveTab('search')} 
          icon={<Search size={22} />} 
          label="Search" 
        />
        <TabButton 
          active={activeTab === 'settings'} 
          onClick={() => setActiveTab('settings')} 
          icon={<Settings size={22} />} 
          label="Config" 
        />
      </nav>
    </div>
  );
}

// --- Mobile Sub-components ---

function TabButton({ active, onClick, icon, label }: { active: boolean, onClick: () => void, icon: React.ReactNode, label: string }) {
  return (
    <button 
      onClick={onClick}
      className={`flex flex-col items-center justify-center space-y-1 w-20 transition-all duration-300 ${active ? 'text-orange-500' : 'text-gray-500 hover:text-gray-300'}`}
    >
      <div className={`p-1.5 rounded-xl transition-all ${active ? 'bg-orange-500/10 scale-110' : ''}`}>
        {icon}
      </div>
      <span className="text-[10px] font-black uppercase tracking-tighter">{label}</span>
      {active && <div className="w-1 h-1 bg-orange-500 rounded-full mt-0.5" />}
    </button>
  );
}

function StatsCard({ title, value, icon }: { title: string, value: string | number, icon: React.ReactNode }) {
  return (
    <div className="bg-[#161920] border border-white/5 p-4 rounded-2xl flex items-center justify-between shadow-sm">
      <div className="bg-white/5 p-2 rounded-xl text-orange-500">
        {icon}
      </div>
      <div className="text-right">
        <p className="text-[9px] font-black text-gray-600 uppercase tracking-widest leading-none mb-1">{title}</p>
        <p className="text-xl font-black leading-none">{value}</p>
      </div>
    </div>
  );
}

function InputGroup({ label, value, onChange, type, placeholder, isSystem }: { label: string, value: string, onChange: (v: string) => void, type: string, placeholder: string, isSystem?: boolean }) {
  return (
    <div className="space-y-2">
      <div className="flex justify-between items-center">
        <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">{label}</label>
        {isSystem && <span className="text-[8px] font-black bg-blue-500/10 text-blue-500 px-1.5 py-0.5 rounded border border-blue-500/20 uppercase">Environment</span>}
      </div>
      <input 
        type={type}
        className={`w-full bg-black/40 border border-white/5 rounded-xl py-3 px-4 text-xs font-bold focus:border-orange-500 focus:outline-none transition-colors placeholder:text-gray-700 ${isSystem ? 'opacity-50' : ''}`}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        readOnly={isSystem}
      />
    </div>
  );
}

const rootElement = document.getElementById('root');
if (rootElement) {
  createRoot(rootElement).render(<App />);
}
