import React, { useEffect, useState } from 'react';
import { Edit3, Plus, Trash2, Upload, Users, Settings, ShieldAlert, BookOpen } from 'lucide-react';
import { CsvUploadModal } from '../components/CsvUploadModal';

interface User {
  id: number;
  name: string;
  email: string;
  role: string;
}

interface Subject {
  id: number;
  name: string;
  semester: number;
  teacher_id: number | null;
  teacher?: User | null;
}

interface StudentProfile {
  id: number;
  student_id_str: string;
  name: string;
  email: string;
  semester: number;
  attendance: number;
  engagement_score: number;
}

export const AdminDashboard: React.FC = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [teachers, setTeachers] = useState<User[]>([]);
  const [studentProfiles, setStudentProfiles] = useState<StudentProfile[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Tab control
  const [activeSubTab, setActiveSubTab] = useState<'accounts' | 'subjects'>('accounts');
  
  // Modals state
  const [modalOpen, setModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [subjectModalOpen, setSubjectModalOpen] = useState(false);
  const [uploadOpen, setUploadOpen] = useState(false);
  
  // Create user state
  const [newName, setNewName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newRole, setNewRole] = useState('Student');
  const [newStudentId, setNewStudentId] = useState('');
  const [newStudentSemester, setNewStudentSemester] = useState(1);
  const [newStudentAttendance, setNewStudentAttendance] = useState(0);
  const [newStudentEngagement, setNewStudentEngagement] = useState(0);

  // Edit user state
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [editName, setEditName] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editPassword, setEditPassword] = useState('');
  const [editRole, setEditRole] = useState('Student');
  const [editStudentId, setEditStudentId] = useState('');
  const [editStudentSemester, setEditStudentSemester] = useState(1);
  const [editStudentAttendance, setEditStudentAttendance] = useState(0);
  const [editStudentEngagement, setEditStudentEngagement] = useState(0);

  // Create subject state
  const [newSubjName, setNewSubjName] = useState('');
  const [newSubjSem, setNewSubjSem] = useState(3);
  const [selectedTeacherId, setSelectedTeacherId] = useState<string>('');

  const [actionError, setActionError] = useState('');
  const [actionSuccess, setActionSuccess] = useState('');

  // Configuration thresholds
  const [attThreshold, setAttThreshold] = useState(75);
  const [gradeThreshold, setGradeThreshold] = useState(60);

  const token = localStorage.getItem('token');

  const fetchUsers = async () => {
    try {
      const res = await fetch('/api/users', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setUsers(data);
      }
    } catch (err) {
      console.error('Failed to load users', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchSubjects = async () => {
    try {
      const res = await fetch('/api/subjects', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setSubjects(data);
      }
    } catch (err) {
      console.error('Failed to load subjects', err);
    }
  };

  const fetchTeachers = async () => {
    try {
      const res = await fetch('/api/teachers', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setTeachers(data);
        if (data.length > 0) {
          setSelectedTeacherId(data[0].id.toString());
        }
      }
    } catch (err) {
      console.error('Failed to load teachers', err);
    }
  };

  const fetchStudentProfiles = async () => {
    try {
      const res = await fetch('/api/students', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setStudentProfiles(data);
      }
    } catch (err) {
      console.error('Failed to load student profiles', err);
    }
  };

  const fetchConfig = async () => {
    try {
      const res = await fetch('/api/config', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setAttThreshold(data.critical_attendance_threshold);
        setGradeThreshold(data.critical_grade_threshold);
      }
    } catch (err) {
      console.error('Failed to load config', err);
    }
  };

  useEffect(() => {
    fetchUsers();
    fetchConfig();
    fetchSubjects();
    fetchTeachers();
    fetchStudentProfiles();
  }, []);

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionError('');
    setActionSuccess('');

    try {
      const res = await fetch('/api/users', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: newName,
          email: newEmail,
          password: newPassword,
          role: newRole,
          student_id_str: newRole === 'Student' ? newStudentId : null,
          semester: newStudentSemester,
          attendance: newStudentAttendance,
          engagement_score: newStudentEngagement,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.detail || 'Failed to create user');
      }

      setActionSuccess(`User '${newName}' created successfully!`);
      setNewName('');
      setNewEmail('');
      setNewPassword('');
      setNewRole('Student');
      setNewStudentId('');
      setNewStudentSemester(1);
      setNewStudentAttendance(0);
      setNewStudentEngagement(0);
      setModalOpen(false);
      fetchUsers();
      fetchTeachers(); // Refresh teacher list in case a new teacher was added
      fetchStudentProfiles();
    } catch (err: any) {
      setActionError(err.message);
    }
  };

  const openEditModal = (user: User) => {
    const profile = studentProfiles.find((s) => s.email === user.email);
    setEditingUser(user);
    setEditName(user.name);
    setEditEmail(user.email);
    setEditPassword('');
    setEditRole(user.role);
    setEditStudentId(profile?.student_id_str || '');
    setEditStudentSemester(profile?.semester || 1);
    setEditStudentAttendance(profile?.attendance || 0);
    setEditStudentEngagement(profile?.engagement_score || 0);
    setEditModalOpen(true);
  };

  const handleUpdateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;

    setActionError('');
    setActionSuccess('');

    try {
      const res = await fetch(`/api/users/${editingUser.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: editName,
          email: editEmail,
          password: editPassword || null,
          role: editRole,
          student_id_str: editRole === 'Student' ? editStudentId : null,
          semester: editStudentSemester,
          attendance: editStudentAttendance,
          engagement_score: editStudentEngagement,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.detail || 'Failed to update user');
      }

      setActionSuccess(`User '${editName}' updated successfully!`);
      setEditModalOpen(false);
      setEditingUser(null);
      fetchUsers();
      fetchTeachers();
      fetchStudentProfiles();
    } catch (err: any) {
      setActionError(err.message);
    }
  };

  const handleDeleteUser = async (userId: number, userName: string) => {
    if (!window.confirm(`Are you sure you want to delete user: ${userName}?`)) return;
    setActionError('');
    setActionSuccess('');

    try {
      const res = await fetch(`/api/users/${userId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.detail || 'Failed to delete user');
      }

      setActionSuccess(`User '${userName}' has been deleted.`);
      fetchUsers();
      fetchTeachers();
      fetchStudentProfiles();
    } catch (err: any) {
      setActionError(err.message);
    }
  };

  const handleCreateSubject = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionError('');
    setActionSuccess('');

    try {
      const res = await fetch('/api/subjects', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: newSubjName,
          semester: newSubjSem,
          teacher_id: selectedTeacherId ? parseInt(selectedTeacherId) : null,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.detail || 'Failed to create subject');
      }

      setActionSuccess(`Subject '${newSubjName}' created and allocated successfully!`);
      setNewSubjName('');
      setSubjectModalOpen(false);
      fetchSubjects();
    } catch (err: any) {
      setActionError(err.message);
    }
  };

  const handleSaveConfig = async () => {
    setActionError('');
    setActionSuccess('');

    try {
      const res = await fetch('/api/config', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          critical_attendance_threshold: attThreshold,
          critical_grade_threshold: gradeThreshold,
        }),
      });

      if (!res.ok) throw new Error('Failed to save configuration');
      setActionSuccess('System configuration updated successfully!');
    } catch (err: any) {
      setActionError(err.message);
    }
  };

  return (
    <div>
      <div className="section-title" style={{ marginBottom: '16px' }}>
        <div>
          <h2 style={{ fontSize: '28px', color: 'white' }}>Admin Control Center</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '14px', marginTop: '4px' }}>
            Allocate curriculum subjects, manage user credentials, and adjust threshold triggers.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '12px' }}>
          <button className="btn-secondary" onClick={() => setUploadOpen(true)} id="admin-upload-csv-btn">
            <Upload size={18} /> Upload CSV
          </button>
          {activeSubTab === 'accounts' ? (
            <button className="btn-primary" onClick={() => setModalOpen(true)} id="add-user-btn">
              <Plus size={18} /> Add User Account
            </button>
          ) : (
            <button className="btn-primary" onClick={() => setSubjectModalOpen(true)} id="add-subj-btn">
              <Plus size={18} /> Create Subject
            </button>
          )}
        </div>
      </div>

      {/* Sub Tabs Selection */}
      <div style={{ display: 'flex', gap: '16px', marginBottom: '24px', borderBottom: '1px solid var(--border-glass)', paddingBottom: '10px' }}>
        <button
          onClick={() => setActiveSubTab('accounts')}
          style={{
            background: 'transparent',
            border: 'none',
            color: activeSubTab === 'accounts' ? 'white' : 'var(--text-muted)',
            fontSize: '15px',
            fontWeight: 600,
            cursor: 'pointer',
            padding: '4px 8px',
            borderBottom: activeSubTab === 'accounts' ? '2px solid var(--primary)' : 'none',
            transition: 'var(--transition-smooth)'
          }}
        >
          Accounts & Settings
        </button>
        <button
          onClick={() => setActiveSubTab('subjects')}
          style={{
            background: 'transparent',
            border: 'none',
            color: activeSubTab === 'subjects' ? 'white' : 'var(--text-muted)',
            fontSize: '15px',
            fontWeight: 600,
            cursor: 'pointer',
            padding: '4px 8px',
            borderBottom: activeSubTab === 'subjects' ? '2px solid var(--primary)' : 'none',
            transition: 'var(--transition-smooth)'
          }}
          id="tab-subjects"
        >
          Subjects & Allocations
        </button>
      </div>

      {(actionError || actionSuccess) && (
        <div style={{
          padding: '16px',
          borderRadius: '8px',
          marginBottom: '24px',
          fontSize: '14px',
          textAlign: 'center',
          background: actionError ? 'var(--danger-bg)' : 'var(--success-bg)',
          color: actionError ? 'var(--danger)' : 'var(--success)',
          border: `1px solid ${actionError ? 'rgba(244, 63, 94, 0.2)' : 'rgba(16, 185, 129, 0.2)'}`
        }}>
          {actionError || actionSuccess}
        </div>
      )}

      {activeSubTab === 'accounts' ? (
        <div className="dashboard-grid">
          {/* User management list */}
          <div className="glass-card" style={{ padding: '24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '20px' }}>
              <Users size={20} style={{ color: 'var(--primary)' }} />
              <h3 style={{ color: 'white', fontSize: '18px' }}>User Accounts</h3>
            </div>

            {loading ? (
              <p style={{ color: 'var(--text-muted)' }}>Loading users...</p>
            ) : (
              <div className="table-container">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Email Address</th>
                      <th>System Role</th>
                      <th style={{ textAlign: 'right' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map((u) => (
                      <tr key={u.id}>
                        <td style={{ fontWeight: 600 }}>{u.name}</td>
                        <td style={{ color: 'var(--text-muted)' }}>{u.email}</td>
                        <td>
                          <span style={{
                            padding: '3px 8px',
                            borderRadius: '4px',
                            fontSize: '11px',
                            fontWeight: 600,
                            background: u.role === 'Admin' ? 'rgba(139, 92, 246, 0.15)' : 'rgba(255, 255, 255, 0.05)',
                            color: u.role === 'Admin' ? 'var(--secondary)' : 'var(--text-main)',
                            border: `1px solid ${u.role === 'Admin' ? 'rgba(139, 92, 246, 0.3)' : 'rgba(255, 255, 255, 0.1)'}`
                          }}>
                            {u.role}
                          </span>
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          <button
                            onClick={() => openEditModal(u)}
                            style={{
                              background: 'transparent',
                              border: 'none',
                              color: 'var(--text-muted)',
                              cursor: 'pointer',
                              transition: 'color 0.2s',
                              marginRight: '10px'
                            }}
                            onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--primary)')}
                            onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-muted)')}
                            aria-label={`Edit ${u.name}`}
                          >
                            <Edit3 size={16} />
                          </button>
                          <button
                            onClick={() => handleDeleteUser(u.id, u.name)}
                            style={{
                              background: 'transparent',
                              border: 'none',
                              color: 'var(--text-muted)',
                              cursor: 'pointer',
                              transition: 'color 0.2s'
                            }}
                            onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--danger)')}
                            onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-muted)')}
                          >
                            <Trash2 size={16} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Configurations column */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            <div className="glass-card">
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '20px' }}>
                <Settings size={20} style={{ color: 'var(--primary)' }} />
                <h3 style={{ color: 'white', fontSize: '18px' }}>Risk Thresholds</h3>
              </div>

              <p style={{ color: 'var(--text-muted)', fontSize: '13px', marginBottom: '24px', lineHeight: 1.5 }}>
                Set criteria values below which students are flagged as at-risk.
              </p>

              <div className="form-group" style={{ marginBottom: '24px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px', marginBottom: '8px' }}>
                  <span style={{ color: 'var(--text-main)' }}>Critical Attendance Rate</span>
                  <span style={{ fontWeight: 'bold', color: 'var(--primary)' }}>&lt; {attThreshold}%</span>
                </div>
                <input
                  type="range"
                  min="50"
                  max="95"
                  step="5"
                  value={attThreshold}
                  onChange={(e) => setAttThreshold(Number(e.target.value))}
                  style={{ width: '100%', accentColor: 'var(--primary)', padding: 0 }}
                />
              </div>

              <div className="form-group" style={{ marginBottom: '28px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px', marginBottom: '8px' }}>
                  <span style={{ color: 'var(--text-main)' }}>Critical Average Grade</span>
                  <span style={{ fontWeight: 'bold', color: 'var(--primary)' }}>&lt; {gradeThreshold}%</span>
                </div>
                <input
                  type="range"
                  min="50"
                  max="85"
                  step="5"
                  value={gradeThreshold}
                  onChange={(e) => setGradeThreshold(Number(e.target.value))}
                  style={{ width: '100%', accentColor: 'var(--primary)', padding: 0 }}
                />
              </div>

              <button className="btn-primary" onClick={handleSaveConfig} style={{ width: '100%', justifyContent: 'center' }}>
                Apply Configurations
              </button>
            </div>

            <div className="glass-card" style={{ borderLeft: '3px solid var(--warning)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                <ShieldAlert size={20} style={{ color: 'var(--warning)' }} />
                <h4 style={{ color: 'white', fontSize: '15px' }}>Important Notice</h4>
              </div>
              <p style={{ color: 'var(--text-muted)', fontSize: '12px', lineHeight: 1.5 }}>
                Modifying these limits will immediately trigger automatic recalculation of student risk status indicators upon the next dashboard refresh.
              </p>
            </div>
          </div>
        </div>
      ) : (
        /* Subjects and teacher allocation registry tab active */
        <div className="glass-card" style={{ padding: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '20px' }}>
            <BookOpen size={20} style={{ color: 'var(--primary)' }} />
            <h3 style={{ color: 'white', fontSize: '18px' }}>Course Subjects & Assigned Teachers</h3>
          </div>

          <div className="table-container">
            <table className="data-table" id="subjects-table">
              <thead>
                <tr>
                  <th>Subject Name</th>
                  <th>Target Semester</th>
                  <th>Assigned Instructor</th>
                  <th>Instructor Email</th>
                </tr>
              </thead>
              <tbody>
                {subjects.map((subj) => (
                  <tr key={subj.id}>
                    <td style={{ fontWeight: 600, color: 'white' }}>{subj.name}</td>
                    <td>Semester {subj.semester}</td>
                    <td>
                      <span style={{
                        padding: '3px 8px',
                        borderRadius: '4px',
                        fontSize: '12px',
                        background: subj.teacher ? 'rgba(16, 185, 129, 0.12)' : 'rgba(244, 63, 94, 0.12)',
                        color: subj.teacher ? 'var(--success)' : 'var(--danger)',
                        fontWeight: 600,
                        border: `1px solid ${subj.teacher ? 'rgba(16, 185, 129, 0.2)' : 'rgba(244, 63, 94, 0.2)'}`
                      }}>
                        {subj.teacher ? subj.teacher.name : 'Unassigned'}
                      </span>
                    </td>
                    <td style={{ color: 'var(--text-muted)' }}>
                      {subj.teacher ? subj.teacher.email : 'N/A'}
                    </td>
                  </tr>
                ))}
                {subjects.length === 0 && (
                  <tr>
                    <td colSpan={4} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '20px' }}>
                      No subjects registered in system. Click 'Create Subject' to allocate one.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Add User Modal */}
      {modalOpen && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h3 style={{ color: 'white', fontSize: '20px' }}>Create User Account</h3>
              <button
                onClick={() => setModalOpen(false)}
                style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', fontSize: '20px', cursor: 'pointer' }}
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleCreateUser}>
              <div className="form-group">
                <label>Full Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Professor X"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label>Email Address</label>
                <input
                  type="email"
                  required
                  placeholder="e.g. profx@dashboard.com"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label>Password</label>
                <input
                  type="password"
                  required
                  placeholder="Minimum 6 characters"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label>System Role</label>
                <select value={newRole} onChange={(e) => setNewRole(e.target.value)}>
                  <option value="Student">Student</option>
                  <option value="Teacher">Teacher</option>
                  <option value="AcademicAdvisor">Academic Advisor</option>
                  <option value="Admin">Admin</option>
                </select>
              </div>

              {newRole === 'Student' && (
                <>
                  <div className="form-group">
                    <label>Student ID</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. STU011"
                      value={newStudentId}
                      onChange={(e) => setNewStudentId(e.target.value)}
                    />
                  </div>

                  <div className="form-group">
                    <label>Semester</label>
                    <input
                      type="number"
                      min="1"
                      max="12"
                      required
                      value={newStudentSemester}
                      onChange={(e) => setNewStudentSemester(parseInt(e.target.value) || 1)}
                    />
                  </div>

                  <div className="form-group">
                    <label>Attendance (%)</label>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      step="0.1"
                      required
                      value={newStudentAttendance}
                      onChange={(e) => setNewStudentAttendance(parseFloat(e.target.value) || 0)}
                    />
                  </div>

                  <div className="form-group">
                    <label>Engagement Score</label>
                    <input
                      type="number"
                      min="0"
                      max="10"
                      step="0.1"
                      required
                      value={newStudentEngagement}
                      onChange={(e) => setNewStudentEngagement(parseFloat(e.target.value) || 0)}
                    />
                  </div>
                </>
              )}

              <div className="modal-actions">
                <button type="button" className="btn-secondary" onClick={() => setModalOpen(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn-primary" id="submit-user-btn">
                  Create User
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit User Modal */}
      {editModalOpen && editingUser && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h3 style={{ color: 'white', fontSize: '20px' }}>Edit User Account</h3>
              <button
                onClick={() => setEditModalOpen(false)}
                style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', fontSize: '20px', cursor: 'pointer' }}
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleUpdateUser}>
              <div className="form-group">
                <label>Full Name</label>
                <input
                  type="text"
                  required
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label>Email Address</label>
                <input
                  type="email"
                  required
                  value={editEmail}
                  onChange={(e) => setEditEmail(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label>New Password</label>
                <input
                  type="password"
                  placeholder="Leave blank to keep current password"
                  value={editPassword}
                  onChange={(e) => setEditPassword(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label>System Role</label>
                <select value={editRole} onChange={(e) => setEditRole(e.target.value)}>
                  <option value="Student">Student</option>
                  <option value="Teacher">Teacher</option>
                  <option value="AcademicAdvisor">Academic Advisor</option>
                  <option value="Admin">Admin</option>
                </select>
              </div>

              {editRole === 'Student' && (
                <>
                  <div className="form-group">
                    <label>Student ID</label>
                    <input
                      type="text"
                      required
                      value={editStudentId}
                      onChange={(e) => setEditStudentId(e.target.value)}
                    />
                  </div>

                  <div className="form-group">
                    <label>Semester</label>
                    <input
                      type="number"
                      min="1"
                      max="12"
                      required
                      value={editStudentSemester}
                      onChange={(e) => setEditStudentSemester(parseInt(e.target.value) || 1)}
                    />
                  </div>

                  <div className="form-group">
                    <label>Attendance (%)</label>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      step="0.1"
                      required
                      value={editStudentAttendance}
                      onChange={(e) => setEditStudentAttendance(parseFloat(e.target.value) || 0)}
                    />
                  </div>

                  <div className="form-group">
                    <label>Engagement Score</label>
                    <input
                      type="number"
                      min="0"
                      max="10"
                      step="0.1"
                      required
                      value={editStudentEngagement}
                      onChange={(e) => setEditStudentEngagement(parseFloat(e.target.value) || 0)}
                    />
                  </div>
                </>
              )}

              <div className="modal-actions">
                <button type="button" className="btn-secondary" onClick={() => setEditModalOpen(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn-primary" id="submit-edit-user-btn">
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Subject Modal */}
      {subjectModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h3 style={{ color: 'white', fontSize: '20px' }}>Create Curriculum Subject</h3>
              <button
                onClick={() => setSubjectModalOpen(false)}
                style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', fontSize: '20px', cursor: 'pointer' }}
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleCreateSubject}>
              <div className="form-group">
                <label>Subject Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Applied Chemistry"
                  value={newSubjName}
                  onChange={(e) => setNewSubjName(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label>Target Semester</label>
                <input
                  type="number"
                  min="1"
                  max="8"
                  required
                  value={newSubjSem}
                  onChange={(e) => setNewSubjSem(parseInt(e.target.value))}
                />
              </div>

              <div className="form-group">
                <label>Allocate Instructor</label>
                <select value={selectedTeacherId} onChange={(e) => setSelectedTeacherId(e.target.value)} id="teacher-select">
                  <option value="">-- Leave Unassigned --</option>
                  {teachers.map((t) => (
                    <option key={t.id} value={t.id.toString()}>
                      {t.name} ({t.email})
                    </option>
                  ))}
                </select>
              </div>

              <div className="modal-actions">
                <button type="button" className="btn-secondary" onClick={() => setSubjectModalOpen(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn-primary" id="submit-subject-btn">
                  Create Subject
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <CsvUploadModal
        open={uploadOpen}
        onClose={() => setUploadOpen(false)}
        onUploadComplete={() => {
          fetchUsers();
          fetchTeachers();
          fetchStudentProfiles();
        }}
      />
    </div>
  );
};
