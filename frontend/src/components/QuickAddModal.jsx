import React, { useState, useEffect } from 'react';
import api from '../services/api';
import { X, Trash2, PlusCircle } from 'lucide-react';
import { formatVehicleNumber, formatChassisOrEngine } from '../utils/formatters';
import '../pages/Dashboard.css'; // Reuse CSS rules for Quick Add

const QuickAddModal = ({ isOpen, onClose }) => {
  const [servicesList, setServicesList] = useState([]);
  const [quickAddError, setQuickAddError] = useState(null);
  const [quickAddLoading, setQuickAddLoading] = useState(false);
  const [quickAddSuccess, setQuickAddSuccess] = useState(false);
  const [receiptIds, setReceiptIds] = useState([]);

  // Form Data States
  const [customerForm, setCustomerForm] = useState({ name: '', mobile: '', email: '', address: '' });
  const [vehiclesForm, setVehiclesForm] = useState([{ index: 0, vehicle_number: '', vehicle_type: '2 Wheeler', chassis_number: '', engine_number: '', registration_date: '' }]);
  const [servicesForm, setServicesForm] = useState([{ vehicle_index: 0, service_id: '', service_fee: '', paid_amount: '', payment_mode: 'Cash' }]);

  // Load services catalog list on open
  useEffect(() => {
    if (!isOpen) return;

    const loadServices = async () => {
      try {
        const response = await api.get('/api/services');
        if (response.data.success) {
          setServicesList(response.data.services);
        }
      } catch (err) {
        console.error('Failed to load services list in Quick Add:', err);
      }
    };
    loadServices();
  }, [isOpen]);

  const handleAddVehicleField = () => {
    const nextIndex = vehiclesForm.length;
    setVehiclesForm([...vehiclesForm, { index: nextIndex, vehicle_number: '', vehicle_type: '2 Wheeler', chassis_number: '', engine_number: '', registration_date: '' }]);
  };

  const handleRemoveVehicleField = (index) => {
    if (vehiclesForm.length === 1) return;
    const updated = vehiclesForm.filter((_, i) => i !== index).map((v, i) => ({ ...v, index: i }));
    setVehiclesForm(updated);
    
    // Reset service bindings that pointed to deleted vehicle index
    const updatedServices = servicesForm.map(s => {
      if (s.vehicle_index >= updated.length) {
        return { ...s, vehicle_index: 0 };
      }
      return s;
    });
    setServicesForm(updatedServices);
  };

  const handleServiceChange = (index, field, value) => {
    const updated = [...servicesForm];
    updated[index][field] = value;

    // Autofill default fee when service is selected
    if (field === 'service_id' && value !== '') {
      const selected = servicesList.find(s => s.id === parseInt(value, 10));
      if (selected) {
        updated[index].service_fee = selected.default_fee.toString();
        updated[index].paid_amount = selected.default_fee.toString(); // Default to fully paid
      }
    }
    setServicesForm(updated);
  };

  const handleAddServiceField = () => {
    setServicesForm([...servicesForm, { vehicle_index: 0, service_id: '', service_fee: '', paid_amount: '', payment_mode: 'Cash' }]);
  };

  const handleRemoveServiceField = (index) => {
    if (servicesForm.length === 1) return;
    setServicesForm(servicesForm.filter((_, i) => i !== index));
  };

  const handleQuickAddSubmit = async (e) => {
    e.preventDefault();
    setQuickAddError(null);
    setQuickAddLoading(true);

    // Clean inputs
    const cleanMobile = customerForm.mobile.replace(/\D/g, '');
    const cleanEmail = customerForm.email.trim().toLowerCase();

    // Validate Customer
    const mobileRegex = /^[6-9]\d{9}$/;
    if (!mobileRegex.test(cleanMobile)) {
      setQuickAddError("Customer Mobile must be a valid 10-digit Indian number starting with 6-9.");
      setQuickAddLoading(false);
      return;
    }
    if (cleanEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      setQuickAddError("Please enter a valid customer email address.");
      setQuickAddLoading(false);
      return;
    }

    // Validate Vehicles
    const cleanVehicles = [];
    for (let i = 0; i < vehiclesForm.length; i++) {
      const v = vehiclesForm[i];
      const cleanPlate = v.vehicle_number.toUpperCase().trim().replace(/[^A-Z0-9-]/g, '');
      if (cleanPlate.length < 5) {
        setQuickAddError(`Vehicle #${i + 1} plate number must be at least 5 characters.`);
        setQuickAddLoading(false);
        return;
      }
      cleanVehicles.push({
        ...v,
        vehicle_number: cleanPlate,
        chassis_number: v.chassis_number.toUpperCase().trim().replace(/[^A-Z0-9]/g, ''),
        engine_number: v.engine_number.toUpperCase().trim().replace(/[^A-Z0-9]/g, '')
      });
    }

    // Validate Services
    for (let i = 0; i < servicesForm.length; i++) {
      const s = servicesForm[i];
      if (!s.service_id) {
        setQuickAddError(`Please select a service for Service #${i + 1}.`);
        setQuickAddLoading(false);
        return;
      }
      const fee = parseFloat(s.service_fee);
      const paid = parseFloat(s.paid_amount || '0');
      if (isNaN(fee) || fee <= 0) {
        setQuickAddError(`Service #${i + 1} fee must be a positive number.`);
        setQuickAddLoading(false);
        return;
      }
      if (isNaN(paid) || paid < 0) {
        setQuickAddError(`Service #${i + 1} paid amount cannot be negative.`);
        setQuickAddLoading(false);
        return;
      }
      if (paid > fee) {
        setQuickAddError(`Service #${i + 1} paid amount cannot exceed the service fee.`);
        setQuickAddLoading(false);
        return;
      }
    }
    
    try {
      const payload = {
        customer: {
          ...customerForm,
          mobile: cleanMobile,
          email: cleanEmail || null
        },
        vehicles: cleanVehicles,
        services: servicesForm
      };
      
      const response = await api.post('/api/dashboard/quick-add', payload);
      if (response.data.success) {
        setReceiptIds(response.data.receipts || []);
        setQuickAddSuccess(true);
        // Dispatch global success event so active pages refresh data
        window.dispatchEvent(new CustomEvent('quick-add-success'));
      }
    } catch (err) {
      setQuickAddError(err.response?.data?.error || 'Failed to submit Quick Add registration.');
    } finally {
      setQuickAddLoading(false);
    }
  };

  const resetQuickAddForm = () => {
    setCustomerForm({ name: '', mobile: '', email: '', address: '' });
    setVehiclesForm([{ index: 0, vehicle_number: '', vehicle_type: '2 Wheeler', chassis_number: '', engine_number: '', registration_date: '' }]);
    setServicesForm([{ vehicle_index: 0, service_id: '', service_fee: '', paid_amount: '', payment_mode: 'Cash' }]);
    setQuickAddSuccess(false);
    setReceiptIds([]);
    setQuickAddError(null);
  };

  const handleClose = () => {
    resetQuickAddForm();
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" style={{ zIndex: 1000 }}>
      <div className="modal-card">
        
        <div className="modal-header">
          <h2>Quick Add</h2>
          <button type="button" className="close-btn" onClick={handleClose}>
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleQuickAddSubmit} style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
          <div className="modal-body" style={{ maxHeight: '60vh', overflowY: 'auto', paddingRight: '10px' }}>
            
            {quickAddError && (
              <div className="error-banner" style={{ borderRadius: '8px', marginBottom: '15px' }}>
                {quickAddError}
              </div>
            )}

            {!quickAddSuccess ? (
              <>
                {/* 👤 STAGE 1 DETAILS */}
                <div className="form-section-title">1. Customer Information</div>
                <div className="nested-list-item">
                  <div className="form-row">
                    <div className="form-item">
                      <label>Full Name *</label>
                      <input
                        type="text"
                        placeholder="Enter customer name"
                        value={customerForm.name}
                        onChange={(e) => setCustomerForm({ ...customerForm, name: e.target.value })}
                        required
                      />
                    </div>
                    <div className="form-item">
                      <label>Mobile Number *</label>
                      <input
                        type="tel"
                        maxLength={10}
                        placeholder="Enter 10-digit mobile"
                        value={customerForm.mobile}
                        onChange={(e) => setCustomerForm({ ...customerForm, mobile: e.target.value.replace(/\D/g, '').slice(0, 10) })}
                        required
                      />
                    </div>
                  </div>
                  <div className="form-row">
                    <div className="form-item">
                      <label>Email Address</label>
                      <input
                        type="email"
                        placeholder="Enter email address"
                        value={customerForm.email}
                        onChange={(e) => setCustomerForm({ ...customerForm, email: e.target.value.toLowerCase().replace(/\s/g, '') })}
                      />
                    </div>
                    <div className="form-item">
                      <label>Home Address</label>
                      <input
                        type="text"
                        placeholder="Enter billing address"
                        value={customerForm.address}
                        onChange={(e) => setCustomerForm({ ...customerForm, address: e.target.value })}
                      />
                    </div>
                  </div>
                </div>

                {/* 🚗 STAGE 2: DYNAMIC VEHICLES LIST */}
                <div className="form-section-title">2. Registered Vehicles</div>
                {vehiclesForm.map((v, idx) => (
                  <div key={v.index} className="nested-list-item">
                    <div className="nested-item-header">
                      <span>Vehicle #{idx + 1}</span>
                      {vehiclesForm.length > 1 && (
                        <button type="button" className="delete-item-btn" onClick={() => handleRemoveVehicleField(idx)}>
                          <Trash2 size={16} />
                        </button>
                      )}
                    </div>
                    <div className="form-row">
                      <div className="form-item">
                        <label>Vehicle Number *</label>
                        <input
                          type="text"
                          placeholder="e.g. MH-12-AB-1234"
                          value={v.vehicle_number}
                          onChange={(e) => {
                            const updated = [...vehiclesForm];
                            updated[idx].vehicle_number = formatVehicleNumber(e.target.value);
                            setVehiclesForm(updated);
                          }}
                          required
                        />
                      </div>
                      <div className="form-item">
                        <label>Vehicle Type</label>
                        <select
                          value={v.vehicle_type}
                          onChange={(e) => {
                            const updated = [...vehiclesForm];
                            updated[idx].vehicle_type = e.target.value;
                            setVehiclesForm(updated);
                          }}
                        >
                          <option>2 Wheeler</option>
                          <option>4 Wheeler</option>
                          <option>Commercial LMV</option>
                          <option>HGV (Heavy Cargo)</option>
                        </select>
                      </div>
                    </div>
                    <div className="form-row">
                      <div className="form-item">
                        <label>Chassis Number</label>
                        <input
                          type="text"
                          placeholder="Enter chassis code"
                          value={v.chassis_number}
                          onChange={(e) => {
                            const updated = [...vehiclesForm];
                            updated[idx].chassis_number = formatChassisOrEngine(e.target.value);
                            setVehiclesForm(updated);
                          }}
                        />
                      </div>
                      <div className="form-item">
                        <label>Engine Number</label>
                        <input
                          type="text"
                          placeholder="Enter engine code"
                          value={v.engine_number}
                          onChange={(e) => {
                            const updated = [...vehiclesForm];
                            updated[idx].engine_number = formatChassisOrEngine(e.target.value);
                            setVehiclesForm(updated);
                          }}
                        />
                      </div>
                    </div>
                  </div>
                ))}
                <button type="button" className="add-list-item-btn" onClick={handleAddVehicleField}>
                  <PlusCircle size={16} />
                  <span>Register Another Vehicle</span>
                </button>

                {/* 🛠️ STAGE 3: DYNAMIC RTO SERVICES SELECTION */}
                <div className="form-section-title">3. Services & Payments</div>
                {servicesForm.map((s, idx) => (
                  <div key={idx} className="nested-list-item">
                    <div className="nested-item-header">
                      <span>Service #{idx + 1}</span>
                      {servicesForm.length > 1 && (
                        <button type="button" className="delete-item-btn" onClick={() => handleRemoveServiceField(idx)}>
                          <Trash2 size={16} />
                        </button>
                      )}
                    </div>
                    <div className="form-row">
                      <div className="form-item">
                        <label>Apply to Vehicle *</label>
                        <select
                          value={s.vehicle_index}
                          onChange={(e) => handleServiceChange(idx, 'vehicle_index', parseInt(e.target.value, 10))}
                        >
                          {vehiclesForm.map((v, vIdx) => (
                            <option key={v.index} value={v.index}>
                              Vehicle #{vIdx + 1} ({v.vehicle_number || 'New'})
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="form-item">
                        <label>Select Service *</label>
                        <select
                          value={s.service_id}
                          onChange={(e) => handleServiceChange(idx, 'service_id', e.target.value)}
                          required
                        >
                          <option value="">-- Choose RTO Service --</option>
                          {servicesList.map(item => (
                            <option key={item.id} value={item.id}>{item.service_name}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                    <div className="form-row">
                      <div className="form-item">
                        <label>Service Fee (₹) *</label>
                        <input
                          type="number"
                          placeholder="Total fee"
                          value={s.service_fee}
                          onChange={(e) => handleServiceChange(idx, 'service_fee', e.target.value)}
                          required
                        />
                      </div>
                      <div className="form-item">
                        <label>Paid Amount (₹)</label>
                        <input
                          type="number"
                          placeholder="Advance paid"
                          value={s.paid_amount}
                          onChange={(e) => handleServiceChange(idx, 'paid_amount', e.target.value)}
                        />
                      </div>
                      <div className="form-item">
                        <label>Payment Mode</label>
                        <select
                          value={s.payment_mode}
                          onChange={(e) => handleServiceChange(idx, 'payment_mode', e.target.value)}
                        >
                          <option>Cash</option>
                          <option>UPI</option>
                          <option>Bank Transfer</option>
                          <option>Card</option>
                        </select>
                      </div>
                    </div>
                  </div>
                ))}
                <button type="button" className="add-list-item-btn" onClick={handleAddServiceField}>
                  <PlusCircle size={16} />
                  <span>Request Another Service</span>
                </button>
              </>
            ) : (
              // 🎉 SUCCESS SCREEN
              <div className="quick-add-success">
                <div className="success-icon">✓</div>
                <h3>Quick Registration Successful!</h3>
                <p style={{ marginTop: '5px', color: 'var(--text-secondary)' }}>
                  All details saved and welcome emails triggered.
                </p>
                
                <div className="success-receipts-list">
                  <span>Available Receipts to Print:</span>
                  {receiptIds.map((id, index) => (
                    <a 
                      key={id} 
                      href={`/receipts/${id}`}
                      target="_blank" 
                      rel="noopener noreferrer"
                    >
                      Print Receipt #{index + 1}
                    </a>
                  ))}
                </div>
                
                <button 
                  type="button" 
                  className="submit-btn" 
                  style={{ marginTop: '20px' }}
                  onClick={resetQuickAddForm}
                >
                  Register New Customer
                </button>
              </div>
            )}

          </div>

          <div className="modal-footer">
            <button type="button" className="btn-secondary" onClick={handleClose}>
              Close
            </button>
            {!quickAddSuccess && (
              <button type="submit" className="submit-btn" style={{ width: 'auto', background: '#3b82f6', color: 'white' }} disabled={quickAddLoading}>
                {quickAddLoading ? "Processing Transaction..." : "Save & Register Customer"}
              </button>
            )}
          </div>
        </form>

      </div>
    </div>
  );
};

export default QuickAddModal;
