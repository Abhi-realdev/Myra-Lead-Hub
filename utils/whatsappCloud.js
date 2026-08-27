import crypto from 'crypto';
import {
  LEAD_WELCOME_TEMPLATE,
  LEAD_WELCOME_TEMPLATE_NAME,
  TEMPLATES_WITHOUT_BODY_PARAMETERS
} from './whatsappTemplates.js';

const ENGLISH_LANGUAGE_FALLBACKS = ['en_US', 'en', 'en_GB'];
const AUTH_ERROR_CODES = new Set([102, 190, 463, 467]);

function cleanAccessToken(accessToken) {
  return String(accessToken || '').trim().replace(/^["']|["']$/g, '');
}

function withAppSecretProof(url, accessToken) {
  const appSecret = String(process.env.WHATSAPP_APP_SECRET || '').trim();
  if (!appSecret) {
    return url;
  }

  const proof = crypto.createHmac('sha256', appSecret).update(accessToken).digest('hex');
  return `${url}${url.includes('?') ? '&' : '?'}appsecret_proof=${proof}`;
}

async function graphRequest(url, accessToken, options = {}) {
  const token = cleanAccessToken(accessToken);
  const response = await fetch(withAppSecretProof(url, token), {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...options.headers
    }
  });
  const result = await response.json().catch(() => ({}));
  return { response, result };
}

function graphErrorMessage(result) {
  const error = result?.error;
  if (!error) {
    return null;
  }

  const details = error.error_data?.details || error.error_user_msg;
  return [error.message, details].filter(Boolean).join(' ');
}

async function postTemplate({
  apiVersion,
  phoneNumberId,
  accessToken,
  to,
  templateName,
  language,
  name,
  program,
  goal
}) {
  const template = {
    name: templateName,
    language: {
      code: language
    }
  };

  if (!TEMPLATES_WITHOUT_BODY_PARAMETERS.has(templateName)) {
    template.components = [{
      type: 'body',
      parameters: [
        { type: 'text', text: name },
        { type: 'text', text: program || 'our programs' },
        { type: 'text', text: goal || 'your educational goals' }
      ]
    }];
  }

  return graphRequest(
    `https://graph.facebook.com/${apiVersion}/${phoneNumberId}/messages`,
    accessToken,
    {
      method: 'POST',
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to,
        type: 'template',
        template
      })
    }
  );
}

async function wabaIdFromDebugToken({ apiVersion, accessToken }) {
  const token = cleanAccessToken(accessToken);
  const lookup = await graphRequest(
    `https://graph.facebook.com/${apiVersion}/debug_token?input_token=${encodeURIComponent(token)}`,
    token
  );
  const scopes = lookup.result.data?.granular_scopes || [];

  for (const scope of scopes) {
    if (!/whatsapp/i.test(scope.scope || '')) {
      continue;
    }

    const id = (scope.target_ids || []).find(Boolean);
    if (id) {
      return id;
    }
  }

  return null;
}

async function resolveWabaId({ apiVersion, phoneNumberId, accessToken, wabaId }) {
  const configuredId = String(wabaId || process.env.WHATSAPP_WABA_ID || '').trim();
  if (configuredId) {
    return { wabaId: configuredId, error: null };
  }

  const fromToken = await wabaIdFromDebugToken({ apiVersion, accessToken });
  if (fromToken) {
    return { wabaId: fromToken, error: null };
  }

  const accountsLookup = await graphRequest(
    `https://graph.facebook.com/${apiVersion}/me/whatsapp_business_accounts?fields=id,name&limit=10`,
    accessToken
  );
  const accountId = accountsLookup.result.data?.[0]?.id;
  if (accountId) {
    return { wabaId: accountId, error: null };
  }

  return {
    wabaId: null,
    error: 'Set WHATSAPP_WABA_ID in .env to the WhatsApp Business Account ID from Meta Developer Dashboard → WhatsApp → API Setup.'
  };
}

