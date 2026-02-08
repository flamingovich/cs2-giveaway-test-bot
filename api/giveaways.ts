import { createClient } from '@supabase/supabase-js';

// Инициализация клиента Supabase
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
);

export default async function handler(req, res) {
  // Обработка создания нового розыгрыша
  if (req.method === 'POST') {
    try {
      const { skin_name, image_url, rarity_color, end_time } = req.body;

      // Проверка на наличие обязательных данных
      if (!skin_name || !image_url) {
        return res.status(400).json({ error: "Missing skin data" });
      }

      const { data, error } = await supabase
        .from('giveaways')
        .insert([
          { 
            skin_name, 
            image_url, 
            rarity_color, 
            end_time,
            status: 'active',
            participants: [] 
          }
        ])
        .select();

      if (error) throw error;
      return res.status(200).json(data[0]);
    } catch (error) {
      console.error('Database error:', error);
      return res.status(500).json({ error: error.message });
    }
  }

  // Обработка получения списка розыгрышей
  if (req.method === 'GET') {
    try {
      const { data, error } = await supabase
        .from('giveaways')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return res.status(200).json(data);
    } catch (error) {
      return res.status(500).json({ error: error.message });
    }
  }

  res.setHeader('Allow', ['GET', 'POST']);
  res.status(405).end(`Method ${req.method} Not Allowed`);
}