'use client';
import { BusinessHoursEditor } from '../../../components/empresa/BusinessHoursEditor';import { useEmpresa } from '../../../components/empresa/EmpresaContext';export default function Page(){const{request}=useEmpresa();return <BusinessHoursEditor request={request} endpoint="/restaurants/me/business-hours"/>}