export async function listWhatsAppTemplates({ apiVersion, phoneNumberId, accessToken, wabaId }) {
  const resolved = await resolveWabaId({ apiVersion, phoneNumberId, accessToken, wabaId });
  if (!resolved.wabaId) {
    return { templates: [], wabaId: null, error: resolved.error };
  }

  const templatesLookup = await graphRequest(
    `https://graph.facebook.com/${apiVersion}/${resolved.wabaId}/message_templates?fields=name,status,language,category,rejected_reason&limit=100`,
    accessToken
  );

  if (templatesLookup.result.error) {
    return {
      templates: [],
      wabaId: resolved.wabaId,
      error: graphErrorMessage(templatesLookup.result)
    };
  }

  return {
    templates: templatesLookup.result.data || [],
    wabaId: resolved.wabaId,
    error: null
  };
}

export async function submitLeadWelcomeTemplate({ apiVersion, phoneNumberId, accessToken, wabaId }) {
  const listing = await listWhatsAppTemplates({ apiVersion, phoneNumberId, accessToken, wabaId });
  if (!listing.wabaId) {
    return {
      ok: false,
      status: 502,
      body: {
        message: listing.error || 'WhatsApp Business Account ID is required to create the welcome template. Set WHATSAPP_WABA_ID in .env.',
        templates: []
      }
    };
  }

  const existing = listing.templates.find(template => template.name === LEAD_WELCOME_TEMPLATE_NAME);
  if (existing) {
    return {
      ok: true,
      status: 200,
      body: {
        created: false,
        template: {
          name: existing.name,
          language: existing.language,
          status: existing.status,
          category: existing.category
        },
        message: existing.status === 'APPROVED' || existing.status === 'ACTIVE'
          ? `Template "${LEAD_WELCOME_TEMPLATE_NAME}" is already ${existing.status}. You can send it now.`
          : `Template "${LEAD_WELCOME_TEMPLATE_NAME}" already exists with status ${existing.status}. Wait until it is Active, then send again.`
      }
    };
  }

  const { response, result } = await graphRequest(
    `https://graph.facebook.com/${apiVersion}/${listing.wabaId}/message_templates`,
    accessToken,
    {
      method: 'POST',
      body: JSON.stringify(LEAD_WELCOME_TEMPLATE)
    }
  );

  if (!response.ok) {
    return {
      ok: false,
      status: response.status,
      body: {
        message: graphErrorMessage(result) || 'Could not create the Myra welcome template in Meta.',
        wabaId: listing.wabaId
      }
    };
  }

  return {
    ok: true,
    status: 201,
    body: {
      created: true,
      template: {
        name: LEAD_WELCOME_TEMPLATE_NAME,
        language: LEAD_WELCOME_TEMPLATE.language,
        status: result.status || 'PENDING',
        id: result.id
      },
      message: `Submitted "${LEAD_WELCOME_TEMPLATE_NAME}" to Meta. Wait until WhatsApp Manager shows it as Active, then send the lead message again.`
    }
  };
}

function formatTemplateList(templates) {
  if (!templates.length) {
    return 'none listed';
  }

  return templates
    .map(template => `${template.name} (${template.language}, ${template.status})`)
    .join(', ');
}

function isUsableTemplateStatus(status) {
  return status === 'APPROVED' || status === 'ACTIVE';
}

function isPendingTemplateStatus(status) {
  return /pending|review|received|flagged/i.test(String(status || ''));
}

function buildMissingTemplateMessage({ templateName, templateLanguage, listing }) {
  const pending = listing.templates.find(template =>
    template.name === templateName && isPendingTemplateStatus(template.status)
  );

  if (pending) {
    return `Template "${templateName}" is still ${pending.status}. WhatsApp will reject sends until WhatsApp Manager shows it as Active (this can take up to 24 hours). Try again after it is Active.`;
  }

  if (templateName === LEAD_WELCOME_TEMPLATE_NAME) {
    return `Template "${LEAD_WELCOME_TEMPLATE_NAME}" is not Active on this number yet. If WhatsApp Manager shows it In Review, wait until it is Active, then send again. Until then you can temporarily set WHATSAPP_TEMPLATE_NAME=hello_world to test sending.`;
  }

  if (listing.error) {
    return `Template "${templateName}" is not available to send yet (language ${templateLanguage}). ${listing.error}`;
  }

  if (!listing.templates.length) {
    return `Template "${templateName}" was not found. Confirm the exact name and language in WhatsApp Manager, then set WHATSAPP_TEMPLATE_NAME and WHATSAPP_TEMPLATE_LANGUAGE.`;
  }

  return `Template "${templateName}" is not available in language "${templateLanguage}". Templates on this account: ${formatTemplateList(listing.templates)}. Copy an approved name and language into WHATSAPP_TEMPLATE_NAME and WHATSAPP_TEMPLATE_LANGUAGE, then restart the API.`;
}

