import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
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
  Globe, 
  Activity, 
  Zap, 
  Terminal, 
  ChevronRight, 
  Key, 
  PlusCircle,
  Clock, 
  AlertCircle, 
  Eye, 
  EyeOff, 
  Info, 
  Filter, 
  ChevronLeft,
  Users,
  Target,
  CheckCircle2,
  XCircle,
  Star,
  StarOff
} from 'lucide-react';

// --- Константы и Помощники ---
const EXTERIOR_MAP: Record<string, string> = {
  "Factory New": "FN",
  "Minimal Wear": "MW",
  "Field-Tested": "FT",
  "Well-Worn": "WW",
  "Battle-Scarred": "BS"
};

const RARITY_MAP: Record<string, string> = {
  "Covert": "Тайное",
  "Classified": "Засекреченное",
  "Restricted": "Запрещенное",
  "Mil-Spec Grade": "Армейское",
  "Mil-Spec": "Армейское",
  "Industrial Grade": "Промышленное",
  "Consumer Grade": "Ширпотреб",
  "Extraordinary": "Экстраординарное",
  "Contraband": "Контрабанда"
};

const DEFAULT_API_KEY = 'e785e6e0-ee3f-40fa-a5d7-e63cb9dbab76';

// Исправленная нормализация строки
const normalizeStr = (str: string) => str.replace(/[\|\-\s]/g, '').toLowerCase();

const formatPrice = (price: string | number) => {
  const num = typeof price === 'string' ? parseFloat(price) : price;
  return new Intl.NumberFormat('ru-RU').format(num);
};

const localizeName = (name: string) => {
  let localized = name;
  Object.entries(EXTERIOR_MAP).forEach(([en, ru]) => {
    localized = localized.replace(`(${en})`, `(${ru})`);
  });
  return localized;
};

// Хелпер для разделения названия и износа
const splitSkinName = (fullName: string) => {
  const parts = fullName.split(' (');
  const name = parts[0];
  const exterior = parts[1] ? `(${parts[1]}` : '';
  return { name, exterior };
};

const localizeRarity = (rarity: string) => {
  return RARITY_MAP[rarity] || rarity;
};

// 3. Таймер (Формат времени): Мм:Сс если < 1 часа
const formatCountdown = (endTime: number, now: number) => {
  const diff = endTime - now;
  if (diff <= 0) return "Завершен";

  const totalSeconds = Math.floor(diff / 1000);
  const seconds = Math.floor((diff / 1000) % 60);
  const minutes = Math.floor((diff / 1000 / 60) % 60);
  const hours = Math.floor((diff / (1000 * 60 * 60)) % 24);
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));

  const pad = (n: number) => n.toString().padStart(2, '0');

  if (days > 0) return `${days}д:${hours}ч`;
  if (totalSeconds >= 3600) return `${hours}ч:${pad(minutes)}м`;
  
  // Меньше часа: формат Мм:Сс
  return `${pad(minutes)}м:${pad(seconds)}с`;
};

// --- Типы ---
interface Skin {
  id: string | number;
  name: string;
  price: string;
  image: string;
  rarity?: string;
  rarityColor?: string;
  float?: string;
  item_class_id?: string | number;
}

interface Giveaway {
  id: string;
  skins: Skin[];
  endTime: number;
  status: 'active' | 'ended';
  winners: string[];
  participants: string[]; // Добавлено поле участников
}

interface Config {
  lisSkinsKey: string;
  customProxyUrl: string;
}

const STORAGE_KEY = 'cs2_giveaway_config_v6';
const GIVEAWAYS_KEY = 'cs2_active_giveaways_v6';
const PARTICIPATION_KEY = 'cs2_user_participation_v6';
const FAVORITES_KEY = 'cs2_favorites_v6';
const DEFAULT_PROXY_URL = 'https://lucky-mode-5191.flamingovich69.workers.dev';

