import { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { initials } from '../lib/format.js';
import {
  IconDashboard, IconPipeline, IconTrial, IconPhone, IconStudents,
  IconReport, IconSettings, IconMenu, IconClose, IconLogout, IconBolt,
} from './Icons.jsx';

/** Order matches the workbook's tab strip. */
export const NAV = [
  { to: '/', label: 'Dashboard', icon: IconDashboard, end: true, mobile: true },
  { to: '/pipeline', label: 'Master Pipeline', short: 'Pipeline', icon: IconPipeline, mobile: true },
  { to: '/trials', label: 'Trial Sessions', short: 'Trials', icon: IconTrial, mobile: true },
  { to: '/followups', label: 'Follow-ups', short: 'Follow-ups', icon: IconPhone, mobile: true },
  { to: '/students', label: 'Active Students', short: 'Students', icon: IconStudents, mobile: true },
  { to: '/report', label: 'Weekly Investor Report', short: 'Report', icon: IconReport },
  { to: '/instructions', label: 'Instructions & Lists', short: 'Lists', icon: IconSettings },
];

/** Five items fit a phone tab bar; the rest live behind "More". */
const MOBILE_NAV = NAV.filter((n) => n.mobile);

function Brand({ compact = false }) {
  return (
    <div className="flex items-center gap-2.5">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/10 text-white ring-1 ring-white/20">
        <IconBolt className="h-5 w-5" />
      </span>
      {!compact && (
        <div className="flex min-w-0 flex-col leading-tight">
          <span className="truncate text-sm font-extrabold tracking-tight text-white">TutWithUs</span>
          <span className="truncate text-[11px] text-navy-200">Sales &amp; Trial Ops</span>
        </div>
      )}
    </div>
  );
}

function NavItems({ onNavigate }) {
  return (
    <nav className="flex flex-1 flex-col gap-1 overflow-y-auto px-3 py-4">
      {NAV.map(({ to, label, icon: Icon, end }) => (
        <NavLink
          key={to}
          to={to}
          end={end}
          onClick={onNavigate}
          className={({ isActive }) =>
            `flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${
              isActive ? 'bg-white/15 text-white' : 'text-navy-100 hover:bg-white/10 hover:text-white'
            }`
          }
        >
          <Icon className="h-5 w-5 shrink-0" />
          <span className="truncate">{label}</span>
        </NavLink>
      ))}
    </nav>
  );
}

function UserBlock({ onNavigate }) {
  const { user, logout } = useAuth();
  return (
    <div className="flex flex-col gap-2 border-t border-white/10 px-3 py-4">
      <NavLink
        to="/profile"
        onClick={onNavigate}
        className="flex items-center gap-3 rounded-xl px-2 py-1.5 transition hover:bg-white/10"
      >
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/15 text-xs font-bold text-white">
          {initials(user?.name)}
        </span>
        <div className="flex min-w-0 flex-1 flex-col leading-tight">
          <span className="truncate text-sm font-semibold text-white">{user?.name}</span>
          <span className="truncate text-[11px] capitalize text-navy-200">{user?.role}</span>
        </div>
      </NavLink>

      {/* Labelled, full-width — an icon-only control here was too easy to miss. */}
      <button
        type="button"
        onClick={logout}
        className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold
                   text-navy-100 transition hover:bg-rose-500/20 hover:text-white"
      >
        <IconLogout className="h-5 w-5 shrink-0" />
        Sign out
      </button>
    </div>
  );
}

export default function Layout() {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const location = useLocation();

  useEffect(() => { setDrawerOpen(false); }, [location.pathname]);

  const current = NAV.find((n) => (n.end ? n.to === location.pathname : location.pathname.startsWith(n.to)));

  return (
    <div className="flex min-h-screen bg-slate-100">
      {/* ---------- desktop sidebar ---------- */}
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col bg-navy-800 lg:flex">
        <div className="flex items-center px-4 py-5"><Brand /></div>
        <NavItems />
        <UserBlock />
      </aside>

      {/* ---------- mobile drawer ---------- */}
      {drawerOpen && (
        <div className="fixed inset-0 z-50 flex lg:hidden">
          <button type="button" aria-label="Close menu" onClick={() => setDrawerOpen(false)}
                  className="absolute inset-0 animate-fade-in bg-navy-900/60" />
          <div className="relative flex h-full w-72 max-w-[85%] animate-fade-in flex-col bg-navy-800">
            <div className="flex items-center justify-between px-4 py-5">
              <Brand />
              <button type="button" onClick={() => setDrawerOpen(false)} className="rounded-lg p-2 text-navy-200 hover:bg-white/10">
                <IconClose />
              </button>
            </div>
            <NavItems onNavigate={() => setDrawerOpen(false)} />
            <UserBlock onNavigate={() => setDrawerOpen(false)} />
          </div>
        </div>
      )}

      {/* ---------- main column ---------- */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* mobile top bar */}
        <header className="sticky top-0 z-30 flex items-center gap-3 bg-navy-800 px-4 py-3 lg:hidden"
                style={{ paddingTop: 'max(0.75rem, env(safe-area-inset-top))' }}>
          <button type="button" onClick={() => setDrawerOpen(true)} className="rounded-lg p-1.5 text-white hover:bg-white/10" aria-label="Open menu">
            <IconMenu />
          </button>
          <span className="min-w-0 flex-1 truncate text-sm font-bold text-white">{current?.label || 'TutWithUs'}</span>
          <Brand compact />
        </header>

        <main className="flex-1 px-3 pb-24 pt-3 sm:px-5 sm:pb-8 sm:pt-5 lg:px-7 lg:pb-10">
          <div className="mx-auto flex w-full max-w-[1500px] flex-col gap-4 sm:gap-5">
            <Outlet />
          </div>
        </main>

        {/* mobile bottom tab bar */}
        <nav className="fixed inset-x-0 bottom-0 z-30 flex border-t border-slate-200 bg-white/95 backdrop-blur lg:hidden"
             style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
          {MOBILE_NAV.map(({ to, short, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                `flex flex-1 flex-col items-center gap-0.5 px-1 py-2 text-[10px] font-semibold transition ${
                  isActive ? 'text-navy-700' : 'text-slate-400'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <span className={`flex h-7 w-12 items-center justify-center rounded-full transition ${isActive ? 'bg-navy-100' : ''}`}>
                    <Icon className="h-5 w-5" />
                  </span>
                  <span className="truncate">{short || label}</span>
                </>
              )}
            </NavLink>
          ))}
        </nav>
      </div>
    </div>
  );
}
