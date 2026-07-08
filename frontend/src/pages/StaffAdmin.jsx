import React, { useState, useEffect } from 'react';
import api from '../services/api';
import { 
  Users, Key, Shield, Check, UserMinus, UserPlus, Plus, X 
} from 'lucide-react';
import './StaffAdmin.css';
import './LedgerList.css'; // Inherits button design systems
import '../components/Layout.css'; // Inherits card overlays and standard layout frames











const StaffAdmin = () => {
  const [activeTab, setActiveTab] = useState('allotments');
  const [loading, setLoading] = useState(true);

  // Core configurations datasets
  const [users, setUsers] = useState([]);
  const [roles, setRoles] = useState([]);
  const [permissions, setPermissions] = useState([]);
  const [agents, setAgents] = useState([]);
  const [unassignedCustomers, setUnassignedCustomers] = useState([]);

  // Selection references
  const [selectedUserId, setSelectedUserId] = useState(null);
  const [selectedRoleId, setSelectedRoleId] = useState(null);
  const [selectedAgentId, setSelectedAgentId] = useState(null);

  // Active checkboxes arrays
  const [userCheckedPerms, setUserCheckedPerms] = useState([]);
  const [roleCheckedPerms, setRoleCheckedPerms] = useState([]);

  const [message, setMessage] = useState(null);

  // Creation Modals Toggles
  const [showUserModal, setShowUserModal] = useState(false);
  const [showRoleModal, setShowRoleModal] = useState(false);
  const [prelockedRoleName, setPrelockedRoleName] = useState(null);
  const [modalError, setModalError] = useState(null);

  // Add User Form details
  const [userForm, setUserForm] = useState({
    username: '',
    email: '',
    password: '',
    role_id: ''
  });

  // Add Role Form details
  const [roleForm, setRoleForm] = useState({
    name: '',
    description: ''
  });

  const loadData = async (isSilent = false) => {
    if (!isSilent) setLoading(true);
    try {
      const [uRes, rRes, pRes, aRes, uaRes] = await Promise.all([
        api.get('/api/admin/users'),
        api.get('/api/admin/roles'),
        api.get('/api/admin/permissions'),
        api.get('/api/admin/agents/allotments'),
        api.get('/api/admin/unassigned-customers')
      ]);

      if (uRes.data.success) setUsers(uRes.data.users);
      if (rRes.data.success) setRoles(rRes.data.roles);
      if (pRes.data.success) setPermissions(pRes.data.permissions);
      if (aRes.data.success) {
        setAgents(aRes.data.agents);
        if (aRes.data.agents.length > 0 && !selectedAgentId) {
          setSelectedAgentId(aRes.data.agents[0].id);
        }
      }
      if (uaRes.data.success) setUnassignedCustomers(uaRes.data.customers);

      // Pre-select sidebar lists
      if (uRes.data.users.length > 0 && !selectedUserId) {
        handleUserSelect(uRes.data.users[0].id);
      }
      if (rRes.data.roles.length > 0 && !selectedRoleId) {
        handleRoleSelect(rRes.data.roles[0].id);
      }

    } catch (err) {
      console.error("Failed to load admin RBAC data:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [activeTab]);

  const handleUserSelect = async (userId) => {
    setSelectedUserId(userId);
    setMessage(null);
    try {
      const response = await api.get(`/api/admin/users/${userId}/permissions`);
      if (response.data.success) {
        setUserCheckedPerms(response.data.permissionIds);
      }
    } catch (err) {
      console.error("Failed to fetch user permissions:", err);
    }
  };

  const handleRoleSelect = async (roleId) => {
    setSelectedRoleId(roleId);
    setMessage(null);
    try {
      const response = await api.get(`/api/admin/roles/${roleId}/permissions`);
      if (response.data.success) {
        setRoleCheckedPerms(response.data.permissionIds);
      }
    } catch (err) {
      console.error("Failed to fetch role permissions:", err);
    }
  };

  const handleUserCheckboxChange = (permId) => {
    setUserCheckedPerms(prev => 
      prev.includes(permId) ? prev.filter(id => id !== permId) : [...prev, permId]
    );
  };

  const handleRoleCheckboxChange = (permId) => {
    setRoleCheckedPerms(prev => 
      prev.includes(permId) ? prev.filter(id => id !== permId) : [...prev, permId]
    );
  };

  const handleSaveUserPermissions = async () => {
    if (!selectedUserId) return;
    try {
      const response = await api.post(`/api/admin/users/${selectedUserId}/permissions`, {
        permissionIds: userCheckedPerms
      });
      if (response.data.success) {
        setMessage({ type: 'success', text: "Custom permissions overrides saved successfully!" });
      }
    } catch (err) {
      setMessage({ type: 'error', text: "Failed to save user permission overrides." });
    }
  };

  const handleSaveRolePermissions = async () => {
    if (!selectedRoleId) return;
    try {
      const response = await api.post(`/api/admin/roles/${selectedRoleId}/permissions`, {
        permissionIds: roleCheckedPerms
      });
      if (response.data.success) {
        setMessage({ type: 'success', text: "Role default permissions updated successfully!" });
      }
    } catch (err) {
      setMessage({ type: 'error', text: "Failed to update role default permissions." });
    }
  };

  const handleAllot = async (customerId) => {
    if (!selectedAgentId) return;
    try {
      const response = await api.post('/api/admin/agents/allot', {
        agent_id: selectedAgentId,
        customer_id: customerId
      });
      if (response.data.success) {
        loadData(true);
      }
    } catch (err) {
      alert(err.response?.data?.error || err.message || "Failed to allot customer.");
    }
  };

  const handleUnallot = async (customerId) => {
    try {
      const response = await api.post('/api/admin/agents/unallot', { customer_id: customerId });
      if (response.data.success) {
        loadData(true);
      }
    } catch (err) {
      alert(err.response?.data?.error || err.message || "Failed to unallot customer.");
    }
  };

  // Open creation modal
  const handleOpenAddUser = (prelockRole) => {
    setPrelockedRoleName(prelockRole || null);
    setModalError(null);
    
    let defaultRoleId = '';
    if (prelockRole) {
      const foundRole = roles.find(r => r.name.toLowerCase() === prelockRole.toLowerCase());
      if (foundRole) defaultRoleId = foundRole.id.toString();
    }

    setUserForm({ username: '', email: '', password: '', role_id: defaultRoleId });
    setShowUserModal(true);
  };

  const handleOpenAddRole = () => {
    setModalError(null);
    setRoleForm({ name: '', description: '' });
    setShowRoleModal(true);
  };

  // User/Agent account submit
  const handleUserSubmit = async (e) => {
    e.preventDefault();
    setModalError(null);

    const cleanUsername = userForm.username.trim();
    const cleanEmail = userForm.email.trim().toLowerCase();

    if (cleanUsername.length < 3) {
      setModalError("Username must be at least 3 characters long.");
      return;
    }

    if (cleanEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      setModalError("Please enter a valid email address.");
      return;
    }

    if (!userForm.password || userForm.password.length < 6) {
      setModalError("Password must be at least 6 characters long.");
      return;
    }

    if (!userForm.role_id) {
      setModalError("Please select a default role.");
      return;
    }

    try {
      const response = await api.post('/api/admin/users', {
        ...userForm,
        username: cleanUsername,
        email: cleanEmail
      });
      if (response.data.success) {
        setShowUserModal(false);
        loadData();
      }
    } catch (err) {
      setModalError(err.response?.data?.error || "Failed to create user account.");
    }
  };

  // Role profile submit
  const handleRoleSubmit = async (e) => {
    e.preventDefault();
    setModalError(null);

    const cleanRoleName = roleForm.name.trim();
    if (cleanRoleName.length < 3) {
      setModalError("Role Name must be at least 3 characters long.");
      return;
    }

    try {
      const response = await api.post('/api/admin/roles', {
        ...roleForm,
        name: cleanRoleName
      });
      if (response.data.success) {
        setShowRoleModal(false);
        loadData();
      }
    } catch (err) {
      setModalError(err.response?.data?.error || "Failed to create role profile.");
    }
  };

  const activeAgent = agents.find(a => a.id === selectedAgentId);

  return (
    <div className="page-container">
      
      {/* 🧭 NAVIGATION & SHORTCUT BUTTONS BAR */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '15px' }}>
        <div className="portal-tabs">
          <button 
            className={`portal-tab-btn ${activeTab === 'allotments' ? 'active' : ''}`} 
            onClick={() => { setActiveTab('allotments'); }}
          >
            <Users size={16} style={{ marginRight: '6px', verticalAlign: 'middle' }} />
            <span>Agent Allotments</span>
          </button>
          <button 
            className={`portal-tab-btn ${activeTab === 'users' ? 'active' : ''}`} 
            onClick={() => { setActiveTab('users'); }}
          >
            <Key size={16} style={{ marginRight: '6px', verticalAlign: 'middle' }} />
            <span>User Overrides</span>
          </button>
          <button 
            className={`portal-tab-btn ${activeTab === 'roles' ? 'active' : ''}`} 
            onClick={() => { setActiveTab('roles'); }}
          >
            <Shield size={16} style={{ marginRight: '6px', verticalAlign: 'middle' }} />
            <span>Role Defaults</span>
          </button>
        </div>

        <div style={{ display: 'flex', gap: '10px' }}>
          {activeTab === 'allotments' && (
            <button type="button" className="quick-add-btn" onClick={() => handleOpenAddUser('Agent')}>
              <Plus size={16} />
              <span>Add Agent</span>
            </button>
          )}
          {activeTab === 'users' && (
            <button type="button" className="quick-add-btn" onClick={() => handleOpenAddUser()}>
              <Plus size={16} />
              <span>Add User</span>
            </button>
          )}
          {activeTab === 'roles' && (
            <button type="button" className="quick-add-btn" onClick={handleOpenAddRole}>
              <Plus size={16} />
              <span>Add Role</span>
            </button>
          )}
        </div>
      </div>

      {loading ? (
        <h2>Loading admin control data...</h2>
      ) : (
        <div className="admin-split-layout">
          
          {/* ==================== LEFT LIST SIDEBAR ==================== */}
          <div className="admin-list-sidebar">
            {activeTab === 'allotments' && (
              <>
                <div className="admin-list-title">Active Agents</div>
                {agents.length === 0 ? (
                  <p style={{ padding: '20px', color: 'var(--text-secondary)', fontSize: '0.82rem' }}>
                    No Agent accounts registered in system.
                  </p>
                ) : (
                  agents.map(agent => (
                    <div 
                      key={agent.id} 
                      className={`admin-list-item ${selectedAgentId === agent.id ? 'selected' : ''}`}
                      onClick={() => setSelectedAgentId(agent.id)}
                    >
                      <span className="title">👤 {agent.username}</span>
                      <span className="subtitle">{agent.allottedCustomers.length} allotted clients</span>
                    </div>
                  ))
                )}
              </>
            )}

            {activeTab === 'users' && (
              <>
                <div className="admin-list-title">Staff Members</div>
                {users.map(user => (
                  <div 
                    key={user.id} 
                    className={`admin-list-item ${selectedUserId === user.id ? 'selected' : ''}`}
                    onClick={() => handleUserSelect(user.id)}
                  >
                    <span className="title">{user.username}</span>
                    <span className="subtitle">Role: {user.role_name || 'None'}</span>
                  </div>
                ))}
              </>
            )}

            {activeTab === 'roles' && (
              <>
                <div className="admin-list-title">System Roles</div>
                {roles.map(role => (
                  <div 
                    key={role.id} 
                    className={`admin-list-item ${selectedRoleId === role.id ? 'selected' : ''}`}
                    onClick={() => handleRoleSelect(role.id)}
                  >
                    <span className="title">🛡 {role.name}</span>
                    <span className="subtitle">{role.description}</span>
                  </div>
                ))}
              </>
            )}
          </div>

          {/* ==================== RIGHT DETAILS WORKSPACE ==================== */}
          <div className="admin-details-content">
            
            {message && (
              <div className="error-banner" style={{ 
                backgroundColor: message.type === 'success' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                color: message.type === 'success' ? '#10b981' : '#ef4444',
                border: `1px solid ${message.type === 'success' ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)'}`,
                borderRadius: '8px', 
                marginBottom: '15px' 
              }}>
                {message.text}
              </div>
            )}

            {/* TAB: AGENT ALLOTMENTS */}
            {activeTab === 'allotments' && (
              activeAgent ? (
                <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
                  <div style={{ marginBottom: '20px' }}>
                    <h2 style={{ fontSize: '1.25rem' }}>Customer Portfolio Allotment: {activeAgent.username}</h2>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Manage the list of customers assigned to this agent's client pool.</p>
                  </div>

                  <div className="allotment-columns">
                    <div className="allotment-box">
                      <h3 style={{ fontSize: '1rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px' }}>
                        Allotted Customers ({activeAgent.allottedCustomers.length})
                      </h3>
                      <div className="allotment-customers-list">
                        {activeAgent.allottedCustomers.length === 0 ? (
                          <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', textAlign: 'center', marginTop: '30px' }}>
                            No customers allotted to this agent.
                          </p>
                        ) : (
                          activeAgent.allottedCustomers.map(c => (
                            <div key={c.id} className="allotment-customer-row">
                              <div>
                                <span style={{ fontWeight: 700 }}>{c.name}</span>
                                <span style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', marginLeft: '8px' }}>({c.customer_code})</span>
                              </div>
                              <button 
                                type="button" 
                                className="quick-add-btn" 
                                style={{ background: '#ef4444', color: 'white', padding: '4px 8px', fontSize: '0.78rem' }}
                                onClick={() => handleUnallot(c.id)}
                              >
                                <UserMinus size={12} />
                                <span>Remove</span>
                              </button>
                            </div>
                          ))
                        )}
                      </div>
                    </div>

                    <div className="allotment-box">
                      <h3 style={{ fontSize: '1rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px' }}>
                        Unassigned Customers ({unassignedCustomers.length})
                      </h3>
                      <div className="allotment-customers-list">
                        {unassignedCustomers.length === 0 ? (
                          <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', textAlign: 'center', marginTop: '30px' }}>
                            All customers have been allotted to agents.
                          </p>
                        ) : (
                          unassignedCustomers.map(c => (
                            <div key={c.id} className="allotment-customer-row">
                              <div>
                                <span style={{ fontWeight: 700 }}>{c.name}</span>
                                <span style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', marginLeft: '8px' }}>({c.customer_code})</span>
                              </div>
                              <button 
                                type="button" 
                                className="quick-add-btn" 
                                style={{ background: '#3b82f6', color: 'white', padding: '4px 8px', fontSize: '0.78rem' }}
                                onClick={() => handleAllot(c.id)}
                              >
                                <UserPlus size={12} />
                                <span>Allot</span>
                              </button>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div style={{ padding: '40px', textAlign: 'center' }}>
                  <p style={{ color: 'var(--text-secondary)' }}>Add an Agent role and staff users to start managing allotments.</p>
                </div>
              )
            )}

            {/* TAB: USER CUSTOM OVERRIDES */}
            {activeTab === 'users' && selectedUserId && (
              <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <h2 style={{ fontSize: '1.25rem' }}>
                      Custom User Overrides: {users.find(u => u.id === selectedUserId)?.username}
                    </h2>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                      Specify individual override permissions for this staff member. These override the role default credentials.
                    </p>
                  </div>
                  <button 
                    type="button" 
                    className="quick-add-btn" 
                    style={{ background: '#10b981', color: 'white' }}
                    onClick={handleSaveUserPermissions}
                  >
                    <Check size={16} />
                    <span>Save Overrides</span>
                  </button>
                </div>

                <div className="permission-grid">
                  {permissions.map(perm => (
                    <div 
                      key={perm.id} 
                      className="permission-checkbox-card"
                      onClick={() => handleUserCheckboxChange(perm.id)}
                    >
                      <input 
                        type="checkbox" 
                        checked={userCheckedPerms.includes(perm.id)}
                        onChange={() => {}}
                      />
                      <div>
                        <div style={{ fontWeight: 700, fontSize: '0.9rem' }}>{perm.description}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* TAB: ROLE DEFAULTS */}
            {activeTab === 'roles' && selectedRoleId && (
              <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <h2 style={{ fontSize: '1.25rem' }}>
                      Role Default Credentials: {roles.find(r => r.id === selectedRoleId)?.name}
                    </h2>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                      Specify the default permissions granted automatically to any user assigned to this role.
                    </p>
                  </div>
                  <button 
                    type="button" 
                    className="quick-add-btn" 
                    style={{ background: '#3b82f6', color: 'white' }}
                    onClick={handleSaveRolePermissions}
                  >
                    <Check size={16} />
                    <span>Save Role Defaults</span>
                  </button>
                </div>

                <div className="permission-grid">
                  {permissions.map(perm => (
                    <div 
                      key={perm.id} 
                      className="permission-checkbox-card"
                      onClick={() => handleRoleCheckboxChange(perm.id)}
                    >
                      <input 
                        type="checkbox" 
                        checked={roleCheckedPerms.includes(perm.id)}
                        onChange={() => {}}
                      />
                      <div>
                        <div style={{ fontWeight: 700, fontSize: '0.9rem' }}>{perm.description}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

          </div>
        </div>
      )}

      {/* ==================== ADD USER / AGENT MODAL ==================== */}
      {showUserModal && (
        <div className="modal-overlay">
          <div className="modal-card" style={{ maxWidth: '500px' }}>
            <div className="modal-header">
              <h2>{prelockedRoleName ? `Add New ${prelockedRoleName}` : 'Add New Staff User'}</h2>
              <button type="button" className="close-btn" onClick={() => setShowUserModal(false)}>
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleUserSubmit}>
              <div className="modal-body">
                {modalError && <div className="error-banner">{modalError}</div>}

                <div className="form-group-sm form-item">
                  <label>Username / Display Name *</label>
                  <input
                    type="text"
                    placeholder="Enter name"
                    value={userForm.username}
                    onChange={(e) => setUserForm({ ...userForm, username: e.target.value })}
                    required
                  />
                </div>

                <div className="form-group-sm form-item">
                  <label>Email Address *</label>
                  <input
                    type="email"
                    placeholder="staff@rto.com"
                    value={userForm.email}
                    onChange={(e) => setUserForm({ ...userForm, email: e.target.value.toLowerCase().replace(/\s/g, '') })}
                    required
                  />
                </div>

                <div className="form-group-sm form-item">
                  <label>Password *</label>
                  <input
                    type="password"
                    placeholder="Enter secure password"
                    value={userForm.password}
                    onChange={(e) => setUserForm({ ...userForm, password: e.target.value.replace(/\s/g, '') })}
                    required
                  />
                </div>

                <div className="form-group-sm form-item">
                  <label>Role Assignment *</label>
                  <select
                    value={userForm.role_id}
                    onChange={(e) => setUserForm({ ...userForm, role_id: e.target.value })}
                    disabled={prelockedRoleName !== null}
                    required
                  >
                    <option value="">-- Select Role --</option>
                    {roles.map(r => (
                      <option key={r.id} value={r.id}>
                        {r.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn-secondary" onClick={() => setShowUserModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="submit-btn" style={{ width: 'auto', background: '#3b82f6', color: 'white' }}>
                  Create Account
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ==================== ADD ROLE MODAL ==================== */}
      {showRoleModal && (
        <div className="modal-overlay">
          <div className="modal-card" style={{ maxWidth: '500px' }}>
            <div className="modal-header">
              <h2>Add New Role</h2>
              <button type="button" className="close-btn" onClick={() => setShowRoleModal(false)}>
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleRoleSubmit}>
              <div className="modal-body">
                {modalError && <div className="error-banner">{modalError}</div>}

                <div className="form-group-sm form-item">
                  <label>Role Name *</label>
                  <input
                    type="text"
                    placeholder="e.g. Inspector"
                    value={roleForm.name}
                    onChange={(e) => setRoleForm({ ...roleForm, name: e.target.value })}
                    required
                  />
                </div>

                <div className="form-group-sm form-item">
                  <label>Description</label>
                  <input
                    type="text"
                    placeholder="Short description of access"
                    value={roleForm.description}
                    onChange={(e) => setRoleForm({ ...roleForm, description: e.target.value })}
                  />
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn-secondary" onClick={() => setShowRoleModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="submit-btn" style={{ width: 'auto', background: '#3b82f6', color: 'white' }}>
                  Create Role
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};

export default StaffAdmin;