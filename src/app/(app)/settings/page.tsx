'use client'

export const dynamic = 'force-dynamic'

import { useEffect, useState, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Plus, Pencil, Trash2, Settings2, User, Lock, Camera, Check, AlertCircle } from 'lucide-react'
import type { DeliverablesConfig, DeliverableFormData } from '@/types'

const emptyDel: DeliverableFormData = { name: '', days_before_show: 14 }

type Toast = { type: 'success' | 'error'; message: string }

export default function SettingsPage() {
  // Profile
  const [name, setName]         = useState('')
  const [role, setRole]         = useState('')
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)
  const [profileSaving, setProfileSaving] = useState(false)

  // Account
  const [currentEmail, setCurrentEmail] = useState('')
  const [newEmail, setNewEmail]         = useState('')
  const [newPassword, setNewPassword]   = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [accountSaving, setAccountSaving] = useState(false)

  // Deliverables
  const [configs, setConfigs]         = useState<DeliverablesConfig[]>([])
  const [configsLoading, setConfigsLoading] = useState(true)
  const [modalOpen, setModalOpen]     = useState(false)
  const [editing, setEditing]         = useState<DeliverablesConfig | null>(null)
  const [form, setForm]               = useState<DeliverableFormData>(emptyDel)
  const [deleteTarget, setDeleteTarget] = useState<DeliverablesConfig | null>(null)
  const [delSaving, setDelSaving]     = useState(false)

  const [toast, setToast]   = useState<Toast | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const saveInFlight = useRef(false)

  function showToast(type: Toast['type'], message: string) {
    setToast({ type, message })
    setTimeout(() => setToast(null), 3500)
  }

  useEffect(() => {
    const supabase = createClient()
    Promise.all([
      supabase.auth.getUser(),
      supabase.from('profiles').select('*').single(),
      supabase.from('deliverables_config').select('*').order('days_before_show', { ascending: false }),
    ]).then(([{ data: { user } }, profileRes, configsRes]) => {
      if (user) setCurrentEmail(user.email ?? '')
      if (profileRes.data) {
        setName(profileRes.data.name ?? '')
        setRole(profileRes.data.role ?? '')
        setAvatarUrl(profileRes.data.avatar_url ?? null)
      }
      setConfigs((configsRes.data as DeliverablesConfig[]) ?? [])
      setConfigsLoading(false)
    })
  }, [])

  function handleAvatarClick() { fileInputRef.current?.click() }

  function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = ev => setAvatarUrl(ev.target?.result as string)
    reader.readAsDataURL(file)
  }

  async function handleProfileSave() {
    setProfileSaving(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { error } = await supabase.from('profiles').upsert({
      id: user.id, name, role, avatar_url: avatarUrl, onboarding_complete: true,
    })
    setProfileSaving(false)
    if (error) showToast('error', 'Failed to save profile')
    else showToast('success', 'Profile saved')
  }

  async function handleAccountSave() {
    if (newPassword && newPassword !== confirmPassword) {
      showToast('error', 'Passwords do not match')
      return
    }
    setAccountSaving(true)
    const supabase = createClient()
    const updates: { email?: string; password?: string } = {}
    if (newEmail && newEmail !== currentEmail) updates.email = newEmail
    if (newPassword) updates.password = newPassword
    if (Object.keys(updates).length === 0) {
      setAccountSaving(false)
      showToast('error', 'No changes to save')
      return
    }
    const { error } = await supabase.auth.updateUser(updates)
    setAccountSaving(false)
    if (error) showToast('error', error.message)
    else {
      showToast('success', 'Account updated')
      if (updates.email) setCurrentEmail(updates.email)
      setNewEmail(''); setNewPassword(''); setConfirmPassword('')
    }
  }

  async function fetchConfigs() {
    const supabase = createClient()
    const { data } = await supabase.from('deliverables_config').select('*').order('days_before_show', { ascending: false })
    setConfigs((data as DeliverablesConfig[]) ?? [])
  }

  async function handleDelSave() {
    if (saveInFlight.current || !form.name.trim()) return
    saveInFlight.current = true
    setDelSaving(true)
    const supabase = createClient()
    if (editing) {
      await supabase.from('deliverables_config').update({ name: form.name, days_before_show: form.days_before_show }).eq('id', editing.id)
    } else {
      await supabase.from('deliverables_config').insert(form)
    }
    await fetchConfigs()
    setDelSaving(false)
    saveInFlight.current = false
    setModalOpen(false)
  }

  async function handleDelete(config: DeliverablesConfig) {
    const supabase = createClient()
    await supabase.from('deliverables_config').delete().eq('id', config.id)
    setDeleteTarget(null)
    fetchConfigs()
  }

  return (
    <div className="p-8 space-y-6 max-w-2xl">
      {/* Toast */}
      {toast && (
        <div className={`fixed top-6 right-6 z-50 flex items-center gap-2.5 rounded-xl px-4 py-3 text-sm font-medium text-white shadow-lg transition-all ${
          toast.type === 'success' ? 'bg-zinc-900' : 'bg-red-600'
        }`}>
          {toast.type === 'success' ? <Check className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
          {toast.message}
        </div>
      )}

      <div>
        <h1 className="text-2xl font-bold text-zinc-900">Settings</h1>
        <p className="text-zinc-500 mt-1">Manage your profile and account</p>
      </div>

      {/* ── Profile ── */}
      <div className="rounded-2xl border border-zinc-200 bg-white shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-zinc-100 flex items-center gap-2">
          <User className="h-4 w-4 text-zinc-500" />
          <h2 className="font-semibold text-zinc-900 text-sm">Profile</h2>
        </div>
        <div className="p-6 space-y-5">
          {/* Avatar */}
          <div className="flex items-center gap-4">
            <div className="relative">
              <div className="h-16 w-16 rounded-full bg-zinc-200 overflow-hidden flex items-center justify-center">
                {avatarUrl ? (
                  <img src={avatarUrl} alt="Avatar" className="h-full w-full object-cover" />
                ) : (
                  <User className="h-7 w-7 text-zinc-400" />
                )}
              </div>
              <button
                onClick={handleAvatarClick}
                className="absolute -bottom-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full bg-zinc-900 text-white hover:bg-zinc-700 transition-colors"
              >
                <Camera className="h-3 w-3" />
              </button>
              <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarChange} />
            </div>
            <div>
              <p className="text-sm font-semibold text-zinc-800">{name || 'Your Name'}</p>
              <p className="text-xs text-zinc-500">{role || 'Your Role'}</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-zinc-700 mb-1.5">Full Name</label>
              <input
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="Eden Jannides"
                className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm text-zinc-800 focus:outline-none focus:ring-2 focus:ring-[#14C29F]/40 focus:border-[#14C29F]"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-zinc-700 mb-1.5">Role</label>
              <input
                value={role}
                onChange={e => setRole(e.target.value)}
                placeholder="Marketing Manager"
                className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm text-zinc-800 focus:outline-none focus:ring-2 focus:ring-[#14C29F]/40 focus:border-[#14C29F]"
              />
            </div>
          </div>

          <div className="flex justify-end">
            <button
              onClick={handleProfileSave}
              disabled={profileSaving}
              className="rounded-lg px-4 py-2 text-sm font-semibold text-white disabled:opacity-50 transition-opacity hover:opacity-90"
              style={{ backgroundColor: '#14C29F' }}
            >
              {profileSaving ? 'Saving…' : 'Save Profile'}
            </button>
          </div>
        </div>
      </div>

      {/* ── Account ── */}
      <div className="rounded-2xl border border-zinc-200 bg-white shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-zinc-100 flex items-center gap-2">
          <Lock className="h-4 w-4 text-zinc-500" />
          <h2 className="font-semibold text-zinc-900 text-sm">Account</h2>
        </div>
        <div className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-zinc-700 mb-1.5">Email Address</label>
            <input
              type="email"
              defaultValue={currentEmail}
              onChange={e => setNewEmail(e.target.value)}
              className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm text-zinc-800 focus:outline-none focus:ring-2 focus:ring-[#14C29F]/40 focus:border-[#14C29F]"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-zinc-700 mb-1.5">New Password</label>
              <input
                type="password"
                value={newPassword}
                onChange={e => setNewPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm text-zinc-800 focus:outline-none focus:ring-2 focus:ring-[#14C29F]/40 focus:border-[#14C29F]"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-zinc-700 mb-1.5">Confirm Password</label>
              <input
                type="password"
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm text-zinc-800 focus:outline-none focus:ring-2 focus:ring-[#14C29F]/40 focus:border-[#14C29F]"
              />
            </div>
          </div>
          <div className="flex justify-end">
            <button
              onClick={handleAccountSave}
              disabled={accountSaving}
              className="rounded-lg px-4 py-2 text-sm font-semibold text-white disabled:opacity-50 transition-opacity hover:opacity-90"
              style={{ backgroundColor: '#14C29F' }}
            >
              {accountSaving ? 'Saving…' : 'Update Account'}
            </button>
          </div>
        </div>
      </div>

      {/* ── Deliverables Template ── */}
      <div className="rounded-2xl border border-zinc-200 bg-white shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-zinc-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Settings2 className="h-4 w-4 text-zinc-500" />
            <h2 className="font-semibold text-zinc-900 text-sm">Deliverables Template</h2>
          </div>
          <button
            onClick={() => { setEditing(null); setForm(emptyDel); setModalOpen(true) }}
            className="flex items-center gap-1 rounded-lg border border-zinc-200 px-2.5 py-1.5 text-xs font-medium text-zinc-600 hover:bg-zinc-50 transition-colors"
          >
            <Plus className="h-3.5 w-3.5" /> Add
          </button>
        </div>
        <p className="px-6 pt-4 pb-2 text-xs text-zinc-500">
          Auto-created for every show. Edit timing here — future shows will use the updated schedule.
        </p>
        {configsLoading ? (
          <div className="p-6 space-y-2">
            {[1,2,3].map(n => <div key={n} className="h-10 rounded-xl bg-zinc-100 animate-pulse" />)}
          </div>
        ) : (
          <div className="p-4 space-y-1.5">
            {configs.length === 0 ? (
              <p className="text-xs text-zinc-400 text-center py-6">No deliverables configured.</p>
            ) : configs.map(config => (
              <div key={config.id} className="group flex items-center justify-between rounded-xl bg-zinc-50 px-4 py-2.5">
                <div>
                  <p className="text-xs font-semibold text-zinc-800">{config.name}</p>
                  <p className="text-[10px] text-zinc-500">{config.days_before_show}d before show</p>
                </div>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={() => { setEditing(config); setForm({ name: config.name, days_before_show: config.days_before_show }); setModalOpen(true) }}
                    className="rounded-lg p-1.5 text-zinc-500 hover:bg-zinc-200 transition-colors">
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                  <button onClick={() => setDeleteTarget(config)}
                    className="rounded-lg p-1.5 text-zinc-500 hover:bg-red-50 hover:text-red-500 transition-colors">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Deliverable Modal */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'Edit Deliverable' : 'Add Deliverable'} size="sm">
        <div className="space-y-4">
          <Input id="del-name" label="Task Name *" value={form.name}
            onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Show Announcement EDM" />
          <Input id="del-days" label="Days Before Show *" type="number" min={1} value={form.days_before_show}
            onChange={e => setForm(f => ({ ...f, days_before_show: parseInt(e.target.value) || 0 }))} />
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="secondary" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button loading={delSaving} onClick={handleDelSave}>{editing ? 'Save Changes' : 'Add'}</Button>
          </div>
        </div>
      </Modal>

      {/* Delete Modal */}
      <Modal open={!!deleteTarget} onClose={() => setDeleteTarget(null)} title="Delete Deliverable" size="sm">
        <p className="text-sm text-zinc-600">Delete <strong>{deleteTarget?.name}</strong>? Won't affect existing tasks.</p>
        <div className="flex justify-end gap-3 mt-6">
          <Button variant="secondary" onClick={() => setDeleteTarget(null)}>Cancel</Button>
          <Button variant="danger" onClick={() => deleteTarget && handleDelete(deleteTarget)}>Delete</Button>
        </div>
      </Modal>
    </div>
  )
}
