import React, { useState, useEffect } from 'react';
import api from '../services/api';
import { 
  Search, X, AlertTriangle, IndianRupee,
} from 'lucide-react';
import './LedgerList.css';
import './VehiclesList.css'; // Inherits shared table and pagination styles
import { useAuth } from '../context/AuthContext';



const LedgerList = () => {
  const { hasPermission } = useAuth();
  const [records, setRecords] = useState([]);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalRecords, setTotalRecords] = useState(0);
  const [loading, setLoading] = useState(true);

  // Modal Control
  const [showModal, setShowModal] = useState(false);
  const [selectedLedger, setSelectedLedger] = useState(null);
  const [errorMsg, setErrorMsg] = useState(null);

  // Form State
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentMode, setPaymentMode] = useState('Cash');
  const [remarks, setRemarks] = useState('');

  // Dynamically load Razorpay Checkout Script on mount
  useEffect(() => {
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.async = true;
    document.body.appendChild(script);
    return () => {
      document.body.removeChild(script);
    };
  }, []);

  const loadLedgers = async () => {
    setLoading(true);
    try {
      const response = await api.get('/api/ledgers', {
        params: { q: search, page, limit: 10 }
      });
      if (response.data.success) {
        setRecords(response.data.ledgers);
        setTotalPages(response.data.pagination.totalPages);
        setTotalRecords(response.data.pagination.totalRecords);
      }
    } catch (err) {
      console.error('Failed to load ledger database:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLedgers();
  }, [search, page]);

  const handleOpenPayment = (record) => {
    setSelectedLedger(record);
    setPaymentAmount(parseFloat(record.due_amount.toString()).toFixed(0)); // Auto-fill with remaining due
    setPaymentMode('Cash');
    setRemarks('');
    setErrorMsg(null);
    setShowModal(true);
  };

  const handleSubmitPayment = async (e) => {
    e.preventDefault();
    setErrorMsg(null);
    if (!selectedLedger) return;

    const payAmt = parseFloat(paymentAmount);
    if (isNaN(payAmt) || payAmt <= 0) {
      setErrorMsg("Please enter a valid payment amount.");
      return;
    }

    if (paymentMode === 'Online') {
      try {
        // 1. Create a temporary Razorpay Order via staff-accessible endpoint
        const orderRes = await api.post('/api/requests/create-temp-order', { amount: payAmt });
        if (orderRes.data.success) {
          const { key_id, order_id, amount, currency } = orderRes.data;

          const options = {
            key: key_id,
            amount: amount,
            currency: currency,
            name: "RTO Ledger System",
            description: `Fee Payment for request #${selectedLedger.request_no}`,
            order_id: order_id,
            handler: async function (res) {
              try {
                const response = await api.post('/api/ledgers/payment', {
                  ledger_id: selectedLedger.id,
                  amount_received: paymentAmount,
                  payment_mode: paymentMode,
                  remarks: remarks,
                  razorpay_payment_id: res.razorpay_payment_id,
                  razorpay_order_id: res.razorpay_order_id,
                  razorpay_signature: res.razorpay_signature
                });
                if (response.data.success) {
                  setShowModal(false);
                  loadLedgers(); // Reload the table
                }
              } catch (err) {
                setErrorMsg(err.response?.data?.error || 'Failed to record online payment.');
              }
            },
            modal: {
              ondismiss: function() {
                setErrorMsg("Payment window closed. Please try again.");
              }
            },
            prefill: {
              name: selectedLedger.customer_name || ""
            },
            theme: {
              color: "#3b82f6"
            }
          };

          const rzp = new window.Razorpay(options);
          rzp.on('payment.failed', function (resp) {
            setErrorMsg(`Payment transaction failed: ${resp.error.description}`);
          });
          rzp.open();
        }
      } catch (err) {
        setErrorMsg(err.response?.data?.error || err.message || "Failed to initiate online transaction.");
      }
    } else {
      // Normal offline payment logging
      try {
        const response = await api.post('/api/ledgers/payment', {
          ledger_id: selectedLedger.id,
          amount_received: paymentAmount,
          payment_mode: paymentMode,
          remarks: remarks
        });
        if (response.data.success) {
          setShowModal(false);
          loadLedgers(); // Reload the table
        }
      } catch (err) {
        setErrorMsg(err.response?.data?.error || 'Failed to record payment.');
      }
    }
  };

  return (
    <div className="page-container">
      
      {/* Top Filter actions */}
      <div className="page-actions">
        <div className="search-input-wrap">
          <Search className="search-icon-pos" size={18} />
          <input
            type="text"
            placeholder="Search by owner, plate, or REQ ID..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          />
        </div>
      </div>

      {/* Main Ledger Table */}
      <div className="table-card">
        {loading ? (
          <div style={{ padding: '40px', textAlignment: 'center' }}>
            <h2>Loading Accounts Ledger...</h2>
          </div>
        ) : records.length === 0 ? (
          <div style={{ padding: '40px', textAlignment: 'center', color: 'var(--text-secondary)' }}>
            <AlertTriangle style={{ margin: '0 auto 10px' }} size={32} />
            <p>No billing ledger records found matching search filters.</p>
          </div>
        ) : (
          <>
            <table className="app-table">
              <thead>
                <tr>
                  <th>Job Request No</th>
                  <th>Customer Owner</th>
                  <th>Vehicle Number</th>
                  <th>Service Applied</th>
                  <th>Charge (₹)</th>
                  <th>Paid (₹)</th>
                  <th>Dues (₹)</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {records.map((r) => (
                  <tr key={r.id}>
                    <td style={{ fontWeight: 600 }}>{r.request_no}</td>
                    <td>
                      <div className="driver-info-cell">
                        <span className="name">{r.customer_name}</span>
                        <span className="mobile">{r.customer_code}</span>
                      </div>
                    </td>
                    <td>
                      <span className="vehicle-badge">{r.vehicle_number}</span>
                    </td>
                    <td>{r.service_name}</td>
                    <td className="ledger-amount-charged">₹{r.service_fee}</td>
                    <td className="ledger-amount-paid">₹{r.amount_paid}</td>
                    <td className={`ledger-amount-due ${parseFloat(r.due_amount.toString()) === 0 ? 'cleared' : ''}`}>
                      ₹{r.due_amount}
                    </td>
                    <td>
                      <span className={`status-badge ${r.status.toLowerCase()}`}>
                        {r.status}
                      </span>
                    </td>
                    <td>
                      {parseFloat(r.due_amount.toString()) > 0 ? (
                        hasPermission('ledger.create') ? (
                          <button 
                            type="button" 
                            className="quick-add-btn" 
                            style={{ padding: '6px 12px', fontSize: '0.8rem', background: '#3b82f6', color: 'white' }}
                            onClick={() => handleOpenPayment(r)}
                          >
                            <IndianRupee size={13} />
                            <span>Pay Dues</span>
                          </button>
                        ) : (
                          <span style={{ color: 'var(--text-secondary)', fontSize: '0.82rem' }}>Due</span>
                        )
                      ) : (
                        <span style={{ color: '#10b981', fontSize: '0.82rem', fontWeight: 700 }}>Settled ✓</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Pagination Controls */}
            <div className="pagination-row">
              <div className="pagination-info">
                Showing {((page - 1) * 10) + 1} to {Math.min(page * 10, totalRecords)} of {totalRecords} accounts
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

      {/* ==================== RECORD PAYMENT MODAL ==================== */}
      {showModal && selectedLedger && (
        <div className="modal-overlay">
          <div className="modal-card" style={{ maxWidth: '450px' }}>
            
            <div className="modal-header">
              <h2>Record Payment</h2>
              <button type="button" className="close-btn" onClick={() => setShowModal(false)}>
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSubmitPayment}>
              <div className="modal-body">
                
                {errorMsg && (
                  <div className="error-banner" style={{ borderRadius: '8px', marginBottom: '15px' }}>
                    {errorMsg}
                  </div>
                )}

                <div style={{ marginBottom: '15px', padding: '12px', backgroundColor: 'var(--bg-primary)', borderRadius: '10px' }}>
                  <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Account Owner:</p>
                  <p style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--text-primary)' }}>{selectedLedger.customer_name} ({selectedLedger.customer_code})</p>
                  <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '8px' }}>Active Dues:</p>
                  <p style={{ fontWeight: 700, fontSize: '1.2rem', color: '#ef4444' }}>₹{selectedLedger.due_amount}</p>
                </div>

                <div className="form-group-sm form-item">
                  <label>Amount to Pay (₹) *</label>
                  <input
                    type="number"
                    max={parseFloat(selectedLedger.due_amount.toString())}
                    min={1}
                    value={paymentAmount}
                    onChange={(e) => setPaymentAmount(e.target.value)}
                    required
                  />
                </div>

                <div className="form-group-sm form-item">
                  <label>Payment Mode *</label>
                  <select
                    value={paymentMode}
                    onChange={(e) => setPaymentMode(e.target.value)}
                    required
                  >
                    <option value="Cash">💵 Cash</option>
                    <option value="Online">🌐 Online / UPI</option>
                    <option value="Card">💳 Card Payment</option>
                  </select>
                </div>

                <div className="form-group-sm form-item">
                  <label>Transaction Notes</label>
                  <input
                    type="text"
                    placeholder="e.g. Paid via PhonePe, Cash handed to clerk"
                    value={remarks}
                    onChange={(e) => setRemarks(e.target.value)}
                  />
                </div>

              </div>

              <div className="modal-footer">
                <button type="button" className="btn-secondary" onClick={() => setShowModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="submit-btn" style={{ width: 'auto', background: '#10b981', color: 'white' }}>
                  Log Payment
                </button>
              </div>
            </form>

          </div>
        </div>
      )}

    </div>
  );
};

export default LedgerList;