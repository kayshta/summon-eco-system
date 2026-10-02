import { useQuery } from '@tanstack/react-query';
import { api } from '../../services/api';
import { toast } from 'react-toastify';

export default function QRManager() {
  const { data: classes, isLoading } = useQuery({
    queryKey: ['classes'],
    queryFn: async () => {
      const response = await api.get('/classes');
      return response.data;
    }
  });

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

  const handleGetQRValue = async (classId: number) => {
    try {
      const response = await api.get(`/classes/${classId}/qr-value`);
      const qrValue = response.data.qr_code_value;
      navigator.clipboard.writeText(qrValue);
      toast.success('QR code value copied to clipboard');
    } catch (error: any) {
      toast.error('Failed to get QR code value');
    }
  };

  if (isLoading) {
    return <div className="loading">Loading classes...</div>;
  }

  return (
    <div className="container">
      <h1>QR Code Manager</h1>
      <div className="card">
        <p style={{ marginBottom: '24px', color: '#666' }}>
          Generate and manage QR codes for each class. Teachers scan these codes to sign in to their classes.
        </p>
        <table className="table">
          <thead>
            <tr>
              <th>Class</th>
              <th>QR Code Value</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {classes?.map((cls: any) => (
              <tr key={cls.id}>
                <td><strong>{cls.class_name}</strong></td>
                <td style={{ fontFamily: 'monospace', fontSize: '12px' }}>{cls.qr_code_value}</td>
                <td>
                  <button
                    className="btn btn-primary"
                    onClick={() => handleDownloadQR(cls.id, cls.class_name)}
                    style={{ marginRight: '8px' }}
                  >
                    Download QR Image
                  </button>
                  <button
                    className="btn btn-secondary"
                    onClick={() => handleGetQRValue(cls.id)}
                  >
                    Copy QR Value
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

