import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import { 
  Car, ClipboardList, IndianRupee, LogOut, 
  Printer, X, Clock 
} from 'lucide-react';
import './CustomerDashboard.css';
import './ReceiptsList.css'; // Reuses invoice slip visual styling rules
import '../components/Layout.css'; // Reuses sidebar and main container layout css rules

const CustomerDashboard = () => {
  const { customer, logout } = useAuth();
  
  // Tab control
  const [activeTab, setActiveTab] = useState('overview');
  
  // Data States
  const [profile, setProfile] = useState(null);
  const [vehicles, setVehicles] = useState([]);
  const [requests, setRequests] = useState([]);
  const [ledgers, setLedgers] = useState([]);
  const [receipts, setReceipts] = useState([]);
  const [loading, setLoading] = useState(true);

  // Printing Receipt Modal
  const [showModal, setShowModal] = useState(false);
  const [selectedReceipt, setSelectedReceipt] = useState(null);

  // Online Payment States
  const [showPayModal, setShowPayModal] = useState(false);
  const [paymentLedger, setPaymentLedger] = useState(null);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentError, setPaymentError] = useState(null);
  const [paymentProcessing, setPaymentProcessing] = useState(false);

  // Fetch portal data
  const loadPortalData = async (isSilent = false) => {
    if (!isSilent) setLoading(true);
    try {
      const [vRes, rRes, lRes, recRes, pRes] = await Promise.all([
        api.get('/api/portal/vehicles'),
        api.get('/api/portal/requests'),
        api.get('/api/portal/ledger'),
        api.get('/api/portal/receipts'),
        api.get('/api/portal/profile')
      ]);
      if (vRes.data.success) setVehicles(vRes.data.vehicles);
      if (rRes.data.success) setRequests(rRes.data.requests);
      if (lRes.data.success) setLedgers(lRes.data.ledger);
      if (recRes.data.success) setReceipts(recRes.data.receipts);
      if (pRes.data.success) setProfile(pRes.data.customer);
    } catch (err) {
      console.error('Failed to load portal metrics:', err);
    } finally {
      setLoading(false);
    }
  };

  // Load portal data on mount
  useEffect(() => {
    loadPortalData();
  }, []);

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

  const totalDues = ledgers.reduce((sum, current) => sum + parseFloat(current.due_amount.toString()), 0);
  const totalPaid = ledgers.reduce((sum, current) => sum + parseFloat(current.amount_paid.toString()), 0);

  const handlePrintOpen = (receipt) => {
    setSelectedReceipt(receipt);
    setShowModal(true);
  };

  // Open Payment dialog
  const handleOpenPayment = (ledger) => {
    setPaymentLedger(ledger);
    setPaymentAmount(ledger.due_amount.toString());
    setPaymentError(null);
    setShowPayModal(true);
  };

  // Process secure payment creation & checkout
  const handleProceedPayment = async (e) => {
    e.preventDefault();
    setPaymentError(null);
    
    if (!paymentLedger) return;

    const payVal = parseFloat(paymentAmount);
    if (isNaN(payVal) || payVal <= 0) {
      setPaymentError("Please enter a valid payment amount.");
      return;
    }

    if (payVal > parseFloat(paymentLedger.due_amount.toString())) {
      setPaymentError(`Payment amount cannot exceed outstanding dues (₹${paymentLedger.due_amount}).`);
      return;
    }

    setPaymentProcessing(true);

    try {
      // 1. Request Order creation from backend
      const orderRes = await api.post('/api/portal/payments/create-order', {
        ledger_id: paymentLedger.id,
        amount: payVal
      });

      if (orderRes.data.success) {
        const { key_id, order_id, amount, currency } = orderRes.data;

        // 2. Configure Razorpay checkout options
        const options = {
          key: key_id,
          amount: amount,
          currency: currency,
          name: "RTO Ledger System",
          description: `Fee Payment for request #${paymentLedger.request_no}`,
          order_id: order_id,
          handler: async function (res) {
            try {
              setPaymentProcessing(true);
              const verifyRes = await api.post('/api/portal/payments/verify-payment', {
                razorpay_payment_id: res.razorpay_payment_id,
                razorpay_order_id: res.razorpay_order_id,
                razorpay_signature: res.razorpay_signature,
                ledger_id: paymentLedger.id,
                amount: payVal
              });
              
              if (verifyRes.data.success) {
                alert(`Payment of ₹${payVal} verified and recorded successfully!\nReceipt logged instantly.`);
                setShowPayModal(false);
                loadPortalData(true); // reload portal metrics silently in background
              } else {
                alert("Payment verification failed! Please contact support with reference: " + res.razorpay_payment_id);
              }
            } catch (verifyErr) {
              console.error("Verification error:", verifyErr);
              alert("Error verifying payment signature: " + (verifyErr.response?.data?.error || verifyErr.message));
            } finally {
              setPaymentProcessing(false);
            }
          },
          prefill: {
            name: customer?.name || "",
            email: customer?.email || "",
            contact: customer?.mobile || ""
          },
          notes: {
            ledger_id: paymentLedger.id.toString(),
            customer_id: customer?.id.toString()
          },
          theme: {
            color: "#3b82f6"
          }
        };

        const rzp = new window.Razorpay(options);
        rzp.on('payment.failed', function (resp) {
          alert(`Payment transaction failed!\nReason: ${resp.error.description}`);
        });

        rzp.open();
      }
    } catch (err) {
      setPaymentError(err.response?.data?.error || err.message || "Failed to initiate online transaction.");
    } finally {
      setPaymentProcessing(false);
    }
  };

  return (
    <div className="layout-container">
      
      {/* 🧭 PORTAL SIDEBAR */}
      <aside className="sidebar" style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
        
        <div className="sidebar-header" style={{ display: 'flex', alignItems: 'center', padding: '15px 20px' }}>
          <Car size={24} style={{ color: 'var(--button-color)', flexShrink: 0 }} />
          <span className="sidebar-title" style={{ marginLeft: '10px', fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '0.5px', fontSize: '1rem' }}>CUSTOMER PORTAL</span>
        </div>

        <nav style={{ flex: 1, marginTop: '20px' }}>
          <ul className="sidebar-menu" style={{ listStyle: 'none', padding: '0 12px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
            
            <li className={`menu-item ${activeTab === 'overview' ? 'active' : ''}`}>
              <a onClick={() => setActiveTab('overview')} style={{ cursor: 'pointer' }}>
                <ClipboardList size={18} />
                <span>Overview</span>
              </a>
            </li>

            <li className={`menu-item ${activeTab === 'vehicles' ? 'active' : ''}`}>
              <a onClick={() => setActiveTab('vehicles')} style={{ cursor: 'pointer' }}>
                <Car size={18} />
                <span>My Vehicles</span>
              </a>
            </li>

            <li className={`menu-item ${activeTab === 'requests' ? 'active' : ''}`}>
              <a onClick={() => setActiveTab('requests')} style={{ cursor: 'pointer' }}>
                <Clock size={18} />
                <span>Service Requests</span>
              </a>
            </li>

            <li className={`menu-item ${activeTab === 'billing' ? 'active' : ''}`}>
              <a onClick={() => setActiveTab('billing')} style={{ cursor: 'pointer' }}>
                <IndianRupee size={18} />
                <span>Dues & Receipts</span>
              </a>
            </li>

          </ul>
        </nav>

        {/* Customer Profile footer */}
        <div className="sidebar-footer" style={{ padding: '20px 16px', borderTop: '1px solid var(--border-color)', background: 'rgba(0,0,0,0.1)' }}>
          <div style={{ marginBottom: '12px', fontSize: '0.85rem', color: 'var(--text-primary)', fontWeight: 600 }}>
            <div>{profile?.name || customer?.name}</div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '2px', fontWeight: 500 }}>Code: {profile?.customer_code || '...'}</div>
          </div>
          <button 
            type="button" 
            className="logout-btn" 
            onClick={logout} 
            style={{ 
              width: '100%', 
              display: 'flex', 
              alignItems: 'center', 
              gap: '10px', 
              padding: '10px 14px', 
              background: 'rgba(239,68,68,0.1)', 
              border: 'none', 
              color: '#ef4444', 
              cursor: 'pointer', 
              transition: '0.2s', 
              borderRadius: '8px',
              fontWeight: 600,
              fontSize: '0.82rem'
            }}
          >
            <LogOut size={14} />
            <span>Sign Out</span>
          </button>
        </div>

      </aside>

      {/* 🖥️ MAIN WORKSPACE */}
      <div className="main-wrapper">
        
        {/* Top Header navbar */}
        <header className="navbar" style={{ padding: '15px 24px' }}>
          <div className="navbar-left">
            <h2>
              {activeTab === 'overview' ? 'Personal Dossier' : 
               activeTab === 'vehicles' ? 'My Registered Vehicles' : 
               activeTab === 'requests' ? 'Active Service Requests' : 
               'Financial Ledger Statements'}
            </h2>
          </div>
          <div className="navbar-right" style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
            <div style={{ padding: '6px 12px', borderRadius: '6px', backgroundColor: 'rgba(16, 185, 129, 0.08)', border: '1px solid rgba(16, 185, 129, 0.2)', fontSize: '0.8rem', fontWeight: 600 }}>
              <span style={{ color: 'var(--text-secondary)', marginRight: '6px' }}>PAID:</span>
              <span style={{ color: '#10b981' }}>₹{totalPaid.toFixed(2)}</span>
            </div>
            <div style={{ padding: '6px 12px', borderRadius: '6px', backgroundColor: 'rgba(239, 68, 68, 0.08)', border: '1px solid rgba(239, 68, 68, 0.2)', fontSize: '0.8rem', fontWeight: 600 }}>
              <span style={{ color: 'var(--text-secondary)', marginRight: '6px' }}>OUTSTANDING DUES:</span>
              <span style={{ color: '#ef4444' }}>₹{totalDues.toFixed(2)}</span>
            </div>
          </div>
        </header>

        {/* Content Body */}
        <main className="app-page-content" style={{ padding: '24px' }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: '40px' }}>
              <h3>Syncing Portal details...</h3>
            </div>
          ) : (
            <>
              {/* OVERVIEW TAB */}
              {activeTab === 'overview' && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))', gap: '20px' }}>
                  <div className="overview-section">
                    <h2>My Personal Dossier</h2>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '15px' }}>
                      <div><strong>Client ID Code:</strong> {profile?.customer_code || '...'}</div>
                      <div><strong>Full Name:</strong> {profile?.name || customer?.name}</div>
                      <div><strong>Mobile Number:</strong> {profile?.mobile || '...'}</div>
                      <div><strong>Email Address:</strong> {profile?.email || '—'}</div>
                      <div><strong>Billing Address:</strong> {profile?.address || '—'}</div>
                    </div>
                  </div>

                  <div className="overview-section">
                    <h2>Ongoing Service Timelines</h2>
                    {requests.filter(r => r.status !== 'Completed' && r.status !== 'Rejected').length === 0 ? (
                      <p style={{ marginTop: '15px', color: 'var(--text-secondary)' }}>No active requests currently processing.</p>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '15px' }}>
                        {requests.filter(r => r.status !== 'Completed' && r.status !== 'Rejected').map(r => (
                          <div key={r.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 14px', backgroundColor: 'var(--bg-primary)', borderRadius: '8px' }}>
                            <div>
                              <strong style={{ color: 'var(--text-primary)' }}>{r.request_no}</strong> - {r.service_name}
                              <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '2px' }}>Plate: {r.vehicle_number}</div>
                            </div>
                            <span className={`status-badge ${r.status.toLowerCase()}`} style={{ alignSelf: 'center' }}>{r.status}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* VEHICLES TAB */}
              {activeTab === 'vehicles' && (
                <div className="table-card">
                  {vehicles.length === 0 ? (
                    <p style={{ padding: '20px', color: 'var(--text-secondary)' }}>No registered vehicles found.</p>
                  ) : (
                    <table className="app-table">
                      <thead>
                        <tr>
                          <th>Vehicle Plate</th>
                          <th>Type</th>
                          <th>Driver/Owner Name</th>
                          <th>Registration Date</th>
                        </tr>
                      </thead>
                      <tbody>
                        {vehicles.map(v => (
                          <tr key={v.id}>
                            <td><span className="vehicle-badge" style={{ fontSize: '0.9rem', padding: '6px 12px' }}>{v.vehicle_number}</span></td>
                            <td>{v.vehicle_type}</td>
                            <td>{v.driver_name || 'Owner'}</td>
                            <td>{v.registration_date ? new Date(v.registration_date).toLocaleDateString() : '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              )}

              {/* REQUESTS TAB */}
              {activeTab === 'requests' && (
                <div className="table-card">
                  {requests.length === 0 ? (
                    <p style={{ padding: '20px', color: 'var(--text-secondary)' }}>No service requests active.</p>
                  ) : (
                    <table className="app-table">
                      <thead>
                        <tr>
                          <th>Job Request No</th>
                          <th>Applied Service</th>
                          <th>Vehicle</th>
                          <th>Date Applied</th>
                          <th>Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {requests.map(r => (
                          <tr key={r.id}>
                            <td style={{ fontWeight: 700 }}>{r.request_no}</td>
                            <td>{r.service_name}</td>
                            <td><span className="vehicle-badge">{r.vehicle_number}</span></td>
                            <td>{new Date(r.created_at).toLocaleDateString()}</td>
                            <td>
                              <span className={`status-badge ${r.status.toLowerCase()}`}>
                                {r.status}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              )}

              {/* BILLING TAB */}
              {activeTab === 'billing' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '30px' }}>
                  
                  {/* Ledger balances */}
                  <div className="table-card">
                    <h3 style={{ padding: '15px 20px', borderBottom: '1px solid var(--border-color)', fontSize: '0.95rem' }}>Outstanding Statements</h3>
                    {ledgers.length === 0 ? (
                      <p style={{ padding: '20px', color: 'var(--text-secondary)' }}>No ledger statements created.</p>
                    ) : (
                      <table className="app-table">
                        <thead>
                          <tr>
                            <th>Job Request No</th>
                            <th>Service</th>
                            <th>Charge</th>
                            <th>Paid</th>
                            <th>Dues Remaining</th>
                            <th>Status</th>
                            <th>Action</th>
                          </tr>
                        </thead>
                        <tbody>
                          {ledgers.map(l => (
                            <tr key={l.id}>
                              <td style={{ fontWeight: 600 }}>{l.request_no}</td>
                              <td>{l.service_name} ({l.vehicle_number})</td>
                              <td className="ledger-amount-charged">₹{l.service_fee}</td>
                              <td className="ledger-amount-paid">₹{l.amount_paid}</td>
                              <td className={`ledger-amount-due ${parseFloat(l.due_amount.toString()) === 0 ? 'cleared' : ''}`}>₹{l.due_amount}</td>
                              <td>
                                <span className={`status-badge ${l.status.toLowerCase()}`}>
                                  {l.status}
                                </span>
                              </td>
                              <td>
                                {parseFloat(l.due_amount.toString()) > 0 ? (
                                  <button 
                                    type="button" 
                                    className="quick-add-btn" 
                                    style={{ padding: '6px 12px', fontSize: '0.8rem', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}
                                    onClick={() => handleOpenPayment(l)}
                                  >
                                    Pay Online
                                  </button>
                                ) : (
                                  <span style={{ color: '#10b981', fontWeight: 'bold', fontSize: '0.85rem' }}>✓ Paid</span>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>

                  {/* Receipts download */}
                  <div className="table-card">
                    <h3 style={{ padding: '15px 20px', borderBottom: '1px solid var(--border-color)', fontSize: '0.95rem' }}>Payment Receipts Log</h3>
                    {receipts.length === 0 ? (
                      <p style={{ padding: '20px', color: 'var(--text-secondary)' }}>No receipts logged.</p>
                    ) : (
                      <table className="app-table">
                        <thead>
                          <tr>
                            <th>Receipt No</th>
                            <th>Job Request No</th>
                            <th>Service Detail</th>
                            <th>Amount Received</th>
                            <th>Payment Mode</th>
                            <th>Date</th>
                            <th>Action</th>
                          </tr>
                        </thead>
                        <tbody>
                          {receipts.map(rec => (
                            <tr key={rec.id}>
                              <td style={{ fontWeight: 700 }}>{rec.receipt_no}</td>
                              <td style={{ fontWeight: 600 }}>{rec.request_no}</td>
                              <td>{rec.service_name} ({rec.vehicle_number})</td>
                              <td className="receipt-amount-text">₹{rec.amount_received}</td>
                              <td><span className="payment-mode-badge">{rec.payment_mode}</span></td>
                              <td>{new Date(rec.received_at).toLocaleDateString()}</td>
                              <td>
                                <button 
                                  type="button" 
                                  className="print-btn"
                                  onClick={() => handlePrintOpen(rec)}
                                >
                                  <Printer size={14} />
                                  <span>Print Slip</span>
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>

                </div>
              )}
            </>
          )}
        </main>

      </div>

      {/* ==================== PRINT MODAL DIALOG ==================== */}
      {showModal && selectedReceipt && (
        <div className="modal-overlay">
          <div className="modal-card" style={{ maxWidth: '500px', backgroundColor: 'var(--bg-secondary)' }}>
            
            <div className="modal-header">
              <h2>Payment Slip Preview</h2>
              <button type="button" className="close-btn" onClick={() => setShowModal(false)}>
                <X size={20} />
              </button>
            </div>

            <div className="modal-body" style={{ padding: '20px' }}>
              <div className="print-invoice-container">
                <div className="invoice-header">
                  <h1>RTO LEDGER SYSTEM</h1>
                  <p>Regional Transport Office Agent Services</p>
                  <p>Onboarding, Registration & Finance</p>
                </div>

                <div className="invoice-meta-row">
                  <span className="invoice-meta-label">Receipt No:</span>
                  <span>{selectedReceipt.receipt_no}</span>
                </div>
                <div className="invoice-meta-row">
                  <span className="invoice-meta-label">Job Req No:</span>
                  <span>{selectedReceipt.request_no}</span>
                </div>
                <div className="invoice-meta-row">
                  <span className="invoice-meta-label">Date/Time:</span>
                  <span>{new Date(selectedReceipt.received_at).toLocaleString()}</span>
                </div>

                <div className="invoice-separator"></div>

                <div className="invoice-meta-row">
                  <span className="invoice-meta-label">Customer Name:</span>
                  <span>{customer?.name} ({customer?.customer_code})</span>
                </div>
                <div className="invoice-meta-row">
                  <span className="invoice-meta-label">Customer Mobile:</span>
                  <span>{customer?.mobile}</span>
                </div>

                <div className="invoice-separator"></div>

                <div className="invoice-meta-row">
                  <span className="invoice-meta-label">Vehicle Plate:</span>
                  <span>{selectedReceipt.vehicle_number}</span>
                </div>
                <div className="invoice-meta-row">
                  <span className="invoice-meta-label">RTO Service:</span>
                  <span style={{ fontWeight: 'bold' }}>{selectedReceipt.service_name}</span>
                </div>

                <div className="invoice-separator"></div>

                <div className="invoice-meta-row">
                  <span className="invoice-meta-label">Payment Mode:</span>
                  <span>{selectedReceipt.payment_mode}</span>
                </div>
                {selectedReceipt.remarks && (
                  <div className="invoice-meta-row">
                    <span className="invoice-meta-label">Notes:</span>
                    <span style={{ fontSize: '0.78rem' }}>{selectedReceipt.remarks}</span>
                  </div>
                )}

                <div className="invoice-total-section">
                  <div className="invoice-total-row">
                    <span>AMOUNT RECEIVED</span>
                    <span>₹{selectedReceipt.amount_received}</span>
                  </div>
                </div>

                <div className="invoice-footer">
                  <p style={{ marginTop: '10px', fontSize: '0.75rem', borderTop: '1px dashed #94a3b8', paddingTop: '8px' }}>
                    Thank you for your business!
                  </p>
                </div>
              </div>
            </div>

            <div className="modal-footer">
              <button type="button" className="btn-secondary" onClick={() => setShowModal(false)}>
                Close
              </button>
              <button 
                type="button" 
                className="submit-btn" 
                onClick={() => window.print()}
                style={{ width: 'auto' }}
              >
                <Printer size={15} style={{ marginRight: '6px' }} />
                <span>Print Slip</span>
              </button>
            </div>

          </div>
        </div>
      )}

      {/* ==================== PAY ONLINE MODAL ==================== */}
      {showPayModal && paymentLedger && (
        <div className="modal-overlay" style={{ zIndex: 1001 }}>
          <div className="modal-card" style={{ maxWidth: '450px' }}>
            <div className="modal-header">
              <h2>Pay Outstanding Dues</h2>
              <button type="button" className="close-btn" onClick={() => setShowPayModal(false)}>
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleProceedPayment}>
              <div className="modal-body">
                {paymentError && <div className="error-banner">{paymentError}</div>}
                
                <div style={{ marginBottom: '15px', padding: '12px', backgroundColor: 'var(--bg-secondary)', borderRadius: '8px', fontSize: '0.9rem', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <div><strong>Service:</strong> {paymentLedger.service_name} ({paymentLedger.vehicle_number})</div>
                  <div><strong>Request No:</strong> {paymentLedger.request_no}</div>
                  <div><strong>Total Outstanding Due:</strong> <span style={{ color: '#ef4444', fontWeight: 'bold' }}>₹{paymentLedger.due_amount}</span></div>
                </div>

                <div className="form-group-sm form-item">
                  <label>Amount to Pay (₹) *</label>
                  <input
                    type="number"
                    step="0.01"
                    min="1"
                    max={paymentLedger.due_amount}
                    value={paymentAmount}
                    onChange={(e) => setPaymentAmount(e.target.value)}
                    required
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn-secondary" onClick={() => setShowPayModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="submit-btn" style={{ width: 'auto', background: '#10b981', color: 'white' }} disabled={paymentProcessing}>
                  {paymentProcessing ? "Opening Secure Payment..." : "Proceed to Pay"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};

export default CustomerDashboard;