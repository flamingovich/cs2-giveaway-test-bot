import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

export default async function handler(req, res) {
  // 1. Обработка создания
  if (req.method === 'POST') {
    try {
      const { skin_name, image_url, rarity_color, end_time } = req.body;

      // Лог для отладки в панели Vercel
      console.log("Attempting to insert:", { skin_name, image_url });

      const { data, error } = await supabase
        .from('giveaways')
        .insert([
          { 
            skin_name, 
            image_url, 
            rarity_color, 
            end_time: end_time || new Date(Date.now() + 86400000).toISOString(),
            status: 'active',
            participants: [] 
          }
        ])
        .select();

      if (error) throw error;
      return res.status(200).json(data[0]);
    } catch (err) {
      console.error("Supabase Error:", err.message);
      return res.status(500).json({ error: err.message });
    }
  }

  // 2. Обработка получения списка
  if (req.method === 'GET') {
    const { data, error } = await supabase
      .from('giveaways')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json(data || []);
  }

  return res.status(405).json({ message: "Method not allowed" });
}