import { PrivateDashboard } from '../../components/dashboard/PrivateDashboard';
export default function AdminLayout({children}:{children:React.ReactNode}){return <PrivateDashboard role="SUPER_ADMIN">{children}</PrivateDashboard>}
