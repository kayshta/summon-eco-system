import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { api } from '../services/api';
import { toast } from 'react-toastify';

interface StudentImportProps {
  onClose: () => void;
}

export default function StudentImport({ onClose }: StudentImportProps) {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<any>(null);
  const [options, setOptions] = useState({
    add_new: true,
    update_existing: true,
    verify_all: false
  });

  const previewMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append('file', file);
      const response = await api.post('/import/preview', formData);
      return response.data;
    },
    onSuccess: (data) => {
      setPreview(data);
      if (!data.validation.valid) {
        toast.warning('Validation errors found. Please review before importing.');
      }
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Failed to preview file');
    }
  });

  const importMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('add_new', options.add_new.toString());
      formData.append('update_existing', options.update_existing.toString());
      formData.append('verify_all', options.verify_all.toString());
      const response = await api.post('/import/students', formData);
      return response.data;
    },
    onSuccess: (data) => {
      toast.success(`Import complete! Added: ${data.summary.added}, Updated: ${data.summary.updated}, Skipped: ${data.summary.skipped}`);
      onClose();
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Failed to import students');
    }
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      previewMutation.mutate(selectedFile);
    }
  };

  const handleImport = () => {
    if (!file) {
      toast.error('Please select a file');
      return;
    }
    if (preview && !preview.validation.valid) {
      toast.error('Please fix validation errors before importing');
      return;
    }
    importMutation.mutate(file);
  };

  return (
    <div className="card" style={{ marginBottom: '24px' }}>
      <h2>Import Students from Excel/CSV</h2>
      <p style={{ marginBottom: '16px', color: '#666' }}>
        Expected columns: name, roll_no, class_name, section, dob, phone, guardian_name, guardian_phone
      </p>

      <div className="form-group">
        <label>Select File</label>
        <input
          type="file"
          accept=".xlsx,.xls,.csv"
          onChange={handleFileChange}
          className="form-input"
        />
      </div>

      {preview && (
        <>
          <div className="form-group">
            <label>
              <input
                type="checkbox"
                checked={options.add_new}
                onChange={(e) => setOptions({ ...options, add_new: e.target.checked })}
              />
              {' '}Add new students
            </label>
          </div>
          <div className="form-group">
            <label>
              <input
                type="checkbox"
                checked={options.update_existing}
                onChange={(e) => setOptions({ ...options, update_existing: e.target.checked })}
              />
              {' '}Update existing students (by roll_no + class)
            </label>
          </div>
          <div className="form-group">
            <label>
              <input
                type="checkbox"
                checked={options.verify_all}
                onChange={(e) => setOptions({ ...options, verify_all: e.target.checked })}
              />
              {' '}Mark all as verified (set last_verified_at)
            </label>
          </div>

          <div style={{ marginTop: '16px' }}>
            <p><strong>Total Rows:</strong> {preview.total_rows}</p>
            {preview.validation.errors.length > 0 && (
              <div className="error" style={{ marginTop: '12px' }}>
                <strong>Validation Errors ({preview.validation.errors.length}):</strong>
                <ul style={{ marginTop: '8px', paddingLeft: '20px' }}>
                  {preview.validation.errors.slice(0, 10).map((err: any, idx: number) => (
                    <li key={idx}>Row {err.row}: {err.error}</li>
                  ))}
                  {preview.validation.errors.length > 10 && (
                    <li>... and {preview.validation.errors.length - 10} more errors</li>
                  )}
                </ul>
              </div>
            )}
          </div>

          {preview.preview && preview.preview.length > 0 && (
            <div style={{ marginTop: '16px' }}>
              <h3>Preview (first 10 rows):</h3>
              <table className="table">
                <thead>
                  <tr>
                    {Object.keys(preview.preview[0]).map((key) => (
                      <th key={key}>{key}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {preview.preview.map((row: any, idx: number) => (
                    <tr key={idx}>
                      {Object.values(row).map((val: any, i: number) => (
                        <td key={i}>{val}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div style={{ marginTop: '16px', display: 'flex', gap: '8px' }}>
            <button
              className="btn btn-primary"
              onClick={handleImport}
              disabled={!preview.validation.valid || importMutation.isPending}
            >
              {importMutation.isPending ? 'Importing...' : 'Import Students'}
            </button>
            <button className="btn btn-secondary" onClick={onClose}>
              Cancel
            </button>
          </div>
        </>
      )}
    </div>
  );
}

