import React, { useState, useEffect } from 'react';
import api from '../services/api';
import { 
  Search, Plus, Edit2, Trash2, X, AlertTriangle, 
  Phone, Mail, MapPin, Check, AlertCircle, ShieldAlert,
  Car, ClipboardList, IndianRupee, FileText, Info
} from 'lucide-react';
import './CustomersList.css';
import '../components/Layout.css'; // Inherits modal overlays
import './LedgerList.css'; // Inherits table headers styling
import './ReceiptsList.css'; // Inherits receipts log badges
import { useAuth } from '../context/AuthContext';

interface Customer {
  id: number;
  customer_code: string;
  name: string;
  mobile: string;
  email: string | null;
  address: string | null;
  is_active: boolean;
  assigned_agent_id: number | null;
  assigned_agent_name: string | null;
}

interface Agent {
  id: number;
  username: string;
}

const CustomersList: React.FC = () => {
  const { user, hasPermission } = useAuth();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCustomers, setTotalCustomers] = useState(0);
  const [loading, setLoading] = useState(true);

  // Modal control states
  const [showModal, setShowModal] = useState(false);
  const [modalMode, setModalMode] = useState<'create' | 'edit'>('create');
  const [selectedCustomerId, setSelectedCustomerId] = useState<number | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Profile Details Modal states
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileData, setProfileData] = useState<any | null>(null);

  // Form States
  const [form, setForm] = useState({
    customer_code: '',
    name: '',
    mobile: '',
    email: '',
    address: '',
    assigned_agent_id: ''
  });

  const canEditCustomer = (customer: Customer) => {
    if (user?.role === 'Admin') return true;
    if (hasPermission('customer.edit')) return true;
    // Agent allotment bypass: allowed if the customer is assigned to this agent
    if (user?.role === 'Agent' && customer.assigned_agent_id === user.id) return true;
    return false;
  };

  // Fetch customer records from API
  const loadCustomers = async () => {
    setLoading(true);
    try {
      const response = await api.get(`/api/customers`, {
        params: { q: search, page, limit: 9 }
      });
      if (response.data.success) {
        setCustomers(response.data.customers);
        setTotalPages(response.data.pagination.totalPages);
        setTotalCustomers(response.data.pagination.totalCustomers);
      }
    } catch (err) {
      console.error('Error loading customers list:', err);
    } finally {
      setLoading(false);
    }
  };

  // Fetch agents list
  const loadAgents = async () => {
    try {
      const response = await api.get('/api/customers/agents');
      if (response.data.success) {
        setAgents(response.data.agents);
      }
    } catch (err) {
      console.error('Error loading agents list:', err);
    }
  };

  // Trigger loading when search or page changes
  useEffect(() => {
    loadCustomers();
    loadAgents();
  }, [search, page]);

  // Handle Create Modal Open
  const handleOpenCreate = () => {
    setForm({ customer_code: '', name: '', mobile: '', email: '', address: '', assigned_agent_id: user?.role === 'Agent' ? user.id.toString() : '' });
    setModalMode('create');
    setErrorMsg(null);
    setShowModal(true);
  };

  // Handle Edit Modal Open
  const handleOpenEdit = (customer: Customer) => {
    setForm({
      customer_code: customer.customer_code,
      name: customer.name,
      mobile: customer.mobile,
      email: customer.email || '',
      address: customer.address || '',
      assigned_agent_id: customer.assigned_agent_id ? customer.assigned_agent_id.toString() : ''
    });
    setSelectedCustomerId(customer.id);
    setModalMode('edit');
    setErrorMsg(null);
    setShowModal(true);
  };

  // Fetch detailed customer profile
  const handleOpenProfileModal = async (customer: Customer) => {
    setProfileData(null);
    setProfileLoading(true);
    setShowProfileModal(true);
    try {
      const response = await api.get(`/api/customers/${customer.id}/profile`);
      if (response.data.success) {
        setProfileData(response.data);
      }
    } catch (err) {
      console.error('Failed to load customer profile details:', err);
    } finally {
      setProfileLoading(false);
    }
  };

  // Form Submit Handler
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    // Clean inputs
    const cleanMobile = form.mobile.replace(/\D/g, '');
    const cleanEmail = form.email.trim().toLowerCase();

    // 10-digit mobile starting with 6,7,8,9
    const mobileRegex = /^[6-9]\d{9}$/;
    if (!mobileRegex.test(cleanMobile)) {
      setErrorMsg("Mobile number must be a valid 10-digit Indian number starting with 6, 7, 8, or 9.");
      return;
    }

    if (cleanEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      setErrorMsg("Please enter a valid email address (e.g. name@example.com).");
      return;
    }
    
    try {
      const payload = {
        ...form,
        mobile: cleanMobile,
        email: cleanEmail || null
      };

      if (modalMode === 'create') {
        const response = await api.post('/api/customers', payload);
        if (response.data.success) {
          setShowModal(false);
          loadCustomers();
        }
      } else {
        const response = await api.put(`/api/customers/${selectedCustomerId}`, payload);
        if (response.data.success) {
          setShowModal(false);
          loadCustomers();
        }
      }
    } catch (err: any) {
      setErrorMsg(err.response?.data?.error || 'Operation failed. Please verify inputs.');
    }
  };

  // Toggle activation status
  const handleToggleStatus = async (id: number, currentStatus: boolean) => {
    try {
      const response = await api.patch(`/api/customers/${id}/status`, {
        is_active: !currentStatus
      });
      if (response.data.success) {
        setCustomers(customers.map(c => c.id === id ? { ...c, is_active: !currentStatus } : c));
      }
    } catch (err) {
      console.error('Failed to toggle customer status:', err);
    }
  };

  // Delete customer record
  const handleDeleteCustomer = async (id: number) => {
    if (!window.confirm("Are you sure you want to permanently delete this customer ID card?")) return;
    
    try {
      const response = await api.delete(`/api/customers/${id}`);
      if (response.data.success) {
        loadCustomers();
      }
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to delete customer record.');
    }
  };

  return (
    <div className="page-container">
      
      {/* Search and Quick Add Section */}
      <div className="page-actions">
        <div className="search-input-wrap">
          <Search className="search-icon-pos" size={18} />
          <input
            type="text"
            placeholder="Search by code, name, mobile..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          />
        </div>
        
        {hasPermission('customer.create') && (
          <button type="button" className="quick-add-btn" onClick={handleOpenCreate}>
            <Plus size={18} />
            <span>Add Customer</span>
          </button>
        )}
      </div>

      {/* Main Grid Directory of ID Cards */}
      {loading ? (
        <div style={{ padding: '40px', textAlignment: 'center' } as React.CSSProperties}>
          <h2>Loading Customer Database...</h2>
        </div>
      ) : customers.length === 0 ? (
        <div className="table-card" style={{ padding: '40px', textAlignment: 'center', color: 'var(--text-secondary)' } as React.CSSProperties}>
          <AlertTriangle style={{ margin: '0 auto 10px' }} size={32} />
          <p>No customer records found matching search filters.</p>
        </div>
      ) : (
        <>
          <div className="directory-grid">
            {customers.map((c) => {
              const initials = c.name
                .split(' ')
                .map(n => n.charAt(0))
                .join('')
                .slice(0, 2)
                .toUpperCase();

              return (
                <div key={c.id} className="id-badge-card">
                  {/* Decorative Lanyard Header */}
                  <div className="id-badge-header">
                    <div className="badge-clip-hole"></div>
                  </div>

                  {/* View Details Info Icon at Top Right */}
                  <button 
                    type="button" 
                    className="badge-view-icon-btn" 
                    style={{
                      position: 'absolute',
                      top: '12px',
                      right: '12px',
                      background: 'none',
                      border: 'none',
                      color: 'var(--text-secondary)',
                      cursor: 'pointer',
                      transition: 'color 0.2s',
                      padding: '4px'
                    }}
                    onClick={() => handleOpenProfileModal(c)}
                    title="View complete customer dossier"
                    onMouseEnter={(e) => e.currentTarget.style.color = '#3b82f6'}
                    onMouseLeave={(e) => e.currentTarget.style.color = 'var(--text-secondary)'}
                  >
                    <Info size={18} />
                  </button>

                  {/* Circular Avatar */}
                  <div 
                    className="badge-avatar-wrap" 
                    style={{ cursor: 'pointer' }} 
                    onClick={() => handleOpenProfileModal(c)}
                    title="Click to view full profile details"
                  >
                    <div className="badge-avatar">{initials}</div>
                  </div>

                  {/* Profile Identification */}
                  <div className="badge-user-info">
                    <h3 
                      style={{ cursor: 'pointer', transition: 'color 0.2s' }} 
                      className="hover-name-link" 
                      onClick={() => handleOpenProfileModal(c)}
                      title="Click to view full profile details"
                    >
                      {c.name}
                    </h3>
                    <span className="badge-code">{c.customer_code}</span>
                  </div>

                  {/* Contact Details List */}
                  <div className="badge-details-list">
                    <div className="badge-detail-item">
                      <Phone className="detail-icon" size={14} />
                      <span className="detail-text">{c.mobile}</span>
                    </div>
                    <div className="badge-detail-item">
                      <Mail className="detail-icon" size={14} />
                      <span className="detail-text" title={c.email || 'No email'}>
                        {c.email || 'No email registered'}
                      </span>
                    </div>
                    <div className="badge-detail-item">
                      <MapPin className="detail-icon" size={14} />
                      <span className="detail-text" title={c.address || 'No address'}>
                        {c.address || 'No address registered'}
                      </span>
                    </div>
                    <div className="badge-detail-item" style={{ borderTop: '1px dashed var(--border-color)', paddingTop: '6px', marginTop: '6px' }}>
                      <ShieldAlert className="detail-icon" size={14} style={{ color: '#3b82f6' }} />
                      <span className="detail-text" style={{ fontWeight: 600, color: '#3b82f6' }}>
                        Agent: {c.assigned_agent_name || 'Unassigned'}
                      </span>
                    </div>
                  </div>

                  {/* Toggle Status Indicator */}
                  <div className="badge-status-container">
                    {canEditCustomer(c) ? (
                      <span 
                        onClick={() => handleToggleStatus(c.id, c.is_active)}
                        className={`status-pill ${c.is_active ? 'active' : 'inactive'}`}
                        style={{ cursor: 'pointer' }}
                        title="Click to toggle account status"
                      >
                        {c.is_active ? (
                          <>
                            <Check size={12} />
                            <span>Active Portal</span>
                          </>
                        ) : (
                          <>
                            <AlertCircle size={12} />
                            <span>Suspended</span>
                          </>
                        )}
                      </span>
                    ) : (
                      <span 
                        className={`status-pill ${c.is_active ? 'active' : 'inactive'}`}
                        style={{ cursor: 'default' }}
                      >
                        {c.is_active ? (
                          <>
                            <Check size={12} />
                            <span>Active Portal</span>
                          </>
                        ) : (
                          <>
                            <AlertCircle size={12} />
                            <span>Suspended</span>
                          </>
                        )}
                      </span>
                    )}
                  </div>

                  {/* Actions Buttons Row */}
                  {canEditCustomer(c) && (
                    <div className="badge-actions-row">
                      <button 
                        type="button" 
                        className="badge-action-btn"
                        onClick={() => handleOpenEdit(c)}
                      >
                        <Edit2 size={13} />
                        <span>Edit</span>
                      </button>
                      <button 
                        type="button" 
                        className="badge-action-btn delete-btn"
                        onClick={() => handleDeleteCustomer(c.id)}
                      >
                        <Trash2 size={13} />
                        <span>Remove</span>
                      </button>
                    </div>
                  )}

                </div>
              );
            })}
          </div>

          {/* Pagination Controls */}
          <div className="pagination-row">
            <div className="pagination-info">
              Showing {((page - 1) * 9) + 1} to {Math.min(page * 9, totalCustomers)} of {totalCustomers} customers
            </div>
            <div className="pagination-controls">
              <button 
                type="button" 
                className="pagination-btn"
                onClick={() => setPage(p => Math.max(p - 1, 1))}
                disabled={page === 1}
              >
                Previous
              </button>
              <button 
                type="button" 
                className="pagination-btn"
                onClick={() => setPage(p => Math.min(p + 1, totalPages))}
                disabled={page === totalPages}
              >
                Next
              </button>
            </div>
          </div>
        </>
      )}

      {/* ==================== CREATE / EDIT MODAL ==================== */}
      {showModal && (
        <div className="modal-overlay">
          <div className="modal-card" style={{ maxWidth: '550px' }}>
            
            <div className="modal-header">
              <h2>{modalMode === 'create' ? 'Add New Customer' : 'Edit Customer Details'}</h2>
              <button type="button" className="close-btn" onClick={() => setShowModal(false)}>
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSubmit}>
              <div className="modal-body">
                
                {errorMsg && (
                  <div className="error-banner" style={{ borderRadius: '8px', marginBottom: '15px' }}>
                    {errorMsg}
                  </div>
                )}

                {modalMode === 'edit' && (
                  <div className="form-group-sm form-item">
                    <label>Customer Code *</label>
                    <input
                      type="text"
                      value={form.customer_code}
                      onChange={(e) => setForm({ ...form, customer_code: e.target.value.toUpperCase().trim() })}
                      required
                    />
                  </div>
                )}

                <div className="form-group-sm form-item">
                  <label>Full Name *</label>
                  <input
                    type="text"
                    placeholder="Enter full name"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    required
                  />
                </div>

                <div className="form-group-sm form-item">
                  <label>Mobile Number *</label>
                  <input
                    type="tel"
                    maxLength={10}
                    placeholder="Enter 10-digit mobile"
                    value={form.mobile}
                    onChange={(e) => setForm({ ...form, mobile: e.target.value.replace(/\D/g, '').slice(0, 10) })}
                    required
                  />
                </div>

                <div className="form-group-sm form-item">
                  <label>Email Address</label>
                  <input
                    type="email"
                    placeholder="Enter email address"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value.toLowerCase().replace(/\s/g, '') })}
                  />
                </div>

                <div className="form-group-sm form-item">
                  <label>Home Address</label>
                  <input
                    type="text"
                    placeholder="Enter billing address"
                    value={form.address}
                    onChange={(e) => setForm({ ...form, address: e.target.value })}
                  />
                </div>

                {user?.role !== 'Agent' && (
                  <div className="form-group-sm form-item">
                    <label>Assign Agent Allotment</label>
                    <select
                      value={form.assigned_agent_id}
                      onChange={(e) => setForm({ ...form, assigned_agent_id: e.target.value })}
                    >
                      <option value="">-- No Assigned Agent (Unallotted) --</option>
                      {agents.map(agent => (
                        <option key={agent.id} value={agent.id}>
                          👤 {agent.username}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

              </div>

              <div className="modal-footer">
                <button type="button" className="btn-secondary" onClick={() => setShowModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="submit-btn" style={{ width: 'auto', background: '#3b82f6', color: 'white' }}>
                  {modalMode === 'create' ? 'Create Account' : 'Save Changes'}
                </button>
              </div>
            </form>

          </div>
        </div>
      )}

      {/* ==================== COMPLETE PROFILE DETAILS MODAL ==================== */}
      {showProfileModal && (
        <div className="modal-overlay" style={{ zIndex: 999 }}>
          <div className="modal-card" style={{ maxWidth: '850px', maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}>
            
            <div className="modal-header">
              <h2>Customer Detailed Dossier</h2>
              <button type="button" className="close-btn" onClick={() => setShowProfileModal(false)}>
                <X size={20} />
              </button>
            </div>

            <div className="modal-body" style={{ overflowY: 'auto', padding: '24px' }}>
              {profileLoading ? (
                <div style={{ textAlign: 'center', padding: '40px' }}>
                  <h3>Loading customer profile dossiers...</h3>
                </div>
              ) : !profileData ? (
                <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-secondary)' }}>
                  <AlertTriangle style={{ margin: '0 auto 10px' }} size={32} />
                  <p>Failed to retrieve customer history details.</p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '25px' }}>
                  
                  {/* Row 1: Profile Header Card */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                    
                    {/* General Profile */}
                    <div style={{ backgroundColor: 'var(--bg-primary)', padding: '20px', borderRadius: '10px', border: '1px solid var(--border-color)' }}>
                      <h3 style={{ fontSize: '1rem', marginBottom: '12px', color: '#3b82f6', borderBottom: '1px solid var(--border-color)', paddingBottom: '6px' }}>
                        👤 Profile Identification
                      </h3>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '0.9rem' }}>
                        <div><strong>Code:</strong> {profileData.customer.customer_code}</div>
                        <div><strong>Name:</strong> {profileData.customer.name}</div>
                        <div><strong>Mobile:</strong> {profileData.customer.mobile}</div>
                        <div><strong>Email:</strong> {profileData.customer.email || 'No email registered'}</div>
                        <div><strong>Address:</strong> {profileData.customer.address || 'No address registered'}</div>
                        <div><strong>Allotted Agent:</strong> {profileData.customer.assigned_agent_name || 'Unassigned'}</div>
                      </div>
                    </div>

                    {/* Financial Summary */}
                    <div style={{ backgroundColor: 'var(--bg-primary)', padding: '20px', borderRadius: '10px', border: '1px solid var(--border-color)' }}>
                      <h3 style={{ fontSize: '1rem', marginBottom: '12px', color: '#10b981', borderBottom: '1px solid var(--border-color)', paddingBottom: '6px' }}>
                        💳 Financial Statements
                      </h3>
                      {(() => {
                        const totalCharged = profileData.ledger.reduce((sum: number, cur: any) => sum + parseFloat(cur.service_fee), 0);
                        const totalPaid = profileData.ledger.reduce((sum: number, cur: any) => sum + parseFloat(cur.amount_paid), 0);
                        const totalDue = profileData.ledger.reduce((sum: number, cur: any) => sum + parseFloat(cur.due_amount), 0);

                        return (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                              <span style={{ color: 'var(--text-secondary)' }}>Total Charged:</span>
                              <span style={{ fontWeight: 'bold' }}>₹{totalCharged.toFixed(2)}</span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                              <span style={{ color: 'var(--text-secondary)' }}>Total Paid:</span>
                              <span style={{ fontWeight: 'bold', color: '#10b981' }}>₹{totalPaid.toFixed(2)}</span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px dashed var(--border-color)', paddingTop: '8px' }}>
                              <span style={{ color: 'var(--text-secondary)' }}>Outstanding Dues:</span>
                              <span style={{ fontWeight: 'bold', color: '#ef4444' }}>₹{totalDue.toFixed(2)}</span>
                            </div>
                          </div>
                        );
                      })()}
                    </div>

                  </div>

                  {/* Row 2: Registered Vehicles */}
                  <div>
                    <h3 style={{ fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
                      <Car size={18} style={{ color: '#3b82f6' }} />
                      <span>Registered Vehicles ({profileData.vehicles.length})</span>
                    </h3>
                    <div className="table-card" style={{ margin: 0 }}>
                      {profileData.vehicles.length === 0 ? (
                        <p style={{ padding: '15px', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>No vehicles registered.</p>
                      ) : (
                        <table className="app-table">
                          <thead>
                            <tr>
                              <th>Vehicle Plate</th>
                              <th>Type</th>
                              <th>Driver / Owner Name</th>
                              <th>Registration Date</th>
                            </tr>
                          </thead>
                          <tbody>
                            {profileData.vehicles.map((v: any) => (
                              <tr key={v.id}>
                                <td><span className="vehicle-badge">{v.vehicle_number}</span></td>
                                <td>{v.vehicle_type}</td>
                                <td>{v.driver_name || 'Owner'}</td>
                                <td>{v.registration_date ? new Date(v.registration_date).toLocaleDateString() : '—'}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      )}
                    </div>
                  </div>

                  {/* Row 3: Service Applications */}
                  <div>
                    <h3 style={{ fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
                      <ClipboardList size={18} style={{ color: '#f59e0b' }} />
                      <span>Service Requests ({profileData.requests.length})</span>
                    </h3>
                    <div className="table-card" style={{ margin: 0 }}>
                      {profileData.requests.length === 0 ? (
                        <p style={{ padding: '15px', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>No active service applications.</p>
                      ) : (
                        <table className="app-table">
                          <thead>
                            <tr>
                              <th>Request No</th>
                              <th>Service Name</th>
                              <th>Vehicle Plate</th>
                              <th>Status</th>
                              <th>Date</th>
                            </tr>
                          </thead>
                          <tbody>
                            {profileData.requests.map((r: any) => (
                              <tr key={r.id}>
                                <td style={{ fontWeight: 700 }}>{r.request_no}</td>
                                <td>{r.service_name}</td>
                                <td><span className="vehicle-badge">{r.vehicle_number}</span></td>
                                <td>
                                  <span className={`status-badge ${r.status.toLowerCase()}`}>
                                    {r.status}
                                  </span>
                                </td>
                                <td>{new Date(r.created_at).toLocaleDateString()}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      )}
                    </div>
                  </div>

                  {/* Row 4: Receipts Log */}
                  <div>
                    <h3 style={{ fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
                      <FileText size={18} style={{ color: '#10b981' }} />
                      <span>Payment Receipts Log ({profileData.receipts.length})</span>
                    </h3>
                    <div className="table-card" style={{ margin: 0 }}>
                      {profileData.receipts.length === 0 ? (
                        <p style={{ padding: '15px', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>No payment transactions logged.</p>
                      ) : (
                        <table className="app-table">
                          <thead>
                            <tr>
                              <th>Receipt No</th>
                              <th>Req No</th>
                              <th>Service</th>
                              <th>Amount Paid</th>
                              <th>Mode</th>
                              <th>Date</th>
                            </tr>
                          </thead>
                          <tbody>
                            {profileData.receipts.map((rec: any) => (
                              <tr key={rec.id}>
                                <td style={{ fontWeight: 700 }}>{rec.receipt_no}</td>
                                <td style={{ fontWeight: 600 }}>{rec.request_no}</td>
                                <td>{rec.service_name} ({rec.vehicle_number})</td>
                                <td style={{ fontWeight: 'bold', color: '#10b981' }}>₹{rec.amount_received}</td>
                                <td><span className="payment-mode-badge">{rec.payment_mode}</span></td>
                                <td>{new Date(rec.received_at).toLocaleDateString()}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      )}
                    </div>
                  </div>

                </div>
              )}
            </div>

            <div className="modal-footer">
              <button type="button" className="btn-secondary" onClick={() => setShowProfileModal(false)}>
                Close dossier
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
};

export default CustomersList;