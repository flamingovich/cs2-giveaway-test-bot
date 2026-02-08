
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'

const supabaseUrl = process.env.SUPABASE_URL || ''
const supabaseKey = process.env.SUPABASE_ANON_KEY || ''
const supabase = createClient(supabaseUrl, supabaseKey)

export default async function handler(req: any, res: any) {
    const { method } = req;
    
    try {
        if (method === 'GET') {
            const { data, error } = await supabase
                .from('giveaways')
                .select('*')
                .order('created_at', { ascending: false });
            
            if (error) throw error;
            return res.status(200).json(data);
        }

        if (method === 'POST') {
            const { skin_name, image_url, rarity_color, rarity_name, price, end_time } = req.body;
            const { data, error } = await supabase
                .from('giveaways')
                .insert([{
                    skin_name,
                    image_url,
                    rarity_color,
                    rarity_name,
                    price,
                    end_time,
                    status: 'active',
                    participants: []
                }])
                .select();
            
            if (error) throw error;
            return res.status(201).json(data[0]);
        }

        if (method === 'PATCH') {
            const { id, participants, winner, status } = req.body;
            const update: any = {};
            if (participants !== undefined) update.participants = participants;
            if (winner !== undefined) update.winner = winner;
            if (status !== undefined) update.status = status;
            
            const { data, error } = await supabase
                .from('giveaways')
                .update(update)
                .eq('id', id)
                .select();
            
            if (error) throw error;
            return res.status(200).json(data[0]);
        }

        if (method === 'DELETE') {
            const { id } = req.query;
            const { error } = await supabase
                .from('giveaways')
                .delete()
                .eq('id', id);
            
            if (error) throw error;
            return res.status(200).json({ success: true });
        }

        return res.status(405).end(`Method ${method} Not Allowed`);
    } catch (error: any) {
        return res.status(500).json({ error: error.message });
    }
}
