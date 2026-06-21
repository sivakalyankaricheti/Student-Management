import React, { useEffect, useState } from 'react';
import { Upload, FileSpreadsheet, RefreshCw, AlertCircle, CheckCircle2, Calendar, ClipboardCheck } from 'lucide-react';

interface Student {
  id: number;
  student_id_str: string;
  name: string;
  email: string;
  semester: number;
  attendance: number;
  engagement_score: number;
  performance_analysis?: {
    risk_score: number;
    risk_level: string;
    trend_data: string;
  };
}

interface Subject {
  id: number;
  name: string;
  semester: number;
}

interface UploadResponse {
  message: string;
  total_rows: number;
  successful_records: number;
  errors: string[];
}

export const TeacherDashboard: React.FC = () => {
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Tab control
  const [activeSubTab, setActiveSubTab] = useState<'registry' | 'attendance'>('registry');

  // CSV upload state
  const [uploadOpen, setUploadOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadLoading, setUploadLoading] = useState(false);
  const [uploadResult, setUploadResult] = useState<UploadResponse | null>(null);
  const [errorMessage, setErrorMessage] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  // Attendance logging state
  const [assignedSubjects, setAssignedSubjects] = useState<Subject[]>([]);
  const [selectedSubjectId, setSelectedSubjectId] = useState<string>('');
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [enrolledStudents, setEnrolledStudents] = useState<Student[]>([]);
  const [attendanceSheet, setAttendanceSheet] = useState<Record<number, 'Present' | 'Absent'>>({});
  const [attendanceLoading, setAttendanceLoading] = useState(false);
  const [attendanceError, setAttendanceError] = useState('');
  const [attendanceSuccess, setAttendanceSuccess] = useState('');

  const token = localStorage.getItem('token');

  const fetchStudents = async () => {
    try {
      const res = await fetch('/api/students', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setStudents(data);
      }
    } catch (err) {
      console.error('Failed to load students', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchAssignedSubjects = async () => {
    try {
      const res = await fetch('/api/teacher/my-subjects', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setAssignedSubjects(data);
        if (data.length > 0) {
          setSelectedSubjectId(data[0].id.toString());
        }
      }
    } catch (err) {
      console.error('Failed to load assigned subjects', err);
    }
  };

  const fetchEnrolledStudents = async (subjId: string) => {
    if (!subjId) return;
    try {
      const res = await fetch(`/api/teacher/subjects/${subjId}/students`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setEnrolledStudents(data);
        
        // Initialize attendance sheet with 'Present' for all students
        const initialSheet: Record<number, 'Present' | 'Absent'> = {};
        data.forEach((s: Student) => {
          initialSheet[s.id] = 'Present';
        });
        setAttendanceSheet(initialSheet);
      }
    } catch (err) {
      console.error('Failed to load enrolled students', err);
    }
  };

  useEffect(() => {
    fetchStudents();
    fetchAssignedSubjects();
  }, []);

  // Fetch students whenever the active subject selection changes
  useEffect(() => {
    if (selectedSubjectId) {
      fetchEnrolledStudents(selectedSubjectId);
    }
  }, [selectedSubjectId]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchStudents();
    setRefreshing(false);
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
      fetchStudents();
    } catch (err: any) {
      setErrorMessage(err.message || 'Connection error occurred during upload.');
    } finally {
      setUploadLoading(false);
    }
  };

  const handleAttendanceToggle = (studentId: number, status: 'Present' | 'Absent') => {
    setAttendanceSheet(prev => ({
      ...prev,
      [studentId]: status
    }));
  };

  const handleAttendanceSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSubjectId) return;

    setAttendanceLoading(true);
    setAttendanceError('');
    setAttendanceSuccess('');

    const records = Object.entries(attendanceSheet).map(([sId, status]) => ({
      student_id: parseInt(sId),
      status
    }));

    try {
      const res = await fetch('/api/teacher/attendance', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          subject_id: parseInt(selectedSubjectId),
          date: selectedDate,
          records
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.detail || 'Failed to submit attendance');
      }

      setAttendanceSuccess('Attendance registry saved and overall student stats re-calculated successfully!');
      // Refresh registry view
      fetchStudents();
    } catch (err: any) {
      setAttendanceError(err.message);
    } finally {
      setAttendanceLoading(false);
    }
  };

  return (
    <div>
      <div className="section-title" style={{ marginBottom: '16px' }}>
        <div>
          <h2 style={{ fontSize: '28px', color: 'white' }}>Academic Records & Dashboard</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '14px', marginTop: '4px' }}>
            Upload semester datasets, clean validation anomalies, and log daily attendance metrics.
          </p>
        </div>
        {activeSubTab === 'registry' && (
          <div style={{ display: 'flex', gap: '12px' }}>
            <button className="btn-secondary" onClick={handleRefresh} disabled={refreshing}>
              <RefreshCw size={16} className={refreshing ? 'spin-anim' : ''} /> {refreshing ? 'Analyzing...' : 'Re-Run Analytics'}
            </button>
            <button className="btn-primary" onClick={() => setUploadOpen(true)} id="upload-csv-btn">
              <Upload size={18} /> Upload Student CSV
            </button>
          </div>
        )}
      </div>

      {/* Sub Tabs Selection */}
      <div style={{ display: 'flex', gap: '16px', marginBottom: '24px', borderBottom: '1px solid var(--border-glass)', paddingBottom: '10px' }}>
        <button
          onClick={() => setActiveSubTab('registry')}
          style={{
            background: 'transparent',
            border: 'none',
            color: activeSubTab === 'registry' ? 'white' : 'var(--text-muted)',
            fontSize: '15px',
            fontWeight: 600,
            cursor: 'pointer',
            padding: '4px 8px',
            borderBottom: activeSubTab === 'registry' ? '2px solid var(--primary)' : 'none',
            transition: 'var(--transition-smooth)'
          }}
        >
          Performance Registry
        </button>
        <button
          onClick={() => setActiveSubTab('attendance')}
          style={{
            background: 'transparent',
            border: 'none',
            color: activeSubTab === 'attendance' ? 'white' : 'var(--text-muted)',
            fontSize: '15px',
            fontWeight: 600,
            cursor: 'pointer',
            padding: '4px 8px',
            borderBottom: activeSubTab === 'attendance' ? '2px solid var(--primary)' : 'none',
            transition: 'var(--transition-smooth)'
          }}
          id="tab-attendance"
        >
          Log Course Attendance
        </button>
      </div>

      {activeSubTab === 'registry' ? (
        /* Original Performance Registry View */
        <div className="glass-card">
          <div style={{ display: 'flex', alignItems: 'center', justifyItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <FileSpreadsheet size={20} style={{ color: 'var(--primary)' }} />
              <h3 style={{ color: 'white', fontSize: '18px' }}>Performance Registry</h3>
            </div>
            <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
              Showing {students.length} students
            </span>
          </div>

          {loading ? (
            <p style={{ color: 'var(--text-muted)' }}>Loading student records...</p>
          ) : students.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 20px' }}>
              <AlertCircle size={40} style={{ color: 'var(--text-muted)', marginBottom: '12px' }} />
              <p style={{ color: 'var(--text-muted)', fontSize: '14px' }}>
                No student records loaded. Click 'Upload Student CSV' to import a dataset.
              </p>
            </div>
          ) : (
            <div className="table-container">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Student ID</th>
                    <th>Name</th>
                    <th>Semester</th>
                    <th>Attendance</th>
                    <th>Engagement</th>
                    <th>Status Profile</th>
                    <th>Trend</th>
                  </tr>
                </thead>
                <tbody>
                  {students.map((student) => {
                    const riskLevel = student.performance_analysis?.risk_level || 'Low';
                    const trend = student.performance_analysis?.trend_data || 'Stable';
                    
                    return (
                      <tr key={student.id}>
                        <td style={{ fontFamily: 'monospace', fontWeight: 600 }}>{student.student_id_str}</td>
                        <td>
                          <div style={{ fontWeight: 600, color: 'white' }}>{student.name}</div>
                          <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{student.email}</div>
                        </td>
                        <td>Sem {student.semester}</td>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <div style={{
                              width: '48px',
                              height: '4px',
                              background: 'rgba(255,255,255,0.1)',
                              borderRadius: '2px',
                              overflow: 'hidden'
                            }}>
                              <div style={{
                                width: `${student.attendance}%`,
                                height: '100%',
                                background: student.attendance < 75 ? 'var(--danger)' : 'var(--primary)'
                              }} />
                            </div>
                            <span style={{ fontSize: '13px' }}>{student.attendance.toFixed(1)}%</span>
                          </div>
                        </td>
                        <td>
                          <span style={{
                            padding: '2px 6px',
                            borderRadius: '4px',
                            fontSize: '12px',
                            background: 'rgba(99, 102, 241, 0.08)',
                            color: 'var(--primary)',
                            fontWeight: 500
                          }}>{student.engagement_score.toFixed(1)}/10</span>
                        </td>
                        <td>
                          <span className={`badge badge-${riskLevel.toLowerCase()}`}>
                            {riskLevel} Risk
                          </span>
                        </td>
                        <td>
                          <span style={{
                            fontSize: '13px',
                            color: trend === 'Improving' ? 'var(--success)' : (trend === 'Declining' ? 'var(--danger)' : 'var(--text-muted)'),
                            fontWeight: 500
                          }}>
                            {trend}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : (
        /* Daily Course Attendance Logging View */
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          
          {(attendanceError || attendanceSuccess) && (
            <div style={{
              padding: '16px',
              borderRadius: '8px',
              fontSize: '14px',
              textAlign: 'center',
              background: attendanceError ? 'var(--danger-bg)' : 'var(--success-bg)',
              color: attendanceError ? 'var(--danger)' : 'var(--success)',
              border: `1px solid ${attendanceError ? 'rgba(244, 63, 94, 0.2)' : 'rgba(16, 185, 129, 0.2)'}`
            }}>
              {attendanceError || attendanceSuccess}
            </div>
          )}

          <div className="dashboard-grid" style={{ gridTemplateColumns: '1.2fr 2fr' }}>
            {/* Left selector panel */}
            <div className="glass-card" style={{ height: 'fit-content' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '20px' }}>
                <Calendar size={20} style={{ color: 'var(--primary)' }} />
                <h3 style={{ color: 'white', fontSize: '18px' }}>Sheet Configuration</h3>
              </div>

              <div className="form-group" style={{ marginBottom: '16px' }}>
                <label>Select Allocated Subject</label>
                <select
                  value={selectedSubjectId}
                  onChange={(e) => {
                    setSelectedSubjectId(e.target.value);
                    setAttendanceSuccess('');
                    setAttendanceError('');
                  }}
                  id="subject-select"
                >
                  <option value="">-- Choose Course --</option>
                  {assignedSubjects.map((subj) => (
                    <option key={subj.id} value={subj.id.toString()}>
                      {subj.name} (Semester {subj.semester})
                    </option>
                  ))}
                </select>
                {assignedSubjects.length === 0 && (
                  <p style={{ color: 'var(--danger)', fontSize: '12px', marginTop: '6px' }}>
                    You have not been assigned any curriculum subjects by the Admin.
                  </p>
                )}
              </div>

              <div className="form-group">
                <label>Select Calendar Date</label>
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => {
                    setSelectedDate(e.target.value);
                    setAttendanceSuccess('');
                    setAttendanceError('');
                  }}
                  id="attendance-date"
                />
              </div>
            </div>

            {/* Right student checklist panel */}
            <div className="glass-card">
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '20px' }}>
                <ClipboardCheck size={20} style={{ color: 'var(--primary)' }} />
                <h3 style={{ color: 'white', fontSize: '18px' }}>Student Roll Sheet</h3>
              </div>

              {!selectedSubjectId ? (
                <p style={{ color: 'var(--text-muted)', fontSize: '14px', textAlign: 'center', padding: '30px' }}>
                  Please select one of your allocated subjects on the left panel to display the roll sheet.
                </p>
              ) : enrolledStudents.length === 0 ? (
                <p style={{ color: 'var(--text-muted)', fontSize: '14px', textAlign: 'center', padding: '30px' }}>
                  No students are enrolled in this subject yet. Students can select this course on their dashboard.
                </p>
              ) : (
                <form onSubmit={handleAttendanceSubmit}>
                  <div className="table-container" style={{ marginBottom: '20px' }}>
                    <table className="data-table" id="attendance-roll-table">
                      <thead>
                        <tr>
                          <th>Student Name</th>
                          <th>Student ID</th>
                          <th style={{ textAlign: 'center' }}>Present</th>
                          <th style={{ textAlign: 'center' }}>Absent</th>
                        </tr>
                      </thead>
                      <tbody>
                        {enrolledStudents.map((s) => (
                          <tr key={s.id}>
                            <td>
                              <div style={{ fontWeight: 600, color: 'white' }}>{s.name}</div>
                              <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{s.email}</div>
                            </td>
                            <td style={{ fontFamily: 'monospace' }}>{s.student_id_str}</td>
                            <td style={{ textAlign: 'center' }}>
                              <input
                                type="radio"
                                name={`att-${s.id}`}
                                value="Present"
                                checked={attendanceSheet[s.id] === 'Present'}
                                onChange={() => handleAttendanceToggle(s.id, 'Present')}
                                style={{ accentColor: 'var(--success)', width: '16px', height: '16px', cursor: 'pointer' }}
                              />
                            </td>
                            <td style={{ textAlign: 'center' }}>
                              <input
                                type="radio"
                                name={`att-${s.id}`}
                                value="Absent"
                                checked={attendanceSheet[s.id] === 'Absent'}
                                onChange={() => handleAttendanceToggle(s.id, 'Absent')}
                                style={{ accentColor: 'var(--danger)', width: '16px', height: '16px', cursor: 'pointer' }}
                              />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                    <button
                      type="submit"
                      disabled={attendanceLoading}
                      className="btn-primary"
                      id="save-attendance-btn"
                    >
                      {attendanceLoading ? 'Saving...' : 'Submit Attendance'}
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>
      )}

      {/* CSV Upload Modal */}
      {uploadOpen && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '560px' }}>
            <div className="modal-header">
              <h3 style={{ color: 'white', fontSize: '20px' }}>Upload & Validate Dataset</h3>
              <button
                onClick={() => {
                  setUploadOpen(false);
                  setUploadResult(null);
                  setSelectedFile(null);
                  setErrorMessage('');
                }}
                style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', fontSize: '20px', cursor: 'pointer' }}
              >
                &times;
              </button>
            </div>

            {!uploadResult ? (
              <form onSubmit={handleUploadSubmit}>
                <p style={{ color: 'var(--text-muted)', fontSize: '13px', marginBottom: '20px', lineHeight: 1.5 }}>
                  Select a CSV dataset to import student grades and attendance. The system will automatically validate the schema, clean empty spaces, clamp out-of-range numerical values, and flag format issues.
                </p>

                <div className="form-group" style={{ marginBottom: '24px' }}>
                  <div style={{
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
                      accept=".csv"
                      style={{ display: 'none' }}
                      onChange={handleFileChange}
                    />
                    <Upload size={32} style={{ color: 'var(--primary)', marginBottom: '12px', opacity: 0.7 }} />
                    <p style={{ color: 'var(--text-main)', fontSize: '14px', fontWeight: 500 }}>
                      {selectedFile ? selectedFile.name : 'Click to select CSV File'}
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
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={() => {
                      setUploadOpen(false);
                      setSelectedFile(null);
                      setErrorMessage('');
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="btn-primary"
                    disabled={!selectedFile || uploadLoading}
                    id="submit-csv-btn"
                  >
                    {uploadLoading ? 'Processing...' : 'Upload & Clean'}
                  </button>
                </div>
              </form>
            ) : (
              <div>
                {/* Upload complete results summary */}
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
                    <div style={{ color: 'var(--success)' }}>✔ Dataset is 100% clean. No validation anomalies or adjustments needed.</div>
                  ) : (
                    uploadResult.errors.map((err, i) => (
                      <div key={i} style={{ marginBottom: '4px', color: err.includes('skipped') ? 'var(--danger)' : 'var(--warning)' }}>
                        • {err}
                      </div>
                    ))
                  )}
                </div>

                <div className="modal-actions">
                  <button
                    className="btn-primary"
                    onClick={() => {
                      setUploadOpen(false);
                      setUploadResult(null);
                    }}
                  >
                    Done
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
