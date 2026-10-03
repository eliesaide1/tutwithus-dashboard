import { useState } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { Input } from '../components/Field.jsx';
import { Spinner } from '../components/Loader.jsx';
import { IconBolt } from '../components/Icons.jsx';

export default function Login() {
  const { login } = useAuth();
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  async function onSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(form.email.trim(), form.password);
    } catch (err) {
      setError(err.friendlyMessage || 'Could not sign in');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col lg:flex-row">
      {/* Brand panel — hidden on phones so the form is the first thing in view. */}
      <section className="hidden flex-1 flex-col justify-between bg-navy-800 p-10 text-white lg:flex">
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/10 ring-1 ring-white/20">
            <IconBolt className="h-6 w-6" />
          </span>
          <div className="flex flex-col leading-tight">
            <span className="text-lg font-extrabold">TutWithUs</span>
            <span className="text-xs text-navy-200">tutwithus.com</span>
          </div>
        </div>

        <div className="flex max-w-md flex-col gap-4">
          <h1 className="text-3xl font-extrabold leading-tight">Sales &amp; Trial Operations</h1>
          <p className="text-navy-100">
            One live workspace for the master pipeline, trial sessions, follow-ups, active students
            and the Friday investor report.
          </p>
          <ul className="flex flex-col gap-2 text-sm text-navy-100">
            {['Every inquiry logged the same day', 'Every open lead owns a next action', 'Investor numbers generated from live data'].map((t) => (
              <li key={t} className="flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-sky-300" />{t}
              </li>
            ))}
          </ul>
        </div>

        <p className="text-xs text-navy-300">Connecting students with qualified tutors for better learning and brighter futures.</p>
      </section>

      <section className="flex flex-1 items-center justify-center bg-white px-5 py-10 sm:px-8">
        <div className="flex w-full max-w-sm flex-col gap-6">
          <div className="flex flex-col items-center gap-3 lg:hidden">
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-navy-700 text-white">
              <IconBolt className="h-6 w-6" />
            </span>
            <div className="text-center">
              <p className="text-lg font-extrabold text-navy-800">TutWithUs</p>
              <p className="text-xs text-slate-500">Sales &amp; Trial Operations</p>
            </div>
          </div>

          <div className="flex flex-col gap-1">
            <h2 className="text-2xl font-bold text-navy-800">Sign in</h2>
            <p className="text-sm text-slate-500">Use the account your manager created for you.</p>
          </div>

          <form onSubmit={onSubmit} className="flex flex-col gap-4">
            <Input
              label="Email"
              type="email"
              autoComplete="email"
              inputMode="email"
              required
              placeholder="you@tutwithus.com"
              value={form.email}
              onChange={set('email')}
            />
            <Input
              label="Password"
              type="password"
              autoComplete="current-password"
              required
              placeholder="••••••••"
              value={form.password}
              onChange={set('password')}
            />

            {error && (
              <p className="rounded-xl bg-rose-50 px-3 py-2.5 text-sm font-medium text-rose-700">{error}</p>
            )}

            <button type="submit" className="btn-primary w-full py-3" disabled={loading}>
              {loading && <Spinner className="h-4 w-4" />}
              {loading ? 'Signing in…' : 'Sign in'}
            </button>
          </form>

          <p className="text-center text-xs text-slate-400">
            Seeded admin: <span className="font-semibold text-slate-500">admin@tutwithus.com</span>
          </p>
        </div>
      </section>
    </div>
  );
}
