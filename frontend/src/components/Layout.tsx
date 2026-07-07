import React, { useState } from 'react';
import { Link, useLocation, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { 
  LayoutDashboard, Users, Car, ClipboardList, 
  IndianRupee, ShieldCheck, LogOut,
  ChevronLeft, ChevronRight, Settings, FileText, Plus 
} from 'lucide-react';
import QuickAddModal from './QuickAddModal';
import './Layout.css';

const Layout: React.FC = () => {
  const { user, logout, hasPermission } = useAuth();
  const location = useLocation();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [showQuickAdd, setShowQuickAdd] = useState(false);

  // Helper to check active link
  const isActive = (path: string) => {
    return location.pathname === path;
  };

  // Helper to convert pathname to Title
  const getPageTitle = () => {
    switch (location.pathname) {
      case '/dashboard': return 'Dashboard Overview';
      case '/customers': return 'Customer Database';
      case '/vehicles': return 'Registered Vehicles';
      case '/requests': return 'Service Requests';
      case '/services': return 'RTO Services Catalog';
      case '/receipts': return 'Payment Receipts Log';
      case '/ledger': return 'Financial Ledger';
      case '/admin': return 'Staff Administration';
      default: return 'RTO Management';
    }
  };

  return (
    <div className="layout-container">
      
            {/* 🧭 SIDEBAR NAV */}
      <aside className={`sidebar ${isCollapsed ? 'collapsed' : ''}`}>
        {/* Floating Toggle Button */}
        <button 
          type="button" 
          className="sidebar-toggle-btn"
          onClick={() => setIsCollapsed(!isCollapsed)}
          title={isCollapsed ? "Expand Sidebar" : "Collapse Sidebar"}
        >
          {isCollapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
        </button>

        <div className="sidebar-header" style={{ display: 'flex', alignItems: 'center', padding: '15px 20px' }}>
          <Car size={24} style={{ color: 'var(--button-color)', flexShrink: 0 }} />
          {!isCollapsed && <span className="sidebar-title" style={{ marginLeft: '10px', fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '0.5px' }}>RTO LEDGER</span>}
        </div>

        <nav style={{ flex: 1 }}>
          <ul className="sidebar-menu">
            
            <li className={`menu-item ${isActive('/dashboard') ? 'active' : ''}`}>
              <Link to="/dashboard">
                <LayoutDashboard size={20} />
                {!isCollapsed && <span>Dashboard</span>}
              </Link>
            </li>

            <li className={`menu-item ${isActive('/customers') ? 'active' : ''}`}>
              <Link to="/customers">
                <Users size={20} />
                {!isCollapsed && <span>Customers</span>}
              </Link>
            </li>

            <li className={`menu-item ${isActive('/vehicles') ? 'active' : ''}`}>
              <Link to="/vehicles">
                <Car size={20} />
                {!isCollapsed && <span>Vehicles</span>}
              </Link>
            </li>

            <li className={`menu-item ${isActive('/services') ? 'active' : ''}`}>
              <Link to="/services">
                <Settings size={20} />
                {!isCollapsed && <span>RTO Services</span>}
              </Link>
            </li>

            <li className={`menu-item ${isActive('/requests') ? 'active' : ''}`}>
              <Link to="/requests">
                <ClipboardList size={20} />
                {!isCollapsed && <span>Service Requests</span>}
              </Link>
            </li>

            {hasPermission('ledger.view') && (
              <li className={`menu-item ${isActive('/ledger') ? 'active' : ''}`}>
                <Link to="/ledger">
                  <IndianRupee size={20} />
                  {!isCollapsed && <span>Ledger & Finance</span>}
                </Link>
              </li>
            )}

            {hasPermission('receipt.view') && (
              <li className={`menu-item ${isActive('/receipts') ? 'active' : ''}`}>
                <Link to="/receipts">
                  <FileText size={20} />
                  {!isCollapsed && <span>Receipts Log</span>}
                </Link>
              </li>
            )}

            {/* Show Admin menu item only if staff role is Admin */}
            {user?.role === 'Admin' && (
              <li className={`menu-item ${isActive('/admin') ? 'active' : ''}`}>
                <Link to="/admin">
                  <ShieldCheck size={20} />
                  {!isCollapsed && <span>Staff Admin</span>}
                </Link>
              </li>
            )}

          </ul>
        </nav>

        <div className="sidebar-footer">
          <button type="button" className="logout-btn" onClick={logout}>
            <LogOut size={20} />
            {!isCollapsed && <span>Sign Out</span>}
          </button>
        </div>
      </aside>

      {/* 🖥️ MAIN CONTENT AREA */}
      <div className="main-wrapper">
        
        {/* NAVBAR */}
        <header className="navbar">
          <div className="navbar-left">
            <h2>{getPageTitle()}</h2>
          </div>

          <div className="navbar-right">
            
            {/* Quick Add Button */}
            {hasPermission('ledger.create') && (
              <button 
                type="button" 
                className="quick-add-btn" 
                style={{ padding: '8px 16px', borderRadius: '8px', fontSize: '0.88rem', height: 'auto', background: '#3b82f6', color: 'white', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}
                onClick={() => setShowQuickAdd(true)}
                title="Quick Add Registration"
              >
                <Plus size={16} />
                <span>Quick Add</span>
              </button>
            )}
            {/* User Details Badge */}
            <div className="user-profile-badge">
              <div className="avatar">
                {user?.username ? user.username.charAt(0).toUpperCase() : 'U'}
              </div>
              <div className="user-info">
                <span className="name">{user?.username}</span>
                <span className="role">{user?.role}</span>
              </div>
            </div>

          </div>
        </header>

        {/* PAGE SCREEN CONTAINER */}
        <main className="app-page-content">
          <Outlet /> {/* Renders the actual active sub-page inside here */}
        </main>

      </div>

      <QuickAddModal isOpen={showQuickAdd} onClose={() => setShowQuickAdd(false)} />

    </div>
  );
};

export default Layout;