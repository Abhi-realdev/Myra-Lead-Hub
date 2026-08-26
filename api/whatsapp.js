import { handleWhatsApp } from './_lib/whatsapp.js';

export default async function handler(request, response) {
  if (request.method !== 'POST') {
    return response.status(405).json({ message: 'Method not allowed.' });
  }

  return handleWhatsApp(request, response);
}
