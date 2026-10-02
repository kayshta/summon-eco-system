import { useQuery } from '@tanstack/react-query';
import { api } from '../../services/api';
import './Dashboard.css';

export default function AdminDashboard() {
  const { data: stats, isLoading } = useQuery({
    queryKey: ['dashboard-stats'],
    queryFn: async () => {
      const [classes, teachers, students, summons, currentTeachers] = await Promise.all([
        api.get('/classes'),
        api.get('/teachers'),
        api.get('/students'),
        api.get('/summon?limit=10'),
        api.get('/qr-scan/current-teachers')
      ]);

      return {
        classes: classes.data.length,
        teachers: teachers.data.length,
        students: students.data.length,
        recentSummons: summons.data.length,
        activeTeachers: currentTeachers.data.length
      };
    }
  });

  if (isLoading) {
    return <div className="loading">Loading dashboard...</div>;
  }

  return (
    <div className="dashboard">
      <h1>Admin Dashboard</h1>
      <div className="stats-grid">
        <div className="stat-card">
          <h3>Classes</h3>
          <p className="stat-number">{stats?.classes || 0}</p>
        </div>
        <div className="stat-card">
          <h3>Teachers</h3>
          <p className="stat-number">{stats?.teachers || 0}</p>
        </div>
        <div className="stat-card">
          <h3>Students</h3>
          <p className="stat-number">{stats?.students || 0}</p>
        </div>
        <div className="stat-card">
          <h3>Active Teachers</h3>
          <p className="stat-number">{stats?.activeTeachers || 0}</p>
        </div>
        <div className="stat-card">
          <h3>Recent Summons</h3>
          <p className="stat-number">{stats?.recentSummons || 0}</p>
        </div>
      </div>
    </div>
  );
}

