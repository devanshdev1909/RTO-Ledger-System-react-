import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Car } from 'lucide-react';
import './Login.css';

const Login: React.FC = () => {
  const { loginStaff, loginCustomer, error, setError, loading } = useAuth();

  // Active form view ('customer' or 'staff')
  const [activeTab, setActiveTab] = useState<'customer' | 'staff'>('customer');

  // Input states
  const [identifier, setIdentifier] = useState(''); // Mobile/Email for customer
  const [email, setEmail] = useState('');           // Email for staff
  const [password, setPassword] = useState('');

  // Password visibility toggler
  const [showPassword, setShowPassword] = useState(false);

  const handleTabChange = (tab: 'customer' | 'staff') => {
    setActiveTab(tab);
    setError(null);         // Reset errors on switch
    setPassword('');        // Clear password
    setShowPassword(false); // Reset eye icon
  };

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (activeTab === 'staff') {
        await loginStaff(email, password);
      } else {
        await loginCustomer(identifier, password);
      }
    } catch {
      console.log('Authentication failed');
    }
  };

  return (
    <div className="login-body-wrapper">
      {/* Decorative background shapes */}
      <div className="background-shape shape-1"></div>
      <div className="background-shape shape-2"></div>

      <div className="login-container">
        <div className="login-card">
          
          {/* Logo / Header Section */}
          <div className="logo-section reg-header">
            <div className="logo-icon" style={{ background: 'none', display: 'flex', justifyContent: 'center', marginBottom: '10px' }}>
              <Car size={42} style={{ color: '#3b82f6' }} />
            </div>
            <h1>RTO Ledger</h1>
            <p>Welcome back, please log in below</p>
          </div>

          {/* Navigation Tabs */}
          <div className="tabs">
            <button
              type="button"
              className={`tab-btn ${activeTab === 'customer' ? 'active' : ''}`}
              onClick={() => handleTabChange('customer')}
            >
              Customer
            </button>
            <button
              type="button"
              className={`tab-btn ${activeTab === 'staff' ? 'active' : ''}`}
              onClick={() => handleTabChange('staff')}
            >
              Staff
            </button>
          </div>

          {/* Error Banner */}
          {error && (
            <div className="error-banner">
              {error}
            </div>
          )}

          {/* CUSTOMER LOGIN FORM */}
          <form 
            onSubmit={handleLoginSubmit} 
            className={`form-content ${activeTab === 'customer' ? 'active' : ''}`}
          >
            <div className="form-group-sm">
              <label>Email or Mobile Number</label>
              <div className="input-icon-wrap">
                <span className="input-icon">📱</span>
                <input
                  type="text"
                  placeholder="Enter email or mobile"
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  required={activeTab === 'customer'}
                />
              </div>
            </div>

            <div className="form-group-sm">
              <label>Password</label>
              <div className="input-icon-wrap">
                <span className="input-icon">🔒</span>
                <input
                  type={showPassword ? "text" : "password"}
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required={activeTab === 'customer'}
                />
                <button
                  type="button"
                  className="toggle-pw"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? "🙈" : "👁"}
                </button>
              </div>
            </div>

            <button 
              type="submit" 
              className="login-btn" 
              style={{ background: '#1c37a2ff', marginTop: '10px' }}
              disabled={loading}
            >
              {loading ? "Logging in..." : "Login as Customer →"}
            </button>

            <div className="customer-register-link">
              <div>
                Staff created your account? <a href="/portal/activate">Activate it here</a>
              </div>
              <div>
                Don't have an account at all? <a href="/portal/register">Register here</a>
              </div>
            </div>
          </form>

          {/* STAFF LOGIN FORM */}
          <form 
            onSubmit={handleLoginSubmit} 
            className={`form-content ${activeTab === 'staff' ? 'active' : ''}`}
          >
            <div className="form-group-sm">
              <label>Email Address</label>
              <div className="input-icon-wrap">
                <span className="input-icon">✉️</span>
                <input className='input-forms'
                  type="email"
                  placeholder="Enter your email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required={activeTab === 'staff'}
                />
              </div>
            </div>

            <div className="form-group-sm">
              <label>Password</label>
              <div className="input-icon-wrap">
                <span className="input-icon">🔒</span>
                <input
                  type={showPassword ? "text" : "password"}
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required={activeTab === 'staff'}
                />
                <button
                  type="button"
                  className="toggle-pw"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? "🙈" : "👁"}
                </button>
              </div>
            </div>

            <button 
              type="submit" 
              className="login-btn" 
              style={{ background: '#1c37a2ff', marginTop: '10px' }}
              disabled={loading}
            >
              {loading ? "Logging in..." : "Login as Staff →"}
            </button>
          </form>

          <div className="footer-text" style={{ marginTop: '15px' }}>
            RTO Management System © 2026
          </div>

        </div>
      </div>
    </div>
  );
};

export default Login;