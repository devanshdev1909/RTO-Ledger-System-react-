import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import api from '../services/api';
import './Login.css'; // Reuse premium layout classes

const Register = () => {
  const navigate = useNavigate();

  const [name, setName] = useState('');
  const [mobile, setMobile] = useState('');
  const [email, setEmail] = useState('');
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

    if (!/^[0-9]{10}$/.test(mobile)) {
      setErrorMsg("Please enter a valid 10-digit mobile number.");
      return;
    }

    setLoading(true);
    try {
      const response = await api.post('/api/portal/register', {
        name,
        mobile,
        email: email || null,
        password,
        confirm_password: confirmPassword
      });
      if (response.data.success) {
        setSuccessMsg("Registration successful! Redirecting to login...");
        setTimeout(() => {
          navigate('/login');
        }, 2000);
      }
    } catch (err) {
      setErrorMsg(err.response?.data?.error || "Registration failed. Try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-body-wrapper">
      <div className="background-shape shape-1"></div>
      <div className="background-shape shape-2"></div>

      <div className="login-container" style={{ margin: '40px auto' }}>
        <div className="login-card">
          
          <div className="logo-section reg-header">
            <div className="logo-icon">📝</div>
            <h1>Customer Registration</h1>
            <p>Create a secure portal account to track your vehicles and dues</p>
          </div>

          {errorMsg && <div className="error-banner">{errorMsg}</div>}
          {successMsg && <div className="error-banner" style={{ backgroundColor: 'rgba(16, 185, 129, 0.15)', color: '#10b981', border: '1px solid rgba(16, 185, 129, 0.2)' }}>{successMsg}</div>}

          <form onSubmit={handleSubmit} className="form-content active">
            
            <div className="form-group-sm">
              <label>Full Name *</label>
              <div className="input-icon-wrap">
                <span className="input-icon">👤</span>
                <input
                  type="text"
                  placeholder="Enter your full name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="form-group-sm">
              <label>10-Digit Mobile Number *</label>
              <div className="input-icon-wrap">
                <span className="input-icon">📱</span>
                <input
                  type="tel"
                  maxLength={10}
                  placeholder="Enter mobile number"
                  value={mobile}
                  onChange={(e) => setMobile(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="form-group-sm">
              <label>Email Address</label>
              <div className="input-icon-wrap">
                <span className="input-icon">✉️</span>
                <input
                  type="email"
                  placeholder="Enter email address"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
            </div>

            <div className="form-group-sm">
              <label>Password *</label>
              <div className="input-icon-wrap">
                <span className="input-icon">🔒</span>
                <input
                  type="password"
                  placeholder="Create password"
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
                  placeholder="Confirm password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                />
              </div>
            </div>

            <button 
              type="submit" 
              className="login-btn" 
              style={{ background: '#3b82f6', marginTop: '15px' }}
              disabled={loading}
            >
              {loading ? "Registering..." : "Create Portal Account →"}
            </button>

            <div className="customer-register-link" style={{ textAlign: 'center', marginTop: '15px' }}>
              <span>Already have an account? </span>
              <Link to="/login">Sign In</Link>
            </div>
          </form>

        </div>
      </div>
    </div>
  );
};

export default Register;
