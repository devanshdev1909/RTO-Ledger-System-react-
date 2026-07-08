import React, { useState, useEffect } from 'react';
import api from '../services/api';
import { 
  Search, Plus, Edit2, Trash2, X, AlertTriangle, 
  Check, AlertCircle 
} from 'lucide-react';
import './ServicesList.css';
import './VehiclesList.css'; // Shared table structures
import { useAuth } from '../context/AuthContext';



const ServicesList = () => {
  const { hasPermission } = useAuth();
  const [services, setServices] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  // Modal Control
  const [showModal, setShowModal] = useState(false);
  const [modalMode, setModalMode] = useState('create');
  const [selectedServiceId, setSelectedServiceId] = useState(null);
  const [errorMsg, setErrorMsg] = useState(null);

  // Form States
  const [form, setForm] = useState({
    service_name: '',
    default_fee: '',
    description: ''
  });

  const loadServices = async () => {
    setLoading(true);
    try {
      const response = await api.get('/api/services');
      if (response.data.success) {
        setServices(response.data.services);
      }
    } catch (err) {
      console.error('Failed to load services:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadServices();
  }, []);

  const handleOpenCreate = () => {
    setForm({ service_name: '', default_fee: '', description: '' });
    setModalMode('create');
    setErrorMsg(null);
    setShowModal(true);
  };

  const handleOpenEdit = (service) => {
    setForm({
      service_name: service.service_name,
      default_fee: service.default_fee.toString(),
      description: service.description || ''
    });
    setSelectedServiceId(service.id);
    setModalMode('edit');
    setErrorMsg(null);
    setShowModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg(null);

    const cleanServiceName = form.service_name.trim();
    const fee = parseFloat(form.default_fee);

    if (cleanServiceName.length < 3) {
      setErrorMsg("Service Name must be at least 3 characters long.");
      return;
    }

    if (isNaN(fee) || fee <= 0) {
      setErrorMsg("Base Fee must be a positive number greater than 0.");
      return;
    }

    try {
      const payload = {
        ...form,
        service_name: cleanServiceName
      };

      if (modalMode === 'create') {
        const response = await api.post('/api/services', payload);
        if (response.data.success) {
          setShowModal(false);
          loadServices();
        }
      } else {
        const response = await api.put(`/api/services/${selectedServiceId}`, payload);
        if (response.data.success) {
          setShowModal(false);
          loadServices();
        }
      }
    } catch (err) {
      setErrorMsg(err.response?.data?.error || 'Operation failed. Verify input details.');
    }
  };

  const handleToggleStatus = async (id, currentStatus) => {
    try {
      const response = await api.patch(`/api/services/${id}/status`, {
        is_active: !currentStatus
      });
      if (response.data.success) {
        setServices(services.map(s => s.id === id ? { ...s, is_active: !currentStatus } : s));
      }
    } catch (err) {
      console.error('Failed to update service status:', err);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Permanently delete this service from catalog? This will fail if it's already used in active service requests!")) return;
    try {
      const response = await api.delete(`/api/services/${id}`);
      if (response.data.success) {
        loadServices();
      }
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to delete service.');
    }
  };

  // Filter services by search local state
  const filteredServices = services.filter(s => 
    s.service_name.toLowerCase().includes(search.toLowerCase()) ||
    (s.description && s.description.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div className="page-container">
      
      {/* Top controls */}
      <div className="page-actions">
        <div className="search-input-wrap">
          <Search className="search-icon-pos" size={18} />
          <input
            type="text"
            placeholder="Search service name or description..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        
        {hasPermission('service_catalog.create') && (
          <button type="button" className="quick-add-btn" onClick={handleOpenCreate}>
            <Plus size={18} />
            <span>Add Service</span>
          </button>
        )}
      </div>

      {/* Main Database Table */}
      <div className="table-card">
        {loading ? (
          <div style={{ padding: '40px', textAlignment: 'center' }}>
            <h2>Loading RTO Services Catalog...</h2>
          </div>
        ) : filteredServices.length === 0 ? (
          <div style={{ padding: '40px', textAlignment: 'center', color: 'var(--text-secondary)' }}>
            <AlertTriangle style={{ margin: '0 auto 10px' }} size={32} />
            <p>No services catalog records found.</p>
          </div>
        ) : (
          <table className="app-table">
            <thead>
              <tr>
                <th>Service Name</th>
                <th>Base Fee (₹)</th>
                <th>Description</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredServices.map((s) => (
                <tr key={s.id}>
                  <td style={{ fontWeight: 700 }}>{s.service_name}</td>
                  <td className="service-fee-text">₹{s.default_fee}</td>
                  <td className="service-desc-cell" title={s.description || ''}>
                    {s.description || '—'}
                  </td>
                  <td>
                    {hasPermission('service_catalog.edit') ? (
                      <span 
                        onClick={() => handleToggleStatus(s.id, s.is_active)}
                        className={`status-badge ${s.is_active ? 'active' : 'inactive'}`}
                        style={{ cursor: 'pointer' }}
                        title="Click to toggle status"
                      >
                        {s.is_active ? (
                          <>
                            <Check size={12} />
                            <span>Active</span>
                          </>
                        ) : (
                          <>
                            <AlertCircle size={12} />
                            <span>Inactive</span>
                          </>
                        )}
                      </span>
                    ) : (
                      <span 
                        className={`status-badge ${s.is_active ? 'active' : 'inactive'}`}
                        style={{ cursor: 'default' }}
                      >
                        {s.is_active ? (
                          <>
                            <Check size={12} />
                            <span>Active</span>
                          </>
                        ) : (
                          <>
                            <AlertCircle size={12} />
                            <span>Inactive</span>
                          </>
                        )}
                      </span>
                    )}
                  </td>
                  <td>
                    {hasPermission('service_catalog.edit') && (
                      <div className="action-buttons-cell">
                        <button type="button" className="btn-icon" onClick={() => handleOpenEdit(s)}>
                          <Edit2 size={15} />
                        </button>
                        <button type="button" className="btn-icon delete" onClick={() => handleDelete(s.id)}>
                          <Trash2 size={15} />
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* ==================== CREATE / EDIT MODAL ==================== */}
      {showModal && (
        <div className="modal-overlay">
          <div className="modal-card" style={{ maxWidth: '500px' }}>
            
            <div className="modal-header">
              <h2>{modalMode === 'create' ? 'Create RTO Service' : 'Edit Service Catalog Details'}</h2>
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

                <div className="form-group-sm form-item">
                  <label>Service Name *</label>
                  <input
                    type="text"
                    placeholder="e.g. NOC, Fitness Certificate, Re-registration"
                    value={form.service_name}
                    onChange={(e) => setForm({ ...form, service_name: e.target.value })}
                    required
                  />
                </div>

                <div className="form-group-sm form-item">
                  <label>Base Fee (₹) *</label>
                  <input
                    type="number"
                    placeholder="Enter standard charge"
                    value={form.default_fee}
                    onChange={(e) => setForm({ ...form, default_fee: e.target.value })}
                    required
                  />
                </div>

                <div className="form-group-sm form-item">
                  <label>Description</label>
                  <input
                    type="text"
                    placeholder="Explain service requirements or timeline details"
                    value={form.description}
                    onChange={(e) => setForm({ ...form, description: e.target.value })}
                  />
                </div>

              </div>

              <div className="modal-footer">
                <button type="button" className="btn-secondary" onClick={() => setShowModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="submit-btn" style={{ width: 'auto', background: '#3b82f6', color: 'white' }}>
                  {modalMode === 'create' ? 'Create Service' : 'Save Changes'}
                </button>
              </div>
            </form>

          </div>
        </div>
      )}

    </div>
  );
};

export default ServicesList;