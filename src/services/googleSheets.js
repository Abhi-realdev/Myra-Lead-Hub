const SHEET_ID = '1dIVYvFjMD5WNml_oYLQ7i1A4G-1Q6TCyja5hC9079lo';
const API_KEY = 'AIzaSyD8EcmXipvtbYrtlTeoitURxp8zBYIJSpY';
const RANGE = 'Sheet1!A:W'; // Adjust if your sheet has a different name

/**
 * Fetches leads from Google Sheets
 * @returns {Promise<Array>} Array of lead objects
 */
export async function fetchLeadsFromSheet() {
  try {
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${RANGE}?key=${API_KEY}`;
    
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`Google Sheets API error: ${response.status} ${response.statusText}`);
    }
    
    const data = await response.json();
    
    if (!data.values || data.values.length === 0) {
      return [];
    }
    
    // First row is headers
    const headers = data.values[0];
    const rows = data.values.slice(1);
    
    // Map rows to lead objects
    const leads = rows.map((row, index) => {
      const lead = {};
      
      headers.forEach((header, i) => {
        lead[header] = row[i] || '';
      });
      
      // Transform to dashboard format
      return {
        id: lead.id || `lead-${index + 1}`,
        name: lead.full_name || 'Unknown',
        country: lead["which_country_are_you_currently_residing_in?"] || lead.country || 'Unknown',
        phone: lead.phone || lead.work_phone_number || '',
        email: String(lead.email || lead.email_address || lead['e-mail'] || '').trim(),
        status: normalizeStatus(lead.lead_status),
        contactedAt: lead.created_time ? new Date(lead.created_time) : null,
        
        // Additional details
        grade: lead["what_is_your_child's_current_grade/class?"] || '',
        program: lead["which_program_are_you_seeking_for_your_child?"] || '',
        goal: lead["what_is_your_primary_goal_for_your_child?"] || '',
        preferredTime: lead.preferred_time_for_counselling || '',
        
        // Facebook ad metadata
        adId: lead.ad_id || '',
        adName: lead.ad_name || '',
        adsetId: lead.adset_id || '',
        adsetName: lead.adset_name || '',
        campaignId: lead.campaign_id || '',
        campaignName: lead.campaign_name || '',
        formId: lead.form_id || '',
        formName: lead.form_name || '',
        platform: lead.platform || '',
        isOrganic: lead.is_organic || '',
      };
    });
    
    return leads;
  } catch (error) {
    console.error('Error fetching leads from Google Sheets:', error);
    throw error;
  }
}

/**
 * Normalizes lead status from sheet to dashboard format
 * @param {string} status - Status from Google Sheet
 * @returns {string} Normalized status
 */
function normalizeStatus(status) {
  if (!status) return 'NEW';
  
  const statusUpper = status.toUpperCase().trim();
  
  // Map common status values
  const statusMap = {
    'NEW': 'NEW',
    'CONTACTED': 'CONTACTED',
    'PROCESSING': 'PROCESSING',
    'PARTIAL': 'PARTIAL',
    'FAILED': 'FAILED',
    'REPLIED': 'REPLIED',
    'CLOSED': 'CLOSED',
    'PENDING': 'NEW',
    'IN PROGRESS': 'PROCESSING',
    'COMPLETE': 'CLOSED',
    'DONE': 'CLOSED',
  };
  
  return statusMap[statusUpper] || 'NEW';
}

/**
 * Refreshes lead data from Google Sheets
 * @returns {Promise<Array>} Fresh array of lead objects
 */
export async function refreshLeads() {
  return fetchLeadsFromSheet();
}
