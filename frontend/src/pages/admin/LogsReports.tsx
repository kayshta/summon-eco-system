import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../services/api';
import { format } from 'date-fns';

export default function LogsReports() {
  const [activeTab, setActiveTab] = useState<'summons' | 'qr-scans'>('summons');

  const { data: summons, isLoading: summonsLoading } = useQuery({
    queryKey: ['summon'],
    queryFn: async () => {
      const response = await api.get('/summon');
      return response.data;
    },
    enabled: activeTab === 'summons'
  });

  const { data: qrLogs, isLoading: qrLogsLoading } = useQuery({
    queryKey: ['qr-scan-logs'],
    queryFn: async () => {
      const response = await api.get('/qr-scan/logs');
      return response.data;
    },
    enabled: activeTab === 'qr-scans'
  });

  return (
    <div className="container">
      <h1>Logs & Reports</h1>
      
      <div style={{ marginBottom: '24px', borderBottom: '1px solid #ddd' }}>
        <button
          className="btn"
          onClick={() => setActiveTab('summons')}
          style={{
            marginRight: '8px',
            backgroundColor: activeTab === 'summons' ? '#007bff' : '#6c757d',
            color: 'white'
          }}
        >
          Summon Requests
        </button>
        <button
          className="btn"
          onClick={() => setActiveTab('qr-scans')}
          style={{
            backgroundColor: activeTab === 'qr-scans' ? '#007bff' : '#6c757d',
            color: 'white'
          }}
        >
          QR Scan Logs
        </button>
      </div>

      {activeTab === 'summons' && (
        <div className="card">
          {summonsLoading ? (
            <div className="loading">Loading summon requests...</div>
          ) : (
            <table className="table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Student</th>
                  <th>Class</th>
                  <th>Teacher</th>
                  <th>Reason</th>
                  <th>Status</th>
                  <th>WhatsApp Status</th>
                  <th>Created</th>
                </tr>
              </thead>
              <tbody>
                {summons?.map((summon: any) => (
                  <tr key={summon.id}>
                    <td>{summon.id}</td>
                    <td>{summon.student_name} (Roll: {summon.roll_no})</td>
                    <td>{summon.class_name}</td>
                    <td>{summon.teacher_name || 'N/A'}</td>
                    <td>{summon.reason}</td>
                    <td>
                      <span className={`badge badge-${summon.status === 'arrived' ? 'success' : summon.status === 'acknowledged' ? 'info' : 'warning'}`}>
                        {summon.status}
                      </span>
                    </td>
                    <td>
                      {(summon.whatsapp_delivery_status === 'failed' || summon.whatsapp_delivery_status === 'needs_setup') && 
                       !summon.teacher_phone_verified ? (
                        <span style={{ color: '#ff9800' }} title="Teacher needs to join WhatsApp sandbox">
                          Needs Setup
                        </span>
                      ) : summon.whatsapp_delivery_status === 'failed' ? (
                        <span style={{ color: '#d32f2f' }}>Failed</span>
                      ) : summon.whatsapp_delivery_status === 'sent' ? (
                        <span style={{ color: '#2e7d32' }}>Sent</span>
                      ) : summon.whatsapp_delivery_status === 'needs_setup' ? (
                        <span style={{ color: '#ff9800' }}>Needs Setup</span>
                      ) : (
                        summon.whatsapp_delivery_status || 'N/A'
                      )}
                    </td>
                    <td>{format(new Date(summon.created_at), 'MMM dd, yyyy HH:mm')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {activeTab === 'qr-scans' && (
        <div className="card">
          {qrLogsLoading ? (
            <div className="loading">Loading QR scan logs...</div>
          ) : (
            <table className="table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Teacher</th>
                  <th>Class</th>
                  <th>Scanned At</th>
                  <th>Token</th>
                </tr>
              </thead>
              <tbody>
                {qrLogs?.map((log: any) => (
                  <tr key={log.id}>
                    <td>{log.id}</td>
                    <td>{log.teacher_name}</td>
                    <td>{log.class_name}</td>
                    <td>{format(new Date(log.scanned_at), 'MMM dd, yyyy HH:mm:ss')}</td>
                    <td style={{ fontFamily: 'monospace', fontSize: '11px' }}>{log.scan_token?.substring(0, 20)}...</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}

