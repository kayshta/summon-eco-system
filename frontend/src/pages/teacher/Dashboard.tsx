import { useQuery } from '@tanstack/react-query';
import { api } from '../../services/api';
import { Link } from 'react-router-dom';

export default function TeacherDashboard() {
  const { data: currentTeachers, isLoading } = useQuery({
    queryKey: ['current-teachers'],
    queryFn: async () => {
      const response = await api.get('/qr-scan/current-teachers');
      return response.data;
    }
  });

  if (isLoading) {
    return <div className="loading">Loading dashboard...</div>;
  }

  return (
    <div className="container">
      <h1>Teacher Dashboard</h1>
      <div className="card">
        <h2>Welcome!</h2>
        <p style={{ marginBottom: '24px' }}>
          Scan the QR code in your classroom to sign in and receive student summon notifications.
        </p>
        <Link to="/teacher/scan" className="btn btn-primary">
          Scan QR Code
        </Link>
      </div>

      <div className="card">
        <h2>Currently Active Teachers</h2>
        {currentTeachers && currentTeachers.length > 0 ? (
          <table className="table">
            <thead>
              <tr>
                <th>Class</th>
                <th>Teacher</th>
                <th>Last Updated</th>
              </tr>
            </thead>
            <tbody>
              {currentTeachers.map((ct: any) => (
                <tr key={ct.class_id}>
                  <td>{ct.class_name}</td>
                  <td>{ct.teacher_name}</td>
                  <td>{new Date(ct.updated_at).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p>No teachers currently signed in to classes.</p>
        )}
      </div>
    </div>
  );
}

