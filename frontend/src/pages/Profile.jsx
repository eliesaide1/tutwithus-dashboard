import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { authApi } from '../api/endpoints.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useLists } from '../context/ListsContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import PageHeader from '../components/PageHeader.jsx';
import SectionCard from '../components/SectionCard.jsx';
import Modal from '../components/Modal.jsx';
import Badge from '../components/Badge.jsx';
import { Input, Select, FormGrid } from '../components/Field.jsx';
import { Spinner } from '../components/Loader.jsx';
import { IconPlus, IconUser, IconLogout } from '../components/Icons.jsx';
import { formatDateTime, initials } from '../lib/format.js';

const ROLE_STYLES = {
  admin: 'bg-navy-100 text-navy-800',
  manager: 'bg-indigo-100 text-indigo-800',
  agent: 'bg-sky-100 text-sky-800',
  tutor: 'bg-emerald-100 text-emerald-800',
  viewer: 'bg-slate-100 text-slate-600',
};

function UserModal({ open, onClose, user }) {
  const lists = useLists();
  const toast = useToast();
  const queryClient = useQueryClient();
  const isEdit = Boolean(user?._id);
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'agent', ownerAlias: '', phone: '', active: true });

  useEffect(() => {
    if (!open) return;
    setForm(user ? { ...user, password: '' } : { name: '', email: '', password: '', role: 'agent', ownerAlias: '', phone: '', active: true });
  }, [open, user]);

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const mutation = useMutation({
    mutationFn: (payload) => (isEdit ? authApi.updateUser(user._id, payload) : authApi.register(payload)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      toast.success(isEdit ? 'User updated' : 'User created');
      onClose();
    },
    onError: (err) => toast.error(err.friendlyMessage),
  });

  return (
    <Modal
      open={open} onClose={onClose} size="sm"
      title={isEdit ? `Edit ${user.name}` : 'Add team member'}
      footer={
        <>
          <button type="button" className="btn-secondary w-full sm:w-auto" onClick={onClose}>Cancel</button>
          <button type="submit" form="user-form" className="btn-primary w-full sm:w-auto" disabled={mutation.isPending}>
            {mutation.isPending && <Spinner className="h-4 w-4" />} Save
          </button>
        </>
      }
    >
      <form id="user-form" className="flex flex-col gap-4"
            onSubmit={(e) => {
              e.preventDefault();
              const payload = { ...form };
              if (isEdit && !payload.password) delete payload.password;
              ['_id', 'id', '__v', 'createdAt', 'updatedAt', 'lastLoginAt'].forEach((k) => delete payload[k]);
              mutation.mutate(payload);
            }}>
        <FormGrid>
          <Input label="Name" required value={form.name} onChange={set('name')} />
          <Input label="Email" type="email" required disabled={isEdit} value={form.email} onChange={set('email')} />
          <Input label={isEdit ? 'New password (optional)' : 'Password'} type="password" required={!isEdit}
                 value={form.password} onChange={set('password')} hint="At least 8 characters" />
          <Select label="Role" options={lists.role || ['admin', 'manager', 'agent', 'tutor', 'viewer']} value={form.role} onChange={set('role')} />
          <Select label="Lead owner alias" placeholder="Not linked" options={lists.leadOwner || []} value={form.ownerAlias || ''} onChange={set('ownerAlias')} />
          <Input label="Phone" value={form.phone || ''} onChange={set('phone')} />
        </FormGrid>
        {isEdit && (
          <label className="flex items-center gap-3 rounded-xl bg-slate-50 px-3.5 py-3">
            <input type="checkbox" className="h-5 w-5 rounded border-slate-300 text-navy-600"
                   checked={form.active} onChange={(e) => setForm((f) => ({ ...f, active: e.target.checked }))} />
            <span className="text-sm text-navy-800">Account active</span>
          </label>
        )}
      </form>
    </Modal>
  );
}