function App() {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'create' | 'settings'>('dashboard');
  const [debugLog, setDebugLog] = useState<string[]>([]);
  const [proxyStatus, setProxyStatus] = useState<'unknown' | 'ok' | 'error'>('unknown');
  const [apiKeyStatus, setApiKeyStatus] = useState<'unknown' | 'ok' | 'error'>('unknown');
  const [showKey, setShowKey] = useState(false);
  const [currentTime, setCurrentTime] = useState(Date.now());
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
  
  // Идентификатор текущего пользователя для имитации системы
  const myUserId = useMemo(() => {
    const saved = localStorage.getItem('cs2_mock_uid');
    if (saved) return saved;
    const newId = 'user_' + Math.random().toString(36).substring(2, 9);
    localStorage.setItem('cs2_mock_uid', newId);
    return newId;
  }, []);

  const [exchangeRate, setExchangeRate] = useState<number>(92.5);
  const [allSkinNames, setAllSkinNames] = useState<string[]>([]);
  const [skinsMetadata, setSkinsMetadata] = useState<Map<string, {rarity: string, color: string}>>(new Map());
  const [suggestions, setSuggestions] = useState<string[]>([]);

  const [selectedSkins, setSelectedSkins] = useState<Skin[]>([]);
  const [isAddingMore, setIsAddingMore] = useState(true);
  const [duration, setDuration] = useState<string>("60");
  const [customDate, setCustomDate] = useState<string>("");

  const [config, setConfig] = useState<Config>(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    const parsed = saved ? JSON.parse(saved) : {};
    return {
      lisSkinsKey: (parsed.lisSkinsKey || DEFAULT_API_KEY).trim(),
      customProxyUrl: (parsed.customProxyUrl || DEFAULT_PROXY_URL).trim(),
    };
  });
  
  const [giveaways, setGiveaways] = useState<Giveaway[]>(() => {
    const saved = localStorage.getItem(GIVEAWAYS_KEY);
    const parsed = saved ? JSON.parse(saved) : [];
    // Совместимость со старыми данными
    return parsed.map((g: any) => ({
      ...g,
      participants: g.participants || []
    }));
  });

  const [favorites, setFavorites] = useState<Skin[]>(() => {
    const saved = localStorage.getItem(FAVORITES_KEY);
    return saved ? JSON.parse(saved) : [];
  });

  const [participatedIds, setParticipatedIds] = useState<string[]>(() => {
    const saved = localStorage.getItem(PARTICIPATION_KEY);
    return saved ? JSON.parse(saved) : [];
  });

  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Skin[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 1. Исправленный Журнал событий (addLog)
  const addLog = useCallback((msg: string) => {
    const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    const logEntry = `[${time}] ${msg}`;
    setDebugLog(prev => [logEntry, ...prev].slice(0, 50));
    console.log(logEntry);
  }, []);

  useEffect(() => {
    const timer = setInterval(() => {
      const now = Date.now();
      setCurrentTime(now);
      
      setGiveaways(prev => {
        let changed = false;
        const next = prev.map(g => {
          if (g.status === 'active' && g.endTime <= now) {
            changed = true;
            return { 
              ...g, 
              status: 'ended' as const, 
              winners: g.skins.map((_, i) => `TestUser_${i + 1}`) 
            };
          }
          return g;
        });
        return changed ? next : prev;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // 4. useEffect загрузки данных
  useEffect(() => {
    const tg = (window as any).Telegram?.WebApp;
    if (tg) { tg.expand(); tg.ready(); }
    
    addLog("Приложение запущено. Начало инициализации данных...");

    const initData = async () => {
      try {
        const [namesRes, rateRes] = await Promise.all([
          fetch('https://raw.githubusercontent.com/ByMykel/CSGO-API/main/public/api/en/all.json'),
          fetch('https://api.frankfurter.dev/v1/latest?base=USD&symbols=RUB')
        ]);

        if (namesRes.ok) {
          const namesData = await namesRes.json();
          const metaMap = new Map<string, {rarity: string, color: string}>();
          const nameList: string[] = [];
          
          Object.values(namesData).forEach((item: any) => {
            if (item.name) {
              nameList.push(item.name);
              metaMap.set(item.name, {
                rarity: localizeRarity(item.rarity?.name || 'Common'),
                color: item.rarity?.color || '#5e98d9'
              });
            }
          });
          
          setSkinsMetadata(metaMap);
          setAllSkinNames(nameList);
          addLog(`База скинов загружена: ${nameList.length} шт.`);
        } else {
          addLog("ERROR: Не удалось загрузить базу названий.");
        }

        if (rateRes.ok) {
          const rateData = await rateRes.json();
          setExchangeRate(rateData.rates.RUB);
          addLog(`Курс обновлен: ${rateData.rates.RUB} RUB/USD`);
        } else {
          addLog("WARN: Не удалось обновить курс валют. Используется стандартный.");
        }
      } catch (e: any) {
        addLog(`CRITICAL ERROR загрузки данных: ${e.message}`);
      }
    };

    initData();
    checkSystems();
  }, [addLog]);

  // 4. Логика предложений (fetchSuggestions аналог в useEffect)
  useEffect(() => {
    if (searchQuery.length > 2 && allSkinNames.length > 0) {
      const q = normalizeStr(searchQuery);
      const filtered = allSkinNames
        .filter(name => normalizeStr(name).includes(q))
        .slice(0, 10);
      setSuggestions(filtered);
    } else {
      setSuggestions([]);
    }
  }, [searchQuery, allSkinNames]);

  useEffect(() => localStorage.setItem(STORAGE_KEY, JSON.stringify(config)), [config]);
  useEffect(() => localStorage.setItem(GIVEAWAYS_KEY, JSON.stringify(giveaways)), [giveaways]);
  useEffect(() => localStorage.setItem(PARTICIPATION_KEY, JSON.stringify(participatedIds)), [participatedIds]);
  useEffect(() => localStorage.setItem(FAVORITES_KEY, JSON.stringify(favorites)), [favorites]);

  const apiRequest = async (targetUrl: string) => {
    const rawKey = ((process.env.MARKET_API_KEY as string) || config.lisSkinsKey || DEFAULT_API_KEY).trim();
    const proxy = config.customProxyUrl || DEFAULT_PROXY_URL;
    const finalProxyUrl = `${proxy.endsWith('/') ? proxy : proxy + '/'}?url=${encodeURIComponent(targetUrl)}`;
    
    const headers: HeadersInit = { 'Accept': 'application/json' };
    if (rawKey) headers['Authorization'] = `Bearer ${rawKey}`;
    
    return fetch(finalProxyUrl, { method: 'GET', headers, mode: 'cors' });
  };

  const checkSystems = async () => {
    await testProxy();
    if (config.lisSkinsKey || (process.env.MARKET_API_KEY as string)) await validateApiKey();
  };

  const testProxy = async () => {
    try {
      const res = await fetch(config.customProxyUrl || DEFAULT_PROXY_URL);
      const text = await res.text();
      setProxyStatus(res.ok && text.includes('Worker is Alive') ? 'ok' : 'error');
    } catch (e) { 
      setProxyStatus('error');
      addLog("ERROR: Прокси недоступен.");
    }
  };

  const validateApiKey = async () => {
    try {
      const res = await apiRequest(`https://api.lis-skins.com/v1/market/search?game=csgo&limit=1`);
      setApiKeyStatus(res.ok ? 'ok' : 'error');
    } catch (e) { 
      setApiKeyStatus('error');
      addLog("ERROR: API ключ отклонен или ошибка сети.");
    }
  };

  const selectSuggestion = (name: string) => {
    setSearchQuery(name);
    setSuggestions([]);
    handleSearch(name);
  };

  // 2. Исправленный handleSearch
  const handleSearch = async (forcedQuery?: string) => {
    let query = (forcedQuery || searchQuery).trim();
    if (query.length < 2) return;

    // Нормализация для поиска точного соответствия в базе перед запросом к API
    const normInput = normalizeStr(query);
    const matchedName = allSkinNames.find(name => normalizeStr(name) === normInput) || 
                       allSkinNames.find(name => normalizeStr(name).includes(normInput));

    if (matchedName) {
      query = matchedName;
      addLog(`Поиск уточнен до: ${query}`);
    }

    // Если нет ключа в конфиге и нет переменной окружения, то просим ключ
    if (!config.lisSkinsKey.trim() && !(process.env.MARKET_API_KEY as string)) { 
      setError('Укажите API ключ в настройках'); 
      setActiveTab('settings'); 
      return; 
    }
    
    setIsSearching(true);
    setError(null);
    setSearchResults([]);
    setSuggestions([]); 
    
    addLog(`Запрос к API Lis-Skins: ${query}...`);
    
    try {
      const res = await apiRequest(`https://api.lis-skins.com/v1/market/search?game=csgo&names[]=${encodeURIComponent(query)}&limit=15&only_unlocked=1&sort_by=lowest_price`);
      
      if (!res.ok) {
        throw new Error(`Сервер ответил ошибкой: ${res.status}`);
      }

      const result = await res.json();
      
      let rawItems = [];
      if (Array.isArray(result)) rawItems = result;
      else if (result.items) rawItems = result.items;
      else if (result.data?.items) rawItems = result.data.items;
      else if (result.data) rawItems = result.data;

      if (rawItems && rawItems.length > 0) {
        setSearchResults(rawItems.map((item: any) => {
          const priceRub = (parseFloat(item.price || 0) * exchangeRate).toFixed(0);
          const classId = item.item_class_id || item.class_id || '';
          const meta = skinsMetadata.get(item.name) || skinsMetadata.get(item.name.replace(/\s\(.*\)$/, ''));

          return {
            id: item.id || item.item_id || Math.random(),
            name: localizeName(item.name || 'Unknown Item'),
            price: priceRub,
            image: classId ? `https://community.cloudflare.steamstatic.com/economy/image/class/730/${classId}/300fx300f` : '',
            rarity: meta?.rarity || localizeRarity(item.rarity_name || 'Common'),
            rarityColor: meta?.color || '#5e98d9',
          };
        }));
        addLog(`Найдено товаров: ${rawItems.length}`);
      } else {
        setError('Ничего не найдено на маркете.');
        addLog(`API вернул 0 результатов для "${query}".`);
      }
    } catch (err: any) { 
      setError(err.message); 
      addLog(`ERROR в handleSearch: ${err.message}`);
    } finally { 
      setIsSearching(false); 
    }
  };

  const toggleFavorite = (skin: Skin) => {
    const isFav = favorites.some(f => f.name === skin.name);
    if (isFav) {
      setFavorites(prev => prev.filter(f => f.name !== skin.name));
      addLog(`Удалено из избранного: ${skin.name}`);
    } else {
      setFavorites(prev => [...prev, skin]);
      addLog(`Добавлено в избранное: ${skin.name}`);
    }
  };

  const addPrize = (skin: Skin) => {
    setSelectedSkins(prev => [...prev, skin]);
    setIsAddingMore(false);
    addLog(`Приз добавлен в лот: ${skin.name}`);
  };

  const removePrize = (index: number) => {
    const removed = selectedSkins[index];
    setSelectedSkins(prev => prev.filter((_, i) => i !== index));
    addLog(`Приз удален: ${removed.name}`);
    if (selectedSkins.length === 1) setIsAddingMore(true);
  };

  const launchGiveaway = () => {
    if (selectedSkins.length === 0) return;
    const endTime = (duration === "custom" && customDate) ? new Date(customDate).getTime() : Date.now() + (parseInt(duration) * 60000);
    const newG: Giveaway = {
      id: Math.random().toString(36).substring(2, 9),
      skins: selectedSkins,
      endTime,
      status: 'active',
      winners: [],
      participants: [] 
    };
    setGiveaways(prev => [newG, ...prev]);
    setSelectedSkins([]);
    setIsAddingMore(true);
    setSearchQuery(''); // Логика сброса: очистка поиска после создания
    setActiveTab('dashboard');
    addLog(`РОЗЫГРЫШ ЗАПУЩЕН! ID: ${newG.id}`);
  };

  const forceEnd = (id: string) => {
    setGiveaways(prev => prev.map(g => g.id === id ? { 
      ...g, 
      status: 'ended' as const, 
      endTime: Date.now(), 
      winners: g.skins.map((_, i) => `TestUser_${i + 1}`) 
    } : g));
    addLog(`Розыгрыш ${id} завершен досрочно.`);
  };

  const toggleParticipation = (giveawayId: string) => {
    setGiveaways(prev => prev.map(g => {
      if (g.id === giveawayId && g.status === 'active') {
        const isAlreadyIn = g.participants.includes(myUserId);
        if (isAlreadyIn) {
          return { ...g, participants: g.participants.filter(p => p !== myUserId) };
        } else {
          return { ...g, participants: [...g.participants, myUserId] };
        }
      }
      return g;
    }));
    
    setParticipatedIds(prev => {
      if (prev.includes(giveawayId)) return prev.filter(id => id !== giveawayId);
      return [...prev, giveawayId];
    });
  };

  return (
    <div 
      className="min-h-screen bg-[#090a0d] text-gray-200 font-sans flex flex-col pb-24 relative overflow-x-hidden"
      style={{ paddingTop: 'calc(var(--tg-safe-area-inset-top, 0px) + 20px)' }}
    >
      {/* Background Ambient Glow */}
      <div className="fixed top-[-20%] left-[-20%] w-[140%] h-[140%] pointer-events-none z-0 opacity-10">
        <div 
          className="w-full h-full bg-[radial-gradient(circle_at_50%_50%,#FFD700,transparent_60%)] animate-gold-glow"
        ></div>
      </div>

      <header className="sticky top-0 z-40 bg-[#090a0d]/90 backdrop-blur-2xl border-b border-white/[0.04] px-6 py-5 flex items-center justify-between shadow-lg">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-[#ff6b00] rounded-xl flex items-center justify-center shadow-[0_0_20px_rgba(255,107,0,0.3)]">
            <Gift className="text-white" size={20} />
          </div>
          <h1 className="text-sm font-black tracking-[0.2em] uppercase text-white">ХАЛЯВА</h1>
        </div>
        <div className="flex space-x-2.5">
          <StatusDot status={proxyStatus} icon={<Globe size={8} />} />
          <StatusDot status={apiKeyStatus} icon={<Key size={8} />} />
        </div>
      </header>

      <main className="flex-1 px-4 py-6 overflow-x-hidden relative z-10">
        {activeTab === 'dashboard' && (
          <div className="space-y-6 animate-in fade-in duration-500">
            <StatsCard title="Активных розыгрышей" value={giveaways.filter(g => g.status === 'active').length} icon={<Trophy size={16} />} />
            
            <div className="space-y-4">
              <h2 className="text-[9px] font-black uppercase tracking-[0.3em] text-gray-500 px-1 flex items-center"><Activity size={10} className="mr-2" /> ЛЕНТА</h2>
              {giveaways.length === 0 ? (
                <div className="bg-[#111217]/80 rounded-[2.5rem] p-12 text-center border border-white/[0.05] backdrop-blur-md shadow-[inset_0_0_20px_rgba(255,255,255,0.02)]">
                  <p className="text-[10px] text-gray-600 uppercase font-black tracking-widest opacity-40">Пусто</p>
                </div>
              ) : (
                giveaways.map(g => (
                  <div key={g.id} className="bg-[#111217]/80 backdrop-blur-md rounded-[2.5rem] border border-white/[0.05] p-6 shadow-2xl relative overflow-hidden group hover:shadow-[inset_0_0_20px_rgba(255,255,255,0.03)] transition-all">
                    <div className="flex justify-between items-start mb-6">
                      <div className="flex-1 space-y-5">
                        {g.skins.map((skin, idx) => {
                          const { name, exterior } = splitSkinName(skin.name);
                          return (
                            <div key={idx} className="flex items-center space-x-4">
                              {/* Rarity Line Indicator */}
                              <div className="w-1 self-stretch shrink-0 rounded-full" style={{ backgroundColor: skin.rarityColor || '#5e98d9' }} />
                              
                              <div className="w-16 h-16 bg-black/60 rounded-lg flex items-center justify-center shrink-0 border border-white/5 relative overflow-hidden">
                                <div 
                                  className="absolute inset-0 z-0 opacity-10" 
                                  style={{ background: `linear-gradient(135deg, transparent, ${skin.rarityColor || '#5e98d9'})` }}
                                ></div>
                                {skin.image && (
                                  <img 
                                    src={skin.image} 
                                    className="w-full h-full object-contain relative z-10" 
                                    style={{ mixBlendMode: 'screen' }} 
                                  />
                                )}
                              </div>
                              <div className="min-w-0 flex-1">
                                 <div className="text-[6px] font-black uppercase text-gray-500 mb-0.5">{skin.rarity}</div>
                                 {/* Combined name and quality on one line, protected by ellipsis and nowrap */}
                                 <h4 className="font-black text-sm text-white leading-tight truncate whitespace-nowrap">
                                   {name} <span className="text-gray-400 font-bold">{exterior}</span>
                                 </h4>
                                 {/* Gradient Price Text */}
                                 <p className="text-xl font-black bg-gradient-to-r from-orange-400 to-orange-600 text-gradient animate-gradient mt-1">
                                   {formatPrice(skin.price)} ₽
                                 </p>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                      
                      <div className="flex space-x-1">
                        {g.status === 'active' && (
                          <button 
                            onClick={() => forceEnd(g.id)} 
                            title="Завершить досрочно"
                            className="p-2 text-gray-700 hover:text-orange-500 transition-colors"
                          >
                            <XCircle size={20} />
                          </button>
                        )}
                        <button 
                          onClick={() => setGiveaways(prev => prev.filter(x => x.id !== g.id))} 
                          className="p-2 text-gray-700 hover:text-red-500 transition-colors"
                        >
                          <Trash2 size={20} />
                        </button>
                      </div>
                    </div>

                    {/* Redesigned Info Panel: Grid layout with 3 columns, smaller icons and ultra-compact text */}
                    <div className="grid grid-cols-3 gap-2">
                      <div className="bg-white/[0.03] border border-white/[0.05] rounded-xl p-1.5 flex items-center space-x-1.5 transition-colors group-hover:bg-white/[0.05]">
                        <div className="p-1 bg-white/[0.02] rounded-lg shrink-0">
                          <Clock size={14} className="text-gray-500" strokeWidth={2.5} />
                        </div>
                        <div className="flex flex-col min-w-0">
                          <span className="text-[9px] text-gray-500 leading-none mb-0.5 font-bold uppercase">Осталось</span>
                          <span className={`text-sm font-black leading-none truncate ${g.status === 'ended' ? 'text-red-500' : 'text-white'}`}>
                            {formatCountdown(g.endTime, currentTime)}
                          </span>
                        </div>
                      </div>
                      
                      <div className="bg-white/[0.03] border border-white/[0.05] rounded-xl p-1.5 flex items-center space-x-1.5 transition-colors group-hover:bg-white/[0.05]">
                        <div className="p-1 bg-white/[0.02] rounded-lg shrink-0">
                          <Gift size={14} className="text-gray-500" strokeWidth={2.5} />
                        </div>
                        <div className="flex flex-col min-w-0">
                          <span className="text-[9px] text-gray-500 leading-none mb-0.5 font-bold uppercase">Призов</span>
                          <span className="text-sm font-black text-white leading-none">
                            {g.skins.length}
                          </span>
                        </div>
                      </div>

                      <div className="bg-white/[0.03] border border-white/[0.05] rounded-xl p-1.5 flex items-center space-x-1.5 transition-colors group-hover:bg-white/[0.05]">
                        <div className="p-1 bg-white/[0.02] rounded-lg shrink-0">
                          <Users size={14} className="text-gray-500" strokeWidth={2.5} />
                        </div>
                        <div className="flex flex-col min-w-0">
                          <span className="text-[9px] text-gray-500 leading-none mb-0.5 font-bold uppercase">Участники</span>
                          <span className="text-sm font-black text-white leading-none">
                            {g.participants.length}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Winners display if ended */}
                    {g.status === 'ended' && (
                      <div className="mt-4 p-3 bg-green-500/5 rounded-xl border border-green-500/10 text-center">
                        <span className="text-[8px] font-black text-green-500 uppercase block mb-1">Победители</span>
                        <div className="text-[9px] font-bold text-white flex flex-wrap justify-center gap-2">
                          {g.winners.map((w, i) => <span key={i} className="bg-green-500/10 px-2 py-0.5 rounded-md">@{w}</span>)}
                        </div>
                      </div>
                    )}

                    {/* Participate Button with Animated Gradient */}
                    {g.status === 'active' && (
                      <button 
                        onClick={() => toggleParticipation(g.id)}
                        className={`w-full mt-4 py-4 rounded-2xl font-black text-[11px] uppercase tracking-[0.2em] transition-all shadow-xl shadow-green-900/10 animate-gradient ${g.participants.includes(myUserId) ? 'bg-green-500/10 text-green-500 border border-green-500/20' : 'bg-gradient-to-r from-green-400 to-green-600 text-white active:scale-95'}`}
                      >
                        {g.participants.includes(myUserId) ? 'Вы участвуете' : 'УЧАСТВОВАТЬ'}
                      </button>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {activeTab === 'create' && (
          <div className="space-y-6 animate-in slide-in-from-bottom-4 duration-500 pb-12">
             {selectedSkins.length > 0 && !isAddingMore && (
               <div className="space-y-4">
                  <div className="flex items-center justify-between px-1">
                    <h2 className="text-[10px] font-black uppercase text-gray-500">ПРИЗЫ В РОЗЫГРЫШЕ ({selectedSkins.length})</h2>
                    <button onClick={() => setIsAddingMore(true)} className="flex items-center text-[#ff6b00] text-[9px] font-black uppercase"><Plus size={14} className="mr-1" /> Добавить еще</button>
                  </div>
                  <div className="space-y-2">
                    {selectedSkins.map((s, i) => (
                      <div key={i} className="bg-[#111217] p-4 rounded-2xl flex items-center justify-between border border-white/[0.04]">
                         <div className="flex items-center space-x-3">
                           <div className="w-1 shrink-0 self-stretch rounded-full" style={{ backgroundColor: s.rarityColor || '#5e98d9' }} />
                           <div className="w-14 h-14 bg-black/40 rounded-lg flex items-center justify-center border border-white/5 relative overflow-hidden">
                              <div 
                                className="absolute inset-0 z-0 opacity-10" 
                                style={{ background: `linear-gradient(135deg, transparent, ${s.rarityColor || '#5e98d9'})` }}
                              ></div>
                              <img src={s.image} className="w-full h-full object-contain relative z-10" />
                           </div>
                           <div className="min-w-0">
                             <h4 className="text-xs font-bold text-white truncate">{s.name}</h4>
                             <p className="text-[#ff6b00] text-base font-black">{formatPrice(s.price)} ₽</p>
                           </div>
                         </div>
                         <button onClick={() => removePrize(i)} className="p-2 text-gray-700 hover:text-red-500"><Trash2 size={16} /></button>
                      </div>
                    ))}
                  </div>

                  <div className="bg-[#111217] p-6 rounded-[2rem] space-y-5 border border-white/[0.04]">
                    <div className="space-y-3">
                      <label className="text-[9px] font-black text-gray-700 uppercase tracking-widest px-1 flex items-center"><Clock size={12} className="mr-2" /> Длительность</label>
                      <select className="w-full bg-black/60 border border-white/[0.06] rounded-2xl py-4 px-5 text-xs font-bold text-white outline-none" value={duration} onChange={(e) => setDuration(e.target.value)}>
                        <option value="5">5 минут</option><option value="15">15 минут</option><option value="30">30 минут</option><option value="60">1 час</option><option value="180">3 часа</option><option value="720">12 часов</option><option value="custom">Своя дата</option>
                      </select>
                      {duration === "custom" && <input type="datetime-local" className="w-full bg-black/60 border border-white/[0.06] rounded-2xl py-4 px-5 text-xs font-bold text-white" value={customDate} onChange={(e) => setCustomDate(e.target.value)} />}
                    </div>
                    <button onClick={launchGiveaway} className="w-full bg-[#ff6b00] text-white py-5 rounded-2xl font-black text-[11px] uppercase tracking-[0.3em] active:scale-95 shadow-xl">ЗАПУСТИТЬ</button>
                  </div>
               </div>
             )}

             {isAddingMore && (
               <div className="space-y-6">
                 <div className="flex items-center justify-between px-1">
                    <h2 className="text-[10px] font-black uppercase text-gray-500">ВЫБОР ПРИЗА</h2>
                    {selectedSkins.length > 0 && <button onClick={() => setIsAddingMore(false)} className="text-gray-500 text-[9px] font-black uppercase flex items-center"><ChevronLeft size={14} className="mr-1" /> Отмена</button>}
                 </div>

                 {/* Система Избранных: кнопка переключения */}
                 <div className="flex space-x-2">
                    <button 
                      onClick={() => setShowFavoritesOnly(false)}
                      className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-wider border transition-all ${!showFavoritesOnly ? 'bg-[#ff6b00] border-[#ff6b00] text-white' : 'bg-[#111217] border-white/[0.05] text-gray-500'}`}
                    >
                      Поиск
                    </button>
                    <button 
                      onClick={() => setShowFavoritesOnly(true)}
                      className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-wider border transition-all ${showFavoritesOnly ? 'bg-yellow-500 border-yellow-500 text-white' : 'bg-[#111217] border-white/[0.05] text-gray-500'}`}
                    >
                      <Star size={12} className="inline-block mr-1 mb-0.5" /> Избранное
                    </button>
                 </div>

                 {!showFavoritesOnly && (
                    <div className="relative">
                       <input type="text" placeholder="Название скина..." className="w-full bg-[#111217] border border-white/[0.06] rounded-2xl py-5 pl-12 pr-4 text-sm font-bold outline-none text-white focus:border-[#ff6b00]/50" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleSearch()} />
                       <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-800" size={18} />
                       {suggestions.length > 0 && (
                         <div className="absolute top-full left-0 right-0 mt-2 bg-[#16181d] border border-white/[0.08] rounded-2xl overflow-hidden shadow-2xl z-50">
                           {suggestions.map((name, i) => (
                             <button key={i} onClick={() => selectSuggestion(name)} className="w-full text-left px-5 py-4 text-[10px] font-bold text-gray-400 hover:bg-[#ff6b00]/10 border-b border-white/[0.02] last:border-0">{localizeName(name)}</button>
                           ))}
                         </div>
                       )}
                    </div>
                 )}

                 {/* Отображение результатов или избранного */}
                 <div className="grid grid-cols-1 gap-4">
                    {(showFavoritesOnly ? favorites : searchResults).map((s, i) => {
                      const { name, exterior } = splitSkinName(s.name);
                      return (
                        <div key={i} className="bg-[#111217] rounded-3xl p-5 border border-white/[0.05] flex flex-col relative overflow-hidden shadow-[inset_0_0_20px_rgba(255,255,255,0.02)]">
                           <button onClick={() => toggleFavorite(s)} className="absolute top-4 right-4 z-20 text-gray-700 hover:text-yellow-500 transition-colors">
                              {favorites.some(f => f.name === s.name) ? <Star size={18} fill="#eab308" className="text-yellow-500" /> : <StarOff size={18} />}
                           </button>
                           <div className="flex items-center space-x-6 mb-5">
                             <div className="w-1 self-stretch rounded-full" style={{ backgroundColor: s.rarityColor || '#5e98d9' }} />
                             <div className="w-24 h-24 bg-black/60 rounded-2xl flex items-center justify-center border border-white/5 shrink-0 relative overflow-hidden">
                                <div 
                                  className="absolute inset-0 z-0 opacity-10" 
                                  style={{ background: `linear-gradient(135deg, transparent, ${s.rarityColor || '#5e98d9'})` }}
                                ></div>
                                {s.image && <img src={s.image} className="w-full h-full object-contain relative z-10" style={{ mixBlendMode: 'screen' }} />}
                             </div>
                             <div className="min-w-0 flex-1">
                               <div className="text-[7px] font-black uppercase px-2 py-0.5 border rounded-lg mb-1.5 inline-block" style={{ borderColor: `${s.rarityColor}44`, color: s.rarityColor, backgroundColor: `${s.rarityColor}11` }}>{s.rarity}</div>
                               <h3 className={`font-black text-sm truncate leading-tight ${['Covert', 'Classified', 'Extraordinary'].includes(s.rarity || '') ? 'animate-gradient text-gradient bg-gradient-to-r from-white via-gray-300 to-white' : 'text-white'}`}>
                                 {name} <span className="text-gray-400 font-bold">{exterior}</span>
                               </h3>
                               <p className="text-2xl font-black bg-gradient-to-r from-orange-400 to-orange-600 text-gradient animate-gradient mt-2">
                                 {formatPrice(s.price)} ₽
                               </p>
                             </div>
                           </div>
                           <button onClick={() => addPrize(s)} className="w-full bg-[#22c55e] hover:bg-green-600 text-white py-4 rounded-xl font-black text-[10px] uppercase tracking-widest active:scale-95 transition-all">ВЫБРАТЬ</button>
                        </div>
                      );
                    })}
                    {showFavoritesOnly && favorites.length === 0 && (
                       <div className="text-center py-12 text-gray-600 text-[10px] font-black uppercase tracking-widest opacity-40">Избранных скинов нет</div>
                    )}
                 </div>
               </div>
             )}
          </div>
        )}

        {activeTab === 'settings' && (
          <div className="space-y-6 animate-in fade-in duration-500">
            <div className="bg-[#111217]/80 backdrop-blur-md rounded-[2.5rem] p-8 border border-white/[0.05] space-y-7 shadow-xl shadow-[inset_0_0_20px_rgba(255,255,255,0.02)]">
              <h2 className="text-[10px] font-black uppercase text-gray-500 flex items-center"><ShieldCheck size={16} className="mr-3 text-[#ff6b00]" /> НАСТРОЙКИ</h2>
              <div className="space-y-3.5 relative">
                <label className="text-[9px] font-black text-gray-700 uppercase px-1.5 flex justify-between">Lis-Skins API Key <button onClick={() => setShowKey(!showKey)} className="text-[#ff6b00] lowercase">{showKey ? 'скрыть' : 'показать'}</button></label>
                <input type={showKey ? "text" : "password"} className="w-full bg-black/60 border border-white/[0.06] rounded-2xl py-5 px-7 text-xs font-bold outline-none text-white focus:border-[#ff6b00]/50" value={config.lisSkinsKey} onChange={(e) => setConfig({...config, lisSkinsKey: e.target.value})} placeholder="e785e6e0-..." />
              </div>
              <button onClick={checkSystems} className="w-full py-5 rounded-2xl bg-[#ff6b00] text-white text-[9px] font-black uppercase tracking-[0.2em] shadow-xl active:scale-95">Проверить статус</button>
            </div>

            <div className="bg-black/40 rounded-[2.5rem] p-8 border border-white/[0.03] space-y-4">
               <h3 className="text-[9px] font-black uppercase text-gray-700 flex items-center"><Terminal size={12} className="mr-2" /> ЖУРНАЛ СОБЫТИЙ</h3>
               <div className="space-y-2 font-mono overflow-hidden">
                  {debugLog.length === 0 && <p className="text-[8px] text-gray-800">Пусто...</p>}
                  {debugLog.map((log, i) => (
                     <div key={i} className={`text-[8px] flex items-start ${log.includes('ERROR') ? 'text-red-400' : 'text-gray-500'}`}>
                        <ChevronRight size={10} className="mr-1.5 opacity-30 mt-0.5" /> <span className="break-all">{log}</span>
                     </div>
                  ))}
               </div>
            </div>
          </div>
        )}
      </main>

      <nav className="fixed bottom-0 left-0 right-0 z-50 bg-[#090a0d]/95 backdrop-blur-3xl border-t border-white/[0.04] px-6 pt-4 h-24 flex justify-between items-center shadow-[0_-20px_60px_rgba(0,0,0,0.8)]">
        <TabButton active={activeTab === 'dashboard'} onClick={() => setActiveTab('dashboard')} icon={<LayoutDashboard size={22} />} label="Главная" />
        <TabButton active={activeTab === 'create'} onClick={() => setActiveTab('create')} icon={<PlusCircle size={22} />} label="Создать" />
        <TabButton active={activeTab === 'settings'} onClick={() => setActiveTab('settings')} icon={<Settings size={22} />} label="Опции" />
      </nav>
    </div>
  );
}

function StatusDot({ status, icon }: { status: string, icon: React.ReactNode }) {
  const colors: Record<string, string> = { unknown: 'bg-gray-800', ok: 'bg-green-500 shadow-[0_0_10px_rgba(34,197,94,0.4)]', error: 'bg-red-500 animate-pulse' };
  return <div className={`w-5 h-5 rounded-lg flex items-center justify-center border border-white/5 transition-all ${colors[status] || colors.unknown}`}><div className="opacity-50 text-white">{icon}</div></div>;
}

function TabButton({ active, onClick, icon, label }: { active: boolean, onClick: () => void, icon: React.ReactNode, label: string }) {
  return (
    <button onClick={onClick} className={`flex flex-col items-center justify-center space-y-1.5 transition-all flex-1 ${active ? 'text-[#ff6b00]' : 'text-gray-700'}`}>
      <div className={`transition-transform active:scale-90 ${active ? 'scale-110' : ''}`}>{icon}</div>
      <span className="text-[8px] font-black uppercase tracking-[0.1em]">{label}</span>
    </button>
  );
}

function StatsCard({ title, value, icon }: { title: string, value: string | number, icon: React.ReactNode }) {
  return (
    <div className="bg-[#111217]/80 backdrop-blur-md border border-white/[0.05] p-8 rounded-[2.5rem] flex items-center justify-between shadow-2xl relative overflow-hidden group shadow-[inset_0_0_20px_rgba(255,255,255,0.01)]">
      <div className="absolute inset-0 bg-gradient-to-br from-white/[0.01] to-transparent pointer-events-none"></div>
      <div className="bg-[#ff6b00]/10 p-4 rounded-2xl text-[#ff6b00] relative z-10">{icon}</div>
      <div className="text-right relative z-10">
        <p className="text-[9px] font-black text-gray-700 uppercase mb-2">{title}</p>
        <p className="text-3xl font-black text-white">{value}</p>
      </div>
    </div>
  );
}

const rootElement = document.getElementById('root');
if (rootElement) { createRoot(rootElement).render(<App />); }