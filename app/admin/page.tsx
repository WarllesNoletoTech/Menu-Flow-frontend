import { ProtectedDashboard } from '../../components/protected-dashboard';
export default function AdminPage() { return <ProtectedDashboard role="SUPER_ADMIN" />; }
