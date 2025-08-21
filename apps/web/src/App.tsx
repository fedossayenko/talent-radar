import { Routes, Route, Navigate } from 'react-router-dom'
import Layout from './components/layout/Layout'
import VacanciesPage from './pages/VacanciesPage'
import VacancyDetailPage from './pages/VacancyDetailPage'
import AdminPage from './pages/AdminPage'

function App() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Navigate to="/vacancies" replace />} />
        <Route path="/vacancies" element={<VacanciesPage />} />
        <Route path="/vacancies/:id" element={<VacancyDetailPage />} />
        <Route path="/admin" element={<AdminPage />} />
      </Routes>
    </Layout>
  )
}

export default App