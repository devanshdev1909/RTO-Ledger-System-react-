import React, { useState, useEffect } from 'react';
import api from '../services/api';
import { 
  Search, Printer, X, AlertTriangle, FileText, Calendar 
} from 'lucide-react';
import './ReceiptsList.css';
import './VehiclesList.css'; // Inherits shared table and pagination styles
import { useAuth } from '../context/AuthContext';

interface Receipt {
  id: number;
  receipt_no: string;
  ledger_id: number;
  amount_received: number;
  payment_mode: string;
  transaction_reference: string | null;
  cashier_name: string;
  customer_name: string;
  customer_code: string;
  customer_mobile: string;
  customer_address: string | null;
  vehicle_number: string;
  vehicle_type: string;
  request_no: string;
  service_name: string;
  remarks: string | null;
  received_at: string;
}

const ReceiptsList: React.FC = () => {
  const { hasPermission } = useAuth();
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalRecords, setTotalRecords] = useState(0);
  const [loading, setLoading] = useState(true);

  // Modal Control
  const [showModal, setShowModal] = useState(false);
  const [selectedReceipt, setSelectedReceipt] = useState<Receipt | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  const loadReceipts = async () => {
    setLoading(true);
    try {
      const response = await api.get('/api/receipts', {
        params: { q: search, page, limit: 10 }
      });
      if (response.data.success) {
        setReceipts(response.data.receipts);
        setTotalPages(response.data.pagination.totalPages);
        setTotalRecords(response.data.pagination.totalRecords);
      }
    } catch (err) {
      console.error('Failed to load receipts:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadReceipts();
  }, [search, page]);

  const handlePrintOpen = async (id: number) => {
    setLoadingDetail(true);
    try {
      const response = await api.get(`/api/receipts/${id}`);
      if (response.data.success) {
        setSelectedReceipt(response.data.receipt);
        setShowModal(true);
      }
    } catch (err) {
      console.error('Failed to load receipt details:', err);
    } finally {
      setLoadingDetail(false);
    }
  };

  const triggerPrint = () => {
    window.print();
  };

  return (
    <div className="page-container">
      
      {/* Top filter actions */}
      <div className="page-actions">
        <div className="search-input-wrap">
          <Search className="search-icon-pos" size={18} />
          <input
            type="text"
            placeholder="Search by receipt number, owner, plate..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          />
        </div>
      </div>

      {/* Main Database Table */}
      <div className="table-card">
        {loading ? (
          <div style={{ padding: '40px', textAlignment: 'center' } as React.CSSProperties}>
            <h2>Loading Payment Log...</h2>
          </div>
        ) : receipts.length === 0 ? (
          <div style={{ padding: '40px', textAlignment: 'center', color: 'var(--text-secondary)' } as React.CSSProperties}>
            <AlertTriangle style={{ margin: '0 auto 10px' }} size={32} />
            <p>No payment receipts logged in database.</p>
          </div>
        ) : (
          <>
            <table className="app-table">
              <thead>
                <tr>
                  <th>Receipt No</th>
                  <th>Job Request No</th>
                  <th>Customer Owner</th>
                  <th>Vehicle Number</th>
                  <th>Amount Received</th>
                  <th>Mode</th>
                  <th>Cashier</th>
                  <th>Date</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {receipts.map((r) => (
                  <tr key={r.id}>
                    <td style={{ fontWeight: 700 }}>{r.receipt_no}</td>
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
                    <td className="receipt-amount-text">₹{r.amount_received}</td>
                    <td>
                      <span className="payment-mode-badge">{r.payment_mode}</span>
                    </td>
                    <td style={{ fontWeight: 600 }}>{r.cashier_name}</td>
                    <td>
                      <div className="driver-info-cell">
                        <span>{new Date(r.received_at).toLocaleDateString()}</span>
                        <span className="mobile">{new Date(r.received_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                      </div>
                    </td>
                    <td>
                      {hasPermission('receipt.print') && (
                        <button 
                          type="button" 
                          className="btn-icon"
                          title="Print Receipt Slip"
                          onClick={() => handlePrintOpen(r.id)}
                        >
                          <Printer size={15} />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Pagination Controls */}
            <div className="pagination-row">
              <div className="pagination-info">
                Showing {((page - 1) * 10) + 1} to {Math.min(page * 10, totalRecords)} of {totalRecords} receipts
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

      {/* ==================== PRINT INVOICE SLIP MODAL ==================== */}
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
              
              {/* Receipt invoice wrapper box */}
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
                  <span>{selectedReceipt.customer_name} ({selectedReceipt.customer_code})</span>
                </div>
                <div className="invoice-meta-row">
                  <span className="invoice-meta-label">Customer Mobile:</span>
                  <span>{selectedReceipt.customer_mobile}</span>
                </div>
                <div className="invoice-meta-row">
                  <span className="invoice-meta-label">Address:</span>
                  <span style={{ fontSize: '0.8rem' }}>{selectedReceipt.customer_address || '—'}</span>
                </div>

                <div className="invoice-separator"></div>

                <div className="invoice-meta-row">
                  <span className="invoice-meta-label">Vehicle Plate:</span>
                  <span>{selectedReceipt.vehicle_number}</span>
                </div>
                <div className="invoice-meta-row">
                  <span className="invoice-meta-label">Vehicle Type:</span>
                  <span>{selectedReceipt.vehicle_type}</span>
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
                  <p>Cashier Collector: {selectedReceipt.cashier_name}</p>
                  <p style={{ marginTop: '10px', fontSize: '0.75rem', borderTop: '1px dashed #94a3b8', paddingTop: '8px' }}>
                    Thank you for your business!
                  </p>
                </div>
              </div>

            </div>

            <div className="modal-footer">
              <button type="button" className="btn-secondary" onClick={() => setShowModal(false)}>
                Close Preview
              </button>
              <button 
                type="button" 
                className="submit-btn" 
                style={{ width: 'auto', background: '#3b82f6', color: 'white' }}
                onClick={triggerPrint}
              >
                <Printer size={15} style={{ marginRight: '6px' }} />
                <span>Print Document</span>
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default ReceiptsList;