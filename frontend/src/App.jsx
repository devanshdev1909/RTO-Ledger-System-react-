import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Layout from './components/Layout';
import CustomersList from './pages/CustomersList';
import VehiclesList from './pages/VehiclesList';
import ServiceRequestsList from './pages/ServiceRequestsList';
import ServicesList from './pages/ServicesList';
import LedgerList from './pages/LedgerList';
import ReceiptsList from './pages/ReceiptsList';
import Activate from './pages/Activate';
import Register from './pages/Register';
import CustomerDashboard from './pages/CustomerDashboard';
import StaffAdmin from './pages/StaffAdmin';


// Helper Component to protect Staff routes
const ProtectedStaffRoute = ({ children }) => {
  const { user, userType, loading } = useAuth();

  if (loading) {
    return <div className="loading-screen">Loading RTO Ledger...</div>;
  }

  // If not logged in, or logged in, redirect to login
  if (!user || userType !== 'staff') {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
};

// Helper Component to protect Customer routes
const ProtectedCustomerRoute = ({ children }) => {
  const { customer, userType, loading } = useAuth();

  if (loading) {
    return <div className="loading-screen">Loading Portal...</div>;
  }

  if (!customer || userType !== 'customer') {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
};

// The Main App Router Component
const AppContent = () => {
  const { userType, loading } = useAuth();

  // Show a loading screen while checking active session cookie on load
  if (loading) {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100vh',
        background: '#1e293b',
        color: '#ffffff',
        fontFamily: 'sans-serif'
      }}>
        <h2>Initializing System...</h2>
      </div>
    );
  }

  return (
    <Router>
      <Routes>
        
        {/* Public Login Route */}
        <Route 
          path="/login" 
          element={
            userType === 'staff' ? (
              <Navigate to="/dashboard" replace />
            ) : userType === 'customer' ? (
              <Navigate to="/portal/dashboard" replace />
            ) : (
              <Login />
            )
          } 
        />

        <Route 
          path="/portal/activate" 
          element={
            userType === 'staff' ? (
              <Navigate to="/dashboard" replace />
            ) : userType === 'customer' ? (
              <Navigate to="/portal/dashboard" replace />
            ) : (
              <Activate />
            )
          } 
        />

        <Route 
          path="/portal/register" 
          element={
            userType === 'staff' ? (
              <Navigate to="/dashboard" replace />
            ) : userType === 'customer' ? (
              <Navigate to="/portal/dashboard" replace />
            ) : (
              <Register />
            )
          } 
        />

        {/* Staff Routes wrapped inside Layout */}
        <Route
          element={
            <ProtectedStaffRoute>
              <Layout />
            </ProtectedStaffRoute>
          }
        >
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/customers" element={<CustomersList />} />
          <Route path="/vehicles" element={<VehiclesList />} />
          <Route path="/requests" element={<ServiceRequestsList />} />
          <Route path="/services" element={<ServicesList />} />
          <Route path="/ledger" element={<LedgerList />} />
          <Route path="/receipts" element={<ReceiptsList />} />
          <Route path="/admin" element={<StaffAdmin />} />
        </Route>

        {/* Customer Portal Dashboard */}
        <Route path="/portal/dashboard" element={<ProtectedCustomerRoute><CustomerDashboard /></ProtectedCustomerRoute>} />

        {/* Root Redirect Route */}
        <Route 
          path="/" 
          element={
            userType === 'staff' ? (
              <Navigate to="/dashboard" replace />
            ) : userType === 'customer' ? (
              <Navigate to="/portal/dashboard" replace />
            ) : (
              <Navigate to="/login" replace />
            )
          } 
        />

        {/* Catch-all Route: redirects unknown paths to Login */}
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </Router>
  );
};

// Wrap everything in the AuthProvider
const App = () => {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
};

export default App;