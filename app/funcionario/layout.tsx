import { PrivateDashboard } from '../../components/dashboard/PrivateDashboard';
export default function EmployeeLayout({children}:{children:React.ReactNode}){return <PrivateDashboard role="EMPLOYEE">{children}</PrivateDashboard>}
