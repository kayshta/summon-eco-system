import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { toast } from 'react-toastify';
import './Login.css';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [userType, setUserType] = useState<'admin' | 'teacher'>('admin');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      await login(email, password, userType);
      toast.success('Login successful!');
      navigate(userType === 'admin' ? '/admin' : '/teacher');
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-container">
      <div className="login-card">
        <h1>Shree Durga Sec.</h1>
        <h2>School Operations System</h2>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>User Type</label>
            <select
              value={userType}
              onChange={(e) => setUserType(e.target.value as 'admin' | 'teacher')}
              className="form-input"
            >
              <option value="admin">Admin</option>
              <option value="teacher">Teacher</option>
            </select>
          </div>
          <div className="form-group">
            <label>Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="form-input"
              required
            />
          </div>
          <div className="form-group">
            <label>Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="form-input"
              required
            />
          </div>
          <button type="submit" className="btn btn-primary" disabled={loading}>
            {loading ? 'Logging in...' : 'Login'}
          </button>
        </form>
        <div className="login-info">
          <p><strong>Demo Credentials:</strong></p>
          <p>Admin: admin@greenfield.example / admin123</p>
          <p>Teacher: teachera@greenfield.example / teacher123</p>
        </div>
      </div>
    </div>
  );
}

