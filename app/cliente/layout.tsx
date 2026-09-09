import { PrivateDashboard } from '../../components/dashboard/PrivateDashboard';
export default function CustomerLayout({children}:{children:React.ReactNode}){return <PrivateDashboard role="CUSTOMER">{children}</PrivateDashboard>}
