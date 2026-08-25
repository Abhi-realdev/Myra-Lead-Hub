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

    return result;
  } catch (error) {
    if (error instanceof TypeError && error.message === 'Failed to fetch') {
      throw new Error('WhatsApp service is unavailable. Start the API server and try again.');
    }
    throw error;
  }
}