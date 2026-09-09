import { ProtectedDashboard } from '../../components/protected-dashboard';
export default function FuncionarioPage() { return <ProtectedDashboard role="EMPLOYEE" />; }