export async function sendWhatsAppTemplateMessage({
  apiVersion = 'v20.0',
  phoneNumberId,
  accessToken,
  wabaId,
  templateName,
  templateLanguage = 'en_US',
  to,
  name,
  program,
  goal
}) {
  const languagesToTry = [
    templateLanguage,
    ...ENGLISH_LANGUAGE_FALLBACKS.filter(code => code !== templateLanguage)
  ];

  let lastFailure;

  for (const language of languagesToTry) {
    const { response, result } = await postTemplate({
      apiVersion,
      phoneNumberId,
      accessToken,
      to,
      templateName,
      language,
      name,
      program,
      goal
    });

    if (response.ok) {
      return {
        ok: true,
        status: 200,
        body: {
          success: true,
          messageId: result.messages?.[0]?.id,
          provider: 'whatsapp-cloud-api',
          templateName,
          templateLanguage: language
        }
      };
    }

    lastFailure = { response, result, language };
    if (result.error?.code !== 132001) {
      break;
    }
  }

  const metaError = lastFailure?.result?.error;
  if (AUTH_ERROR_CODES.has(metaError?.code) || /authentication error/i.test(metaError?.message || '')) {
    return {
      ok: false,
      status: lastFailure.response.status || 401,
      body: {
        message: 'WhatsApp access token is invalid or expired. In Meta Developer Dashboard → your app → WhatsApp → API Setup, generate a new access token, replace WHATSAPP_ACCESS_TOKEN in .env (no quotes or extra spaces), then restart the API with npm run dev. For production, use a permanent System User token instead of the temporary test token.',
        code: metaError?.code,
        type: metaError?.type,
        recipient: to
      }
    };
  }

  if (metaError?.code === 132001) {
    const listing = await listWhatsAppTemplates({ apiVersion, phoneNumberId, accessToken, wabaId });
    const matching = listing.templates.filter(template =>
      template.name === templateName && isUsableTemplateStatus(template.status)
    );

    if (matching.length) {
      const language = matching[0].language;
      if (!languagesToTry.includes(language)) {
        const retry = await postTemplate({
          apiVersion,
          phoneNumberId,
          accessToken,
          to,
          templateName: matching[0].name,
          language,
          name,
          program,
          goal
        });

        if (retry.response.ok) {
          return {
            ok: true,
            status: 200,
            body: {
              success: true,
              messageId: retry.result.messages?.[0]?.id,
              provider: 'whatsapp-cloud-api',
              templateName: matching[0].name,
              templateLanguage: language
            }
          };
        }
      }
    }

    if (templateName === LEAD_WELCOME_TEMPLATE_NAME && listing.wabaId && !listing.templates.some(template => template.name === templateName)) {
      const submitted = await submitLeadWelcomeTemplate({ apiVersion, phoneNumberId, accessToken, wabaId });
      if (submitted.ok && submitted.body.created) {
        return {
          ok: false,
          status: 202,
          body: {
            message: submitted.body.message,
            code: 132001,
            recipient: to
          }
        };
      }
    }

    return {
      ok: false,
      status: lastFailure.response.status || 404,
      body: {
        message: buildMissingTemplateMessage({ templateName, templateLanguage, listing }),
        code: 132001,
        type: metaError.type,
        recipient: to,
        wabaId: listing.wabaId,
        templates: listing.templates.map(template => ({
          name: template.name,
          language: template.language,
          status: template.status
        }))
      }
    };
  }

  const message = metaError?.code === 131030
    ? `Recipient ${to} is not in the WhatsApp test allowlist. Add this number in Meta WhatsApp API Setup, or move the app to production after business verification and user opt-in.`
    : metaError?.error_data?.details || metaError?.message || 'WhatsApp Cloud API request failed.';

  return {
    ok: false,
    status: lastFailure?.response.status || 502,
    body: {
      message,
      code: metaError?.code,
      type: metaError?.type,
      recipient: to
    }
  };
}
