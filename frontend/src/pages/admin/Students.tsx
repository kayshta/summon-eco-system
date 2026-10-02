import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../services/api';
import { toast } from 'react-toastify';
import StudentImport from '../../components/StudentImport';

export default function AdminStudents() {
  const [showForm, setShowForm] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    roll_no: '',
    class_id: '',
    section: '',
    phone: ''
  });
  const queryClient = useQueryClient();

  const { data: students, isLoading } = useQuery({
    queryKey: ['students'],
    queryFn: async () => {
      const response = await api.get('/students');
      return response.data;
    }
  });

  const { data: classes } = useQuery({
    queryKey: ['classes'],
    queryFn: async () => {
      const response = await api.get('/classes');
      return response.data;
    }
  });

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await api.post('/students', data);
      return response.data;
    },
    onSuccess: () => {
      toast.success('Student created successfully');
      setShowForm(false);
      setFormData({ name: '', roll_no: '', class_id: '', section: '', phone: '' });
      queryClient.invalidateQueries({ queryKey: ['students'] });
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Failed to create student');
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await api.delete(`/students/${id}`);
    },
    onSuccess: () => {
      toast.success('Student deleted successfully');
      queryClient.invalidateQueries({ queryKey: ['students'] });
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Failed to delete student');
    }
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createMutation.mutate({
      ...formData,
      class_id: parseInt(formData.class_id)
    });
  };

  if (isLoading) {
    return <div className="loading">Loading students...</div>;
  }

  return (
    <div className="container">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <h1>Students</h1>
        <div>
          <button className="btn btn-secondary" onClick={() => setShowImport(!showImport)} style={{ marginRight: '8px' }}>
            {showImport ? 'Cancel Import' : 'Import from Excel'}
          </button>
          <button className="btn btn-primary" onClick={() => setShowForm(!showForm)}>
            {showForm ? 'Cancel' : 'Add Student'}
          </button>
        </div>
      </div>

      {showImport && <StudentImport onClose={() => setShowImport(false)} />}

      {showForm && (
        <div className="card">
          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label>Name</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="form-input"
                required
              />
            </div>
            <div className="form-group">
              <label>Roll Number</label>
              <input
                type="text"
                value={formData.roll_no}
                onChange={(e) => setFormData({ ...formData, roll_no: e.target.value })}
                className="form-input"
                required
              />
            </div>
            <div className="form-group">
              <label>Class</label>
              <select
                value={formData.class_id}
                onChange={(e) => setFormData({ ...formData, class_id: e.target.value })}
                className="form-input"
                required
              >
                <option value="">Select Class</option>
                {classes?.map((cls: any) => (
                  <option key={cls.id} value={cls.id}>{cls.class_name}</option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label>Section</label>
              <input
                type="text"
                value={formData.section}
                onChange={(e) => setFormData({ ...formData, section: e.target.value })}
                className="form-input"
              />
            </div>
            <div className="form-group">
              <label>Phone</label>
              <input
                type="tel"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                className="form-input"
              />
            </div>
            <button type="submit" className="btn btn-primary" disabled={createMutation.isPending}>
              {createMutation.isPending ? 'Creating...' : 'Create Student'}
            </button>
          </form>
        </div>
      )}

      <div className="card">
        <table className="table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Name</th>
              <th>Roll No</th>
              <th>Class</th>
              <th>Section</th>
              <th>Last Verified</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {students?.map((student: any) => (
              <tr key={student.id}>
                <td>{student.id}</td>
                <td>{student.name}</td>
                <td>{student.roll_no}</td>
                <td>{student.class_name}</td>
                <td>{student.section || 'N/A'}</td>
                <td>{student.last_verified_at ? new Date(student.last_verified_at).toLocaleDateString() : 'Never'}</td>
                <td>
                  <button
                    className="btn btn-danger"
                    onClick={() => {
                      if (window.confirm('Are you sure you want to delete this student?')) {
                        deleteMutation.mutate(student.id);
                      }
                    }}
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

