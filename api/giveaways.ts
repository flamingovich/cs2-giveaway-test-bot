import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
);

export default async function handler(req, res) {
  // Если мы создаем розыгрыш
  if (req.method === 'POST') {
    try {
      const { skin_name, image_url, rarity_color, end_time } = req.body;

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
      return res.status(500).json({ error: error.message });
    }
  }

  // Если мы просто загружаем список
  if (req.method === 'GET') {
    const { data, error } = await supabase
      .from('giveaways')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json(data);
  }

  res.setHeader('Allow', ['GET', 'POST']);
  res.status(405).end(`Method ${req.method} Not Allowed`);
}