import React, { useEffect, useState } from 'react';
import { FileText, Download, Award, ShieldAlert, Sparkles, MessageSquarePlus, Activity, Upload } from 'lucide-react';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';
import { CsvUploadModal } from '../components/CsvUploadModal';

interface PerformanceRecord {
  id: number;
  subject: string;
  grade: number;
  semester: number;
  attendance: number;
}

interface PerformanceAnalysis {
  risk_score: number;
  risk_level: string;
  trend_data: string;
}

interface Recommendation {
  id: number;
  message: string;
  priority: string;
  created_date: string;
}

interface Student {
  id: number;
  student_id_str: string;
  name: string;
  email: string;
  semester: number;
  attendance: number;
  engagement_score: number;
  performance_records: PerformanceRecord[];
  performance_analysis?: PerformanceAnalysis;
  recommendations: Recommendation[];
}

export const AcademicAdvisorDashboard: React.FC = () => {
  const [students, setStudents] = useState<Student[]>([]);
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [loading, setLoading] = useState(true);
  const [recModalOpen, setRecModalOpen] = useState(false);
  const [recMessage, setRecMessage] = useState('');
  const [recPriority, setRecPriority] = useState('Medium');
  const [recLoading, setRecLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [uploadOpen, setUploadOpen] = useState(false);

  const token = localStorage.getItem('token');

  const fetchStudents = async () => {
    try {
      const res = await fetch('/api/students', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setStudents(data);
        
        // Retain selection if exists, else select first student
        if (data.length > 0) {
          if (selectedStudent) {
            const updated = data.find((s: Student) => s.id === selectedStudent.id);
            if (updated) setSelectedStudent(updated);
          } else {
            setSelectedStudent(data[0]);
          }
        }
      }
    } catch (err) {
      console.error('Failed to load students', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStudents();
  }, []);

  const handleAddRecommendation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStudent || !recMessage.trim()) return;

    setRecLoading(true);
    try {
      const res = await fetch(`/api/students/${selectedStudent.id}/recommendations`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          message: recMessage,
          priority: recPriority,
        }),
      });

      if (res.ok) {
        setRecMessage('');
        setRecPriority('Medium');
        setRecModalOpen(false);
        await fetchStudents();
      }
    } catch (err) {
      console.error('Failed to add recommendation', err);
    } finally {
      setRecLoading(false);
    }
  };

  const handleDownloadReport = (format: 'pdf' | 'csv') => {
    if (!selectedStudent) return;
    
    // Open a link to download report directly
    const url = `/api/students/${selectedStudent.id}/report?format=${format}`;
    
    // Fetch with authorization headers and trigger download
    fetch(url, {
      headers: { Authorization: `Bearer ${token}` }
    })
    .then(res => {
      if (!res.ok) throw new Error('Download failed');
      return res.blob();
    })
    .then(blob => {
      const fileUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = fileUrl;
      link.download = `report_${selectedStudent.student_id_str}.${format}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    })
    .catch(err => {
      console.error('Download failed', err);
    });
  };

  // Filter students based on search
  const filteredStudents = students.filter(s =>
    s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    s.student_id_str.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Prepare chart data: Average Grade per Semester for Selected Student
  const getChartData = () => {
    if (!selectedStudent || !selectedStudent.performance_records) return [];
    
    const records = selectedStudent.performance_records;
    const semesters = Array.from(new Set(records.map(r => r.semester))).sort();
    
    return semesters.map(sem => {
      const semRecords = records.filter(r => r.semester === sem);
      const avgGrade = semRecords.reduce((sum, r) => sum + r.grade, 0) / semRecords.length;
      return {
        semester: `Semester ${sem}`,
        Grade: parseFloat(avgGrade.toFixed(1)),
      };
    });
  };

  const chartData = getChartData();
  const selectedRisk = selectedStudent?.performance_analysis?.risk_level || 'Low';

  return (
    <div>
      <div className="section-title">
        <div>
          <h2 style={{ fontSize: '28px', color: 'white' }}>Academic Advising Desk</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '14px', marginTop: '4px' }}>
            Identify at-risk students, view grade progression timelines, and log academic feedback.
          </p>
        </div>
        <button className="btn-primary" onClick={() => setUploadOpen(true)} id="advisor-upload-csv-btn">
          <Upload size={18} /> Upload CSV
        </button>
      </div>

      {loading ? (
        <p style={{ color: 'var(--text-muted)' }}>Loading student profiles...</p>
      ) : students.length === 0 ? (
        <div className="glass-card" style={{ textAlign: 'center', padding: '60px' }}>
          <p style={{ color: 'var(--text-muted)' }}>No student profiles available. Please contact a teacher to upload a student dataset.</p>
        </div>
      ) : (
        <div className="dashboard-grid" style={{ gridTemplateColumns: '1.2fr 2fr' }}>
          
          {/* Left panel: student roster */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div className="glass-card" style={{ padding: '20px' }}>
              <input
                type="text"
                placeholder="Search by name or ID..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                style={{ width: '100%', marginBottom: '16px' }}
              />

              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '540px', overflowY: 'auto' }} id="student-roster">
                {filteredStudents.map((s) => {
                  const isSelected = selectedStudent?.id === s.id;
                  const risk = s.performance_analysis?.risk_level || 'Low';
                  
                  return (
                    <button
                      key={s.id}
                      onClick={() => setSelectedStudent(s)}
                      style={{
                        width: '100%',
                        textAlign: 'left',
                        padding: '12px 16px',
                        borderRadius: '12px',
                        border: '1px solid',
                        borderColor: isSelected ? 'var(--primary)' : 'var(--border-glass)',
                        background: isSelected ? 'rgba(99, 102, 241, 0.12)' : 'rgba(22, 19, 48, 0.3)',
                        color: 'white',
                        cursor: 'pointer',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        transition: 'var(--transition-smooth)'
                      }}
                      onMouseEnter={(e) => {
                        if (!isSelected) e.currentTarget.style.borderColor = 'var(--border-glass-hover)';
                      }}
                      onMouseLeave={(e) => {
                        if (!isSelected) e.currentTarget.style.borderColor = 'var(--border-glass)';
                      }}
                    >
                      <div>
                        <div style={{ fontWeight: 600, fontSize: '14px' }}>{s.name}</div>
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'monospace', marginTop: '2px' }}>
                          {s.student_id_str} | Sem {s.semester}
                        </div>
                      </div>
                      <span className={`badge badge-${risk.toLowerCase()}`} style={{ fontSize: '10px', padding: '2px 8px' }}>
                        {risk}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Right panel: student detailed profile */}
          {selectedStudent && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              {/* Profile Card Header */}
              <div className="glass-card" id="student-details-panel">
                <div style={{ display: 'flex', justifyItems: 'center', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
                  <div>
                    <h3 style={{ fontSize: '22px', color: 'white' }}>{selectedStudent.name}</h3>
                    <p style={{ color: 'var(--text-muted)', fontSize: '13px', marginTop: '4px' }}>
                      ID: {selectedStudent.student_id_str} | {selectedStudent.email} | Semester {selectedStudent.semester}
                    </p>
                  </div>
                  
                  {/* Action Buttons */}
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button className="btn-secondary" style={{ padding: '8px 16px', fontSize: '13px' }} onClick={() => handleDownloadReport('csv')}>
                      <Download size={14} /> CSV
                    </button>
                    <button className="btn-secondary" style={{ padding: '8px 16px', fontSize: '13px' }} onClick={() => handleDownloadReport('pdf')}>
                      <FileText size={14} /> PDF Report
                    </button>
                    <button className="btn-primary" style={{ padding: '8px 16px', fontSize: '13px' }} onClick={() => setRecModalOpen(true)} id="add-rec-btn">
                      <MessageSquarePlus size={14} /> Recommend
                    </button>
                  </div>
                </div>

                {/* Key Metrics gauges */}
                <div className="metrics-grid" style={{ marginBottom: '24px' }}>
                  <div className="glass-card" style={{ padding: '16px', background: 'rgba(255,255,255,0.01)' }}>
                    <div className="metric-header">
                      <span>Attendance Rate</span>
                      <Activity size={14} />
                    </div>
                    <div className="metric-value" style={{ color: selectedStudent.attendance < 75 ? 'var(--danger)' : 'white' }}>
                      {selectedStudent.attendance.toFixed(1)}%
                    </div>
                    <div className="metric-subtext">
                      {selectedStudent.attendance < 75 ? 'Critically low attendance' : 'Satisfactory attendance rate'}
                    </div>
                  </div>

                  <div className="glass-card" style={{ padding: '16px', background: 'rgba(255,255,255,0.01)' }}>
                    <div className="metric-header">
                      <span>Engagement Metric</span>
                      <Award size={14} />
                    </div>
                    <div className="metric-value">
                      {selectedStudent.engagement_score.toFixed(1)}/10
                    </div>
                    <div className="metric-subtext">
                      Reflects platform interaction index
                    </div>
                  </div>

                  <div className="glass-card" style={{ padding: '16px', background: 'rgba(255,255,255,0.01)' }}>
                    <div className="metric-header">
                      <span>Risk Profile</span>
                      <ShieldAlert size={14} style={{ color: selectedRisk === 'High' ? 'var(--danger)' : (selectedRisk === 'Medium' ? 'var(--warning)' : 'var(--success)') }} />
                    </div>
                    <div className="metric-value" style={{ color: selectedRisk === 'High' ? 'var(--danger)' : (selectedRisk === 'Medium' ? 'var(--warning)' : 'var(--success)') }}>
                      {selectedRisk}
                    </div>
                    <div className="metric-subtext">
                      Overall risk level
                    </div>
                  </div>
                </div>

                {/* Chart Area */}
                <div style={{ marginBottom: '32px' }}>
                  <h4 style={{ color: 'white', fontSize: '15px', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Sparkles size={16} style={{ color: 'var(--primary)' }} /> Grade Progression Timeline
                  </h4>
                  {chartData.length === 0 ? (
                    <p style={{ color: 'var(--text-muted)', fontSize: '13px' }}>No historic performance records to plot.</p>
                  ) : (
                    <div style={{ width: '100%', height: 200 }}>
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={chartData}>
                          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                          <XAxis dataKey="semester" stroke="var(--text-muted)" fontSize={12} />
                          <YAxis domain={[40, 100]} stroke="var(--text-muted)" fontSize={12} />
                          <Tooltip contentStyle={{ background: '#0f0d23', borderColor: 'var(--border-glass)' }} />
                          <Legend />
                          <Line
                            type="monotone"
                            dataKey="Grade"
                            stroke="var(--primary)"
                            strokeWidth={3}
                            activeDot={{ r: 8 }}
                            name="Avg Semester Grade (%)"
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                </div>

                {/* Recommendation Feed */}
                <div>
                  <h4 style={{ color: 'white', fontSize: '15px', marginBottom: '16px' }}>Advisor Intervention Log</h4>
                  
                  {selectedStudent.recommendations.length === 0 ? (
                    <p style={{ color: 'var(--text-muted)', fontSize: '13px' }}>No intervention recommendations logged yet.</p>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }} id="rec-feed">
                      {selectedStudent.recommendations.map((rec) => (
                        <div key={rec.id} className={`recommendation-item priority-${rec.priority}`}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'var(--text-muted)', marginBottom: '4px' }}>
                            <span style={{
                              fontWeight: 600,
                              color: rec.priority === 'High' ? 'var(--danger)' : (rec.priority === 'Medium' ? 'var(--warning)' : 'var(--success)')
                            }}>
                              {rec.priority} Priority
                            </span>
                            <span>{new Date(rec.created_date).toLocaleDateString()}</span>
                          </div>
                          <p style={{ fontSize: '13px', color: 'var(--text-main)', lineHeight: 1.4 }}>
                            {rec.message}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Add Recommendation Modal */}
      {recModalOpen && selectedStudent && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h3 style={{ color: 'white', fontSize: '20px' }}>Log Intervention Advice</h3>
              <button
                onClick={() => setRecModalOpen(false)}
                style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', fontSize: '20px', cursor: 'pointer' }}
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleAddRecommendation}>
              <div style={{ marginBottom: '16px' }}>
                <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
                  Student: <strong style={{ color: 'white' }}>{selectedStudent.name}</strong> ({selectedStudent.student_id_str})
                </p>
              </div>

              <div className="form-group">
                <label>Recommendation details</label>
                <textarea
                  required
                  rows={4}
                  placeholder="e.g. Schedule weekly progress check-ins, attend tutoring sessions..."
                  value={recMessage}
                  onChange={(e) => setRecMessage(e.target.value)}
                  style={{ resize: 'vertical' }}
                />
              </div>

              <div className="form-group">
                <label>Priority Level</label>
                <select value={recPriority} onChange={(e) => setRecPriority(e.target.value)}>
                  <option value="Low">Low</option>
                  <option value="Medium">Medium</option>
                  <option value="High">High</option>
                </select>
              </div>

              <div className="modal-actions">
                <button type="button" className="btn-secondary" onClick={() => setRecModalOpen(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn-primary" disabled={recLoading} id="submit-rec-btn">
                  {recLoading ? 'Logging...' : 'Submit Advice'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <CsvUploadModal open={uploadOpen} onClose={() => setUploadOpen(false)} onUploadComplete={fetchStudents} />
    </div>
  );
};
