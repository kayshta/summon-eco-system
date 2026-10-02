import { ReactNode } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import './Layout.css';

interface LayoutProps {
  children: ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const isActive = (path: string) => location.pathname === path;

  if (user?.userType === 'admin') {
    return (
      <div className="layout">
        <nav className="navbar">
          <div className="nav-brand">
            <h2>Shree Durga Sec.</h2>
            <span className="nav-user">Admin: {user.name}</span>
          </div>
          <div className="nav-links">
            <Link to="/admin" className={isActive('/admin') ? 'active' : ''}>Dashboard</Link>
            <Link to="/admin/classes" className={isActive('/admin/classes') ? 'active' : ''}>Classes</Link>
            <Link to="/admin/teachers" className={isActive('/admin/teachers') ? 'active' : ''}>Teachers</Link>
            <Link to="/admin/students" className={isActive('/admin/students') ? 'active' : ''}>Students</Link>
            <Link to="/admin/call-student" className={isActive('/admin/call-student') ? 'active' : ''}>Call Student</Link>
            <Link to="/admin/qr-manager" className={isActive('/admin/qr-manager') ? 'active' : ''}>QR Manager</Link>
            <Link to="/admin/verification" className={isActive('/admin/verification') ? 'active' : ''}>Verification</Link>
            <Link to="/admin/logs" className={isActive('/admin/logs') ? 'active' : ''}>Logs</Link>
            <button onClick={handleLogout} className="btn-logout">Logout</button>
          </div>
        </nav>
        <main className="main-content">{children}</main>
      </div>
    );
  }

  if (user?.userType === 'teacher') {
    return (
      <div className="layout">
        <nav className="navbar">
          <div className="nav-brand">
            <h2>Shree Durga Sec.</h2>
            <span className="nav-user">Teacher: {user.name}</span>
          </div>
          <div className="nav-links">
            <Link to="/teacher" className={isActive('/teacher') ? 'active' : ''}>Dashboard</Link>
            <Link to="/teacher/scan" className={isActive('/teacher/scan') ? 'active' : ''}>Scan QR</Link>
            <button onClick={handleLogout} className="btn-logout">Logout</button>
          </div>
        </nav>
        <main className="main-content">{children}</main>
      </div>
    );
  }

  return <>{children}</>;
}

