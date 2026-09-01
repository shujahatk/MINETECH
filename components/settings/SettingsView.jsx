'use client';

import React, { useState, useEffect } from 'react';
import {
  Settings,
  Mail,
  Key,
  Shield,
  CheckCircle,
  Save,
  AlertCircle,
  Eye,
  EyeOff,
  User,
  LogOut,
  Lock,
  Clock,
  Phone,
  Sparkles,
  Check,
  X,
} from 'lucide-react';

export default function SettingsView() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  // Account & General Profile
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [lastLogin, setLastLogin] = useState('');
  const [dailyEmailLimit, setDailyEmailLimit] = useState(200);
  const [dailyCallTarget, setDailyCallTarget] = useState(50);
  const [centralSendingEmail, setCentralSendingEmail] = useState('');
  const [centralReplyTo, setCentralReplyTo] = useState('');
  const [savingGeneral, setSavingGeneral] = useState(false);
  const [generalSuccess, setGeneralSuccess] = useState('');

  // Password Management
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [passwordError, setPasswordError] = useState('');
  const [passwordSuccess, setPasswordSuccess] = useState('');

  const fetchSettings = async () => {
    try {
      const res = await fetch('/api/settings');
      if (res.ok) {
        const j = await res.json();
        if (j.data) {
          setData(j.data);
          setName(j.data.user?.name || '');
          setEmail(j.data.user?.email || 'admin@8020outbound.com');
          setLastLogin(j.data.user?.lastLogin ? new Date(j.data.user.lastLogin).toLocaleString() : 'Recent');
          setDailyEmailLimit(j.data.user?.dailyEmailLimit || 200);
          setDailyCallTarget(j.data.user?.dailyCallTarget || 50);
          setCentralSendingEmail(j.data.user?.centralSendingEmail || '');
          setCentralReplyTo(j.data.user?.centralReplyTo || '');
        }
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  // Password strength calculations
  const hasMinLength = newPassword.length >= 8;
  const hasUpper = /[A-Z]/.test(newPassword);
  const hasLower = /[a-z]/.test(newPassword);
  const hasNumber = /[0-9]/.test(newPassword);
  const hasSpecial = /[!@#$%^&*(),.?":{}|<>_\-+=~`[\]\\/]/.test(newPassword);

  const passedCount = [hasMinLength, hasUpper, hasLower, hasNumber, hasSpecial].filter(Boolean).length;
  let strengthLabel = 'Weak';
  let strengthColor = 'bg-rose-500 text-rose-300';
  let strengthWidth = '20%';

  if (passedCount >= 5) {
    strengthLabel = 'Strong';
    strengthColor = 'bg-emerald-500 text-emerald-300';
    strengthWidth = '100%';
  } else if (passedCount >= 3) {
    strengthLabel = 'Medium';
    strengthColor = 'bg-amber-500 text-amber-300';
    strengthWidth = '60%';
  }

  const handleSaveGeneral = async (e) => {
    e.preventDefault();
    setSavingGeneral(true);
    setGeneralSuccess('');

    try {
      const res = await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          dailyEmailLimit: parseInt(dailyEmailLimit, 10),
          dailyCallTarget: parseInt(dailyCallTarget, 10),
          centralSendingEmail,
          centralReplyTo,
        }),
      });

      if (res.ok) {
        setGeneralSuccess('Settings updated successfully.');
        setTimeout(() => setGeneralSuccess(''), 4000);
      }
    } catch (e) {
      alert('Error updating settings');
    } finally {
      setSavingGeneral(false);
    }
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    setPasswordError('');
    setPasswordSuccess('');

    if (!currentPassword) {
      setPasswordError('Please enter your current password.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordError('New passwords do not match.');
      return;
    }

    if (currentPassword === newPassword) {
      setPasswordError('New password must be different from your current password.');
      return;
    }

    if (passedCount < 5) {
      setPasswordError('Password does not meet all security requirements.');
      return;
    }

    setPasswordLoading(true);

    try {
      const res = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          currentPassword,
          newPassword,
          confirmPassword,
        }),
      });

      const json = await res.json();

      if (res.ok) {
        setPasswordSuccess('Password changed successfully! Redirecting to login...');
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
        setTimeout(() => {
          window.location.href = '/login';
        }, 2000);
      } else {
        setPasswordError(json.message || 'Current password is incorrect.');
      }
    } catch (err) {
      setPasswordError('Unable to change password right now. Please try again.');
    } finally {
      setPasswordLoading(false);
    }
  };

  const handleSignOut = async () => {
    if (!confirm('Are you sure you want to sign out of your workstation?')) return;
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
      window.location.href = '/login';
    } catch (e) {
      window.location.href = '/login';
    }
  };

  if (loading) {
    return <div className="p-12 text-center text-xs text-slate-500">Loading settings...</div>;
  }

  const integrations = data?.integrations || {};

  return (
    <div className="space-y-8 max-w-4xl pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
            <Settings className="w-6 h-6 text-slate-400" /> Account Settings & Security
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Manage your personal profile credentials, password security, and outbound routing.
          </p>
        </div>

        <button
          onClick={handleSignOut}
          className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 text-xs font-semibold transition"
        >
          <LogOut className="w-4 h-4" /> Sign Out
        </button>
      </div>

      {generalSuccess && (
        <div className="p-3.5 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2">
          <CheckCircle className="w-4 h-4 shrink-0" />
          <span>{generalSuccess}</span>
        </div>
      )}

      {/* System Architecture & Health Overview */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
        <div className="p-4 rounded-2xl glass-panel border border-slate-800 flex flex-col justify-between">
          <div>
            <span className="text-xs font-bold text-white block">MongoDB CRM</span>
            <span className="text-[10px] text-slate-500 block mt-0.5">Primary Source of Truth</span>
          </div>
          <div className="mt-3 flex items-center gap-1.5">
            <span className={`w-2 h-2 rounded-full ${integrations.mongodbConnected ? 'bg-emerald-400 animate-pulse' : 'bg-emerald-500/80'}`}></span>
            <span className="text-[11px] font-mono text-emerald-400 font-semibold">
              {integrations.mongodbConnected ? 'Connected' : 'Active (Local)'}
            </span>
          </div>
        </div>

        <div className="p-4 rounded-2xl glass-panel border border-slate-800 flex flex-col justify-between">
          <div>
            <span className="text-xs font-bold text-white block">Listmonk Engine</span>
            <span className="text-[10px] text-slate-500 block mt-0.5">Docker Bulk Campaign</span>
          </div>
          <div className="mt-3 flex items-center gap-1.5">
            <span className={`w-2 h-2 rounded-full ${integrations.listmonkConnected ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'}`}></span>
            <span className={`text-[11px] font-mono font-semibold ${integrations.listmonkConnected ? 'text-emerald-400' : 'text-amber-400'}`}>
              {integrations.listmonkConnected ? 'Connected' : 'Dev Ready'}
            </span>
          </div>
        </div>

        <div className="p-4 rounded-2xl glass-panel border border-slate-800 flex flex-col justify-between">
          <div>
            <span className="text-xs font-bold text-white block">PostgreSQL (Docker)</span>
            <span className="text-[10px] text-slate-500 block mt-0.5">Listmonk Exclusive DB</span>
          </div>
          <div className="mt-3 flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-indigo-400"></span>
            <span className="text-[11px] font-mono text-indigo-400 font-semibold">Configured</span>
          </div>
        </div>

        <div className="p-4 rounded-2xl glass-panel border border-slate-800 flex flex-col justify-between">
          <div>
            <span className="text-xs font-bold text-white block">Resend SMTP</span>
            <span className="text-[10px] text-slate-500 block mt-0.5">Listmonk Outbound Relay</span>
          </div>
          <div className="mt-3 flex items-center gap-1.5">
            <span className={`w-2 h-2 rounded-full ${integrations.resendConfigured ? 'bg-emerald-400' : 'bg-slate-500'}`}></span>
            <span className={`text-[11px] font-mono font-semibold ${integrations.resendConfigured ? 'text-emerald-400' : 'text-slate-400'}`}>
              {integrations.resendConfigured ? 'Ready' : 'Configured'}
            </span>
          </div>
        </div>

        <div className="p-4 rounded-2xl glass-panel border border-slate-800 flex flex-col justify-between">
          <div>
            <span className="text-xs font-bold text-white block">Twilio Channels</span>
            <span className="text-[10px] text-slate-500 block mt-0.5">Voice & SMS Relay</span>
          </div>
          <div className="mt-3 flex items-center gap-1.5">
            <span className={`w-2 h-2 rounded-full ${integrations.twilioConfigured ? 'bg-emerald-400' : 'bg-slate-500'}`}></span>
            <span className={`text-[11px] font-mono font-semibold ${integrations.twilioConfigured ? 'text-emerald-400' : 'text-slate-400'}`}>
              {integrations.twilioConfigured ? 'Active' : 'Unconfigured'}
            </span>
          </div>
        </div>
      </div>

      {/* 1. ACCOUNT SECTION */}
      <div className="p-6 rounded-3xl glass-panel border border-slate-800 space-y-5">
        <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
          <div className="flex items-center gap-2">
            <User className="w-5 h-5 text-indigo-400" />
            <h2 className="text-sm font-bold text-white uppercase tracking-wider">Account Profile</h2>
          </div>
          <span className="px-2.5 py-0.5 text-[10px] font-bold rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
            Active Single-User
          </span>
        </div>

        <form onSubmit={handleSaveGeneral} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-semibold text-slate-400 block mb-1.5">User Full Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Your Name"
                className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-400 block mb-1.5">
                Authorized Login Email (Username)
              </label>
              <div className="relative">
                <input
                  type="email"
                  disabled
                  value={email}
                  className="w-full bg-slate-950 border border-slate-800/80 rounded-xl px-3.5 py-2.5 text-xs text-slate-400 font-mono cursor-not-allowed"
                />
                <Lock className="w-3.5 h-3.5 text-slate-500 absolute right-3.5 top-1/2 -translate-y-1/2" />
              </div>
              <span className="text-[10px] text-slate-500 block mt-1">Configured in workstation authentication.</span>
            </div>
          </div>

          <div className="flex items-center justify-between pt-2">
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <Clock className="w-3.5 h-3.5" />
              <span>Last Login: <strong className="text-slate-300 font-mono">{lastLogin}</strong></span>
            </div>

            <button
              type="submit"
              disabled={savingGeneral}
              className="flex items-center gap-2 px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-bold transition shadow-md shadow-indigo-600/20"
            >
              <Save className="w-3.5 h-3.5" /> {savingGeneral ? 'Saving...' : 'Save Profile'}
            </button>
          </div>
        </form>
      </div>

      {/* 2. SECURITY & PASSWORD MANAGEMENT SECTION */}
      <div className="p-6 rounded-3xl glass-panel border border-slate-800 space-y-5">
        <div className="border-b border-slate-800/80 pb-3">
          <div className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-purple-400" />
            <h2 className="text-sm font-bold text-white uppercase tracking-wider">Security & Password Management</h2>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            Update your password with policy enforcement and automatic session renewal.
          </p>
        </div>

        {passwordSuccess && (
          <div className="p-3.5 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2">
            <CheckCircle className="w-4 h-4 shrink-0" />
            <span>{passwordSuccess}</span>
          </div>
        )}

        {passwordError && (
          <div className="p-3.5 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{passwordError}</span>
          </div>
        )}

        <form onSubmit={handleChangePassword} className="space-y-4">
          <div>
            <label className="text-xs font-semibold text-slate-400 block mb-1.5">Current Password</label>
            <div className="relative max-w-md">
              <input
                type={showCurrent ? 'text' : 'password'}
                required
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="••••••••••••"
                className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-3.5 pr-10 py-2.5 text-xs text-white focus:outline-none focus:border-purple-500"
              />
              <button
                type="button"
                onClick={() => setShowCurrent(!showCurrent)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
              >
                {showCurrent ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-semibold text-slate-400 block mb-1.5">New Password</label>
              <div className="relative">
                <input
                  type={showNew ? 'text' : 'password'}
                  required
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-3.5 pr-10 py-2.5 text-xs text-white focus:outline-none focus:border-purple-500"
                />
                <button
                  type="button"
                  onClick={() => setShowNew(!showNew)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
                >
                  {showNew ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-400 block mb-1.5">Confirm New Password</label>
              <div className="relative">
                <input
                  type={showConfirm ? 'text' : 'password'}
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-3.5 pr-10 py-2.5 text-xs text-white focus:outline-none focus:border-purple-500"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirm(!showConfirm)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
                >
                  {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
          </div>

          {/* Password Strength Meter */}
          {newPassword && (
            <div className="p-3.5 rounded-2xl bg-slate-950/60 border border-slate-800/80 space-y-2.5">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-400 font-semibold">Password Strength:</span>
                <span className={`font-bold font-mono text-[11px] px-2 py-0.5 rounded-md ${strengthColor}`}>
                  {strengthLabel}
                </span>
              </div>
              <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
                <div
                  className={`h-full ${passedCount >= 5 ? 'bg-emerald-500' : passedCount >= 3 ? 'bg-amber-500' : 'bg-rose-500'} transition-all duration-300`}
                  style={{ width: strengthWidth }}
                ></div>
              </div>

              {/* Requirements Checklist */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-1 text-[11px]">
                <div className={`flex items-center gap-1.5 ${hasMinLength ? 'text-emerald-400 font-medium' : 'text-slate-500'}`}>
                  {hasMinLength ? <Check className="w-3.5 h-3.5" /> : <X className="w-3.5 h-3.5" />}
                  <span>8+ characters</span>
                </div>
                <div className={`flex items-center gap-1.5 ${hasUpper ? 'text-emerald-400 font-medium' : 'text-slate-500'}`}>
                  {hasUpper ? <Check className="w-3.5 h-3.5" /> : <X className="w-3.5 h-3.5" />}
                  <span>Uppercase (A-Z)</span>
                </div>
                <div className={`flex items-center gap-1.5 ${hasLower ? 'text-emerald-400 font-medium' : 'text-slate-500'}`}>
                  {hasLower ? <Check className="w-3.5 h-3.5" /> : <X className="w-3.5 h-3.5" />}
                  <span>Lowercase (a-z)</span>
                </div>
                <div className={`flex items-center gap-1.5 ${hasNumber ? 'text-emerald-400 font-medium' : 'text-slate-500'}`}>
                  {hasNumber ? <Check className="w-3.5 h-3.5" /> : <X className="w-3.5 h-3.5" />}
                  <span>Number (0-9)</span>
                </div>
                <div className={`flex items-center gap-1.5 ${hasSpecial ? 'text-emerald-400 font-medium' : 'text-slate-500'}`}>
                  {hasSpecial ? <Check className="w-3.5 h-3.5" /> : <X className="w-3.5 h-3.5" />}
                  <span>Special char (!@#)</span>
                </div>
              </div>
            </div>
          )}

          <div className="pt-2">
            <button
              type="submit"
              disabled={passwordLoading || !currentPassword || !newPassword || !confirmPassword}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 disabled:opacity-40 text-white text-xs font-bold transition shadow-lg shadow-purple-600/25"
            >
              <Key className="w-3.5 h-3.5" /> {passwordLoading ? 'Updating Password...' : 'Change Password'}
            </button>
          </div>
        </form>
      </div>

      {/* 3. EMAIL OUTREACH CONFIGURATION */}
      <div className="p-6 rounded-3xl glass-panel border border-slate-800 space-y-4">
        <div className="flex items-center gap-2 border-b border-slate-800/80 pb-3">
          <Mail className="w-5 h-5 text-indigo-400" />
          <h2 className="text-sm font-bold text-white uppercase tracking-wider">Email Dispatch & Central Mailbox</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="text-xs font-semibold text-slate-400 block mb-1.5">Central Sending Address (From)</label>
            <input
              type="email"
              value={centralSendingEmail}
              onChange={(e) => setCentralSendingEmail(e.target.value)}
              placeholder="outreach@yourdomain.com"
              className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-indigo-500"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-400 block mb-1.5">Reply-To Routing Address</label>
            <input
              type="email"
              value={centralReplyTo}
              onChange={(e) => setCentralReplyTo(e.target.value)}
              placeholder="outreach@yourdomain.com"
              className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-indigo-500"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-400 block mb-1.5">Daily Email Dispatch Limit</label>
            <input
              type="number"
              value={dailyEmailLimit}
              onChange={(e) => setDailyEmailLimit(e.target.value)}
              className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-indigo-500"
            />
          </div>
        </div>
      </div>

      {/* 4. TWILIO CHANNELS CONFIGURATION */}
      <div className="p-6 rounded-3xl glass-panel border border-slate-800 space-y-4">
        <div className="flex items-center gap-2 border-b border-slate-800/80 pb-3">
          <Phone className="w-5 h-5 text-emerald-400" />
          <h2 className="text-sm font-bold text-white uppercase tracking-wider">Twilio Voice & SMS Configuration</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="text-xs font-semibold text-slate-400 block mb-1.5">Daily Phone Call Target</label>
            <input
              type="number"
              value={dailyCallTarget}
              onChange={(e) => setDailyCallTarget(e.target.value)}
              className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-emerald-500"
            />
          </div>

          <div className="p-3.5 rounded-2xl bg-slate-900/60 border border-slate-800 flex items-center justify-between">
            <div>
              <span className="text-xs font-bold text-white block">Twilio Integration</span>
              <span className="text-[10px] text-slate-400 block mt-0.5">
                {integrations.twilioConfigured ? 'Connected & Ready' : 'Configured via .env'}
              </span>
            </div>
            <span
              className={`px-2.5 py-0.5 text-[10px] font-bold rounded-full uppercase ${
                integrations.twilioConfigured
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                  : 'bg-slate-800 text-slate-400'
              }`}
            >
              {integrations.twilioConfigured ? 'Active' : 'Unconfigured'}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
