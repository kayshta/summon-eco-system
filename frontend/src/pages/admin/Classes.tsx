import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../services/api';
import { toast } from 'react-toastify';

export default function AdminClasses() {
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({ class_name: '' });
  const queryClient = useQueryClient();

  const { data: classes, isLoading } = useQuery({
    queryKey: ['classes'],
    queryFn: async () => {
      const response = await api.get('/classes');
      return response.data;
    }
  });

  const createMutation = useMutation({
    mutationFn: async (data: { class_name: string }) => {
      const response = await api.post('/classes', data);
      return response.data;
    },
    onSuccess: () => {
      toast.success('Class created successfully');
      setShowForm(false);
      setFormData({ class_name: '' });
      queryClient.invalidateQueries({ queryKey: ['classes'] });
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Failed to create class');
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await api.delete(`/classes/${id}`);
    },
    onSuccess: () => {
      toast.success('Class deleted successfully');
      queryClient.invalidateQueries({ queryKey: ['classes'] });
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Failed to delete class');
    }
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createMutation.mutate(formData);
  };

  const handleDownloadQR = async (classId: number, className: string) => {
    try {
      const response = await api.get(`/classes/${classId}/qr-code`, {
        responseType: 'blob'
      });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `qr_${className}.png`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      toast.success('QR code downloaded');
    } catch (error: any) {
      toast.error('Failed to download QR code');
    }
  };

  if (isLoading) {
    return <div className="loading">Loading classes...</div>;
  }

  return (
    <div className="container">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <h1>Classes</h1>
        <button className="btn btn-primary" onClick={() => setShowForm(!showForm)}>
          {showForm ? 'Cancel' : 'Add Class'}
        </button>
      </div>

      {showForm && (
        <div className="card">
          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label>Class Name</label>
              <input
                type="text"
                value={formData.class_name}
                onChange={(e) => setFormData({ class_name: e.target.value })}
                placeholder="e.g., 1A, 2B, 3C"
                className="form-input"
                required
              />
            </div>
            <button type="submit" className="btn btn-primary" disabled={createMutation.isPending}>
              {createMutation.isPending ? 'Creating...' : 'Create Class'}
            </button>
          </form>
        </div>
      )}

      <div className="card">
        <table className="table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Class Name</th>
              <th>QR Code Value</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {classes?.map((cls: any) => (
              <tr key={cls.id}>
                <td>{cls.id}</td>
                <td>{cls.class_name}</td>
                <td style={{ fontFamily: 'monospace', fontSize: '12px' }}>{cls.qr_code_value}</td>
                <td>
                  <button
                    className="btn btn-success"
                    onClick={() => handleDownloadQR(cls.id, cls.class_name)}
                    style={{ marginRight: '8px' }}
                  >
                    Download QR
                  </button>
                  <button
                    className="btn btn-danger"
                    onClick={() => {
                      if (window.confirm('Are you sure you want to delete this class?')) {
                        deleteMutation.mutate(cls.id);
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

