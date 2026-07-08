import React, { useState, useEffect } from 'react';
import api from '../services/api';
import { 
  Search, Plus, Trash2, X, AlertTriangle, Edit2
} from 'lucide-react';
import './ServiceRequestsList.css';
import './VehiclesList.css'; // Inherits shared table and pagination styles
import { useAuth } from '../context/AuthContext';









const ServiceRequestsList = () => {
  const { user, hasPermission } = useAuth();
  const [requests, setRequests] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [vehicles, setVehicles] = useState([]);
  const [services, setServices] = useState([]);

  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalRequests, setTotalRequests] = useState(0);
  const [loading, setLoading] = useState(true);

  // Modal control
  const [showModal, setShowModal] = useState(false);
  const [modalMode, setModalMode] = useState('create');
  const [selectedRequestId, setSelectedRequestId] = useState(null);
  const [errorMsg, setErrorMsg] = useState(null);

  // Form States
  const [form, setForm] = useState({
    customer_id: '',
    vehicle_id: '',
    service_id: '',
    amount: '',
    paid_amount: '0',
    remarks: '',
    payment_mode: 'Cash'
  });

  const canEditRequest = () => {
    if (user?.role === 'Admin') return true;
    if (hasPermission('service_request.edit')) return true;
    // Agent allotment bypass: allowed if the user is an Agent (backend filters list automatically)
    if (user?.role === 'Agent') return true;
    return false;
  };

  // Fetch Requests List
  const loadRequests = async () => {
    setLoading(true);
    try {
      const response = await api.get('/api/requests', {
        params: { q: search, page, limit: 10 }
      });
      if (response.data.success) {
        setRequests(response.data.requests);
        setTotalPages(response.data.pagination.totalPages);
        setTotalRequests(response.data.pagination.totalRequests);
      }
    } catch (err) {
      console.error('Failed to load service requests:', err);
    } finally {
      setLoading(false);
    }
  };

  // Fetch Master Data for Forms
  const loadFormHelpers = async () => {
    try {
      const [custRes, servRes] = await Promise.all([
        api.get('/api/customers/dropdown'),
        api.get('/api/requests/services')
      ]);
      if (custRes.data.success) setCustomers(custRes.data.customers);
      if (servRes.data.success) setServices(servRes.data.services);
    } catch (err) {
      console.error('Failed to load form helpers:', err);
    }
  };

  // Dynamically load vehicles when customer is selected
  useEffect(() => {
    if (!form.customer_id) {
      setVehicles([]);
      return;
    }
    const loadCustomerVehicles = async () => {
      try {
        const response = await api.get(`/api/vehicles/customer/${form.customer_id}`);
        if (response.data.success) {
          setVehicles(response.data.vehicles);
        }
      } catch (err) {
        console.error('Failed to load customer vehicles:', err);
      }
    };
    loadCustomerVehicles();
  }, [form.customer_id]);

  useEffect(() => {
    loadRequests(); // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, page]);

  useEffect(() => {
    loadFormHelpers();
    
    // Dynamically load Razorpay checkout script
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.async = true;
    document.body.appendChild(script);
    return () => {
      document.body.removeChild(script);
    };
  }, []);

  // Update base fee automatically when service changes
  const handleServiceChange = (serviceId) => {
    const selectedService = services.find(s => s.id.toString() === serviceId);
    setForm(f => ({
      ...f,
      service_id: serviceId,
      amount: selectedService ? selectedService.default_fee.toString() : ''
    }));
  };

  const handleOpenCreate = () => {
    setForm({
      customer_id: '',
      vehicle_id: '',
      service_id: '',
      amount: '',
      paid_amount: '0',
      remarks: '',
      payment_mode: 'Cash'
    });
    setModalMode('create');
    setSelectedRequestId(null);
    setErrorMsg(null);
    setShowModal(true);
  };

  const handleOpenEdit = (request) => {
    setForm({
      customer_id: request.customer_id.toString(),
      vehicle_id: request.vehicle_id.toString(),
      service_id: request.service_id.toString(),
      amount: request.amount.toString(),
      paid_amount: '0', // Upfront paid is locked on edit
      remarks: request.remarks || '',
      payment_mode: 'Cash'
    });
    setModalMode('edit');
    setSelectedRequestId(request.id);
    setErrorMsg(null);
    setShowModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg(null);

    const fee = parseFloat(form.amount);
    const paid = parseFloat(form.paid_amount || '0');

    if (isNaN(fee) || fee <= 0) {
      setErrorMsg("Total Service Fee must be a positive number greater than 0.");
      return;
    }

    if (modalMode === 'create') {
      if (isNaN(paid) || paid < 0) {
        setErrorMsg("Paid Upfront Amount cannot be negative.");
        return;
      }
      if (paid > fee) {
        setErrorMsg("Paid Upfront Amount cannot exceed the total service fee.");
        return;
      }
    }

    try {
      if (modalMode === 'create') {
        // If upfront payment mode is Razorpay, we must trigger the checkout first
        if (paid > 0 && form.payment_mode === 'Razorpay') {
          const orderRes = await api.post('/api/requests/create-temp-order', { amount: paid });
          if (orderRes.data.success) {
            const { key_id, order_id, amount, currency } = orderRes.data;
            const customerObj = customers.find(c => c.id.toString() === form.customer_id);

            const options = {
              key: key_id,
              amount: amount,
              currency: currency,
              name: "RTO Ledger System",
              description: "Upfront Service Request Fee",
              order_id: order_id,
              handler: async function (res) {
                try {
                  const finalResponse = await api.post('/api/requests', {
                    ...form,
                    razorpay_payment_id: res.razorpay_payment_id,
                    razorpay_order_id: res.razorpay_order_id,
                    razorpay_signature: res.razorpay_signature
                  });
                  if (finalResponse.data.success) {
                    setShowModal(false);
                    loadRequests();
                  }
                } catch (saveErr) {
                  setErrorMsg("Payment verified, but request registration failed: " + (saveErr.response?.data?.error || saveErr.message));
                }
              },
              modal: {
                ondismiss: function() {
                  setErrorMsg("Payment window closed. Please try again.");
                }
              },
              prefill: {
                name: customerObj ? customerObj.name : ""
              },
              theme: {
                color: "#3b82f6"
              }
            };
            const rzp = new window.Razorpay(options);
            rzp.on('payment.failed', function (resp) {
              setErrorMsg(`Payment failed: ${resp.error.description || 'Please try again.'}`);
            });
            rzp.open();
          }
          return;
        }

        // Normal offline creation
        const response = await api.post('/api/requests', form);
        if (response.data.success) {
          setShowModal(false);
          loadRequests();
        }
      } else {
        const response = await api.put(`/api/requests/${selectedRequestId}`, {
          customer_id: form.customer_id,
          vehicle_id: form.vehicle_id,
          service_id: form.service_id,
          amount: form.amount,
          remarks: form.remarks
        });
        if (response.data.success) {
          setShowModal(false);
          loadRequests();
        }
      }
    } catch (err) {
      setErrorMsg(err.response?.data?.error || 'Failed to submit request.');
    }
  };

  // Change request status instantly
  const handleStatusChange = async (id, status) => {
    try {
      const response = await api.patch(`/api/requests/${id}/status`, { status });
      if (response.data.success) {
        setRequests(requests.map(r => r.id === id ? { ...r, status } : r));
      }
    } catch (err) {
      console.error('Failed to update request status:', err);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Delete this request? This will roll back its associated ledger charges and receipts!")) return;
    try {
      const response = await api.delete(`/api/requests/${id}`);
      if (response.data.success) {
        loadRequests();
      }
    } catch (err) {
      console.error('Failed to delete request:', err);
    }
  };

  return (
    <div className="page-container">
      
      {/* Search and Action Row */}
      <div className="page-actions">
        <div className="search-input-wrap">
          <Search className="search-icon-pos" size={18} />
          <input
            type="text"
            placeholder="Search REQ-123, owner, plate..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          />
        </div>
        
        {hasPermission('service.create') && (
          <button type="button" className="quick-add-btn" onClick={handleOpenCreate}>
            <Plus size={18} />
            <span>Register Request</span>
          </button>
        )}
      </div>

      {/* Database Table */}
      <div className="table-card">
        {loading ? (
          <div style={{ padding: '40px', textAlignment: 'center' }}>
            <h2>Loading Service Requests...</h2>
          </div>
        ) : requests.length === 0 ? (
          <div style={{ padding: '40px', textAlignment: 'center', color: 'var(--text-secondary)' }}>
            <AlertTriangle style={{ margin: '0 auto 10px' }} size={32} />
            <p>No service requests found matching search filters.</p>
          </div>
        ) : (
          <>
            <table className="app-table">
              <thead>
                <tr>
                  <th>Request No</th>
                  <th>Customer Owner</th>
                  <th>Vehicle Number</th>
                  <th>Service Applied</th>
                  <th>Amount (Fee)</th>
                  <th>Status</th>
                  <th>Date</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {requests.map((r) => (
                  <tr key={r.id}>
                    <td style={{ fontWeight: 700 }}>{r.request_no}</td>
                    <td>
                      <div className="driver-info-cell">
                        <span className="name">{r.customer_name}</span>
                        <span className="mobile">{r.customer_code}</span>
                      </div>
                    </td>
                    <td>
                      <span className="vehicle-badge">{r.vehicle_number}</span>
                    </td>
                    <td style={{ fontWeight: 600 }}>{r.service_name}</td>
                    <td style={{ fontWeight: 700 }}>₹{r.amount}</td>
                    <td>
                      {canEditRequest() ? (
                        <select
                          value={r.status}
                          onChange={(e) => handleStatusChange(r.id, e.target.value)}
                          className={`status-select-btn ${r.status.toLowerCase()}`}
                        >
                          <option value="Pending">Pending</option>
                          <option value="Approved">Approved</option>
                          <option value="Completed">Completed</option>
                          <option value="Rejected">Rejected</option>
                        </select>
                      ) : (
                        <span className={`status-select-btn ${r.status.toLowerCase()}`} style={{ cursor: 'default', display: 'inline-block', border: 'none', appearance: 'none', padding: '6px 12px' }}>
                          {r.status}
                        </span>
                      )}
                    </td>
                    <td>
                      <div className="driver-info-cell">
                        <span>{new Date(r.created_at).toLocaleDateString()}</span>
                        <span className="mobile">{new Date(r.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                      </div>
                    </td>
                    <td>
                      {canEditRequest() && (
                        <div className="action-buttons-cell" style={{ display: 'flex', gap: '6px' }}>
                          <button 
                            type="button" 
                            className="btn-icon edit" 
                            onClick={() => handleOpenEdit(r)}
                            style={{ border: 'none', background: 'var(--bg-secondary)', padding: '5px', borderRadius: '4px', cursor: 'pointer' }}
                            title="Edit request details"
                          >
                            <Edit2 size={15} />
                          </button>
                          <button type="button" className="btn-icon delete" onClick={() => handleDelete(r.id)}>
                            <Trash2 size={15} />
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Pagination Controls */}
            <div className="pagination-row">
              <div className="pagination-info">
                Showing {((page - 1) * 10) + 1} to {Math.min(page * 10, totalRequests)} of {totalRequests} service requests
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
      </div>

      {/* ==================== REGISTER REQUEST MODAL ==================== */}
      {showModal && (
        <div className="modal-overlay">
          <div className="modal-card" style={{ maxWidth: '550px' }}>
            
            <div className="modal-header">
              <h2>{modalMode === 'create' ? 'Register New Service Request' : 'Edit Service Request Details'}</h2>
              <button type="button" className="close-btn" onClick={() => setShowModal(false)}>
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSubmit}>
              <div className="modal-body" style={{ maxHeight: '60vh', overflowY: 'auto', paddingRight: '10px' }}>
                
                {errorMsg && (
                  <div className="error-banner" style={{ borderRadius: '8px', marginBottom: '15px' }}>
                    {errorMsg}
                  </div>
                )}

                {/* 1. Customer Selection */}
                <div className="form-group-sm form-item">
                  <label>Customer Owner *</label>
                  <select
                    value={form.customer_id}
                    onChange={(e) => setForm({ ...form, customer_id: e.target.value, vehicle_id: '' })}
                    required
                  >
                    <option value="">-- Choose Customer Owner --</option>
                    {customers.map(c => (
                      <option key={c.id} value={c.id}>{c.name} ({c.customer_code})</option>
                    ))}
                  </select>
                </div>

                {/* 2. Vehicle Selection (loads based on selected customer) */}
                <div className="form-group-sm form-item">
                  <label>Select Vehicle *</label>
                  <select
                    value={form.vehicle_id}
                    onChange={(e) => setForm({ ...form, vehicle_id: e.target.value })}
                    required
                    disabled={!form.customer_id}
                  >
                    <option value="">-- Choose Vehicle --</option>
                    {vehicles.map(v => (
                      <option key={v.id} value={v.id}>{v.vehicle_number} ({v.vehicle_type})</option>
                    ))}
                  </select>
                  {!form.customer_id && (
                    <small style={{ color: 'var(--text-secondary)', marginTop: '4px', display: 'block' }}>
                      Please select a customer first to load their registered vehicles.
                    </small>
                  )}
                </div>

                {/* 3. Service Selection */}
                <div className="form-group-sm form-item">
                  <label>RTO Service Applied *</label>
                  <select
                    value={form.service_id}
                    onChange={(e) => handleServiceChange(e.target.value)}
                    required
                  >
                    <option value="">-- Choose Service --</option>
                    {services.map(s => (
                      <option key={s.id} value={s.id}>{s.service_name} (₹{s.default_fee})</option>
                    ))}
                  </select>
                </div>

                {/* 4. Financial Amounts */}
                <div className="form-row">
                  <div className="form-group-sm form-item">
                    <label>Total Service Fee (₹) *</label>
                    <input
                      type="number"
                      placeholder="Total Charge"
                      value={form.amount}
                      onChange={(e) => setForm({ ...form, amount: e.target.value })}
                      required
                    />
                  </div>
                  {modalMode === 'create' && (
                    <div className="form-group-sm form-item">
                      <label>Upfront Paid Amount (₹)</label>
                      <input
                        type="number"
                        placeholder="Paid upfront"
                        value={form.paid_amount}
                        onChange={(e) => setForm({ ...form, paid_amount: e.target.value })}
                      />
                    </div>
                  )}
                </div>

                {modalMode === 'create' && parseFloat(form.paid_amount || '0') > 0 && (
                  <div className="form-row">
                    <div className="form-group-sm form-item" style={{ flex: 1 }}>
                      <label>Payment Mode *</label>
                      <select
                        value={form.payment_mode}
                        onChange={(e) => setForm({ ...form, payment_mode: e.target.value })}
                        required
                      >
                        <option value="Cash">Cash</option>
                        <option value="Razorpay">Razorpay (Online)</option>
                      </select>
                    </div>
                  </div>
                )}

                {/* 5. Remarks */}
                <div className="form-group-sm form-item">
                  <label>Remarks / Notes</label>
                  <input
                    type="text"
                    placeholder="Enter file details or status notes"
                    value={form.remarks}
                    onChange={(e) => setForm({ ...form, remarks: e.target.value })}
                  />
                </div>

              </div>

              <div className="modal-footer">
                <button type="button" className="btn-secondary" onClick={() => setShowModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="submit-btn" style={{ width: 'auto', background: '#3b82f6', color: 'white' }}>
                  Register Request
                </button>
              </div>
            </form>

          </div>
        </div>
      )}

    </div>
  );
};

export default ServiceRequestsList;
