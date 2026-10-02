import { useEffect, useRef, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../services/api';
import { toast } from 'react-toastify';
import MessagingConfiguration from '../../components/MessagingConfiguration';

export default function CallStudent() {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStudent, setSelectedStudent] = useState<any>(null);
  const [reason, setReason] = useState('');
  const [showMessagingConfig, setShowMessagingConfig] = useState(false);
  const messagingConfigRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();

  const { data: students, isLoading } = useQuery({
    queryKey: ['students', searchTerm],
    queryFn: async () => {
      const response = await api.get('/students', {
        params: { search: searchTerm }
      });
      return response.data;
    },
    enabled: searchTerm.length >= 2
  });

  const { data: messagingConfig } = useQuery({
    queryKey: ['messaging-config'],
    queryFn: async () => {
      const response = await api.get('/summon/messaging-config');
      return response.data;
    }
  });

  const { data: messageQuota, isLoading: quotaLoading, refetch: refetchQuota } = useQuery({
    queryKey: ['twilio-message-quota'],
    queryFn: async () => {
      const response = await api.get('/summon/message-quota');
      return response.data;
    },
    refetchInterval: 60 * 1000
  });

  useEffect(() => {
    if (window.location.hash === '#messaging-configuration' || window.location.hash === '#twilio-configuration') {
      setShowMessagingConfig(true);
    }
  }, []);

  useEffect(() => {
    if (showMessagingConfig && messagingConfigRef.current) {
      messagingConfigRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [showMessagingConfig]);

  const openMessagingConfiguration = () => {
    setShowMessagingConfig(true);
    window.location.hash = 'messaging-configuration';
  };

  const closeMessagingConfiguration = () => {
    setShowMessagingConfig(false);
    if (window.location.hash === '#messaging-configuration' || window.location.hash === '#twilio-configuration') {
      window.history.replaceState(null, '', window.location.pathname);
    }
  };

  const summonMutation = useMutation({
    mutationFn: async (data: { student_id: number; reason: string }) => {
      const response = await api.post('/summon', data);
      return response.data;
    },
    onSuccess: (data) => {
      const providerLabel = messagingConfig?.provider === 'textlink' ? 'TextLink SMS' : 'WhatsApp';
      toast.success(data.teacher_present
        ? `Student summoned! ${providerLabel} message sent to teacher.`
        : 'Summon request created. No teacher present in class.');
      setSelectedStudent(null);
      setReason('');
      setSearchTerm('');
      queryClient.invalidateQueries({ queryKey: ['summon'] });
      queryClient.invalidateQueries({ queryKey: ['twilio-message-quota'] });
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Failed to create summon request');
    }
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStudent || !reason.trim()) {
      toast.error('Please select a student and enter a reason');
      return;
    }
    summonMutation.mutate({
      student_id: selectedStudent.id,
      reason: reason.trim()
    });
  };

  const quotaTitle = messagingConfig?.provider === 'textlink'
    ? 'TextLink SMS Messages'
    : 'Twilio WhatsApp Messages';

  return (
    <div className="container">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '16px', flexWrap: 'wrap', marginBottom: '16px' }}>
        <h1 style={{ margin: 0 }}>Call Student to Head Office</h1>
        <div
          className="card"
          style={{
            margin: 0,
            padding: '12px 16px',
            minWidth: '220px',
            borderLeft: messageQuota?.lowQuota ? '4px solid #f44336' : '4px solid #4caf50'
          }}
        >
          <div style={{ fontSize: '12px', color: '#666', marginBottom: '4px' }}>{quotaTitle}</div>
          {quotaLoading ? (
            <div>Loading...</div>
          ) : messageQuota?.provider === 'textlink' ? (
            <div>
              <span className={`badge ${messageQuota.available ? 'badge-success' : 'badge-warning'}`}>
                {messageQuota.available ? 'TextLink ready' : 'Not configured'}
              </span>
              <div style={{ fontSize: '13px', marginTop: '8px', color: '#666' }}>
                {messageQuota.message}
              </div>
            </div>
          ) : messageQuota?.mockMode ? (
            <div>
              <span className="badge badge-warning">Mock mode</span>
              <div style={{ fontSize: '13px', marginTop: '6px', color: '#666' }}>No real messages sent</div>
            </div>
          ) : messageQuota?.available && messageQuota?.remaining !== null ? (
            <div>
              <div style={{ fontSize: '24px', fontWeight: 700, color: messageQuota.lowQuota ? '#f44336' : '#2e7d32' }}>
                {messageQuota.remaining} <span style={{ fontSize: '14px', fontWeight: 500, color: '#666' }}>left</span>
              </div>
              <div style={{ fontSize: '13px', color: '#666', marginTop: '4px' }}>
                {messageQuota.sent} sent of {messageQuota.limit} trial limit
              </div>
              <span className={`badge ${messageQuota.lowQuota ? 'badge-danger' : 'badge-info'}`} style={{ marginTop: '8px' }}>
                {messageQuota.accountType} account
              </span>
            </div>
          ) : messageQuota?.available ? (
            <div>
              <div style={{ fontSize: '13px', color: '#666' }}>Sent this month</div>
              <div style={{ fontSize: '24px', fontWeight: 700 }}>{messageQuota.sent}</div>
              {messageQuota.balance !== null && (
                <div style={{ fontSize: '13px', color: '#666', marginTop: '4px' }}>
                  Balance: {messageQuota.balance} {messageQuota.balanceCurrency}
                </div>
              )}
            </div>
          ) : (
            <div style={{ fontSize: '13px', color: '#c62828' }}>
              {messageQuota?.error || 'Could not load quota'}
            </div>
          )}
          <button
            type="button"
            className="btn btn-secondary"
            style={{ marginTop: '10px', padding: '4px 10px', fontSize: '12px', marginRight: '8px' }}
            onClick={openMessagingConfiguration}
          >
            Configure
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            style={{ marginTop: '10px', padding: '4px 10px', fontSize: '12px' }}
            onClick={() => refetchQuota()}
          >
            Refresh
          </button>
        </div>
      </div>

      {showMessagingConfig && (
        <div id="messaging-configuration" ref={messagingConfigRef}>
          <MessagingConfiguration onClose={closeMessagingConfiguration} />
        </div>
      )}

      <div className="card">
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Search Student</label>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by name or roll number..."
              className="form-input"
            />
            {isLoading && <p>Searching...</p>}
            {students && students.length > 0 && (
              <div style={{ marginTop: '12px', maxHeight: '200px', overflowY: 'auto', border: '1px solid #ddd', borderRadius: '4px' }}>
                {students.map((student: any) => (
                  <div
                    key={student.id}
                    onClick={() => {
                      setSelectedStudent(student);
                      setSearchTerm(`${student.name} (${student.roll_no}) - ${student.class_name}`);
                    }}
                    style={{
                      padding: '12px',
                      cursor: 'pointer',
                      borderBottom: '1px solid #eee',
                      backgroundColor: selectedStudent?.id === student.id ? '#e3f2fd' : 'white'
                    }}
                  >
                    <strong>{student.name}</strong> - Roll: {student.roll_no} - {student.class_name}
                  </div>
                ))}
              </div>
            )}
          </div>

          {selectedStudent && (
            <>
              <div className="form-group">
                <label>Selected Student</label>
                <div style={{ padding: '12px', background: '#f5f5f5', borderRadius: '4px' }}>
                  <strong>{selectedStudent.name}</strong><br />
                  Roll: {selectedStudent.roll_no} | Class: {selectedStudent.class_name} | Section: {selectedStudent.section || 'N/A'}
                </div>
              </div>

              <div className="form-group">
                <label>Reason</label>
                <textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Enter reason for calling student..."
                  className="form-input"
                  rows={4}
                  required
                />
              </div>

              <button type="submit" className="btn btn-primary" disabled={summonMutation.isPending}>
                {summonMutation.isPending ? 'Sending...' : 'Call Student'}
              </button>
            </>
          )}
        </form>
      </div>
    </div>
  );
}
