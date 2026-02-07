
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
  Lock,
  UserPlus,
  ExternalLink,
  AlertCircle,
  CheckCircle2
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
  participants: string[]; 
}

interface Config {
  tgToken: string;
  lisSkinsKey: string;
}

// --- Constants ---
const STORAGE_KEY = 'cs2_giveaway_config_v2';
const GIVEAWAYS_KEY = 'cs2_active_giveaways_v2';

// --- App Component ---
function App() {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'search' | 'settings'>('dashboard');
  const [currentUserTgId, setCurrentUserTgId] = useState<string>('guest');
  
  // Приоритет отдаем MARKET_API_KEY, как указал пользователь
  const envDefaults = {
    tgToken: process.env.TG_BOT_TOKEN || '',
    lisSkinsKey: process.env.MARKET_API_KEY || process.env.LISSKINS_API_KEY || ''
  };

  const [config, setConfig] = useState<Config>(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    const parsed = saved ? JSON.parse(saved) : {};
    return {
      tgToken: parsed.tgToken || envDefaults.tgToken,
      lisSkinsKey: parsed.lisSkinsKey || envDefaults.lisSkinsKey,
    };
  });
  
  const [giveaways, setGiveaways] = useState<Giveaway[]>(() => {
    const saved = localStorage.getItem(GIVEAWAYS_KEY);
    return saved ? JSON.parse(saved) : [];
  });

  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Skin[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const tg = (window as any).Telegram?.WebApp;
    if (tg) {
      tg.expand();
      tg.ready();
      const user = tg.initDataUnsafe?.user;
      if (user) setCurrentUserTgId(user.id.toString());
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
  }, [config]);

  useEffect(() => {
    localStorage.setItem(GIVEAWAYS_KEY, JSON.stringify(giveaways));
  }, [giveaways]);

  const handleSearch = async () => {
    const currentKey = config.lisSkinsKey || envDefaults.lisSkinsKey;
    
    if (searchQuery.length < 2) return;
    if (!currentKey) {
      setError('Критическая ошибка: MARKET_API_KEY не найден в Vercel или настройках.');
      setActiveTab('settings');
      return;
    }
    
    setIsSearching(true);
    setError(null);

    try {
      // Согласно документации: https://api.lis-skins.ru/v2/market/items
      const response = await fetch(`https://api.lis-skins.ru/v2/market/items?search=${encodeURIComponent(searchQuery)}&limit=12`, {
        method: 'GET',
        headers: {
          'X-Api-Key': currentKey,
          'Accept': 'application/json'
        }
      });

      if (!response.ok) {
        if (response.status === 401 || response.status === 403) {
          throw new Error('Невалидный API ключ. Проверьте MARKET_API_KEY на Vercel.');
        }
        throw new Error(`Ошибка сервера Lis-Skins: ${response.status}`);
      }

      const result = await response.json();
      
      if (result.success && result.data) {
        const mappedSkins: Skin[] = result.data.map((item: any) => {
          // Обработка изображения: берем готовое или формируем из icon_url
          let skinImg = item.image;
          if (!skinImg && item.icon_url) {
            skinImg = `https://community.cloudflare.steamstatic.com/economy/image/${item.icon_url}/360fx360f`;
          }

          return {
            name: item.name || item.name_raw || 'Неизвестный скин',
            price: Math.round(item.price),
            image: skinImg || 'https://via.placeholder.com/360?text=No+Image',
            rarity: item.rarity_name || item.rarity || 'Common'
          };
        });
        setSearchResults(mappedSkins);
      } else {
        setSearchResults([]);
        if (result.error) setError(`API Error: ${result.error}`);
      }
    } catch (err: any) {
      console.error('Lis-Skins API error:', err);
      setError(err.message || 'Ошибка сети. Возможно, API блокирует запросы из браузера (CORS).');
    } finally {
      setIsSearching(false);
    }
  };

  const createGiveaway = (skin: Skin) => {
    const newGiveaway: Giveaway = {
      id: Math.random().toString(36).substr(2, 9),
      skin,
      endTime: Date.now() + (24 * 3600000), 
      winnersCount: 1,
      status: 'active',
      participants: []
    };

    setGiveaways([newGiveaway, ...giveaways]);
    setActiveTab('dashboard');
  };

  const joinGiveaway = (id: string) => {
    setGiveaways(prev => prev.map(g => {
      if (g.id === id && !g.participants.includes(currentUserTgId)) {
        return { ...g, participants: [...g.participants, currentUserTgId] };
      }
      return g;
    }));
  };

  const deleteGiveaway = (id: string) => {
    if(confirm('Удалить розыгрыш?')) {
      setGiveaways(giveaways.filter(g => g.id !== id));
    }
  };

  const getRarityStyle = (rarity?: string) => {
    const r = rarity?.toLowerCase() || '';
    if (r.includes('covert') || r.includes('тайное')) return 'text-red-500 border-red-500/30 bg-red-500/5';
    if (r.includes('classified') || r.includes('засекреченное')) return 'text-pink-500 border-pink-500/30 bg-pink-500/5';
    if (r.includes('restricted') || r.includes('запрещенное')) return 'text-purple-500 border-purple-500/30 bg-purple-500/5';
    return 'text-blue-400 border-blue-400/30 bg-blue-400/5';
  };

  return (
    <div className="min-h-screen bg-[#0d0f13] text-gray-100 font-sans flex flex-col pb-24">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-[#0d0f13]/90 backdrop-blur-xl border-b border-white/5 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-gradient-to-br from-orange-500 to-red-600 rounded-xl flex items-center justify-center shadow-lg shadow-orange-500/20">
            <Trophy className="text-white" size={20} />
          </div>
          <div>
            <h1 className="text-base font-black tracking-tight leading-none uppercase italic">
              Lis<span className="text-orange-500">Skins</span> Give
            </h1>
            <p className="text-[9px] text-gray-500 uppercase font-black tracking-[0.1em] mt-1">v2.1 PRO CONNECTION</p>
          </div>
        </div>
        <div className="flex items-center space-x-2">
          {envDefaults.lisSkinsKey ? (
             <div className="bg-green-500/10 border border-green-500/20 px-2 py-1 rounded-full text-[8px] font-black text-green-500 uppercase flex items-center">
               <CheckCircle2 size={8} className="mr-1" /> API OK
             </div>
          ) : (
            <div className="bg-red-500/10 border border-red-500/20 px-2 py-1 rounded-full text-[8px] font-black text-red-500 uppercase">
              NO KEY
            </div>
          )}
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 px-4 py-6">
        
        {activeTab === 'dashboard' && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-3">
              <StatsCard title="В эфире" value={giveaways.filter(g => g.status === 'active').length} icon={<Gift size={16} />} />
              <StatsCard title="Участники" value={giveaways.reduce((acc, g) => acc + g.participants.length, 0)} icon={<UserPlus size={16} />} />
            </div>

            <div className="space-y-4">
              <h2 className="text-[11px] font-black uppercase tracking-widest text-gray-500 px-1">Витрина активных</h2>
              
              {giveaways.length === 0 ? (
                <div className="bg-[#161920] rounded-[2.5rem] p-12 text-center border border-dashed border-white/5">
                  <div className="bg-orange-500/10 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6">
                    <Gift className="text-orange-500" size={38} />
                  </div>
                  <h3 className="font-black text-lg mb-2">Розыгрыши не запущены</h3>
                  <button onClick={() => setActiveTab('search')} className="w-full bg-orange-500 py-4 rounded-2xl font-black text-xs uppercase tracking-widest shadow-lg shadow-orange-500/20">Найти скины</button>
                </div>
              ) : (
                <div className="space-y-4">
                  {giveaways.map(g => (
                    <div key={g.id} className="bg-[#161920] rounded-3xl border border-white/5 overflow-hidden shadow-xl">
                      <div className="p-5 flex items-center">
                        <div className="w-20 h-20 bg-black/40 rounded-2xl p-2 flex items-center justify-center relative overflow-hidden group">
                          <img src={g.skin.image} alt="" className="max-w-full max-h-full object-contain z-10 relative group-hover:scale-110 transition-transform" />
                          <div className="absolute inset-0 bg-gradient-to-t from-orange-500/10 to-transparent opacity-50" />
                        </div>
                        <div className="ml-5 flex-1 min-w-0">
                          <div className={`inline-block text-[8px] font-black uppercase px-2 py-0.5 border rounded-full mb-1.5 ${getRarityStyle(g.skin.rarity)}`}>
                            {g.skin.rarity || 'Common'}
                          </div>
                          <h4 className="font-black text-sm truncate uppercase tracking-tight text-white">{g.skin.name}</h4>
                          <div className="flex items-center mt-2 space-x-3 text-[10px] font-bold text-gray-500">
                             <span className="flex items-center text-orange-400"><UserPlus size={12} className="mr-1" /> {g.participants.length}</span>
                             <span className="flex items-center"><RefreshCcw size={12} className="mr-1" /> 24ч</span>
                          </div>
                        </div>
                        <button onClick={() => deleteGiveaway(g.id)} className="p-3 text-red-500/30 hover:text-red-500 transition-colors">
                          <Trash2 size={18} />
                        </button>
                      </div>
                      <div className="px-5 pb-5">
                        <button 
                          onClick={() => joinGiveaway(g.id)}
                          disabled={g.participants.includes(currentUserTgId)}
                          className={`w-full py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all ${
                            g.participants.includes(currentUserTgId) 
                            ? 'bg-green-500/10 text-green-500 border border-green-500/20' 
                            : 'bg-white text-black active:scale-95 shadow-lg'
                          }`}
                        >
                          {g.participants.includes(currentUserTgId) ? 'Уже в игре' : 'Вступить'}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'search' && (
          <div className="space-y-6">
            <div className="relative">
              <input 
                type="text" 
                placeholder="Что ищем в Lis-Skins? (например: AWP)"
                className="w-full bg-[#161920] border border-white/5 rounded-2xl py-5 pl-14 pr-4 text-sm font-bold focus:border-orange-500/50 focus:outline-none transition-all placeholder:text-gray-700"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              />
              <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-gray-700" size={22} />
              <button 
                onClick={handleSearch}
                className="absolute right-3 top-1/2 -translate-y-1/2 bg-orange-500 text-white text-[10px] font-black uppercase px-4 py-2 rounded-xl"
              >
                Поиск
              </button>
            </div>

            {error && (
              <div className="bg-red-500/10 border border-red-500/20 p-4 rounded-2xl flex items-start text-red-500 text-xs font-bold">
                <AlertCircle size={16} className="mr-2 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            <div className="grid grid-cols-1 gap-4">
              {isSearching ? (
                <div className="text-center py-20">
                  <RefreshCcw className="mx-auto text-orange-500 animate-spin mb-4" size={32} />
                  <p className="text-xs font-black uppercase text-gray-600 tracking-widest">Получаем данные с маркета...</p>
                </div>
              ) : searchResults.length > 0 ? (
                searchResults.map((skin, i) => (
                  <div key={i} className="bg-[#161920] rounded-[2rem] border border-white/5 overflow-hidden flex flex-col p-6 hover:border-orange-500/30 transition-all shadow-xl">
                    <div className="flex items-center space-x-5 mb-5">
                      <div className="w-28 h-28 bg-black/60 rounded-[1.5rem] p-3 shrink-0 flex items-center justify-center border border-white/5">
                        <img src={skin.image} alt={skin.name} className="max-w-full max-h-full object-contain" />
                      </div>
                      <div className="flex-1">
                        <div className={`inline-block text-[9px] font-black uppercase px-2.5 py-1 border rounded-full mb-2.5 ${getRarityStyle(skin.rarity)}`}>
                          {skin.rarity}
                        </div>
                        <h3 className="font-black text-sm leading-tight mb-2 text-white uppercase">{skin.name}</h3>
                        <div className="flex items-baseline space-x-1">
                          <span className="text-orange-500 font-black text-2xl">{skin.price}</span>
                          <span className="text-[10px] font-black text-gray-600 uppercase">RUB</span>
                        </div>
                      </div>
                    </div>
                    <button 
                      onClick={() => createGiveaway(skin)}
                      className="w-full bg-white text-black py-4.5 rounded-2xl font-black text-[11px] uppercase tracking-[0.15em] active:scale-95 transition-transform shadow-xl"
                    >
                      Создать розыгрыш
                    </button>
                  </div>
                ))
              ) : searchQuery.length > 0 && !isSearching ? (
                <div className="text-center py-20 opacity-30">
                  <Search size={40} className="mx-auto mb-4" />
                  <p className="text-sm font-bold uppercase tracking-widest">Ничего не найдено</p>
                </div>
              ) : null}
            </div>
          </div>
        )}

        {activeTab === 'settings' && (
          <div className="space-y-6">
            <div className="bg-[#161920] rounded-[2rem] p-8 border border-white/5 space-y-6 shadow-2xl">
              <h2 className="text-xs font-black uppercase tracking-[0.2em] text-white flex items-center">
                <ShieldCheck size={14} className="mr-2 text-orange-500" /> Конфигурация
              </h2>
              
              <div className="space-y-5">
                <InputGroup 
                  label="Bot Token" 
                  value={config.tgToken} 
                  onChange={v => setConfig({...config, tgToken: v})} 
                  type="password" 
                  placeholder="Bot API Token..." 
                  isSystem={!!process.env.TG_BOT_TOKEN}
                />
                <InputGroup 
                  label="Lis-Skins API (MARKET_API_KEY)" 
                  value={config.lisSkinsKey} 
                  onChange={v => setConfig({...config, lisSkinsKey: v})} 
                  type="password" 
                  placeholder="v2-xxxx-xxxx" 
                  isSystem={!!(process.env.MARKET_API_KEY || process.env.LISSKINS_API_KEY)}
                />
              </div>

              <div className="pt-4">
                <button 
                  onClick={() => alert('Настройки локально обновлены!')}
                  className="w-full bg-white text-black py-4.5 rounded-2xl font-black text-[11px] uppercase tracking-widest"
                >
                  Обновить локально
                </button>
              </div>
            </div>

            <div className="bg-orange-500/5 border border-orange-500/10 rounded-2xl p-5 flex items-start space-x-4">
              <AlertCircle size={18} className="text-orange-500 shrink-0 mt-1" />
              <div className="text-[11px] text-gray-500 leading-relaxed">
                <p className="font-black text-orange-400 uppercase mb-1">Справка:</p>
                Ваш ключ подтягивается из переменной <strong>MARKET_API_KEY</strong> на Vercel. 
                Если вы его изменили, приложению может потребоваться перезапуск или повторная деплой-сессия.
              </div>
            </div>
          </div>
        )}

      </main>

      {/* Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 bg-[#0d0f13]/80 backdrop-blur-2xl border-t border-white/5 px-8 pb-safe pt-2 flex justify-between items-center h-24">
        <TabButton active={activeTab === 'dashboard'} onClick={() => setActiveTab('dashboard')} icon={<LayoutDashboard size={24} />} label="Лента" />
        <TabButton active={activeTab === 'search'} onClick={() => setActiveTab('search')} icon={<Search size={24} />} label="Маркет" />
        <TabButton active={activeTab === 'settings'} onClick={() => setActiveTab('settings')} icon={<Settings size={24} />} label="Настройка" />
      </nav>
    </div>
  );
}

// --- Helpers ---

function TabButton({ active, onClick, icon, label }: { active: boolean, onClick: () => void, icon: React.ReactNode, label: string }) {
  return (
    <button onClick={onClick} className={`flex flex-col items-center justify-center space-y-1.5 w-16 transition-all ${active ? 'text-orange-500 scale-105' : 'text-gray-600'}`}>
      <div className="p-1">{icon}</div>
      <span className="text-[9px] font-black uppercase tracking-widest">{label}</span>
      <div className={`w-1 h-1 rounded-full transition-all ${active ? 'bg-orange-500 mt-0.5' : 'bg-transparent mt-0.5'}`} />
    </button>
  );
}

function StatsCard({ title, value, icon }: { title: string, value: string | number, icon: React.ReactNode }) {
  return (
    <div className="bg-[#161920] border border-white/5 p-5 rounded-[1.8rem] flex items-center justify-between shadow-lg">
      <div className="bg-orange-500/10 p-2.5 rounded-xl text-orange-500">{icon}</div>
      <div className="text-right">
        <p className="text-[9px] font-black text-gray-600 uppercase tracking-widest leading-none mb-1.5">{title}</p>
        <p className="text-xl font-black leading-none text-white tracking-tight">{value}</p>
      </div>
    </div>
  );
}

function InputGroup({ label, value, onChange, type, placeholder, isSystem }: { label: string, value: string, onChange: (v: string) => void, type: string, placeholder: string, isSystem?: boolean }) {
  return (
    <div className="space-y-2.5">
      <div className="flex justify-between items-center px-1">
        <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest">{label}</label>
        {isSystem && <span className="text-[8px] font-black bg-blue-500/10 text-blue-500 px-2 py-0.5 rounded-full border border-blue-500/20 uppercase tracking-tighter">Verified ENV</span>}
      </div>
      <input 
        type={type}
        className={`w-full bg-black/40 border border-white/5 rounded-2xl py-4 px-5 text-xs font-bold focus:border-orange-500/50 focus:outline-none transition-all placeholder:text-gray-800 ${isSystem ? 'opacity-50' : ''}`}
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
