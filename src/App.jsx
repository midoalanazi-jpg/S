import React from 'react';
import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';
import TeacherView from './components/TeacherView';
import AdminView from './components/AdminView';
import { LayoutDashboard, GraduationCap } from 'lucide-react';

function App() {
  return (
    <Router>
      <div className="min-h-screen bg-gray-50">
        <Routes>
          <Route path="/" element={<TeacherView />} />
          <Route path="/admin" element={<AdminView />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;
