import React, { useEffect, useState } from 'react';
import { Award, FileText, Sparkles, AlertTriangle, GraduationCap, PlusCircle, CheckCircle } from 'lucide-react';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';

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

interface Subject {
  id: number;
  name: string;
  semester: number;
}

export const StudentDashboard: React.FC = () => {
  const [student, setStudent] = useState<Student | null>(null);
  const [enrolledSubjects, setEnrolledSubjects] = useState<Subject[]>([]);
  const [availableSubjects, setAvailableSubjects] = useState<Subject[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [enrollLoading, setEnrollLoading] = useState<number | null>(null);

  const token = localStorage.getItem('token');

  const fetchDashboard = async () => {
    try {
      const res = await fetch('/api/student/dashboard', {
        headers: { Authorization: `Bearer ${token}` },
      });
      
      if (!res.ok) {
        throw new Error('Failed to retrieve student dashboard profile.');
      }
      
      const data = await res.json();
      setStudent(data);
    } catch (err: any) {
      setError(err.message || 'Error occurred while loading profile.');
    }
  };

  const fetchSubjects = async () => {
    try {
      const enrolledRes = await fetch('/api/student/my-subjects', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (enrolledRes.ok) {
        const data = await enrolledRes.json();
        setEnrolledSubjects(data);
      }

      const availableRes = await fetch('/api/student/available-subjects', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (availableRes.ok) {
        const data = await availableRes.json();
        setAvailableSubjects(data);
      }
    } catch (err) {
      console.error('Failed to load subjects', err);
    }
  };

  const handleEnroll = async (subjectId: number) => {
    setEnrollLoading(subjectId);
    try {
      const res = await fetch('/api/student/enroll', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ subject_id: subjectId }),
      });

      if (!res.ok) {
        throw new Error('Enrollment failed');
      }

      await fetchSubjects();
      await fetchDashboard();
    } catch (err) {
      console.error(err);
    } finally {
      setEnrollLoading(null);
    }
  };

  useEffect(() => {
    const initData = async () => {
      setLoading(true);
      await fetchDashboard();
      await fetchSubjects();
      setLoading(false);
    };
    initData();
  }, []);

  const handleDownloadReport = (format: 'pdf' | 'csv') => {
    if (!student) return;
    
    const url = `/api/students/${student.id}/report?format=${format}`;
    
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
      link.download = `my_report_${student.student_id_str}.${format}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    })
    .catch(err => {
      console.error('Download failed', err);
    });
  };

  if (loading) return <p style={{ color: 'var(--text-muted)' }}>Loading your dashboard profile...</p>;

  if (error || !student) {
    return (
      <div className="glass-card" style={{ padding: '30px', textAlign: 'center', borderLeft: '3px solid var(--danger)' }}>
        <AlertTriangle size={36} style={{ color: 'var(--danger)', marginBottom: '12px' }} />
        <h3 style={{ color: 'white', fontSize: '18px', marginBottom: '8px' }}>Dashboard Error</h3>
        <p style={{ color: 'var(--text-muted)', fontSize: '14px' }}>
          {error || 'No student profile is linked to your login credentials.'}
        </p>
      </div>
    );
  }

  // Prep chart data
  const getChartData = () => {
    if (!student.performance_records || student.performance_records.length === 0) return [];
    
    // Group records by semester and average them out
    const records = student.performance_records.filter(r => r.grade > 0.0); // Only include records with input grades
    if (records.length === 0) return [];

    const semesters = Array.from(new Set(records.map(r => r.semester))).sort();
    
    return semesters.map(sem => {
      const semRecords = records.filter(r => r.semester === sem);
      const avgGrade = semRecords.reduce((sum, r) => sum + r.grade, 0) / semRecords.length;
      return {
        semester: `Sem ${sem}`,
        Grade: parseFloat(avgGrade.toFixed(1)),
      };
    });
  };

  const chartData = getChartData();
  const riskLevel = student.performance_analysis?.risk_level || 'Low';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }} id="student-dashboard-panel">
      {/* Welcome banner */}
      <div className="glass-card" style={{
        background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.1) 0%, rgba(139, 92, 246, 0.1) 100%)',
        borderColor: 'rgba(99, 102, 241, 0.25)',
        padding: '32px'
      }}>
        <div style={{ display: 'flex', justifyItems: 'center', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '20px' }}>
          <div>
            <h2 style={{ fontSize: '26px', color: 'white', display: 'flex', alignItems: 'center', gap: '8px' }}>
              Welcome back, {student.name}! <Sparkles size={20} style={{ color: 'var(--primary)' }} />
            </h2>
            <p style={{ color: 'var(--text-muted)', fontSize: '14px', marginTop: '6px' }}>
              Student ID: {student.student_id_str} | Semester {student.semester} | {student.email}
            </p>
          </div>
          <div style={{ display: 'flex', gap: '12px' }}>
            <button className="btn-secondary" onClick={() => handleDownloadReport('csv')}>
              Export CSV
            </button>
            <button className="btn-primary" onClick={() => handleDownloadReport('pdf')} id="download-pdf-btn">
              <FileText size={18} /> Download PDF Report
            </button>
          </div>
        </div>
      </div>

      {/* KPI metrics row */}
      <div className="metrics-grid">
        <div className="glass-card">
          <div className="metric-header">
            <span>My Attendance</span>
            <GraduationCap size={16} />
          </div>
          <div className="metric-value" style={{ color: student.attendance < 75 ? 'var(--danger)' : 'var(--success)' }}>
            {student.attendance.toFixed(1)}%
          </div>
          <div className="metric-subtext">
            {student.attendance < 75 ? 'Warning: Attendance is below 75%' : 'Great job maintaining attendance!'}
          </div>
        </div>

        <div className="glass-card">
          <div className="metric-header">
            <span>Engagement Index</span>
            <Award size={16} />
          </div>
          <div className="metric-value" style={{ color: 'var(--primary)' }}>
            {student.engagement_score.toFixed(1)}/10
          </div>
          <div className="metric-subtext">
            Based on active platform interactions
          </div>
        </div>

        <div className="glass-card">
          <div className="metric-header">
            <span>Academic Risk Rating</span>
            <AlertTriangle size={16} style={{ color: riskLevel === 'High' ? 'var(--danger)' : (riskLevel === 'Medium' ? 'var(--warning)' : 'var(--success)') }} />
          </div>
          <div className="metric-value" style={{ color: riskLevel === 'High' ? 'var(--danger)' : (riskLevel === 'Medium' ? 'var(--warning)' : 'var(--success)') }}>
            {riskLevel} Risk
          </div>
          <div className="metric-subtext">
            Determined by grade and attendance status
          </div>
        </div>
      </div>

      {/* Analytics and Interventions Columns */}
      <div className="dashboard-grid">
        
        {/* Grade progression chart */}
        <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <h3 style={{ color: 'white', fontSize: '18px' }}>My Academic Growth</h3>
          {chartData.length === 0 ? (
            <p style={{ color: 'var(--text-muted)', fontSize: '14px' }}>No recorded grades available to graph.</p>
          ) : (
            <div style={{ width: '100%', height: 260 }}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                  <XAxis dataKey="semester" stroke="var(--text-muted)" fontSize={12} />
                  <YAxis domain={[40, 100]} stroke="var(--text-muted)" fontSize={12} />
                  <Tooltip contentStyle={{ background: '#0f0d23', borderColor: 'var(--border-glass)' }} />
                  <Line
                    type="monotone"
                    dataKey="Grade"
                    stroke="var(--primary)"
                    strokeWidth={3}
                    activeDot={{ r: 8 }}
                    name="My Average Grade (%)"
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        {/* Right Columns: Recommendations & Enrollments */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          
          {/* Course Subject Enrollments card */}
          <div className="glass-card">
            <h3 style={{ color: 'white', fontSize: '18px', marginBottom: '16px' }}>My Subjects & Enrollment</h3>
            
            <div style={{ marginBottom: '20px' }}>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '8px' }}>Active Courses</div>
              {enrolledSubjects.map((subj) => (
                <div key={subj.id} style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  background: 'rgba(255,255,255,0.02)',
                  padding: '10px 14px',
                  borderRadius: '8px',
                  marginBottom: '6px',
                  border: '1px solid var(--border-glass)'
                }}>
                  <span style={{ fontSize: '13px', fontWeight: 500, color: 'white' }}>
                    {subj.name} <span style={{ color: 'var(--text-muted)', fontSize: '11px' }}>Semester {subj.semester}</span>
                  </span>
                  <CheckCircle size={16} style={{ color: 'var(--success)' }} />
                </div>
              ))}
              {enrolledSubjects.length === 0 && (
                <p style={{ color: 'var(--text-muted)', fontSize: '12px' }}>Not enrolled in any subjects yet.</p>
              )}
            </div>

            <div>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '8px' }}>Available Subjects</div>
              {availableSubjects.map((subj) => (
                <div key={subj.id} style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  background: 'rgba(99, 102, 241, 0.03)',
                  padding: '10px 14px',
                  borderRadius: '8px',
                  marginBottom: '6px',
                  border: '1px solid rgba(99, 102, 241, 0.15)'
                }}
                id={`avail-subj-${subj.id}`}
                >
                  <span style={{ fontSize: '13px', fontWeight: 500, color: 'white' }}>
                    {subj.name} <span style={{ color: 'var(--text-muted)', fontSize: '11px' }}>Semester {subj.semester}</span>
                  </span>
                  <button
                    onClick={() => handleEnroll(subj.id)}
                    disabled={enrollLoading === subj.id}
                    className="btn-secondary"
                    style={{
                      padding: '4px 10px',
                      fontSize: '11px',
                      borderRadius: '6px',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px'
                    }}
                    id={`enroll-btn-${subj.id}`}
                  >
                    <PlusCircle size={12} /> {enrollLoading === subj.id ? 'Selecting...' : 'Select Subject'}
                  </button>
                </div>
              ))}
              {availableSubjects.length === 0 && (
                <p style={{ color: 'var(--text-muted)', fontSize: '12px' }}>No further subjects available for enrollment.</p>
              )}
            </div>
          </div>

          {/* Advisor Interventions list */}
          <div className="glass-card">
            <h3 style={{ color: 'white', fontSize: '18px', marginBottom: '16px' }}>Advisor Recommendations</h3>
            {student.recommendations.length === 0 ? (
              <p style={{ color: 'var(--text-muted)', fontSize: '14px' }}>You have no active advice comments from advisors.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }} id="rec-feed-student">
                {student.recommendations.map((rec) => (
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
    </div>
  );
};
