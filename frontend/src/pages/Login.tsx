import React, { useState } from 'react';
import { LogIn, GraduationCap } from 'lucide-react';

interface LoginProps {
  onLoginSuccess: (token: string) => void;
}

export const Login: React.FC<LoginProps> = ({ onLoginSuccess }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    const formData = new URLSearchParams();
    formData.append('username', email);
    formData.append('password', password);

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: formData,
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.detail || 'Incorrect credentials. Please try again.');
      }

      const data = await response.json();
      onLoginSuccess(data.access_token);
    } catch (err: any) {
      setError(err.message || 'Network connection failed.');
    } finally {
      setLoading(false);
    }
  };

  const autofillUser = (roleEmail: string) => {
    setEmail(roleEmail);
    setPassword('');
  };

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '100vh',
      padding: '20px',
    }}>
      <div className="glass-card" style={{ width: '100%', maxWidth: '440px', padding: '40px' }} id="login-panel">
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '64px',
            height: '64px',
            borderRadius: '16px',
            background: 'linear-gradient(135deg, var(--primary) 0%, var(--secondary) 100%)',
            boxShadow: 'var(--glow-premium)',
            marginBottom: '16px',
            color: 'white'
          }}>
            <GraduationCap size={32} />
          </div>
          <h1 style={{ fontSize: '24px', fontWeight: 700, color: 'white', marginBottom: '8px' }}>
            Analytics Platform
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '14px' }}>
            Student Performance Dashboard
          </p>
        </div>

        {error && (
          <div style={{
            background: 'var(--danger-bg)',
            border: '1px solid rgba(244, 63, 94, 0.2)',
            borderRadius: '8px',
            color: 'var(--danger)',
            fontSize: '14px',
            padding: '12px',
            marginBottom: '20px',
            textAlign: 'center'
          }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="email-input">Email Address</label>
            <input
              id="email-input"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="e.g. name@dashboard.com"
              required
              autoComplete="username"
            />
          </div>

          <div className="form-group" style={{ marginBottom: '24px' }}>
            <label htmlFor="password-input">Password</label>
            <input
              id="password-input"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              autoComplete="current-password"
            />
          </div>

          <button
            type="submit"
            className="btn-primary"
            style={{ width: '100%', justifyContent: 'center' }}
            disabled={loading}
            id="login-btn"
          >
            {loading ? 'Authenticating...' : (
              <>
                <LogIn size={18} /> Sign In
              </>
            )}
          </button>
        </form>

        <div style={{ marginTop: '32px', borderTop: '1px solid var(--border-glass)', paddingTop: '20px' }}>
          <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '12px', textAlign: 'center' }}>
            Suggested Accounts:
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
            <button
              onClick={() => autofillUser('admin@dashboard.com')}
              className="btn-secondary"
              style={{ fontSize: '11px', padding: '8px 10px', justifyContent: 'center' }}
              type="button"
            >
              Admin Panel
            </button>
            <button
              onClick={() => autofillUser('teacher@dashboard.com')}
              className="btn-secondary"
              style={{ fontSize: '11px', padding: '8px 10px', justifyContent: 'center' }}
              type="button"
            >
              Teacher View
            </button>
            <button
              onClick={() => autofillUser('advisor@dashboard.com')}
              className="btn-secondary"
              style={{ fontSize: '11px', padding: '8px 10px', justifyContent: 'center' }}
              type="button"
            >
              Advisor Panel
            </button>
            <button
              onClick={() => autofillUser('student1@dashboard.com')}
              className="btn-secondary"
              style={{ fontSize: '11px', padding: '8px 10px', justifyContent: 'center' }}
              type="button"
            >
              Student View
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
