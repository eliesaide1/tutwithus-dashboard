import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './context/AuthContext.jsx';
import { ListsProvider } from './context/ListsContext.jsx';
import Layout from './components/Layout.jsx';
import { PageLoader } from './components/Loader.jsx';
import Login from './pages/Login.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Pipeline from './pages/Pipeline.jsx';
import LeadDetail from './pages/LeadDetail.jsx';
import Trials from './pages/Trials.jsx';
import Followups from './pages/Followups.jsx';
import Students from './pages/Students.jsx';
import WeeklyReport from './pages/WeeklyReport.jsx';
import Instructions from './pages/Instructions.jsx';
import Profile from './pages/Profile.jsx';
import NotFound from './pages/NotFound.jsx';

function RequireAuth({ children }) {
  const { isAuthenticated, loading } = useAuth();
  if (loading) return <PageLoader label="Signing you in…" />;
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return children;
}

export default function App() {
  const { isAuthenticated, loading } = useAuth();

  return (
    <Routes>
      <Route
        path="/login"
        element={loading ? <PageLoader /> : isAuthenticated ? <Navigate to="/" replace /> : <Login />}
      />
      <Route
        element={
          <RequireAuth>
            <ListsProvider>
              <Layout />
            </ListsProvider>
          </RequireAuth>
        }
      >
        <Route index element={<Dashboard />} />
        <Route path="pipeline" element={<Pipeline />} />
        <Route path="pipeline/:id" element={<LeadDetail />} />
        <Route path="trials" element={<Trials />} />
        <Route path="followups" element={<Followups />} />
        <Route path="students" element={<Students />} />
        <Route path="report" element={<WeeklyReport />} />
        <Route path="instructions" element={<Instructions />} />
        <Route path="profile" element={<Profile />} />
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  );
}
