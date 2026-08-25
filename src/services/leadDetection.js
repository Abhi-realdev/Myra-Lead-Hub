import { fetchLeadsFromSheet } from './googleSheets';
import { sendWelcomeEmail } from './emailService';
import { sendWhatsAppMessage } from './whatsappService';

// Store to track processed leads (in production, use a database)
let processedLeads = new Set();
let lastCheckTime = null;
let detectionInterval = null;

/**
 * Initialize the lead detection system
 * Loads previously processed leads from localStorage
 */
export function initializeLeadDetection() {
  // Load processed leads from localStorage
  const stored = localStorage.getItem('processedLeads');
  if (stored) {
    try {
      const parsed = JSON.parse(stored);
      processedLeads = new Set(parsed);
      console.log(`Loaded ${processedLeads.size} previously processed leads`);
    } catch (error) {
      console.error('Error loading processed leads:', error);
    }
  }
  
  // Load last check time
  const lastCheck = localStorage.getItem('lastCheckTime');
  if (lastCheck) {
    lastCheckTime = new Date(lastCheck);
  }
}

/**
 * Save processed leads to localStorage
 */
function saveProcessedLeads() {
  try {
    localStorage.setItem('processedLeads', JSON.stringify([...processedLeads]));
    localStorage.setItem('lastCheckTime', new Date().toISOString());
  } catch (error) {
    console.error('Error saving processed leads:', error);
  }
}

/**
 * Generate unique identifier for a lead
 * Uses phone number (primary) and email (secondary)
 */
function generateLeadIdentifier(lead) {
  // Normalize phone number (remove spaces, dashes, parentheses)
  const normalizedPhone = lead.phone
    ? lead.phone.replace(/[\s\-\(\)]/g, '').toLowerCase()
    : '';
  
  // Normalize email
  const normalizedEmail = lead.email
    ? lead.email.toLowerCase().trim()
    : '';
  
  // Create composite identifier
  return `${normalizedPhone}|${normalizedEmail}`;
}

/**
 * Check if a lead has been processed before
 */
function isLeadProcessed(lead) {
  const identifier = generateLeadIdentifier(lead);
  return processedLeads.has(identifier);
}

/**
 * Mark a lead as processed
 */
function markLeadAsProcessed(lead) {
  const identifier = generateLeadIdentifier(lead);
  processedLeads.add(identifier);
  saveProcessedLeads();
}

/**
 * Detect new leads from Google Sheet
 * Returns array of genuinely new leads that haven't been contacted
 */
export async function detectNewLeads() {
  try {
    console.log('🔍 Checking for new leads...');
    
    // Fetch all leads from sheet
    const allLeads = await fetchLeadsFromSheet();
    
    // Filter for genuinely new leads
    const newLeads = allLeads.filter(lead => {
      // Skip if already processed
      if (isLeadProcessed(lead)) {
        return false;
      }
      
      // Skip if status indicates already contacted
      if (['CONTACTED', 'REPLIED', 'CLOSED'].includes(lead.status)) {
        return false;
      }
      
      // Skip if missing critical contact info
      if (!lead.phone && !lead.email) {
        console.warn(`Lead ${lead.name} has no phone or email`);
        return false;
      }
      
      return true;
    });
    
    console.log(`✅ Found ${newLeads.length} new leads`);
    return newLeads;
    
  } catch (error) {
    console.error('Error detecting new leads:', error);
    throw error;
  }
}

/**
 * Process a single new lead
 * Sends WhatsApp and Email, then marks as processed
 */
