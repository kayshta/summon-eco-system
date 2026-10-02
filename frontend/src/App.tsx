import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import Login from './pages/Login';
import AdminDashboard from './pages/admin/Dashboard';
import AdminClasses from './pages/admin/Classes';
import AdminTeachers from './pages/admin/Teachers';
import AdminStudents from './pages/admin/Students';
import CallStudent from './pages/admin/CallStudent';
import QRManager from './pages/admin/QRManager';
import LogsReports from './pages/admin/LogsReports';
import VerificationDashboard from './pages/admin/VerificationDashboard';
import TeacherDashboard from './pages/teacher/Dashboard';
import TeacherQRScan from './pages/teacher/QRScan';
import Layout from './components/Layout';

function App() {
  const { user, loading } = useAuth();

  if (loading) {
    return <div className="loading">Loading...</div>;
  }

  return (
    <Routes>
      <Route path="/login" element={!user ? <Login /> : <Navigate to={user.userType === 'admin' ? '/admin' : '/teacher'} />} />
      
      {user?.userType === 'admin' && (
        <>
          <Route path="/admin" element={<Layout><AdminDashboard /></Layout>} />
          <Route path="/admin/classes" element={<Layout><AdminClasses /></Layout>} />
          <Route path="/admin/teachers" element={<Layout><AdminTeachers /></Layout>} />
          <Route path="/admin/students" element={<Layout><AdminStudents /></Layout>} />
          <Route path="/admin/call-student" element={<Layout><CallStudent /></Layout>} />
          <Route path="/admin/qr-manager" element={<Layout><QRManager /></Layout>} />
          <Route path="/admin/logs" element={<Layout><LogsReports /></Layout>} />
          <Route path="/admin/verification" element={<Layout><VerificationDashboard /></Layout>} />
        </>
      )}

      {user?.userType === 'teacher' && (
        <>
          <Route path="/teacher" element={<Layout><TeacherDashboard /></Layout>} />
          <Route path="/teacher/scan" element={<Layout><TeacherQRScan /></Layout>} />
        </>
      )}

      <Route path="/" element={<Navigate to={user ? (user.userType === 'admin' ? '/admin' : '/teacher') : '/login'} />} />
      <Route path="*" element={<Navigate to="/" />} />
    </Routes>
  );
}

export default App;

