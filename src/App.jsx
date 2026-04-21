import React from 'react';
import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';
import TeacherView from './components/TeacherView';
import AdminView from './components/AdminView';
import { LayoutDashboard, GraduationCap } from 'lucide-react';

function App() {
  return (
    <Router>
      <div className="min-h-screen bg-gray-50">
        {/* Navigation for demo purposes - will be hidden in "real" usage or moved to login */}
        <nav className="bg-white border-b border-gray-200 px-4 py-2 sticky top-0 z-50 print:hidden">
          <div className="max-w-7xl mx-auto flex justify-center gap-8">
            <Link 
              to="/" 
              className="flex items-center gap-2 text-sm font-bold text-gray-600 hover:text-indigo-600 transition-all"
            >
              <GraduationCap size={18} /> واجهة المعلم
            </Link>
            <Link 
              to="/admin" 
              className="flex items-center gap-2 text-sm font-bold text-gray-600 hover:text-indigo-600 transition-all"
            >
              <LayoutDashboard size={18} /> واجهة الإدارة
            </Link>
          </div>
        </nav>

        <Routes>
          <Route path="/" element={<TeacherView />} />
          <Route path="/admin" element={<AdminView />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;
