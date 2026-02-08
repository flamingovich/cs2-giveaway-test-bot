import React, { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';

// Используем переменные из окружения Vercel
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

const MY_ID = "7946967720";

export default function GiveawayApp() {
  const [giveaways, setGiveaways] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  const fetchGiveaways = async () => {
    try {
      const { data, error } = await supabase
        .from('giveaways')
        .select('*')
        .order('created_at', { ascending: false });
      if (!error && data) setGiveaways(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchGiveaways();
    const interval = setInterval(fetchGiveaways, 15000);
    return () => clearInterval(interval);
  }, []);

  const handleJoin = async (giveawayId) => {
    const tg = (window as any).Telegram?.WebApp;
    const user = tg?.initDataUnsafe?.user;
    
    if (!user) {
      tg?.showAlert("Запустите приложение через Telegram!");
      return;
    }

    // Проверка подписки
    const checkRes = await fetch(`/api/check-sub?userId=${user.id}`);
    const checkData = await checkRes.json();

    if (!checkData.subscribed) {
      tg?.showAlert("Сначала подпишись на @bot_ppgtest!");
      tg?.openTelegramLink("https://t.me/bot_ppgtest");
      return;
    }

    const currentG = giveaways.find((g: any) => g.id === giveawayId) as any;
    if (currentG?.participants?.some((p: any) => p.id === user.id)) {
      tg?.showAlert("Вы уже участвуете!");
      return;
    }

    const newParticipant = { id: user.id, first_name: user.first_name, username: user.username || "" };
    const { error } = await supabase
      .from('giveaways')
      .update({ participants: [...(currentG?.participants || []), newParticipant] })
      .eq('id', giveawayId);

    if (!error) fetchGiveaways();
  };

  const handleEndGiveaway = async (giveawayId: string) => {
    const winnerData = { id: MY_ID, first_name: "Организатор", username: "" };
    await supabase
      .from('giveaways')
      .update({ status: 'finished', winner: winnerData })
      .eq('id', giveawayId);
    fetchGiveaways();
  };

  if (loading) return <div className="min-h-screen bg-[#0f111a] flex items-center justify-center">Загрузка...</div>;

  return (
    <div className="min-h-screen bg-[#0f111a] text-white p-4 font-['Roboto']">
      {giveaways.map((g: any) => (
        <div key={g.id} className="bg-[#1a1d29] rounded-xl mb-4 overflow-hidden border border-gray-800">
          <div className="p-4">
            <h3 className="text-lg font-bold truncate mb-4">{g.skin_name}</h3>
            
            <div className="grid grid-cols-3 gap-2 text-[10px] text-gray-400">
              <div className="flex flex-col items-center bg-[#242838] p-2 rounded-lg">
                <span>ОСТАЛОСЬ</span>
                <span className="text-white font-bold text-xs">24ч</span>
              </div>
              <div className="flex flex-col items-center bg-[#242838] p-2 rounded-lg">
                <span>ПРИЗОВ</span>
                <span className="text-white font-bold text-xs">1 шт.</span>
              </div>
              <div className="flex flex-col items-center bg-[#242838] p-2 rounded-lg">
                <span>УЧАСТНИКОВ</span>
                <span className="text-white font-bold text-xs">{g.participants?.length || 0}</span>
              </div>
            </div>

            {g.status === 'active' ? (
              <button 
                onClick={() => handleJoin(g.id)}
                className="w-full mt-4 bg-blue-600 hover:bg-blue-700 py-3 rounded-xl font-bold transition-all text-sm"
              >
                УЧАСТВОВАТЬ
              </button>
            ) : (
              <div className="mt-4 p-3 bg-green-900/20 border border-green-500/50 rounded-xl text-center text-sm">
                Победитель: <a href={`tg://user?id=${MY_ID}`} className="text-green-400 underline font-bold">Организатор</a>
              </div>
            )}
            
            {(window as any).Telegram?.WebApp?.initDataUnsafe?.user?.id?.toString() === MY_ID && g.status === 'active' && (
              <button 
                onClick={() => handleEndGiveaway(g.id)} 
                className="mt-3 text-[10px] text-gray-500 w-full hover:text-red-400 transition-colors"
              >
                Завершить (Админ)
              </button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}