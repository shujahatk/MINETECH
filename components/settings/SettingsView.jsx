'use client';
import { ErrorState } from '@/components/ui/error-state';
import { LoadingState } from '@/components/ui/loading-state';
import { PageHeader } from '@/components/ui/page-header';

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
  Database,
  Cpu,
  Sun,
  Moon,
  Monitor,
  Palette,
  Layers,
  Plus,
  Trash2,
  Sparkles,
} from 'lucide-react';
import { toast } from 'sonner';
import { SectionCard } from '@/components/ui/section-card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useTheme } from '@/components/theme/ThemeProvider';

export default function SettingsView() {
  const { theme, setTheme, resolvedTheme } = useTheme();
  const [loadError, setLoadError] = useState('');
  const [data, setData] = useState(null);
  const [section, setSection] = useState('general');
  const [initialGeneral, setInitialGeneral] = useState(null);
  const [loading, setLoading] = useState(true);

  // Account & General Profile
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [lastLogin, setLastLogin] = useState('');
  const [dailyEmailLimit, setDailyEmailLimit] = useState(2500);
  const [centralSendingEmail, setCentralSendingEmail] = useState('outreach@minetechresources.com');
  const [centralReplyTo, setCentralReplyTo] = useState('outreach@minetechresources.com');
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

  // MineTech Mineral Catalog State
  const [categories, setCategories] = useState([]);
  const [industries, setIndustries] = useState([]);
  const [selectedCatIdx, setSelectedCatIdx] = useState(0);
  const [selectedIndIdx, setSelectedIndIdx] = useState(0);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [newGradeName, setNewGradeName] = useState('');
  const [newIndustryName, setNewIndustryName] = useState('');
  const [newAppName, setNewAppName] = useState('');
  const [savingCatalog, setSavingCatalog] = useState(false);
  const [catalogSuccess, setCatalogSuccess] = useState('');

  const fetchCatalog = async () => {
    try {
      const res = await fetch('/api/settings/catalog');
      if (res.ok) {
        const j = await res.json();
        if (j.data) {
          setCategories(j.data.categories || []);
          setIndustries(j.data.industries || []);
        }
      }
    } catch (e) {
      console.error('Failed to load catalog:', e);
    }
  };

  const fetchSettings = async () => {
    try {
      const res = await fetch('/api/settings');
      if (!res.ok) throw new Error('Request failed');
      if (res.ok) {
        setLoadError('');
        const j = await res.json();
        if (j.data) {
          setData(j.data);
          setName(j.data.user?.name || 'MineTech Administrator');
          setEmail(j.data.user?.email || 'admin@minetechresources.com');
          setLastLogin(j.data.user?.lastLogin ? new Date(j.data.user.lastLogin).toLocaleString() : 'Live Session');
          setDailyEmailLimit(j.data.user?.dailyEmailLimit || 2500);
          setCentralSendingEmail(j.data.user?.centralSendingEmail || 'outreach@minetechresources.com');
          setCentralReplyTo(j.data.user?.centralReplyTo || 'outreach@minetechresources.com');
          setInitialGeneral({
            name: j.data.user?.name || 'MineTech Administrator',
            dailyEmailLimit: j.data.user?.dailyEmailLimit || 2500,
            centralSendingEmail: j.data.user?.centralSendingEmail || 'outreach@minetechresources.com',
            centralReplyTo: j.data.user?.centralReplyTo || 'outreach@minetechresources.com',
          });
        }
      }
    } catch (e) {
      setLoadError('Could not load settings. Please try again.');
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSettings();
    fetchCatalog();
  }, []);

  const handleSaveCatalog = async () => {
    setSavingCatalog(true);
    setCatalogSuccess('');
    try {
      const res = await fetch('/api/settings/catalog', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          catalog: {
            categories,
            industries,
          },
        }),
      });
      if (res.ok) {
        setCatalogSuccess('Product Catalog & Taxonomy saved successfully.');
        setTimeout(() => setCatalogSuccess(''), 3000);
      }
    } catch (e) {
      console.error('Error saving catalog:', e);
    } finally {
      setSavingCatalog(false);
    }
  };

  const handleAddCategory = () => {
    if (!newCategoryName.trim()) return;
    const catId = newCategoryName.toLowerCase().replace(/[^a-z0-9]/g, '-');
    const updated = [
      ...categories,
      { id: catId, name: newCategoryName.trim(), grades: ['Standard Grade'] },
    ];
    setCategories(updated);
    setNewCategoryName('');
    setSelectedCatIdx(updated.length - 1);
  };

  const handleRemoveCategory = (idx) => {
    const updated = categories.filter((_, i) => i !== idx);
    setCategories(updated);
    if (selectedCatIdx >= updated.length) setSelectedCatIdx(Math.max(0, updated.length - 1));
  };

  const handleAddGrade = () => {
    if (!newGradeName.trim() || !categories[selectedCatIdx]) return;
    const current = { ...categories[selectedCatIdx] };
    current.grades = [...(current.grades || []), newGradeName.trim()];
    const updated = [...categories];
    updated[selectedCatIdx] = current;
    setCategories(updated);
    setNewGradeName('');
  };

  const handleRemoveGrade = (gradeIdx) => {
    if (!categories[selectedCatIdx]) return;
    const current = { ...categories[selectedCatIdx] };
    current.grades = (current.grades || []).filter((_, i) => i !== gradeIdx);
    const updated = [...categories];
    updated[selectedCatIdx] = current;
    setCategories(updated);
  };

  // Password strength calculations
  const hasMinLength = newPassword.length >= 8;
  const hasUpper = /[A-Z]/.test(newPassword);
  const hasLower = /[a-z]/.test(newPassword);
  const hasNumber = /[0-9]/.test(newPassword);
  const hasSpecial = /[!@#$%^&*(),.?":{}|<>_\-+=~`[\]\\/]/.test(newPassword);

  const passedCount = [hasMinLength, hasUpper, hasLower, hasNumber, hasSpecial].filter(Boolean).length;
  let strengthLabel = 'Weak';
  let strengthColor = 'tone-danger';
  let strengthWidth = '20%';

  if (passedCount >= 5) {
    strengthLabel = 'Optimal';
    strengthColor = 'tone-success';
    strengthWidth = '100%';
  } else if (passedCount >= 3) {
    strengthLabel = 'Moderate';
    strengthColor = 'tone-warning';
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
          centralSendingEmail,
          centralReplyTo,
        }),
      });

      if (res.ok) {
        setGeneralSuccess('Settings saved.');
        setInitialGeneral({ name, dailyEmailLimit, centralSendingEmail, centralReplyTo });
        toast.success('Settings saved');
        setTimeout(() => setGeneralSuccess(''), 4000);
      } else {
        toast.error('Could not save settings');
      }
    } catch (e) {
      toast.error('Error updating settings: ' + e.message);
    } finally {
      setSavingGeneral(false);
    }
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    setPasswordError('');
    setPasswordSuccess('');

    if (!currentPassword) {
      setPasswordError('Please enter your current workstation password.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordError('New passwords do not match.');
      return;
    }

    if (currentPassword === newPassword) {
      setPasswordError('New password must be different from current password.');
      return;
    }

    if (passedCount < 5) {
      setPasswordError('Password does not meet all security policy requirements.');
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
        setPasswordSuccess('Workstation credentials rotated successfully! Re-authenticating...');
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
        setTimeout(() => {
          window.location.href = '/login';
        }, 2000);
      } else {
        setPasswordError(json.message || 'Current password validation failed.');
      }
    } catch (err) {
      setPasswordError('Unable to rotate password. Please check your session.');
    } finally {
      setPasswordLoading(false);
    }
  };

  const handleSignOut = async () => {
    if (!confirm('Sign out of MINETECH Outbound Command Center?')) return;
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } catch (e) {}
    window.location.href = '/login';
  };

  const SECTIONS = [
    { key: 'general', label: 'General', icon: User, hint: 'Profile and session' },
    { key: 'email', label: 'Email', icon: Mail, hint: 'Sender and daily limit' },
    { key: 'ai', label: 'AI', icon: Sparkles, hint: 'Assistant status' },
    { key: 'campaigns', label: 'Campaigns', icon: Layers, hint: 'Mineral catalog' },
    { key: 'access', label: 'Users & access', icon: Shield, hint: 'Password and role' },
    { key: 'appearance', label: 'Appearance', icon: Palette, hint: 'Theme' },
    { key: 'system', label: 'System', icon: Database, hint: 'Connected services' },
  ];

  const integrations = data?.integrations || {};
  const generalDirty = Boolean(initialGeneral) && (
    name !== initialGeneral.name ||
    String(dailyEmailLimit) !== String(initialGeneral.dailyEmailLimit) ||
    centralSendingEmail !== initialGeneral.centralSendingEmail ||
    centralReplyTo !== initialGeneral.centralReplyTo
  );

  const SaveBar = ({ children }) => (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border bg-muted/20 px-4 py-3">
      <div className="flex min-w-0 items-center gap-2 text-xs text-muted-foreground">{children}</div>
      <div className="flex items-center gap-3">
        {generalSuccess ? (
          <span className="anim-fade-in inline-flex items-center gap-1.5 text-xs font-medium text-success">
            <CheckCircle className="h-3.5 w-3.5" /> Saved
          </span>
        ) : generalDirty ? (
          <span className="inline-flex items-center gap-1.5 text-xs text-warning">
            <span className="h-1.5 w-1.5 rounded-full bg-warning" aria-hidden="true" /> Unsaved changes
          </span>
        ) : null}
        <Button type="submit" size="sm" disabled={savingGeneral || !generalDirty} className="gap-1.5">
          <Save className="h-3.5 w-3.5" /> {savingGeneral ? 'Saving...' : 'Save changes'}
        </Button>
      </div>
    </div>
  );

  const statusRow = (icon, label, ok, detail) => {
    const Icon = icon;
    return (
      <div className="flex items-center justify-between gap-3 px-4 py-3">
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted/70 text-muted-foreground">
            <Icon className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            <p className="text-[13px] font-medium text-foreground">{label}</p>
            {detail && <p className="truncate text-xs text-muted-foreground">{detail}</p>}
          </div>
        </div>
        <span className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-medium ${ok ? 'tone-success' : 'tone-warning'}`}>
          <span className={`h-1.5 w-1.5 rounded-full ${ok ? 'bg-success' : 'bg-warning'}`} aria-hidden="true" />
          {ok ? 'Connected' : 'Not configured'}
        </span>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="max-w-6xl space-y-4 pb-12">
        <PageHeader icon={Settings} title="Settings" description="Profile, appearance, security, integrations and outbound limits." className="mb-0" />
        <div className="panel p-0"><LoadingState rows={4} label="Loading settings" /></div>
        <div className="panel p-0"><LoadingState rows={4} label="Loading settings" /></div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl space-y-4 pb-12">
      {loadError && <ErrorState message={loadError} onRetry={() => fetchSettings()} />}

      <PageHeader
        icon={Settings}
        title="Settings"
        description="Profile, appearance, security, integrations and outbound limits."
        className="mb-0"
        actions={
          <Button
            variant="outline"
            size="sm"
            onClick={handleSignOut}
            className="gap-1.5 border-destructive/30 text-destructive hover:bg-destructive/10 hover:text-destructive"
          >
            <LogOut className="h-3.5 w-3.5" /> Sign out
          </Button>
        }
      />

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[220px_minmax(0,1fr)]">
        {/* Section navigation */}
        <nav aria-label="Settings sections" className="lg:sticky lg:top-4 lg:self-start">
          <ul className="flex gap-1 overflow-x-auto pb-1 lg:flex-col lg:overflow-visible lg:pb-0">
            {SECTIONS.map((s) => {
              const active = section === s.key;
              const Icon = s.icon;
              return (
                <li key={s.key} className="shrink-0">
                  <button
                    type="button"
                    onClick={() => setSection(s.key)}
                    aria-current={active ? 'page' : undefined}
                    className={`group flex w-full items-center gap-2.5 rounded-lg border px-3 py-2 text-left transition-colors ${
                      active
                        ? 'border-primary/25 bg-primary/10 text-primary'
                        : 'border-transparent text-muted-foreground hover:bg-muted hover:text-foreground'
                    }`}
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    <span className="min-w-0">
                      <span className="block whitespace-nowrap text-[13px] font-medium leading-tight">{s.label}</span>
                      <span className="hidden truncate text-[11px] font-normal text-muted-foreground lg:block">{s.hint}</span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </nav>

        <div key={section} className="anim-fade-up min-w-0">
          {/* GENERAL */}
          {section === 'general' && (
            <form onSubmit={handleSaveGeneral}>
              <SectionCard
                title="General"
                description="Your profile and current session."
                icon={User}
                flush
                action={<span className="tone-brand rounded border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide">{(data?.user?.role || 'admin').toString()}</span>}
              >
                <div className="grid grid-cols-1 gap-4 p-4 md:grid-cols-2">
                  <div>
                    <label htmlFor="set-name" className="field-label mb-1.5 block">Full name</label>
                    <Input id="set-name" type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Full name" />
                  </div>
                  <div>
                    <label htmlFor="set-email" className="field-label mb-1.5 block">Email address</label>
                    <div className="relative">
                      <Input id="set-email" type="email" disabled value={email} className="cursor-not-allowed pr-9 opacity-70" />
                      <Lock className="absolute right-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
                    </div>
                    <p className="mt-1 text-[11px] text-muted-foreground">Your sign-in address cannot be changed here.</p>
                  </div>
                </div>
                <SaveBar>
                  <Clock className="h-3.5 w-3.5" />
                  <span className="truncate">Session: <strong className="font-medium text-foreground">{lastLogin}</strong></span>
                </SaveBar>
              </SectionCard>
            </form>
          )}

          {/* EMAIL */}
          {section === 'email' && (
            <form onSubmit={handleSaveGeneral} className="space-y-4">
              <SectionCard title="Email sending" description="Sender identity and daily volume for outbound email." icon={Mail} flush>
                <div className="grid grid-cols-1 gap-4 p-4 md:grid-cols-2">
                  <div>
                    <label htmlFor="set-from" className="field-label mb-1.5 block">Verified sending address (From)</label>
                    <Input id="set-from" type="email" value={centralSendingEmail} onChange={(e) => setCentralSendingEmail(e.target.value)} />
                  </div>
                  <div>
                    <label htmlFor="set-reply" className="field-label mb-1.5 block">Reply-to address</label>
                    <Input id="set-reply" type="email" value={centralReplyTo} onChange={(e) => setCentralReplyTo(e.target.value)} />
                  </div>
                  <div>
                    <label htmlFor="set-limit" className="field-label mb-1.5 block">Daily email limit</label>
                    <Input id="set-limit" type="number" value={dailyEmailLimit} onChange={(e) => setDailyEmailLimit(e.target.value)} className="tabular-nums" />
                    <p className="mt-1 text-[11px] text-muted-foreground">Maximum emails dispatched per day.</p>
                  </div>
                </div>
                <SaveBar>
                  <span>Delivery relay:</span>
                  <span className={`inline-flex items-center gap-1.5 font-medium ${integrations.resendConfigured ? 'text-success' : 'text-warning'}`}>
                    <span className={`h-1.5 w-1.5 rounded-full ${integrations.resendConfigured ? 'bg-success' : 'bg-warning'}`} aria-hidden="true" />
                    Resend {integrations.resendConfigured ? 'configured' : 'not configured'}
                  </span>
                </SaveBar>
              </SectionCard>
            </form>
          )}

          {/* AI */}
          {section === 'ai' && (
            <SectionCard title="AI assistant" description="Drafting, lead intelligence and reply analysis." icon={Sparkles} flush>
              <div className="divide-y divide-border/70">
                {statusRow(Cpu, 'AI provider', Boolean(integrations.aiConfigured), integrations.aiConfigured ? 'An AI provider key is configured on the server.' : 'Add an AI provider key to the server environment to enable drafting.')}
                <div className="px-4 py-3 text-xs leading-relaxed text-muted-foreground">
                  AI output is advisory. Drafts are placed in the editor for review, and nothing is sent without a person
                  confirming it. Provider keys are managed in the server environment, not in this screen.
                </div>
              </div>
            </SectionCard>
          )}

          {/* CAMPAIGNS (catalog) */}
          {section === 'campaigns' && (
            <SectionCard
              title="Mineral catalog & taxonomy"
              description="Minerals, product grades and applications used by campaigns and AI drafting."
              icon={Layers}
              action={
                <Button onClick={handleSaveCatalog} disabled={savingCatalog} size="sm" className="gap-1.5">
                  <Save className="h-3.5 w-3.5" /> {savingCatalog ? 'Saving...' : 'Save catalog'}
                </Button>
              }
              bodyClassName="space-y-4"
            >
              {catalogSuccess && (
                <div className="tone-success anim-fade-in flex items-center gap-2 rounded-lg border p-2.5 text-xs">
                  <CheckCircle className="h-4 w-4 shrink-0" />
                  <span>{catalogSuccess}</span>
                </div>
              )}

              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <div className="space-y-2 rounded-lg border border-border bg-muted/20 p-3">
                  <span className="field-label block">Product categories ({categories.length})</span>

                  <div className="max-h-56 space-y-1 overflow-y-auto pr-1">
                    {categories.map((cat, idx) => (
                      <div
                        key={idx}
                        role="button"
                        tabIndex={0}
                        onClick={() => setSelectedCatIdx(idx)}
                        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSelectedCatIdx(idx); } }}
                        className={`flex cursor-pointer items-center justify-between rounded-lg px-2.5 py-2 text-xs font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring/40 ${
                          selectedCatIdx === idx ? 'row-selected' : 'text-foreground hover:bg-muted'
                        }`}
                      >
                        <span className="truncate">{cat.name}</span>
                        <button
                          type="button"
                          aria-label={`Remove ${cat.name}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleRemoveCategory(idx);
                          }}
                          className="rounded p-0.5 text-muted-foreground hover:text-destructive"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>
                    ))}
                  </div>

                  <div className="flex items-center gap-1.5 border-t border-border pt-2">
                    <Input
                      value={newCategoryName}
                      onChange={(e) => setNewCategoryName(e.target.value)}
                      placeholder="New mineral..."
                      aria-label="New mineral category"
                      className="h-7 bg-background text-xs"
                    />
                    <Button type="button" size="sm" onClick={handleAddCategory} aria-label="Add category" className="h-7 shrink-0 px-2.5">
                      <Plus className="h-3 w-3" />
                    </Button>
                  </div>
                </div>

                <div className="space-y-2 rounded-lg border border-border bg-muted/20 p-3 md:col-span-2">
                  <div className="flex items-center justify-between border-b border-border pb-1.5">
                    <span className="field-label">
                      Grades for <strong className="text-foreground">{categories[selectedCatIdx]?.name || 'category'}</strong>
                    </span>
                    <span className="text-[11px] tabular-nums text-muted-foreground">
                      {(categories[selectedCatIdx]?.grades || []).length} grades
                    </span>
                  </div>

                  <div className="max-h-56 space-y-1.5 overflow-y-auto pr-1">
                    {(categories[selectedCatIdx]?.grades || []).map((grade, gIdx) => (
                      <div key={gIdx} className="flex items-center justify-between rounded-lg border border-border bg-card px-2.5 py-2 text-xs text-foreground">
                        <span className="font-medium">{grade}</span>
                        <button
                          type="button"
                          aria-label={`Remove grade ${grade}`}
                          onClick={() => handleRemoveGrade(gIdx)}
                          className="rounded p-0.5 text-muted-foreground transition-colors hover:text-destructive"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>

                  <div className="flex items-center gap-2 border-t border-border pt-2">
                    <Input
                      value={newGradeName}
                      onChange={(e) => setNewGradeName(e.target.value)}
                      placeholder="e.g. Calcined kaolin, Metakaolin..."
                      aria-label="New grade"
                      className="h-8 flex-1 bg-background text-xs"
                    />
                    <Button type="button" size="sm" onClick={handleAddGrade} className="h-8 shrink-0 gap-1 px-3">
                      <Plus className="h-3.5 w-3.5" />
                      <span>Add grade</span>
                    </Button>
                  </div>
                </div>
              </div>
            </SectionCard>
          )}

          {/* USERS & ACCESS */}
          {section === 'access' && (
            <SectionCard title="Password & access" description="Rotate your workstation credentials. You will be signed out afterwards." icon={Shield} bodyClassName="space-y-4">
              {passwordSuccess && (
                <div className="tone-success anim-fade-in flex items-center gap-2 rounded-lg border p-2.5 text-xs">
                  <CheckCircle className="h-4 w-4 shrink-0" />
                  <span>{passwordSuccess}</span>
                </div>
              )}
              {passwordError && (
                <div className="tone-danger anim-fade-in flex items-center gap-2 rounded-lg border p-2.5 text-xs" role="alert">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  <span>{passwordError}</span>
                </div>
              )}

              <form onSubmit={handleChangePassword} className="space-y-4">
                <div className="max-w-md">
                  <label htmlFor="pw-current" className="field-label mb-1.5 block">Current password</label>
                  <div className="relative">
                    <Input id="pw-current" type={showCurrent ? 'text' : 'password'} required value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} placeholder="Current password" className="pr-10" autoComplete="current-password" />
                    <button type="button" onClick={() => setShowCurrent(!showCurrent)} aria-label={showCurrent ? 'Hide password' : 'Show password'} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                      {showCurrent ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div>
                    <label htmlFor="pw-new" className="field-label mb-1.5 block">New password</label>
                    <div className="relative">
                      <Input id="pw-new" type={showNew ? 'text' : 'password'} required value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="New password" className="pr-10" autoComplete="new-password" />
                      <button type="button" onClick={() => setShowNew(!showNew)} aria-label={showNew ? 'Hide password' : 'Show password'} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                        {showNew ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>
                  <div>
                    <label htmlFor="pw-confirm" className="field-label mb-1.5 block">Confirm new password</label>
                    <div className="relative">
                      <Input id="pw-confirm" type={showConfirm ? 'text' : 'password'} required value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="Repeat new password" className="pr-10" autoComplete="new-password" />
                      <button type="button" onClick={() => setShowConfirm(!showConfirm)} aria-label={showConfirm ? 'Hide password' : 'Show password'} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                        {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>
                </div>

                {newPassword && (
                  <div className="anim-fade-in space-y-2 rounded-lg border border-border bg-muted/30 p-3">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-medium text-muted-foreground">Password strength</span>
                      <span className={`rounded-md border px-2 py-0.5 text-[10px] font-semibold ${strengthColor}`}>{strengthLabel}</span>
                    </div>
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-chart-track">
                      <div
                        className={`h-full rounded-full transition-[width] duration-300 ${passedCount >= 5 ? 'bg-success' : passedCount >= 3 ? 'bg-warning' : 'bg-danger'}`}
                        style={{ width: strengthWidth }}
                      />
                    </div>
                    <ul className="grid grid-cols-1 gap-x-4 gap-y-1 pt-1 text-[11px] sm:grid-cols-2">
                      {[
                        ['At least 8 characters', hasMinLength],
                        ['Uppercase letter', hasUpper],
                        ['Lowercase letter', hasLower],
                        ['Number', hasNumber],
                        ['Special character', hasSpecial],
                      ].map(([label, ok]) => (
                        <li key={label} className={`flex items-center gap-1.5 ${ok ? 'text-success' : 'text-muted-foreground'}`}>
                          <CheckCircle className={`h-3 w-3 ${ok ? '' : 'opacity-40'}`} aria-hidden="true" /> {label}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                <Button type="submit" size="sm" disabled={passwordLoading || !currentPassword || !newPassword || !confirmPassword} className="gap-1.5">
                  <Key className="h-3.5 w-3.5" /> {passwordLoading ? 'Updating...' : 'Update password'}
                </Button>
              </form>
            </SectionCard>
          )}

          {/* APPEARANCE */}
          {section === 'appearance' && (
            <SectionCard
              title="Appearance"
              description="Choose how MineTech looks. Changes apply instantly and are remembered on this device."
              icon={Palette}
              action={<span className="text-xs text-muted-foreground">Active: <strong className="font-semibold capitalize text-foreground">{resolvedTheme}</strong></span>}
            >
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3" role="radiogroup" aria-label="Theme">
                {[
                  { key: 'light', label: 'Light', desc: 'Warm off-white surfaces', icon: Sun },
                  { key: 'dark', label: 'Dark', desc: 'Deep neutral surfaces', icon: Moon },
                  { key: 'system', label: 'System', desc: 'Follow your OS setting', icon: Monitor },
                ].map((opt) => {
                  const Icon = opt.icon;
                  const active = theme === opt.key;
                  return (
                    <button
                      key={opt.key}
                      type="button"
                      role="radio"
                      aria-checked={active}
                      onClick={() => setTheme(opt.key)}
                      className={`flex items-center gap-3 rounded-lg border p-3 text-left transition-colors ${
                        active ? 'border-primary bg-primary/10 text-primary ring-1 ring-primary' : 'border-border bg-card text-foreground hover:bg-muted/40'
                      }`}
                    >
                      <span className={`rounded-lg p-2 ${active ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>
                        <Icon className="h-4 w-4" />
                      </span>
                      <span>
                        <span className="block text-xs font-semibold">{opt.label}</span>
                        <span className="block text-[11px] text-muted-foreground">{opt.desc}</span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </SectionCard>
          )}

          {/* SYSTEM */}
          {section === 'system' && (
            <SectionCard title="System status" description="Services this workspace depends on. Status is read from the server configuration." icon={Database} flush>
              <div className="divide-y divide-border/70">
                {statusRow(Database, 'Supabase database', Boolean(integrations.supabaseConnected), 'Primary data store')}
                {statusRow(Mail, 'Resend email relay', Boolean(integrations.resendConfigured), 'Outbound delivery')}
                {statusRow(Cpu, 'AI provider', Boolean(integrations.aiConfigured), 'Drafting and lead intelligence')}
                {statusRow(Layers, 'Listmonk', Boolean(integrations.listmonkConnected), integrations.listmonkUrl || integrations.listmonkStatus || 'Campaign delivery engine')}
              </div>
            </SectionCard>
          )}
        </div>
      </div>
    </div>
  );
}
