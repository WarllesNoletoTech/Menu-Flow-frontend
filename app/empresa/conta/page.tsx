import { AccountPage } from '../../../components/dashboard/AccountPage';import { DashboardProvider } from '../../../components/dashboard/DashboardContext';
export default function Page(){return <DashboardProvider><AccountPage role="RESTAURANT_ADMIN"/></DashboardProvider>}