export default function Profile() {
  const { user, setUser, isManager, isAdmin, logout } = useAuth();
  const lists = useLists();
  const toast = useToast();
  const [profile, setProfile] = useState({ name: '', phone: '', ownerAlias: '' });
  const [passwords, setPasswords] = useState({ currentPassword: '', newPassword: '' });
  const [userModal, setUserModal] = useState({ open: false, user: null });

  useEffect(() => {
    if (user) setProfile({ name: user.name || '', phone: user.phone || '', ownerAlias: user.ownerAlias || '' });
  }, [user]);

  const { data: users } = useQuery({
    queryKey: ['users'],
    queryFn: authApi.listUsers,
    enabled: isManager,
  });

  const updateProfile = useMutation({
    mutationFn: () => authApi.updateMe(profile),
    onSuccess: (res) => { setUser(res.data); toast.success('Profile updated'); },
    onError: (err) => toast.error(err.friendlyMessage),
  });

  const changePassword = useMutation({
    mutationFn: () => authApi.changePassword(passwords),
    onSuccess: () => { setPasswords({ currentPassword: '', newPassword: '' }); toast.success('Password changed'); },
    onError: (err) => toast.error(err.friendlyMessage),
  });

  return (
    <>
      <PageHeader title="My profile" subtitle={user?.email} />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <SectionCard title="Details">
          <form className="flex flex-col gap-4" onSubmit={(e) => { e.preventDefault(); updateProfile.mutate(); }}>
            <div className="flex items-center gap-3">
              <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-navy-700 text-sm font-bold text-white">
                {initials(user?.name)}
              </span>
              <div className="flex flex-col">
                <span className="text-sm font-semibold text-navy-800">{user?.name}</span>
                <Badge value={user?.role} map={ROLE_STYLES} />
              </div>
            </div>
            <Input label="Name" value={profile.name} onChange={(e) => setProfile((p) => ({ ...p, name: e.target.value }))} />
            <Input label="Phone" value={profile.phone} onChange={(e) => setProfile((p) => ({ ...p, phone: e.target.value }))} />
            <Select label="Lead owner alias" placeholder="Not linked" options={lists.leadOwner || []}
                    value={profile.ownerAlias} onChange={(e) => setProfile((p) => ({ ...p, ownerAlias: e.target.value }))} />
            <button type="submit" className="btn-primary self-start" disabled={updateProfile.isPending}>
              {updateProfile.isPending && <Spinner className="h-4 w-4" />} Save profile
            </button>
          </form>
        </SectionCard>

        <SectionCard title="Password">
          <form className="flex flex-col gap-4" onSubmit={(e) => { e.preventDefault(); changePassword.mutate(); }}>
            <Input label="Current password" type="password" required
                   value={passwords.currentPassword} onChange={(e) => setPasswords((p) => ({ ...p, currentPassword: e.target.value }))} />
            <Input label="New password" type="password" required hint="At least 8 characters"
                   value={passwords.newPassword} onChange={(e) => setPasswords((p) => ({ ...p, newPassword: e.target.value }))} />
            <button type="submit" className="btn-primary self-start" disabled={changePassword.isPending}>
              {changePassword.isPending && <Spinner className="h-4 w-4" />} Change password
            </button>
          </form>
        </SectionCard>
      </div>

      {isManager && (
        <SectionCard
          title="Team"
          subtitle={`${users?.data?.length || 0} account(s)`}
          bodyClassName="p-0"
          actions={isAdmin && (
            <button type="button" className="rounded-lg bg-white px-2.5 py-1 text-xs font-semibold text-navy-700 hover:bg-navy-50"
                    onClick={() => setUserModal({ open: true, user: null })}>
              <IconPlus className="mr-1 inline h-3.5 w-3.5" /> Add
            </button>
          )}
        >
          <ul className="flex flex-col divide-y divide-slate-100">
            {(users?.data || []).map((u) => (
              <li key={u._id} className="flex items-center gap-3 px-4 py-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-bold text-slate-600">
                  {initials(u.name)}
                </span>
                <div className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate text-sm font-semibold text-navy-800">{u.name}</span>
                  <span className="truncate text-xs text-slate-500">
                    {u.email}{u.ownerAlias ? ` · ${u.ownerAlias}` : ''}
                    {u.lastLoginAt ? ` · last seen ${formatDateTime(u.lastLoginAt)}` : ''}
                  </span>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <Badge value={u.role} map={ROLE_STYLES} />
                  {!u.active && <Badge value="Inactive" fallback="bg-rose-100 text-rose-700" />}
                  {isAdmin && (
                    <button type="button" className="btn-ghost btn-sm" onClick={() => setUserModal({ open: true, user: u })}>
                      <IconUser className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </SectionCard>
      )}

      <SectionCard title="Session">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-slate-600">
            Signed in as <span className="font-semibold text-navy-800">{user?.email}</span>
          </p>
          <button type="button" className="btn-danger w-full sm:w-auto" onClick={logout}>
            <IconLogout className="h-4 w-4" /> Sign out
          </button>
        </div>
      </SectionCard>

      <UserModal open={userModal.open} user={userModal.user} onClose={() => setUserModal({ open: false, user: null })} />
    </>
  );
}
