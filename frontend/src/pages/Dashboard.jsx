import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import { 
  Users, Car, Settings, ClipboardList, Clock, 
  CheckCircle, IndianRupee 
} from 'lucide-react';
import { Chart as ChartJS, ArcElement, Tooltip, Legend, CategoryScale, LinearScale, PointElement, LineElement, Title } from 'chart.js';
import { Doughnut, Line } from 'react-chartjs-2';
import './Dashboard.css';

// Register Chart.js components
ChartJS.register(ArcElement, Tooltip, Legend, CategoryScale, LinearScale, PointElement, LineElement, Title);




const Dashboard = () => {
  const { user, logout } = useAuth();
  
  // Dashboard state
  const [stats, setStats] = useState(null);
  const [chartData, setChartData] = useState(null);

  const [loading, setLoading] = useState(true);



  // Fetch stats from backend
  const fetchDashboardData = async () => {
    try {
      const response = await api.get('/api/dashboard');
      if (response.data.success) {
        setStats(response.data.stats);
        setChartData(response.data.chartData);

      }
    } catch (err) {
      console.error('Failed to load dashboard data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();

    const handleQuickAddSuccess = () => {
      fetchDashboardData();
    };
    window.addEventListener('quick-add-success', handleQuickAddSuccess);
    return () => {
      window.removeEventListener('quick-add-success', handleQuickAddSuccess);
    };
  }, []);



  if (loading || !stats) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', background: 'var(--bg-primary)' }}>
        <h2>Loading Dashboard Statistics...</h2>
      </div>
    );
  }

  // 📈 Setup Chart datasets
  const jobStatusData = {
    labels: ['Pending Jobs', 'Completed Jobs'],
    datasets: [{
      data: [stats.pendingJobs, stats.completedJobs],
      backgroundColor: ['#ef4444', '#10b981'],
      borderWidth: 1,
    }],
  };

  const financialData = {
    labels: ['Revenue (Received)', 'Outstanding Dues'],
    datasets: [{
      data: [stats.revenue, stats.dueAmount],
      backgroundColor: ['#10b981', '#f59e0b'],
      borderWidth: 1,
    }],
  };

  const timeLabels = chartData?.requestsOverTime?.map((r) => r.date_label) || [];
  const requestCounts = chartData?.requestsOverTime?.map((r) => parseInt(r.count, 10)) || [];
  
  const requestsOverTimeData = {
    labels: timeLabels,
    datasets: [{
      label: 'Service Requests Raised',
      data: requestCounts,
      borderColor: '#3b82f6',
      backgroundColor: 'rgba(59, 130, 246, 0.1)',
      tension: 0.3,
      fill: true,
    }],
  };

  return (
    <div className="dashboard-container">
      <div className="dashboard-content">
        
        {/* Dashboard Header */}
        <div className="dashboard-header">
          <div>
            <h1>Welcome, {user?.username}!</h1>
            <p>Role: {user?.role} | System Active</p>
          </div>
          <div style={{ display: 'flex', gap: '15px' }}>
            <button 
              type="button" 
              onClick={logout} 
              style={{ background: '#ef4444', color: 'white', border: 'none', padding: '12px 18px', borderRadius: '10px', fontWeight: 'bold', cursor: 'pointer' }}
            >
              Log Out
            </button>
          </div>
        </div>

        {/* Stats Grid Cards */}
        <div className="stats-grid">
          
          <div className="stat-card" style={{ '--card-color': '#f59e0b' }}>
            <h3>Total Customers</h3>
            <div className="stat-value">{stats.customers}</div>
            <span className="stat-icon"><Users size={24} /></span>
          </div>

          <div className="stat-card" style={{ '--card-color': '#10b981' }}>
            <h3>Total Vehicles</h3>
            <div className="stat-value">{stats.vehicles}</div>
            <span className="stat-icon"><Car size={24} /></span>
          </div>

          <div className="stat-card" style={{ '--card-color': '#6366f1' }}>
            <h3>Active Services</h3>
            <div className="stat-value">{stats.services}</div>
            <span className="stat-icon"><Settings size={24} /></span>
          </div>

          <div className="stat-card" style={{ '--card-color': 'var(--button-color)' }}>
            <h3>Total Requests</h3>
            <div className="stat-value">{stats.requests}</div>
            <span className="stat-icon"><ClipboardList size={24} /></span>
          </div>

          <div className="stat-card" style={{ '--card-color': '#ef4444' }}>
            <h3>Pending Jobs</h3>
            <div className="stat-value">{stats.pendingJobs}</div>
            <span className="stat-icon"><Clock size={24} /></span>
          </div>

          <div className="stat-card" style={{ '--card-color': '#10b981' }}>
            <h3>Completed Jobs</h3>
            <div className="stat-value">{stats.completedJobs}</div>
            <span className="stat-icon"><CheckCircle size={24} /></span>
          </div>

          <div className="stat-card" style={{ '--card-color': '#059669' }}>
            <h3>Total Revenue</h3>
            <div className="stat-value">₹{stats.revenue.toLocaleString('en-IN')}</div>
            <span className="stat-icon"><IndianRupee size={24} /></span>
          </div>

          <div className="stat-card" style={{ '--card-color': '#ef4444' }}>
            <h3>Outstanding Dues</h3>
            <div className="stat-value">₹{stats.dueAmount.toLocaleString('en-IN')}</div>
            <span className="stat-icon"><IndianRupee size={24} /></span>
          </div>

        </div>

        {/* Charts Section */}
        <div className="charts-grid">
          
          <div className="chart-card">
            <h3>Job Status Overview</h3>
            <div className="chart-wrapper">
              <Doughnut data={jobStatusData} options={{ maintainAspectRatio: false }} />
            </div>
          </div>

          <div className="chart-card">
            <h3>Financial Overview</h3>
            <div className="chart-wrapper">
              <Doughnut data={financialData} options={{ maintainAspectRatio: false }} />
            </div>
          </div>

          <div className="chart-card" style={{ gridColumn: 'span 2' }}>
            <h3>Service Requests (Last 30 Days)</h3>
            <div className="chart-wrapper-wide">
              <Line data={requestsOverTimeData} options={{ maintainAspectRatio: false, responsive: true }} height={240} />
            </div>
          </div>

        </div>



      </div>
    </div>
  );
};

export default Dashboard;