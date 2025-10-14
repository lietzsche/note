import { useParams } from 'react-router-dom'
import ScenarioEditor from '../components/ScenarioEditor'

export default function ServiceScenariosPage() {
  const params = useParams()
  const serviceId = params.serviceId as string
  const basePath = `/api/services/${serviceId}/scenarios`
  return <ScenarioEditor basePath={basePath} />
}

