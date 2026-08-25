import React, { useState, useEffect } from 'react';
import { signOut } from 'firebase/auth';
import { auth } from '../config/firebase';
import { fetchLeadsFromSheet, refreshLeads } from '../services/googleSheets';
import { 
  startAutomaticDetection, 
  stopAutomaticDetection, 
  triggerManualDetection,
  getDetectionStats 
} from '../services/leadDetection';
import { sendWelcomeEmail, testSendGridConnection } from '../services/emailService';
import { sendWhatsAppMessage } from '../services/whatsappService';
import { 
  Users, 
  UserPlus, 
  CheckCircle, 
  MessageCircle, 
  Search, 
  RefreshCw,
  LogOut,
  Eye,
  Send,
  Mail,
  Phone,
  X,
  AlertCircle,
  Loader,
  Play,
  Pause,
  Zap
} from 'lucide-react';
import { format } from 'date-fns';
import './Dashboard.css';

function Dashboard({ user }) {
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedLead, setSelectedLead] = useState(null);
  const [showConfirmDialog, setShowConfirmDialog] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [autoDetectionEnabled, setAutoDetectionEnabled] = useState(false);
  const [detectionStats, setDetectionStats] = useState(null);
  const [processingLeads, setProcessingLeads] = useState([]);
  const [testingEmail, setTestingEmail] = useState(false);
  const [emailStatus, setEmailStatus] = useState(null);

  // Load leads on mount
  useEffect(() => {
    loadLeads();
    updateDetectionStats();
  }, []);

  // Start automatic detection on mount
  useEffect(() => {
    const callbacks = {
      onStart: (lead) => {
        console.log('Processing started:', lead.name);
        setProcessingLeads(prev => [...prev, lead.id]);
      },
      onWhatsAppSent: (lead) => {
        showToast(`WhatsApp sent to ${lead.name}`, 'success');
      },
      onEmailSent: (lead) => {
        showToast(`Email sent to ${lead.name}`, 'success');
      },
      onComplete: (lead, status) => {
        console.log('Processing complete:', lead.name, status);
        setProcessingLeads(prev => prev.filter(id => id !== lead.id));
        loadLeads(); // Refresh leads
        showToast(`Lead ${lead.name} processed: ${status}`, 'success');
      },
      onError: (lead, error) => {
        console.error('Processing error:', lead.name, error);
        setProcessingLeads(prev => prev.filter(id => id !== lead.id));
        showToast(`Failed to process ${lead.name}`, 'error');
      }
    };

    // Start automatic detection (check every 5 minutes)
    startAutomaticDetection(5, callbacks);
    setAutoDetectionEnabled(true);

    // Cleanup on unmount
    return () => {
      stopAutomaticDetection();
    };
  }, []);

  const loadLeads = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await fetchLeadsFromSheet();
      setLeads(data);
    } catch (err) {
      setError(err.message || 'Failed to load leads from Google Sheets');
      console.error('Load leads error:', err);
    } finally {
      setLoading(false);
    }
  };

  const updateDetectionStats = () => {
    const stats = getDetectionStats();
    setDetectionStats(stats);
  };

  const handleLogout = async () => {
    try {
      stopAutomaticDetection();
      await signOut(auth);
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      const data = await refreshLeads();
      setLeads(data);
      updateDetectionStats();
      showToast('Leads refreshed successfully');
    } catch (err) {
      showToast('Failed to refresh leads', 'error');
      console.error('Refresh error:', err);
    } finally {
      setRefreshing(false);
    }
  };

  const handleManualDetection = async () => {
    showToast('Checking for new leads...', 'info');
    
    const callbacks = {
      onStart: (lead) => {
        setProcessingLeads(prev => [...prev, lead.id]);
      },
      onComplete: (lead, status) => {
        setProcessingLeads(prev => prev.filter(id => id !== lead.id));
        loadLeads();
        showToast(`Lead ${lead.name} processed: ${status}`, 'success');
      },
      onError: (lead, error) => {
        setProcessingLeads(prev => prev.filter(id => id !== lead.id));
        showToast(`Failed to process ${lead.name}`, 'error');
      }
    };

    try {
      await triggerManualDetection(callbacks);
      updateDetectionStats();
    } catch (error) {
      showToast('Detection failed', 'error');
    }
  };

  const toggleAutoDetection = () => {
    if (autoDetectionEnabled) {
      stopAutomaticDetection();
      setAutoDetectionEnabled(false);
      showToast('Automatic detection stopped', 'info');
    } else {
      startAutomaticDetection(5);
      setAutoDetectionEnabled(true);
      showToast('Automatic detection started', 'success');
    }
    updateDetectionStats();
  };

  const handleTestEmail = async () => {
    setTestingEmail(true);
    setEmailStatus(null);
    showToast('Testing SendGrid connection...', 'info');

    try {
      const result = await testSendGridConnection();
      
      if (result.success) {
        setEmailStatus({
          type: 'success',
          message: 'Test email sent successfully! Check your inbox at ' + (import.meta.env.VITE_FROM_EMAIL || 'leads@myraacademy.com')
        });
        showToast('Test email sent! Check your inbox.', 'success');
      } else {
        setEmailStatus({
          type: 'error',
          message: 'SendGrid test failed: ' + result.message
        });
        showToast('Test failed: ' + result.message, 'error');
      }
    } catch (error) {
      setEmailStatus({
        type: 'error',
        message: 'Error: ' + error.message
      });
      showToast('Test failed: ' + error.message, 'error');
    } finally {
      setTestingEmail(false);
    }
  };

  const handleSendEmail = async (lead) => {
    if (!lead.email) {
      showToast('No email address for this lead', 'error');
      return;
    }

    if (!confirm(`Send welcome email to ${lead.name} (${lead.email})?`)) {
      return;
    }

    setProcessingLeads(prev => [...prev, lead.id]);
    showToast(`Sending email to ${lead.name}...`, 'info');

    try {
      const result = await sendWelcomeEmail(lead);
      
      if (result.success) {
        showToast(`Email sent successfully to ${lead.name}!`, 'success');
        setTimeout(() => {
          loadLeads();
        }, 1000);
      }
    } catch (error) {
      showToast(`Failed to send email: ${error.message}`, 'error');
    } finally {
      setProcessingLeads(prev => prev.filter(id => id !== lead.id));
    }
  };

  const handleSendWhatsApp = async (lead) => {
    if (!lead.phone) {
      showToast('No phone number for this lead', 'error');
      return;
    }

    if (!confirm(`Send WhatsApp message to ${lead.name} (${lead.phone})?`)) {
      return;
    }

    setProcessingLeads(prev => [...prev, lead.id]);
    showToast(`Sending WhatsApp message to ${lead.name}...`, 'info');

    try {
      await sendWhatsAppMessage(lead);
      showToast(`WhatsApp message sent successfully to ${lead.name}!`, 'success');
    } catch (error) {
      showToast(`Failed to send WhatsApp message: ${error.message}`, 'error');
    } finally {
      setProcessingLeads(prev => prev.filter(id => id !== lead.id));
    }
  };

  const showToast = (message, type = 'success') => {
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    document.body.appendChild(toast);
    setTimeout(() => toast.classList.add('show'), 100);
    setTimeout(() => {
      toast.classList.remove('show');
      setTimeout(() => document.body.removeChild(toast), 300);
    }, 3000);
  };

  const getStatusBadge = (status) => {
    const statusConfig = {
      NEW: { label: 'New', className: 'status-new' },
      PROCESSING: { label: 'Processing', className: 'status-processing' },
      CONTACTED: { label: 'Contacted', className: 'status-contacted' },
      PARTIAL: { label: 'Partial', className: 'status-partial' },
      FAILED: { label: 'Failed', className: 'status-failed' },
      REPLIED: { label: 'Replied', className: 'status-replied' },
      CLOSED: { label: 'Closed', className: 'status-closed' },
    };

    const config = statusConfig[status] || statusConfig.NEW;
    return <span className={`status-badge ${config.className}`}>{config.label}</span>;
  };

  const filteredLeads = leads.filter(lead => 
    lead.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    lead.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    lead.phone.includes(searchTerm) ||
    lead.country.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const stats = {
    total: leads.length,
    new: leads.filter(l => l.status === 'NEW').length,
    contacted: leads.filter(l => l.status === 'CONTACTED').length,
    replied: leads.filter(l => l.status === 'REPLIED').length,
  };

  const handleSendMessage = (lead, type) => {
    setShowConfirmDialog({ lead, type });
  };

  const confirmSend = () => {
    const { lead, type } = showConfirmDialog;
    
    if (lead.status === 'CONTACTED' || lead.status === 'REPLIED') {
      const proceed = window.confirm(
        `${lead.name} was already contacted${lead.contactedAt ? ` on ${format(lead.contactedAt, 'dd MMM yyyy')}` : ''}. Do you still want to send another ${type}?`
      );
      if (!proceed) {
        setShowConfirmDialog(null);
        return;
      }
    }

    if (type === 'email') {
      handleSendEmail(lead);
    } else {
      handleSendWhatsApp(lead);
    }
    setShowConfirmDialog(null);
  };

  // Loading state
  if (loading) {
    return (
      <div className="dashboard">
        <header className="dashboard-header">
          <div className="header-content">
            <div className="header-left">
              <div className="header-logo">
                <img 
                  src="https://images.pexels.com/photos/5905857/pexels-photo-5905857.jpeg?auto=compress&cs=tinysrgb&w=60&h=60&fit=crop" 
                  alt="Myra's Academy" 
                />
              </div>
              <div className="header-title">
                <h1>Myra's Academy</h1>
                <h2>Lead Outreach</h2>
              </div>
            </div>
            <div className="header-right">
              <span className="user-email">{user.email}</span>
              <button onClick={handleLogout} className="logout-button">
                <LogOut size={18} />
                Logout
              </button>
            </div>
          </div>
        </header>
        <main className="dashboard-main">
          <div className="loading-state">
            <Loader size={48} className="spinning" />
            <p>Loading leads from Google Sheets...</p>
          </div>
        </main>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="dashboard">
        <header className="dashboard-header">
          <div className="header-content">
            <div className="header-left">
              <div className="header-logo">
                <img 
                  src="https://images.pexels.com/photos/5905857/pexels-photo-5905857.jpeg?auto=compress&cs=tinysrgb&w=60&h=60&fit=crop" 
                  alt="Myra's Academy" 
                />
              </div>
              <div className="header-title">
                <h1>Myra's Academy</h1>
                <h2>Lead Outreach</h2>
              </div>
            </div>
            <div className="header-right">
              <span className="user-email">{user.email}</span>
              <button onClick={handleLogout} className="logout-button">
                <LogOut size={18} />
                Logout
              </button>
            </div>
          </div>
        </header>
        <main className="dashboard-main">
          <div className="error-state">
            <AlertCircle size={48} />
            <h3>Failed to Load Leads</h3>
            <p>{error}</p>
            <button onClick={loadLeads} className="button-primary">
              <RefreshCw size={18} />
              Try Again
            </button>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="dashboard">
      {/* Header */}
      <header className="dashboard-header">
        <div className="header-content">
          <div className="header-left">
            <div className="header-logo">
              <img 
                src="https://images.pexels.com/photos/5905857/pexels-photo-5905857.jpeg?auto=compress&cs=tinysrgb&w=60&h=60&fit=crop" 
                alt="Myra's Academy" 
              />
            </div>
            <div className="header-title">
              <h1>Myra's Academy</h1>
              <h2>Lead Outreach</h2>
            </div>
          </div>
          <div className="header-right">
            <span className="user-email">{user.email}</span>
            <button onClick={handleLogout} className="logout-button">
              <LogOut size={18} />
              Logout
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="dashboard-main">
        <div className="dashboard-container">
          {/* Email Status Alert */}
          {emailStatus && (
            <div className={`email-status-alert ${emailStatus.type}`}>
              <div className="alert-content">
                {emailStatus.type === 'success' ? (
                  <CheckCircle size={20} />
                ) : (
                  <AlertCircle size={20} />
                )}
                <div className="alert-message">
                  <p>{emailStatus.message}</p>
                </div>
                <button 
                  onClick={() => setEmailStatus(null)}
                  className="alert-close"
                >
                  <X size={18} />
                </button>
              </div>
            </div>
          )}

          {/* Auto Detection Status */}
          <div className="detection-status">
            <div className="detection-info">
              <Zap size={20} className={autoDetectionEnabled ? 'active' : ''} />
              <div>
                <h4>Automatic Lead Detection</h4>
                <p>
                  {autoDetectionEnabled ? (
                    <>Status: <span className="status-active">Active</span> • Checking every 5 minutes</>
                  ) : (
                    <>Status: <span className="status-inactive">Inactive</span></>
                  )}
                </p>
                {detectionStats && (
                  <p className="detection-stats">
                    Processed: {detectionStats.processedLeadsCount} leads
                    {detectionStats.lastCheckTime && (
                      <> • Last check: {format(detectionStats.lastCheckTime, 'HH:mm:ss')}</>
                    )}
                  </p>
                )}
              </div>
            </div>
            <div className="detection-actions">
              <button 
                onClick={handleTestEmail}
                className="button-test-email"
                disabled={testingEmail}
              >
                <Zap size={16} />
                {testingEmail ? 'Testing...' : 'Test Email'}
              </button>
              <button 
                onClick={handleManualDetection}
                className="button-detect"
                disabled={processingLeads.length > 0}
              >
                <Zap size={16} />
                Detect Now
              </button>
              <button 
                onClick={toggleAutoDetection}
                className={`button-toggle ${autoDetectionEnabled ? 'active' : ''}`}
              >
                {autoDetectionEnabled ? (
                  <>
                    <Pause size={16} />
                    Pause Auto
                  </>
                ) : (
                  <>
                    <Play size={16} />
                    Start Auto
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Stats Cards */}
          <div className="stats-grid">
            <div className="stat-card">
              <div className="stat-icon stat-icon-total">
                <Users size={24} />
              </div>
              <div className="stat-content">
                <p className="stat-label">Total Leads</p>
                <p className="stat-value">{stats.total}</p>
              </div>
            </div>

            <div className="stat-card">
              <div className="stat-icon stat-icon-new">
                <UserPlus size={24} />
              </div>
              <div className="stat-content">
                <p className="stat-label">New Leads</p>
                <p className="stat-value">{stats.new}</p>
              </div>
            </div>

            <div className="stat-card">
              <div className="stat-icon stat-icon-contacted">
                <CheckCircle size={24} />
              </div>
              <div className="stat-content">
                <p className="stat-label">Contacted</p>
                <p className="stat-value">{stats.contacted}</p>
              </div>
            </div>

            <div className="stat-card">
              <div className="stat-icon stat-icon-replied">
                <MessageCircle size={24} />
              </div>
              <div className="stat-content">
                <p className="stat-label">Replied</p>
                <p className="stat-value">{stats.replied}</p>
              </div>
            </div>
          </div>

          {/* Leads Table Section */}
          <div className="leads-section">
            <div className="section-header">
              <h3>All Leads</h3>
              <div className="section-actions">
                <div className="search-box">
                  <Search size={18} />
                  <input
                    type="text"
                    placeholder="Search leads..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
                <button 
                  onClick={handleRefresh} 
                  className="refresh-button"
                  disabled={refreshing}
                >
                  <RefreshCw size={18} className={refreshing ? 'spinning' : ''} />
                  Refresh
                </button>
              </div>
            </div>

            <div className="table-container">
              <table className="leads-table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Country</th>
                    <th>Phone</th>
                    <th>Email</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredLeads.map(lead => (
                    <tr key={lead.id} className={processingLeads.includes(lead.id) ? 'processing' : ''}>
                      <td className="lead-name">
                        {lead.name}
                        {processingLeads.includes(lead.id) && (
                          <Loader size={14} className="spinning inline-spinner" />
                        )}
                      </td>
                      <td>{lead.country}</td>
                      <td className="lead-phone">{lead.phone}</td>
                      <td className="lead-email">{lead.email}</td>
                      <td>{getStatusBadge(lead.status)}</td>
                      <td>
                        <button 
                          onClick={() => setSelectedLead(lead)}
                          className="action-button action-view"
                        >
                          <Eye size={16} />
                          View
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {filteredLeads.length === 0 && (
                <div className="empty-state">
                  <Users size={48} />
                  <p>No leads found</p>
                  <span>Try adjusting your search</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>

      {/* Lead Detail Modal */}
      {selectedLead && (
        <div className="modal-overlay" onClick={() => setSelectedLead(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Lead Details</h3>
              <button onClick={() => setSelectedLead(null)} className="modal-close">
                <X size={20} />
              </button>
            </div>
            <div className="modal-body">
              <div className="lead-detail-grid">
                <div className="detail-item">
                  <label>Name</label>
                  <p>{selectedLead.name}</p>
                </div>
                <div className="detail-item">
                  <label>Country</label>
                  <p>{selectedLead.country}</p>
                </div>
                <div className="detail-item">
                  <label>Phone</label>
                  <p>{selectedLead.phone}</p>
                </div>
                <div className="detail-item">
                  <label>Email</label>
                  <p>{selectedLead.email}</p>
                </div>
                <div className="detail-item">
                  <label>Status</label>
                  <div>{getStatusBadge(selectedLead.status)}</div>
                </div>
                {selectedLead.contactedAt && (
                  <div className="detail-item">
                    <label>Created At</label>
                    <p>{format(selectedLead.contactedAt, 'dd MMM yyyy, HH:mm')}</p>
                  </div>
                )}
                {selectedLead.grade && (
                  <div className="detail-item">
                    <label>Grade/Class</label>
                    <p>{selectedLead.grade}</p>
                  </div>
                )}
                {selectedLead.program && (
                  <div className="detail-item">
                    <label>Program</label>
                    <p>{selectedLead.program}</p>
                  </div>
                )}
                {selectedLead.goal && (
                  <div className="detail-item">
                    <label>Primary Goal</label>
                    <p>{selectedLead.goal}</p>
                  </div>
                )}
                {selectedLead.preferredTime && (
                  <div className="detail-item">
                    <label>Preferred Time</label>
                    <p>{selectedLead.preferredTime}</p>
                  </div>
                )}
                {selectedLead.campaignName && (
                  <div className="detail-item">
                    <label>Campaign</label>
                    <p>{selectedLead.campaignName}</p>
                  </div>
                )}
                {selectedLead.adName && (
                  <div className="detail-item">
                    <label>Ad Name</label>
                    <p>{selectedLead.adName}</p>
                  </div>
                )}
                {selectedLead.platform && (
                  <div className="detail-item">
                    <label>Platform</label>
                    <p>{selectedLead.platform}</p>
                  </div>
                )}
              </div>

              <div className="modal-actions">
                <button 
                  onClick={() => handleSendMessage(selectedLead, 'whatsapp')}
                  className="action-button action-whatsapp"
                >
                  <Phone size={16} />
                  Send WhatsApp
                </button>
                <button 
                  onClick={() => handleSendMessage(selectedLead, 'email')}
                  className="action-button action-email"
                  disabled={processingLeads.includes(selectedLead.id)}
                >
                  <Mail size={16} />
                  {processingLeads.includes(selectedLead.id) ? 'Sending...' : 'Send Email'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Dialog */}
      {showConfirmDialog && (
        <div className="modal-overlay" onClick={() => setShowConfirmDialog(null)}>
          <div className="modal-content modal-confirm" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Confirm Send</h3>
            </div>
            <div className="modal-body">
              <p>
                Are you sure you want to send a {showConfirmDialog.type === 'whatsapp' ? 'WhatsApp message' : 'email'} to <strong>{showConfirmDialog.lead.name}</strong>?
              </p>
            </div>
            <div className="modal-footer">
              <button 
                onClick={() => setShowConfirmDialog(null)}
                className="button-secondary"
              >
                Cancel
              </button>
              <button 
                onClick={confirmSend}
                className="button-primary"
              >
                <Send size={16} />
                Send
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Dashboard;
