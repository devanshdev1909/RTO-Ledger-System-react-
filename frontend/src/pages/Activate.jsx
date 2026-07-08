import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import api from '../services/api';
import './Login.css'; // Reuse premium layout classes

const Activate = () => {
  const navigate = useNavigate();

  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  
  const [loading, setLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState(null);
  const [errorMsg, setErrorMsg] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    if (password !== confirmPassword) {
      setErrorMsg("Passwords do not match.");
      return;
    }

    setLoading(true);
    try {
      const response = await api.post('/api/portal/activate', {
        identifier,
        password,
        confirm_password: confirmPassword
      });
      if (response.data.success) {
        setSuccessMsg("Account activated successfully! Redirecting to login...");
        setTimeout(() => {
          navigate('/login');
        }, 2000);
      }
    } catch (err) {
      setErrorMsg(err.response?.data?.error || "Failed to activate account. Verify your email or mobile number.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-body-wrapper">
      <div className="background-shape shape-1"></div>
      <div className="background-shape shape-2"></div>

      <div className="login-container">
        <div className="login-card">
          
          <div className="logo-section reg-header">
            <div className="logo-icon">🔑</div>
            <h1>Activate Account</h1>
            <p>Set a password for your staff-created portal profile</p>
          </div>

          {errorMsg && <div className="error-banner">{errorMsg}</div>}
          {successMsg && <div className="error-banner" style={{ backgroundColor: 'rgba(16, 185, 129, 0.15)', color: '#10b981', border: '1px solid rgba(16, 185, 129, 0.2)' }}>{successMsg}</div>}

          <form onSubmit={handleSubmit} className="form-content active">
            
            <div className="form-group-sm">
              <label>Email Address or Mobile Number *</label>
              <div className="input-icon-wrap">
                <span className="input-icon">📧</span>
                <input
                  type="text"
                  placeholder="Enter registered email or mobile"
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="form-group-sm">
              <label>Create Password *</label>
              <div className="input-icon-wrap">
                <span className="input-icon">🔒</span>
                <input
                  type="password"
                  placeholder="Enter new password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="form-group-sm">
              <label>Confirm Password *</label>
              <div className="input-icon-wrap">
                <span className="input-icon">🔒</span>
                <input
                  type="password"
                  placeholder="Confirm new password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                />
              </div>
            </div>

            <button 
              type="submit" 
              className="login-btn" 
              style={{ background: '#10b981', marginTop: '15px' }}
              disabled={loading}
            >
              {loading ? "Activating..." : "Activate Account ✓"}
            </button>

            <div className="customer-register-link" style={{ textAlign: 'center', marginTop: '15px' }}>
              <span>Already active? </span>
              <Link to="/login">Back to Login</Link>
            </div>
          </form>

        </div>
      </div>
    </div>
  );
};

export default Activate;
