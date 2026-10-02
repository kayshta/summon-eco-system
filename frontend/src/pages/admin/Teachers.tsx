import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../services/api';
import { toast } from 'react-toastify';
import { countryCodes, extractCountryCode, combinePhoneNumber } from '../../utils/countryCodes';

export default function AdminTeachers() {
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    countryCode: '+91',
    phone_number: '',
    password: ''
  });
  const [verifyingId, setVerifyingId] = useState<number | null>(null);
  const [showSandboxInfo, setShowSandboxInfo] = useState(false);
  const [sandboxInfo, setSandboxInfo] = useState<any>(null);
  const queryClient = useQueryClient();

  const { data: teachers, isLoading } = useQuery({
    queryKey: ['teachers'],
    queryFn: async () => {
      const response = await api.get('/teachers');
      return response.data;
    }
  });

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      // Combine country code and phone number
      const fullPhoneNumber = combinePhoneNumber(data.countryCode, data.phone_number);
      const response = await api.post('/teachers', {
        ...data,
        phone_number: fullPhoneNumber
      });
      return response.data;
    },
    onSuccess: () => {
      toast.success('Teacher created successfully');
      setShowForm(false);
      setFormData({ name: '', email: '', countryCode: '+91', phone_number: '', password: '' });
      queryClient.invalidateQueries({ queryKey: ['teachers'] });
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Failed to create teacher');
    }
  });

  const verifyMutation = useMutation({
    mutationFn: async (teacherId: number) => {
      const response = await api.post(`/teachers/${teacherId}/verify-whatsapp`);
      return response.data;
    },
    onSuccess: (data) => {
      if (data.verified) {
        toast.success('WhatsApp number verified successfully!');
      } else {
        if (data.needsSandboxJoin) {
          // Show informative message based on status
          if (data.status === 'invitation_sent') {
            toast.success('Join invitation sent to teacher via WhatsApp!', {
              autoClose: 8000
            });
          } else if (data.status === 'needs_setup') {
            toast.info('Teacher needs to join WhatsApp sandbox first. See instructions below.', {
              autoClose: 12000
            });
          } else {
            toast.warning('Teacher needs to join WhatsApp sandbox!', {
              autoClose: 10000
            });
          }
          setSandboxInfo(data.sandboxInfo);
          setShowSandboxInfo(true);
          
          // Log manual instructions if invitation couldn't be sent
          if (data.manualInstructions && !data.joinMessageSent) {
            console.log('Manual instructions for teacher:', data.manualInstructions);
          }
        } else {
          toast.warning(data.message || 'WhatsApp number could not be verified.');
        }
      }
      queryClient.invalidateQueries({ queryKey: ['teachers'] });
      setVerifyingId(null);
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Failed to verify WhatsApp number');
      setVerifyingId(null);
    }
  });

  const { data: sandboxInfoData } = useQuery({
    queryKey: ['whatsapp-sandbox-info'],
    queryFn: async () => {
      const response = await api.get('/teachers/whatsapp-sandbox-info');
      return response.data;
    },
    enabled: false
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await api.delete(`/teachers/${id}`);
    },
    onSuccess: () => {
      toast.success('Teacher deleted successfully');
      queryClient.invalidateQueries({ queryKey: ['teachers'] });
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Failed to delete teacher');
    }
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createMutation.mutate(formData);
  };

  if (isLoading) {
    return <div className="loading">Loading teachers...</div>;
  }

  return (
    <div className="container">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <h1>Teachers</h1>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button 
            className="btn btn-secondary" 
            onClick={async () => {
              try {
                const response = await api.get('/teachers/whatsapp-sandbox-info');
                setSandboxInfo(response.data);
                setShowSandboxInfo(true);
              } catch (error: any) {
                toast.error('Failed to get sandbox information');
              }
            }}
          >
            WhatsApp Setup Help
          </button>
          <button className="btn btn-primary" onClick={() => setShowForm(!showForm)}>
            {showForm ? 'Cancel' : 'Add Teacher'}
          </button>
        </div>
      </div>

      {showSandboxInfo && sandboxInfo && (
        <div className="card" style={{ marginBottom: '24px', backgroundColor: '#f0f8ff', border: '1px solid #4CAF50' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
            <div>
              <h3 style={{ marginTop: 0, color: '#2c3e50' }}>📱 WhatsApp Sandbox Setup Instructions</h3>
              <p style={{ color: '#555', marginBottom: '12px' }}>
                <strong>Important:</strong> Each teacher must join the Twilio WhatsApp sandbox to receive messages.
              </p>
              <div style={{ backgroundColor: 'white', padding: '16px', borderRadius: '4px', marginBottom: '12px' }}>
                <p><strong>Sandbox Number:</strong> {sandboxInfo.sandboxNumber || 'Not configured'}</p>
                <p style={{ marginTop: '12px', lineHeight: '1.6' }}>
                  <strong>How to Join:</strong>
                </p>
                <ol style={{ marginLeft: '20px', lineHeight: '1.8' }}>
                  <li>Open your <a href="https://console.twilio.com/" target="_blank" rel="noopener noreferrer">Twilio Console</a></li>
                  <li>Go to <strong>Messaging</strong> → <strong>Try it out</strong> → <strong>Send a WhatsApp message</strong></li>
                  <li>You'll see a join code (e.g., "join abc-xyz")</li>
                  <li>Send this code to <strong>{sandboxInfo.sandboxNumber || 'the sandbox number'}</strong> from your WhatsApp</li>
                  <li>Twilio will confirm you've joined the sandbox</li>
                  <li>After joining, you can receive messages from the system</li>
                </ol>
              </div>
              <p style={{ color: '#d32f2f', fontWeight: 'bold' }}>
                ⚠️ Only teachers who have joined the sandbox will receive WhatsApp messages!
              </p>
            </div>
            <button 
              onClick={() => setShowSandboxInfo(false)}
              style={{ 
                background: 'none', 
                border: 'none', 
                fontSize: '20px', 
                cursor: 'pointer',
                color: '#666'
              }}
            >
              ×
            </button>
          </div>
        </div>
      )}

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
              <label>Email</label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="form-input"
                required
              />
            </div>
            <div className="form-group">
              <label>Phone Number (WhatsApp)</label>
              <div style={{ display: 'flex', gap: '8px' }}>
                <select
                  value={formData.countryCode}
                  onChange={(e) => setFormData({ ...formData, countryCode: e.target.value })}
                  style={{ 
                    padding: '8px 12px', 
                    border: '1px solid #ddd', 
                    borderRadius: '4px',
                    minWidth: '150px'
                  }}
                >
                  {countryCodes.map((country) => (
                    <option key={country.code} value={country.code}>
                      {country.flag} {country.code} ({country.country})
                    </option>
                  ))}
                </select>
                <input
                  type="tel"
                  value={formData.phone_number}
                  onChange={(e) => setFormData({ ...formData, phone_number: e.target.value })}
                  className="form-input"
                  placeholder="Enter phone number without country code"
                  style={{ flex: 1 }}
                  required
                />
              </div>
              <small style={{ color: '#666', marginTop: '4px', display: 'block' }}>
                Full number: {combinePhoneNumber(formData.countryCode, formData.phone_number)}
              </small>
            </div>
            <div className="form-group">
              <label>Password</label>
              <input
                type="password"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                className="form-input"
                required
              />
            </div>
            <button type="submit" className="btn btn-primary" disabled={createMutation.isPending}>
              {createMutation.isPending ? 'Creating...' : 'Create Teacher'}
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
              <th>Email</th>
              <th>Phone</th>
              <th>Verified</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {teachers?.map((teacher: any) => {
              const { code, number } = extractCountryCode(teacher.phone_number || '');
              return (
                <tr key={teacher.id}>
                  <td>{teacher.id}</td>
                  <td>{teacher.name}</td>
                  <td>{teacher.email}</td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span>{code}</span>
                      <span>{number || teacher.phone_number}</span>
                    </div>
                  </td>
                  <td>
                    {teacher.phone_verified ? (
                      <span style={{ color: 'green', fontWeight: 'bold' }}>✓ Verified</span>
                    ) : (
                      <span style={{ color: 'red' }}>✗ Not Verified</span>
                    )}
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                      <button
                        className="btn btn-secondary"
                        onClick={() => {
                          setVerifyingId(teacher.id);
                          verifyMutation.mutate(teacher.id);
                        }}
                        disabled={verifyingId === teacher.id || !teacher.phone_number}
                        style={{ fontSize: '12px', padding: '6px 12px' }}
                        title={!teacher.phone_verified ? 'Verify if teacher can receive WhatsApp messages' : 'Re-verify WhatsApp number'}
                      >
                        {verifyingId === teacher.id ? 'Verifying...' : teacher.phone_verified ? 'Re-verify' : 'Verify WhatsApp'}
                      </button>
                      {!teacher.phone_verified && teacher.phone_number && (
                        <span style={{ 
                          fontSize: '11px', 
                          color: '#d32f2f', 
                          padding: '4px 8px',
                          backgroundColor: '#ffebee',
                          borderRadius: '4px',
                          display: 'inline-block'
                        }}>
                          Needs Sandbox Join
                        </span>
                      )}
                      <button
                        className="btn btn-danger"
                        onClick={() => {
                          if (window.confirm('Are you sure you want to delete this teacher?')) {
                            deleteMutation.mutate(teacher.id);
                          }
                        }}
                        style={{ fontSize: '12px', padding: '6px 12px' }}
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

