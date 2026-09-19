import { Navigate, Route, Routes } from 'react-router-dom';
import { HomePage } from '../pages/HomePage';
import { ArticlesPage } from '../pages/ArticlesPage';
import { BuilderPage } from '../pages/BuilderPage';
import '../styles/tokens.css';
import '../styles/layout.css';
import '../styles/pages.css';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/articles" element={<ArticlesPage />} />
      <Route path="/proposals/:id/edit" element={<BuilderPage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
