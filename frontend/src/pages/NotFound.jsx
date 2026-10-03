import { Link } from 'react-router-dom';
import EmptyState from '../components/EmptyState.jsx';
import { IconAlert } from '../components/Icons.jsx';

export default function NotFound() {
  return (
    <div className="card">
      <EmptyState
        icon={IconAlert}
        title="Page not found"
        message="That screen does not exist in this workspace."
        action={<Link to="/" className="btn-primary">Back to dashboard</Link>}
      />
    </div>
  );
}
