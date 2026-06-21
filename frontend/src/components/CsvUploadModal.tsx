import React, { useState } from 'react';
import { CheckCircle2, Upload } from 'lucide-react';

interface UploadResponse {
  message: string;
  total_rows: number;
  successful_records: number;
  errors: string[];
}

interface CsvUploadModalProps {
  open: boolean;
  onClose: () => void;
  onUploadComplete?: () => void;
}

export const CsvUploadModal: React.FC<CsvUploadModalProps> = ({ open, onClose, onUploadComplete }) => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadLoading, setUploadLoading] = useState(false);
  const [uploadResult, setUploadResult] = useState<UploadResponse | null>(null);
  const [errorMessage, setErrorMessage] = useState('');

  const token = localStorage.getItem('token');

  const resetAndClose = () => {
    setUploadResult(null);
    setSelectedFile(null);
    setErrorMessage('');
    onClose();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedFile(e.target.files[0]);
      setErrorMessage('');
      setUploadResult(null);
    }
  };

  const handleUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile) return;

    setUploadLoading(true);
    setErrorMessage('');
    setUploadResult(null);

    const formData = new FormData();
    formData.append('file', selectedFile);

    try {
      const res = await fetch('/api/students/upload', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.detail || 'Upload failed');
      }

      const data: UploadResponse = await res.json();
      setUploadResult(data);
      setSelectedFile(null);
      onUploadComplete?.();
    } catch (err: any) {
      setErrorMessage(err.message || 'Connection error occurred during upload.');
    } finally {
      setUploadLoading(false);
    }
  };

  if (!open) return null;

  return (
    <div className="modal-overlay">
      <div className="modal-content" style={{ maxWidth: '560px' }}>
        <div className="modal-header">
          <h3 style={{ color: 'white', fontSize: '20px' }}>Upload & Validate Dataset</h3>
          <button
            onClick={resetAndClose}
            style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', fontSize: '20px', cursor: 'pointer' }}
          >
            &times;
          </button>
        </div>

        {!uploadResult ? (
          <form onSubmit={handleUploadSubmit}>
            <p style={{ color: 'var(--text-muted)', fontSize: '13px', marginBottom: '20px', lineHeight: 1.5 }}>
              Select a CSV dataset to import student grades and attendance. The system will validate the schema, clean empty spaces, clamp out-of-range numerical values, and flag format issues.
            </p>

            <div className="form-group" style={{ marginBottom: '24px' }}>
              <div
                style={{
                  border: '2px dashed var(--border-glass)',
                  borderRadius: '12px',
                  padding: '30px',
                  textAlign: 'center',
                  cursor: 'pointer',
                  background: 'rgba(255, 255, 255, 0.01)',
                  transition: 'var(--transition-smooth)'
                }}
                onDragOver={(e) => e.preventDefault()}
                onClick={() => document.getElementById('file-input')?.click()}
              >
                <input
                  id="file-input"
                  type="file"
                  accept=".csv,text/csv"
                  style={{ display: 'none' }}
                  onChange={handleFileChange}
                />
                <Upload size={32} style={{ color: 'var(--primary)', marginBottom: '12px', opacity: 0.7 }} />
                <p style={{ color: 'var(--text-main)', fontSize: '14px', fontWeight: 500 }}>
                  {selectedFile ? selectedFile.name : 'Click to select CSV file'}
                </p>
                <p style={{ color: 'var(--text-muted)', fontSize: '11px', marginTop: '6px' }}>
                  Required columns: student_id, name, email, semester, subject, grade, attendance, engagement_score
                </p>
              </div>
            </div>

            {errorMessage && (
              <div style={{
                background: 'var(--danger-bg)',
                border: '1px solid rgba(244, 63, 94, 0.2)',
                borderRadius: '8px',
                color: 'var(--danger)',
                fontSize: '13px',
                padding: '12px',
                marginBottom: '20px'
              }}>
                {errorMessage}
              </div>
            )}

            <div className="modal-actions">
              <button type="button" className="btn-secondary" onClick={resetAndClose}>
                Cancel
              </button>
              <button type="submit" className="btn-primary" disabled={!selectedFile || uploadLoading} id="submit-csv-btn">
                {uploadLoading ? 'Processing...' : 'Upload & Clean'}
              </button>
            </div>
          </form>
        ) : (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '20px' }}>
              <CheckCircle2 size={24} style={{ color: 'var(--success)' }} />
              <h4 style={{ color: 'white', fontSize: '16px' }}>Processing Complete</h4>
            </div>

            <div style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: '16px',
              marginBottom: '24px',
              background: 'rgba(255,255,255,0.02)',
              padding: '16px',
              borderRadius: '8px'
            }}>
              <div>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>TOTAL RECORDS FOUND</div>
                <div style={{ fontSize: '20px', fontWeight: 'bold', color: 'white' }}>{uploadResult.total_rows}</div>
              </div>
              <div>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>IMPORTED RECORDS</div>
                <div style={{ fontSize: '20px', fontWeight: 'bold', color: 'var(--success)' }}>{uploadResult.successful_records}</div>
              </div>
            </div>

            <h5 style={{ color: 'white', fontSize: '14px', marginBottom: '10px' }}>Data Cleaning & Validation Logs:</h5>
            <div style={{
              background: '#060511',
              border: '1px solid var(--border-glass)',
              borderRadius: '8px',
              padding: '12px',
              maxHeight: '180px',
              overflowY: 'auto',
              fontFamily: 'monospace',
              fontSize: '11px',
              color: 'var(--text-muted)',
              lineHeight: 1.4
            }}>
              {uploadResult.errors.length === 0 ? (
                <div style={{ color: 'var(--success)' }}>Dataset is clean. No validation anomalies or adjustments needed.</div>
              ) : (
                uploadResult.errors.map((err, i) => (
                  <div key={i} style={{ marginBottom: '4px', color: err.includes('skipped') ? 'var(--danger)' : 'var(--warning)' }}>
                    - {err}
                  </div>
                ))
              )}
            </div>

            <div className="modal-actions">
              <button className="btn-primary" onClick={resetAndClose}>
                Done
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
