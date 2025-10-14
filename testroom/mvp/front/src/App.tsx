import { Routes, Route } from 'react-router-dom'
import HomePage from './pages/HomePage'
import LoginPage from './pages/LoginPage'
import RegisterPage from './pages/RegisterPage'
import ScenarioEditorPage from './pages/ScenarioEditorPage'
import ServicesPage from './pages/ServicesPage'
import ServiceScenariosPage from './pages/ServiceScenariosPage'

function App() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/scenarios" element={<ScenarioEditorPage />} />
      <Route path="/services" element={<ServicesPage />} />
      <Route path="/services/:serviceId" element={<ServiceScenariosPage />} />
    </Routes>
  )
}

export default App
