import { Routes, Route, Navigate } from 'react-router-dom'
import Layout from './components/layout/Layout'
import VacanciesPage from './pages/VacanciesPage'

function App() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Navigate to="/vacancies" replace />} />
        <Route path="/vacancies" element={<VacanciesPage />} />
      </Routes>
    </Layout>
  )
}

export default App