export async function processNewLead(lead, callbacks = {}) {
  const {
    onStart,
    onWhatsAppSent,
    onEmailSent,
    onComplete,
    onError
  } = callbacks;
  
  console.log(`📤 Processing lead: ${lead.name}`);
  
  try {
    // Notify processing started
    if (onStart) onStart(lead);
    
    const results = {
      whatsapp: { success: false, error: null },
      email: { success: false, error: null }
    };
    
    // Send WhatsApp message
    if (lead.phone) {
      try {
        await sendWhatsAppMessage(lead);
        results.whatsapp.success = true;
        console.log(`✅ WhatsApp sent to ${lead.name}`);
        if (onWhatsAppSent) onWhatsAppSent(lead);
      } catch (error) {
        results.whatsapp.error = error.message;
        console.error(`❌ WhatsApp failed for ${lead.name}:`, error);
      }
    }
    
    // Send Email via SendGrid
    if (lead.email) {
      try {
        const emailResult = await sendWelcomeEmail(lead);
        results.email.success = emailResult.success;
        results.email.messageId = emailResult.messageId;
        console.log(`✅ Email sent to ${lead.name} via SendGrid`);
        if (onEmailSent) onEmailSent(lead);
      } catch (error) {
        results.email.error = error.message;
        console.error(`❌ Email failed for ${lead.name}:`, error);
      }
    }
    
    // Determine final status
    let finalStatus = 'FAILED';
    if (results.whatsapp.success && results.email.success) {
      finalStatus = 'CONTACTED';
    } else if (results.whatsapp.success || results.email.success) {
      finalStatus = 'PARTIAL';
    }
    
    // Mark as processed (even if failed, to avoid retry loops)
    markLeadAsProcessed(lead);
    
    // Notify completion
    if (onComplete) onComplete(lead, finalStatus, results);
    
    return { lead, status: finalStatus, results };
    
  } catch (error) {
    console.error(`Error processing lead ${lead.name}:`, error);
    if (onError) onError(lead, error);
    throw error;
  }
}

/**
 * Send WhatsApp message to lead
 * TODO: Integrate with WhatsApp Business API
 */
/**
 * Start automatic lead detection
 * Checks for new leads every interval (default: 5 minutes)
 */
export function startAutomaticDetection(intervalMinutes = 5, callbacks = {}) {
  // Stop any existing interval
  stopAutomaticDetection();
  
  console.log(`🚀 Starting automatic lead detection (every ${intervalMinutes} minutes)`);
  
  // Initialize on start
  initializeLeadDetection();
  
  // Run immediately
  runDetectionCycle(callbacks);
  
  // Set up interval
  detectionInterval = setInterval(() => {
    runDetectionCycle(callbacks);
  }, intervalMinutes * 60 * 1000);
  
  return detectionInterval;
}

/**
 * Stop automatic lead detection
 */
export function stopAutomaticDetection() {
  if (detectionInterval) {
    clearInterval(detectionInterval);
    detectionInterval = null;
    console.log('⏹️ Stopped automatic lead detection');
  }
}

/**
 * Run a single detection cycle
 */
async function runDetectionCycle(callbacks = {}) {
  try {
    const newLeads = await detectNewLeads();
    
    if (newLeads.length === 0) {
      console.log('✅ No new leads found');
      return;
    }
    
    console.log(`🎯 Processing ${newLeads.length} new leads...`);
    
    // Process each lead sequentially
    for (const lead of newLeads) {
      try {
        await processNewLead(lead, callbacks);
        // Small delay between leads to avoid rate limits
        await new Promise(resolve => setTimeout(resolve, 2000));
      } catch (error) {
        console.error(`Failed to process lead ${lead.name}:`, error);
        // Continue with next lead
      }
    }
    
    console.log('✅ Detection cycle complete');
    
  } catch (error) {
    console.error('Error in detection cycle:', error);
  }
}

/**
 * Manually trigger lead detection
 */
export async function triggerManualDetection(callbacks = {}) {
  console.log('🔄 Manual detection triggered');
  await runDetectionCycle(callbacks);
}

/**
 * Get detection statistics
 */
export function getDetectionStats() {
  return {
    processedLeadsCount: processedLeads.size,
    lastCheckTime: lastCheckTime,
    isRunning: detectionInterval !== null
  };
}

/**
 * Reset processed leads (use with caution!)
 */
export function resetProcessedLeads() {
  processedLeads.clear();
  localStorage.removeItem('processedLeads');
  localStorage.removeItem('lastCheckTime');
  console.log('⚠️ Processed leads reset');
}
