import React, { useState, useEffect } from 'react';
import api from '../services/api';
import { 
  Search, Plus, Edit2, Trash2, X, AlertTriangle, 
} from 'lucide-react';
import { formatVehicleNumber, formatChassisOrEngine } from '../utils/formatters';
import './VehiclesList.css';
import './CustomersList.css'; // Shared table structures
import { useAuth } from '../context/AuthContext';

interface Vehicle {
  id: number;
  customer_id: number;
  customer_name: string;
  customer_code: string;
  vehicle_number: string;
  vehicle_type: string;
  chassis_number: string | null;
  engine_number: string | null;
  registration_date: string | null;
  driver_name: string | null;
  driver_mobile: string | null;
  is_active: boolean;
}

interface CustomerDropdownItem {
  id: number;
  name: string;
  customer_code: string;
}

const VehiclesList: React.FC = () => {
  const { user, hasPermission } = useAuth();
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [customers, setCustomers] = useState<CustomerDropdownItem[]>([]);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalVehicles, setTotalVehicles] = useState(0);
  const [loading, setLoading] = useState(true);

  // Modal Control States
  const [showModal, setShowModal] = useState(false);
  const [modalMode, setModalMode] = useState<'create' | 'edit'>('create');
  const [selectedVehicleId, setSelectedVehicleId] = useState<number | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const canEditVehicle = () => {
    if (user?.role === 'Admin') return true;
    if (hasPermission('vehicle.edit')) return true;
    // Agent allotment bypass: allowed if the user is an Agent (backend filters list automatically)
    if (user?.role === 'Agent') return true;
    return false;
  };

  // Form States
  const [form, setForm] = useState({
    customer_id: '',
    vehicle_number: '',
    vehicle_type: '2 Wheeler',
    chassis_number: '',
    engine_number: '',
    registration_date: '',
    driver_name: '',
    driver_mobile: ''
  });

  // Fetch Vehicles
  const loadVehicles = async () => {
    setLoading(true);
    try {
      const response = await api.get('/api/vehicles', {
        params: { q: search, page, limit: 10 }
      });
      if (response.data.success) {
        setVehicles(response.data.vehicles);
        setTotalPages(response.data.pagination.totalPages);
        setTotalVehicles(response.data.pagination.totalVehicles);
      }
    } catch (err) {
      console.error('Error fetching vehicles database:', err);
    } finally {
      setLoading(false);
    }
  };

  // Fetch customer dropdown list (called once on modal load)
  const loadCustomerDropdown = async () => {
    try {
      const response = await api.get('/api/customers/dropdown');
      if (response.data.success) {
        setCustomers(response.data.customers);
      }
    } catch (err) {
      console.error('Failed to load customers for selector dropdown:', err);
    }
  };

  useEffect(() => {
    loadVehicles();// eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, page]);

  useEffect(() => {
    loadCustomerDropdown();
  }, []);

  const handleOpenCreate = () => {
    setForm({
      customer_id: '',
      vehicle_number: '',
      vehicle_type: '2 Wheeler',
      chassis_number: '',
      engine_number: '',
      registration_date: '',
      driver_name: '',
      driver_mobile: ''
    });
    setModalMode('create');
    setErrorMsg(null);
    setShowModal(true);
  };

  const handleOpenEdit = (vehicle: Vehicle) => {
    setForm({
      customer_id: vehicle.customer_id.toString(),
      vehicle_number: vehicle.vehicle_number,
      vehicle_type: vehicle.vehicle_type,
      chassis_number: vehicle.chassis_number || '',
      engine_number: vehicle.engine_number || '',
      registration_date: vehicle.registration_date ? vehicle.registration_date.split('T')[0] : '',
      driver_name: vehicle.driver_name || '',
      driver_mobile: vehicle.driver_mobile || ''
    });
    setSelectedVehicleId(vehicle.id);
    setModalMode('edit');
    setErrorMsg(null);
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    const cleanVehicleNumber = form.vehicle_number.toUpperCase().trim().replace(/[^A-Z0-9-]/g, '');
    if (cleanVehicleNumber.length < 5) {
      setErrorMsg("Vehicle Number must be at least 5 characters long.");
      return;
    }

    const cleanDriverMobile = form.driver_mobile.replace(/\D/g, '');
    if (cleanDriverMobile && !/^[6-9]\d{9}$/.test(cleanDriverMobile)) {
      setErrorMsg("Driver Mobile must be a valid 10-digit number starting with 6, 7, 8, or 9.");
      return;
    }

    try {
      const payload = {
        ...form,
        vehicle_number: cleanVehicleNumber,
        driver_mobile: cleanDriverMobile || null
      };

      if (modalMode === 'create') {
        const response = await api.post('/api/vehicles', payload);
        if (response.data.success) {
          setShowModal(false);
          loadVehicles();
        }
      } else {
        const response = await api.put(`/api/vehicles/${selectedVehicleId}`, payload);
        if (response.data.success) {
          setShowModal(false);
          loadVehicles();
        }
      }
    } catch (err: any) {
      setErrorMsg(err.response?.data?.error || 'Operation failed. Please verify inputs.');
    }
  };

  const handleToggleStatus = async (id: number, currentStatus: boolean) => {
    try {
      const response = await api.patch(`/api/vehicles/${id}/status`, {
        is_active: !currentStatus
      });
      if (response.data.success) {
        setVehicles(vehicles.map(v => v.id === id ? { ...v, is_active: !currentStatus } : v));
      }
    } catch (err) {
      console.error('Failed to update status:', err);
    }
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm("Permanently delete this vehicle record?")) return;
    try {
      const response = await api.delete(`/api/vehicles/${id}`);
      if (response.data.success) {
        loadVehicles();
      }
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to delete vehicle record.');
    }
  };

  return (
    <div className="page-container">
      
      {/* Top action row */}
      <div className="page-actions">
        <div className="search-input-wrap">
          <Search className="search-icon-pos" size={18} />
          <input
            type="text"
            placeholder="Search MH-12, owner name, chassis..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          />
        </div>
        
        {hasPermission('vehicle.create') && (
          <button type="button" className="quick-add-btn" onClick={handleOpenCreate}>
            <Plus size={18} />
            <span>Add Vehicle</span>
          </button>
        )}
      </div>

      {/* Main Database Table */}
      <div className="table-card">
        {loading ? (
          <div style={{ padding: '40px', textAlignment: 'center' } as React.CSSProperties}>
            <h2>Loading Vehicles Database...</h2>
          </div>
        ) : vehicles.length === 0 ? (
          <div style={{ padding: '40px', textAlignment: 'center', color: 'var(--text-secondary)' } as React.CSSProperties}>
            <AlertTriangle style={{ margin: '0 auto 10px' }} size={32} />
            <p>No vehicles found matching search filters.</p>
          </div>
        ) : (
          <>
            <table className="app-table">
              <thead>
                <tr>
                  <th>Vehicle No</th>
                  <th>Type</th>
                  <th>Customer Owner</th>
                  <th>Chassis / Engine No</th>
                  <th>Driver Details</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {vehicles.map((v) => (
                  <tr key={v.id}>
                    <td style={{ fontWeight: 700 }}>
                      <span className="vehicle-badge">{v.vehicle_number}</span>
                    </td>
                    <td>{v.vehicle_type}</td>
                    <td>
                      <div className="driver-info-cell">
                        <span className="name">{v.customer_name}</span>
                        <span className="mobile">{v.customer_code}</span>
                      </div>
                    </td>
                    <td>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <div><span className="technical-codes" title="Chassis Number">C: {v.chassis_number || '—'}</span></div>
                        <div><span className="technical-codes" title="Engine Number">E: {v.engine_number || '—'}</span></div>
                      </div>
                    </td>
                    <td>
                      {v.driver_name ? (
                        <div className="driver-info-cell">
                          <span className="name">{v.driver_name}</span>
                          <span className="mobile">{v.driver_mobile || '—'}</span>
                        </div>
                      ) : (
                        <span style={{ color: 'var(--text-secondary)' }}>—</span>
                      )}
                    </td>
                    <td>
                      {canEditVehicle() ? (
                        <span 
                          onClick={() => handleToggleStatus(v.id, v.is_active)}
                          className={`status-badge ${v.is_active ? 'active' : 'inactive'}`}
                          style={{ cursor: 'pointer' }}
                        >
                          {v.is_active ? 'Active' : 'Inactive'}
                        </span>
                      ) : (
                        <span 
                          className={`status-badge ${v.is_active ? 'active' : 'inactive'}`}
                          style={{ cursor: 'default' }}
                        >
                          {v.is_active ? 'Active' : 'Inactive'}
                        </span>
                      )}
                    </td>
                    <td>
                      {canEditVehicle() && (
                        <div className="action-buttons-cell">
                          <button type="button" className="btn-icon" onClick={() => handleOpenEdit(v)}>
                            <Edit2 size={15} />
                          </button>
                          <button type="button" className="btn-icon delete" onClick={() => handleDelete(v.id)}>
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
                Showing {((page - 1) * 10) + 1} to {Math.min(page * 10, totalVehicles)} of {totalVehicles} vehicles
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

      {/* ==================== CREATE / EDIT MODAL ==================== */}
      {showModal && (
        <div className="modal-overlay">
          <div className="modal-card" style={{ maxWidth: '600px' }}>
            
            <div className="modal-header">
              <h2>{modalMode === 'create' ? 'Register New Vehicle' : 'Edit Vehicle Details'}</h2>
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

                {/* Customer Selector Dropdown */}
                <div className="form-group-sm form-item">
                  <label>Assign to Customer Owner *</label>
                  <select
                    value={form.customer_id}
                    onChange={(e) => setForm({ ...form, customer_id: e.target.value })}
                    required
                    disabled={modalMode === 'edit'} // Don't allow changing owner on edit to prevent ledger desync
                  >
                    <option value="">-- Choose Customer Owner --</option>
                    {customers.map(c => (
                      <option key={c.id} value={c.id}>{c.name} ({c.customer_code})</option>
                    ))}
                  </select>
                </div>

                <div className="form-row">
                  <div className="form-group-sm form-item">
                    <label>Vehicle Number *</label>
                    <input
                      type="text"
                      placeholder="e.g. MH-12-AB-1234"
                      value={form.vehicle_number}
                      onChange={(e) => setForm({ ...form, vehicle_number: formatVehicleNumber(e.target.value) })}
                      required
                    />
                  </div>
                  <div className="form-group-sm form-item">
                    <label>Vehicle Type *</label>
                    <select
                      value={form.vehicle_type}
                      onChange={(e) => setForm({ ...form, vehicle_type: e.target.value })}
                      required
                    >
                      <option>2 Wheeler</option>
                      <option>4 Wheeler</option>
                      <option>Commercial LMV</option>
                      <option>HGV (Heavy Cargo)</option>
                    </select>
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group-sm form-item">
                    <label>Chassis Number</label>
                    <input
                      type="text"
                      placeholder="Enter chassis code"
                      value={form.chassis_number}
                      onChange={(e) => setForm({ ...form, chassis_number: formatChassisOrEngine(e.target.value) })}
                    />
                  </div>
                  <div className="form-group-sm form-item">
                    <label>Engine Number</label>
                    <input
                      type="text"
                      placeholder="Enter engine code"
                      value={form.engine_number}
                      onChange={(e) => setForm({ ...form, engine_number: formatChassisOrEngine(e.target.value) })}
                    />
                  </div>
                </div>

                <div className="form-group-sm form-item">
                  <label>Registration Date</label>
                  <input
                    type="date"
                    value={form.registration_date}
                    onChange={(e) => setForm({ ...form, registration_date: e.target.value })}
                  />
                </div>

                <div className="form-row" style={{ marginTop: '10px', borderTop: '1px dashed var(--border-color)', paddingTop: '15px' }}>
                  <div className="form-group-sm form-item">
                    <label>Driver Name</label>
                    <input
                      type="text"
                      placeholder="Enter driver name"
                      value={form.driver_name}
                      onChange={(e) => setForm({ ...form, driver_name: e.target.value })}
                    />
                  </div>
                  <div className="form-group-sm form-item">
                    <label>Driver Mobile</label>
                    <input
                      type="tel"
                      maxLength={10}
                      placeholder="Enter driver mobile"
                      value={form.driver_mobile}
                      onChange={(e) => setForm({ ...form, driver_mobile: e.target.value.replace(/\D/g, '').slice(0, 10) })}
                    />
                  </div>
                </div>

              </div>

              <div className="modal-footer">
                <button type="button" className="btn-secondary" onClick={() => setShowModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="submit-btn" style={{ width: 'auto', background: '#3b82f6', color: 'white' }}>
                  {modalMode === 'create' ? 'Register Vehicle' : 'Save Changes'}
                </button>
              </div>
            </form>

          </div>
        </div>
      )}

    </div>
  );
};

export default VehiclesList;