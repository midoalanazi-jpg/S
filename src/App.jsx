import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import TeacherView from './components/TeacherView';
import AdminView from './components/AdminView';

function App() {
  return (
    <Router>
      <div className="min-h-screen bg-gray-50">
        <Routes>
          <Route path="/" element={<TeacherView />} />
          <Route path="/admin" element={<AdminView />} />
          <Route path="/s/:schoolPhone" element={<TeacherView />} />
          <Route path="/s/:schoolPhone/admin" element={<AdminView />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;

