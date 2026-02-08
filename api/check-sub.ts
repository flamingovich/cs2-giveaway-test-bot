
export default async function handler(req: any, res: any) {
  const { userId } = req.query;
  const botToken = process.env.TG_BOT_TOKEN;
  const chatId = "-1003782690455";

  if (!userId) {
    return res.status(400).json({ subscribed: false, error: "Missing userId" });
  }

  if (!botToken) {
    // Fallback for local development or missing env var
    return res.status(200).json({ subscribed: true, warning: "TG_BOT_TOKEN not set" });
  }

  try {
    const response = await fetch(
      `https://api.telegram.org/bot${botToken}/getChatMember?chat_id=${chatId}&user_id=${userId}`
    );
    const data = await response.json();

    if (data.ok) {
      const status = data.result.status;
      // Member statuses that count as "subscribed"
      const isSubscribed = ['member', 'administrator', 'creator'].includes(status);
      return res.status(200).json({ subscribed: isSubscribed });
    } else {
      // If user not found or bot not in channel, return false
      return res.status(200).json({ subscribed: false, tg_error: data.description });
    }
  } catch (error: any) {
    return res.status(500).json({ subscribed: false, error: error.message });
  }
}
