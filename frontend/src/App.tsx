import React, { useEffect, useState } from 'react';
import { Login } from './pages/Login';
import { AdminDashboard } from './pages/AdminDashboard';
import { TeacherDashboard } from './pages/TeacherDashboard';
import { AcademicAdvisorDashboard } from './pages/AcademicAdvisorDashboard';
import { StudentDashboard } from './pages/StudentDashboard';
import { LogOut, LayoutDashboard, Database, Shield, BookOpen, Compass } from 'lucide-react';

interface User {
  id: number;
  name: string;
  email: string;
  role: string;
}

const App: React.FC = () => {
  const [token, setToken] = useState<string | null>(localStorage.getItem('token'));
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  
  // Navigation active tab
  const [activeTab, setActiveTab] = useState<string>('');

  const fetchProfile = async (currentToken: string) => {
    try {
      const res = await fetch('/api/auth/me', {
        headers: {
          Authorization: `Bearer ${currentToken}`,
        },
      });

      if (res.ok) {
        const userData: User = await res.json();
        setUser(userData);
        
        // Decide default tab based on role
        if (userData.role === 'Admin') {
          setActiveTab('admin');
        } else if (userData.role === 'Teacher') {
          setActiveTab('teacher');
        } else if (userData.role === 'AcademicAdvisor') {
          setActiveTab('advisor');
        } else {
          setActiveTab('student');
        }
      } else {
        // Token expired/invalid
        handleLogout();
      }
    } catch (err) {
      console.error('Error loading user profile', err);
      handleLogout();
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (token) {
      fetchProfile(token);
    } else {
      setLoading(false);
    }
  }, [token]);

  const handleLoginSuccess = (newToken: string) => {
    localStorage.setItem('token', newToken);
    setToken(newToken);
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    setToken(null);
    setUser(null);
    setActiveTab('');
  };

  if (loading) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        background: '#060511',
        color: 'var(--text-muted)'
      }}>
        <p>Loading application session...</p>
      </div>
    );
  }

  // Not authenticated
  if (!user || !token) {
    return <Login onLoginSuccess={handleLoginSuccess} />;
  }

  // Render active panel
  const renderContent = () => {
    switch (activeTab) {
      case 'admin':
        return <AdminDashboard />;
      case 'teacher':
        return <TeacherDashboard />;
      case 'advisor':
        return <AcademicAdvisorDashboard />;
      case 'student':
        return <StudentDashboard />;
      default:
        return <p style={{ color: 'var(--text-muted)' }}>No panel selected</p>;
    }
  };

  // Get matching icon for active panel
  const getAvatarChar = () => {
    return user.name ? user.name.charAt(0).toUpperCase() : 'U';
  };

  return (
    <div className="dashboard-container">
      {/* Sidebar navigation */}
      <aside className="sidebar glass-panel" id="side-nav">
        <div className="sidebar-logo">
          <BookOpen size={24} style={{ color: 'var(--primary)' }} />
          <span>CLS Analytics</span>
        </div>

        <ul className="sidebar-menu">
          {/* Admin role links */}
          {user.role === 'Admin' && (
            <>
              <li className={`sidebar-item ${activeTab === 'admin' ? 'active' : ''}`}>
                <button onClick={() => setActiveTab('admin')} id="nav-admin">
                  <Shield size={18} /> Admin Panel
                </button>
              </li>
              <li className={`sidebar-item ${activeTab === 'teacher' ? 'active' : ''}`}>
                <button onClick={() => setActiveTab('teacher')} id="nav-teacher">
                  <Database size={18} /> Teacher Registry
                </button>
              </li>
              <li className={`sidebar-item ${activeTab === 'advisor' ? 'active' : ''}`}>
                <button onClick={() => setActiveTab('advisor')} id="nav-advisor">
                  <Compass size={18} /> Advisor Desk
                </button>
              </li>
            </>
          )}

          {/* Teacher role links */}
          {user.role === 'Teacher' && (
            <>
              <li className={`sidebar-item ${activeTab === 'teacher' ? 'active' : ''}`}>
                <button onClick={() => setActiveTab('teacher')} id="nav-teacher">
                  <Database size={18} /> Teacher Registry
                </button>
              </li>
              <li className={`sidebar-item ${activeTab === 'advisor' ? 'active' : ''}`}>
                <button onClick={() => setActiveTab('advisor')} id="nav-advisor">
                  <Compass size={18} /> Advisor Desk
                </button>
              </li>
            </>
          )}

          {/* Advisor role links */}
          {user.role === 'AcademicAdvisor' && (
            <li className={`sidebar-item ${activeTab === 'advisor' ? 'active' : ''}`}>
              <button onClick={() => setActiveTab('advisor')} id="nav-advisor">
                <Compass size={18} /> Advisor Desk
              </button>
            </li>
          )}

          {/* Student role links */}
          {user.role === 'Student' && (
            <li className={`sidebar-item ${activeTab === 'student' ? 'active' : ''}`}>
              <button onClick={() => setActiveTab('student')} id="nav-student">
                <LayoutDashboard size={18} /> My Dashboard
              </button>
            </li>
          )}
        </ul>

        {/* Sidebar Footer details */}
        <div className="sidebar-footer">
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
            <div className="user-avatar">{getAvatarChar()}</div>
            <div style={{ overflow: 'hidden' }}>
              <div style={{ fontWeight: 600, color: 'white', fontSize: '13px', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                {user.name}
              </div>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'capitalize' }}>
                {user.role === 'AcademicAdvisor' ? 'Academic Advisor' : user.role}
              </div>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="btn-secondary"
            style={{ width: '100%', justifyContent: 'center', padding: '8px 12px', fontSize: '13px' }}
            id="logout-btn"
          >
            <LogOut size={14} /> Log Out
          </button>
        </div>
      </aside>

      {/* Main workspace */}
      <main className="main-content">
        <header className="top-bar">
          <div>
            <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Platform Context
            </span>
            <h1 style={{ fontSize: '18px', color: 'white', marginTop: '2px' }}>
              {activeTab === 'admin' && 'System Configuration & Users'}
              {activeTab === 'teacher' && 'Dataset Clean & Import Registry'}
              {activeTab === 'advisor' && 'Student Performance Risk Analysis'}
              {activeTab === 'student' && 'My Academic Progress'}
            </h1>
          </div>
          <div className="user-profile">
            <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>{user.email}</span>
          </div>
        </header>

        <div className="content-body">
          {renderContent()}
        </div>
      </main>
    </div>
  );
};

export default App;
