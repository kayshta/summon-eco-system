import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../services/api';
import { toast } from 'react-toastify';
import { format } from 'date-fns';

export default function VerificationDashboard() {
  const queryClient = useQueryClient();

  const { data: students, isLoading } = useQuery({
    queryKey: ['students-verification'],
    queryFn: async () => {
      const response = await api.get('/students/verification/pending');
      return response.data;
    }
  });

  const verifyMutation = useMutation({
    mutationFn: async (studentId: number) => {
      await api.put(`/students/${studentId}`, {
        last_verified_at: 'now'
      });
    },
    onSuccess: () => {
      toast.success('Student marked as verified');
      queryClient.invalidateQueries({ queryKey: ['students-verification'] });
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Failed to verify student');
    }
  });

  if (isLoading) {
    return <div className="loading">Loading students needing verification...</div>;
  }

  const studentsNeedingVerification = students?.filter((s: any) => 
    !s.last_verified_at || s.days_since_verification >= 365
  ) || [];

  return (
    <div className="container">
      <h1>Annual Verification Dashboard</h1>
      <div className="card">
        <p style={{ marginBottom: '24px', color: '#666' }}>
          Students flagged for yearly review (last verified more than 365 days ago or never verified).
        </p>
        <p style={{ marginBottom: '24px' }}>
          <strong>Total students needing verification:</strong> {studentsNeedingVerification.length}
        </p>

        {studentsNeedingVerification.length === 0 ? (
          <p style={{ textAlign: 'center', color: '#666', padding: '40px' }}>
            All students are up to date with verification!
          </p>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Name</th>
                <th>Roll No</th>
                <th>Class</th>
                <th>Section</th>
                <th>Last Verified</th>
                <th>Days Since</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {studentsNeedingVerification.map((student: any) => (
                <tr key={student.id}>
                  <td>{student.id}</td>
                  <td>{student.name}</td>
                  <td>{student.roll_no}</td>
                  <td>{student.class_name}</td>
                  <td>{student.section || 'N/A'}</td>
                  <td>
                    {student.last_verified_at
                      ? format(new Date(student.last_verified_at), 'MMM dd, yyyy')
                      : 'Never'}
                  </td>
                  <td>
                    {student.days_since_verification !== null
                      ? `${student.days_since_verification} days`
                      : 'N/A'}
                  </td>
                  <td>
                    <button
                      className="btn btn-success"
                      onClick={() => verifyMutation.mutate(student.id)}
                      disabled={verifyMutation.isPending}
                    >
                      Mark as Verified
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

