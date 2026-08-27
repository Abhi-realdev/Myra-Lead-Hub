const WHATSAPP_API_URL = import.meta.env.VITE_WHATSAPP_API_URL || '/api/whatsapp';

export async function sendWhatsAppMessage(lead) {
  if (!lead.phone) {
    throw new Error('Lead does not have a phone number');
  }

  try {
    const response = await fetch(WHATSAPP_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        to: lead.phone,
        country: lead.country,
        name: lead.name,
        program: lead.program || 'our programs',
        goal: lead.goal || 'your educational goals'
      })
    });

    const result = await response.json().catch(() => ({}));
    if (!response.ok) {
      if (result.code === 131030) {
        throw new Error(`${result.message} Restart the API and refresh the dashboard after updating Meta's test allowlist.`);
      }
      throw new Error(result.message || `WhatsApp service returned HTTP ${response.status}. Check the API terminal for the Meta error.`);
    }

    if (!result.success && !result.messageId) {
      throw new Error('WhatsApp API did not confirm the message. Check that /api/whatsapp is routed to the API server, not the dashboard.');
    }

    return result;
  } catch (error) {
    if (error instanceof TypeError && /failed to fetch|networkerror|load failed/i.test(error.message)) {
      throw new Error('WhatsApp service is unavailable. Start the API with npm run dev (or npm run api) and try again.');
    }
    throw error;
  }
}