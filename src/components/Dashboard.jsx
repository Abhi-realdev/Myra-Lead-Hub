import React, { useState, useEffect } from 'react';
import { 
  Users, 
  UserPlus, 
  MessageSquare, 
  TrendingUp,
  Search,
  RefreshCw,
  Mail,
  Phone,
  Calendar,
  MapPin,
  Eye,
  Send,
  CheckCircle,
  XCircle,
  AlertCircle,
  Zap
} from 'lucide-react';
import { fetchLeadsFromSheet } from '../services/googleSheets';
import { 
  startAutomaticDetection, 
  stopAutomaticDetection,
  triggerManualDetection,
  getDetectionStats 
} from '../services/leadDetection';
import { sendWelcomeEmail, testSendGridConnection } from '../services/emailService';

export default function Dashboard() {
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedLead, setSelectedLead] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [detectionActive, setDetectionActive] = useState(false);
  const [detectionStats, setDetectionStats] = useState(null);
  const [sendingEmail, setSendingEmail] = useState(false);
  const [emailStatus, setEmailStatus] = useState(null);
  const [testingConnection, setTestingConnection] = useState(false);

  // Load leads on mount
  useEffect(() => {
    loadLeads();
    
    // Start automatic detection
    startAutomaticDetection(5, {
      onStart: (lead) => {
        console.log('Processing lead:', lead.name);
        showToast(`Processing ${lead.name}...`, 'info');
      },
      onEmailSent: (lead) => {
        console.log('Email sent to:', lead.name);
        showToast(`Email sent to ${lead.name}`, 'success');
        loadLeads(); // Refresh to show updated status
      },
      onComplete: (lead, status) => {
        console.log('Lead processed:', lead.name, status);
        if (status === 'CONTACTED') {
          showToast(`${lead.name} contacted successfully!`, 'success');
        }
      }
    });
    
    setDetectionActive(true);
    updateDetectionStats();
    
    // Update stats every minute
    const statsInterval = setInterval(updateDetectionStats, 60000);
    
    return () => {
      stopAutomaticDetection();
      clearInterval(statsInterval);
    };
  }, []);

  const loadLeads = async () => {
    try {
      setLoading(true);
      const data = await fetchLeadsFromSheet();
      setLeads(data);
    } catch (error) {
      console.error('Error loading leads:', error);
      showToast('Failed to load leads', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadLeads();
    setRefreshing(false);
    showToast('Leads refreshed', 'success');
  };

  const handleManualDetection = async () => {
    setRefreshing(true);
    showToast('Checking for new leads...', 'info');
    
    try {
      await triggerManualDetection({
        onEmailSent: (lead) => {
          showToast(`Email sent to ${lead.name}`, 'success');
        },
        onComplete: (lead, status) => {
          if (status === 'CONTACTED') {
            showToast(`${lead.name} contacted successfully!`, 'success');
          }
        }
      });
      
      await loadLeads();
      updateDetectionStats();
    } catch (error) {
      showToast('Detection failed', 'error');
    } finally {
      setRefreshing(false);
    }
  };

  const updateDetectionStats = () => {
    const stats = getDetectionStats();
    setDetectionStats(stats);
  };

  const handleSendEmail = async (lead) => {
    if (!lead.email) {
      showToast('No email address for this lead', 'error');
      return;
    }

    if (!confirm(`Send welcome email to ${lead.name} (${lead.email})?`)) {
      return;
    }

    setSendingEmail(true);
    setEmailStatus(null);

    try {
      const result = await sendWelcomeEmail(lead);
      
      if (result.success) {
        setEmailStatus({
          type: 'success',
          message: `Email sent successfully to ${lead.email}`,
          messageId: result.messageId
        });
        showToast(`Email sent to ${lead.name}!`, 'success');
        
        // Refresh leads to update status
        setTimeout(() => {
          loadLeads();
        }, 1000);
      }
    } catch (error) {
      setEmailStatus({
        type: 'error',
        message: error.message
      });
      showToast('Failed to send email', 'error');
    } finally {
      setSendingEmail(false);
    }
  };

  const handleTestConnection = async () => {
    setTestingConnection(true);
    showToast('Testing SendGrid connection...', 'info');

    try {
      const result = await testSendGridConnection();
      
      if (result.success) {
        showToast('SendGrid connected! Check your email.', 'success');
      } else {
        showToast(`Connection failed: ${result.message}`, 'error');
      }
    } catch (error) {
      showToast('Connection test failed', 'error');
    } finally {
      setTestingConnection(false);
    }
  };

  const showToast = (message, type = 'info') => {
    // Simple toast notification (you can enhance this)
    console.log(`[${type.toUpperCase()}] ${message}`);
  };

  // Calculate stats
  const stats = {
    total: leads.length,
    new: leads.filter(l => l.status === 'NEW').length,
    contacted: leads.filter(l => ['CONTACTED', 'PARTIAL'].includes(l.status)).length,
    replied: leads.filter(l => l.status === 'REPLIED').length
  };

  // Filter leads
  const filteredLeads = leads.filter(lead => {
    const search = searchTerm.toLowerCase();
    return (
      lead.name.toLowerCase().includes(search) ||
      lead.email?.toLowerCase().includes(search) ||
      lead.phone?.toLowerCase().includes(search) ||
      lead.country?.toLowerCase().includes(search)
    );
  });

  const getStatusColor = (status) => {
    switch (status) {
      case 'NEW': return 'bg-blue-100 text-blue-800';
      case 'CONTACTED': return 'bg-green-100 text-green-800';
      case 'PARTIAL': return 'bg-yellow-100 text-yellow-800';
      case 'REPLIED': return 'bg-purple-100 text-purple-800';
      case 'FAILED': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'NEW': return <AlertCircle className="w-4 h-4" />;
      case 'CONTACTED': return <CheckCircle className="w-4 h-4" />;
      case 'PARTIAL': return <AlertCircle className="w-4 h-4" />;
      case 'REPLIED': return <MessageSquare className="w-4 h-4" />;
      case 'FAILED': return <XCircle className="w-4 h-4" />;
      default: return null;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#1E3A8A] mx-auto mb-4"></div>
          <p className="text-gray-600">Loading leads...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <div className="bg-gradient-to-r from-[#1E3A8A] to-[#1e40af] text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold">Lead Outreach Dashboard</h1>
              <p className="text-blue-100 mt-2">Myra's Academy</p>
            </div>
            <div className="flex items-center gap-4">
              {/* Test SendGrid Button */}
              <button
                onClick={handleTestConnection}
                disabled={testingConnection}
                className="flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 rounded-lg transition-colors disabled:opacity-50"
              >
                <Zap className="w-4 h-4" />
                {testingConnection ? 'Testing...' : 'Test Email'}
              </button>
              
              {/* Manual Detection Button */}
              <button
                onClick={handleManualDetection}
                disabled={refreshing}
                className="flex items-center gap-2 px-4 py-2 bg-[#F97316] hover:bg-[#ea580c] rounded-lg transition-colors disabled:opacity-50"
              >
                <Zap className="w-4 h-4" />
                {refreshing ? 'Checking...' : 'Check New Leads'}
              </button>
              
              {/* Refresh Button */}
              <button
                onClick={handleRefresh}
                disabled={refreshing}
                className="flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 rounded-lg transition-colors disabled:opacity-50"
              >
                <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
                Refresh
              </button>
            </div>
          </div>

          {/* Detection Status */}
          {detectionStats && (
            <div className="mt-4 flex items-center gap-4 text-sm text-blue-100">
              <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${detectionActive ? 'bg-green-400 animate-pulse' : 'bg-gray-400'}`}></div>
                <span>Auto-detection: {detectionActive ? 'Active' : 'Inactive'}</span>
              </div>
              <div>Processed: {detectionStats.processedLeadsCount} leads</div>
              {detectionStats.lastCheckTime && (
                <div>Last check: {new Date(detectionStats.lastCheckTime).toLocaleTimeString()}</div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Stats Cards */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 -mt-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-xl shadow-lg p-6 border-l-4 border-[#1E3A8A]">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-600 text-sm">Total Leads</p>
                <p className="text-3xl font-bold text-gray-900 mt-1">{stats.total}</p>
              </div>
              <Users className="w-12 h-12 text-[#1E3A8A] opacity-20" />
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-lg p-6 border-l-4 border-blue-500">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-600 text-sm">New Leads</p>
                <p className="text-3xl font-bold text-gray-900 mt-1">{stats.new}</p>
              </div>
              <UserPlus className="w-12 h-12 text-blue-500 opacity-20" />
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-lg p-6 border-l-4 border-green-500">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-600 text-sm">Contacted</p>
                <p className="text-3xl font-bold text-gray-900 mt-1">{stats.contacted}</p>
              </div>
              <MessageSquare className="w-12 h-12 text-green-500 opacity-20" />
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-lg p-6 border-l-4 border-[#F97316]">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-600 text-sm">Replied</p>
                <p className="text-3xl font-bold text-gray-900 mt-1">{stats.replied}</p>
              </div>
              <TrendingUp className="w-12 h-12 text-[#F97316] opacity-20" />
            </div>
          </div>
        </div>

        {/* Email Status Alert */}
        {emailStatus && (
          <div className={`mb-6 p-4 rounded-lg ${
            emailStatus.type === 'success' 
              ? 'bg-green-50 border border-green-200' 
              : 'bg-red-50 border border-red-200'
          }`}>
            <div className="flex items-start gap-3">
              {emailStatus.type === 'success' ? (
                <CheckCircle className="w-5 h-5 text-green-600 mt-0.5" />
              ) : (
                <XCircle className="w-5 h-5 text-red-600 mt-0.5" />
              )}
              <div className="flex-1">
                <p className={`font-medium ${
                  emailStatus.type === 'success' ? 'text-green-900' : 'text-red-900'
                }`}>
                  {emailStatus.message}
                </p>
                {emailStatus.messageId && (
                  <p className="text-sm text-green-700 mt-1">
                    Message ID: {emailStatus.messageId}
                  </p>
                )}
              </div>
              <button
                onClick={() => setEmailStatus(null)}
                className="text-gray-400 hover:text-gray-600"
              >
                ×
              </button>
            </div>
          </div>
        )}

        {/* Search Bar */}
        <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Search leads by name, email, phone, or country..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1E3A8A] focus:border-transparent"
            />
          </div>
        </div>

        {/* Leads Table */}
        <div className="bg-white rounded-xl shadow-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Lead
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Contact
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Location
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Date
                  </th>
                  <th className="px-6 py-4 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filteredLeads.map((lead, index) => (
                  <tr key={index} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#1E3A8A] to-[#1e40af] flex items-center justify-center text-white font-semibold">
                          {lead.name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <div className="font-medium text-gray-900">{lead.name}</div>
                          {lead.program && (
                            <div className="text-sm text-gray-500">{lead.program}</div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="space-y-1">
                        {lead.email && (
                          <div className="flex items-center gap-2 text-sm text-gray-600">
                            <Mail className="w-4 h-4" />
                            <span className="truncate max-w-[200px]">{lead.email}</span>
                          </div>
                        )}
                        {lead.phone && (
                          <div className="flex items-center gap-2 text-sm text-gray-600">
                            <Phone className="w-4 h-4" />
                            <span>{lead.phone}</span>
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      {lead.country && (
                        <div className="flex items-center gap-2 text-sm text-gray-600">
                          <MapPin className="w-4 h-4" />
                          <span>{lead.country}</span>
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(lead.status)}`}>
                        {getStatusIcon(lead.status)}
                        {lead.status}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2 text-sm text-gray-600">
                        <Calendar className="w-4 h-4" />
                        <span>{new Date(lead.timestamp).toLocaleDateString()}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => setSelectedLead(lead)}
                          className="p-2 text-gray-600 hover:text-[#1E3A8A] hover:bg-gray-100 rounded-lg transition-colors"
                          title="View Details"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleSendEmail(lead)}
                          disabled={!lead.email || sendingEmail}
                          className="p-2 text-gray-600 hover:text-[#F97316] hover:bg-orange-50 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                          title="Send Email"
                        >
                          <Send className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {filteredLeads.length === 0 && (
            <div className="text-center py-12">
              <Users className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600">No leads found</p>
            </div>
          )}
        </div>
      </div>

      {/* Lead Detail Modal */}
      {selectedLead && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-gradient-to-r from-[#1E3A8A] to-[#1e40af] text-white p-6 rounded-t-xl">
              <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold">Lead Details</h2>
                <button
                  onClick={() => setSelectedLead(null)}
                  className="text-white hover:bg-white/20 rounded-lg p-2 transition-colors"
                >
                  ×
                </button>
              </div>
            </div>

            <div className="p-6 space-y-6">
              {/* Basic Info */}
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Basic Information</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm text-gray-600">Name</label>
                    <p className="font-medium text-gray-900">{selectedLead.name}</p>
                  </div>
                  <div>
                    <label className="text-sm text-gray-600">Status</label>
                    <p>
                      <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(selectedLead.status)}`}>
                        {getStatusIcon(selectedLead.status)}
                        {selectedLead.status}
                      </span>
                    </p>
                  </div>
                </div>
              </div>

              {/* Contact Info */}
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Contact Information</h3>
                <div className="space-y-3">
                  {selectedLead.email && (
                    <div className="flex items-center gap-3">
                      <Mail className="w-5 h-5 text-gray-400" />
                      <span className="text-gray-900">{selectedLead.email}</span>
                    </div>
                  )}
                  {selectedLead.phone && (
                    <div className="flex items-center gap-3">
                      <Phone className="w-5 h-5 text-gray-400" />
                      <span className="text-gray-900">{selectedLead.phone}</span>
                    </div>
                  )}
                  {selectedLead.country && (
                    <div className="flex items-center gap-3">
                      <MapPin className="w-5 h-5 text-gray-400" />
                      <span className="text-gray-900">{selectedLead.country}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Additional Details */}
              {(selectedLead.program || selectedLead.goal || selectedLead.grade) && (
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Program Details</h3>
                  <div className="space-y-3">
                    {selectedLead.program && (
                      <div>
                        <label className="text-sm text-gray-600">Program Interest</label>
                        <p className="font-medium text-gray-900">{selectedLead.program}</p>
                      </div>
                    )}
                    {selectedLead.goal && (
                      <div>
                        <label className="text-sm text-gray-600">Goal</label>
                        <p className="font-medium text-gray-900">{selectedLead.goal}</p>
                      </div>
                    )}
                    {selectedLead.grade && (
                      <div>
                        <label className="text-sm text-gray-600">Grade/Class</label>
                        <p className="font-medium text-gray-900">{selectedLead.grade}</p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Timestamp */}
              <div>
                <label className="text-sm text-gray-600">Submitted</label>
                <p className="font-medium text-gray-900">
                  {new Date(selectedLead.timestamp).toLocaleString()}
                </p>
              </div>

              {/* Actions */}
              <div className="flex gap-3 pt-4 border-t">
                <button
                  onClick={() => handleSendEmail(selectedLead)}
                  disabled={!selectedLead.email || sendingEmail}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-[#F97316] hover:bg-[#ea580c] text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Send className="w-4 h-4" />
                  {sendingEmail ? 'Sending...' : 'Send Email'}
                </button>
                <button
                  onClick={() => setSelectedLead(null)}
                  className="px-6 py-3 border border-gray-300 text-gray-700 hover:bg-gray-50 rounded-lg transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
