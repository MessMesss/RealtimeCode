import React, { useState } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';

// Componentleri içeri aktarıyoruz
import AuthScreen from './components/AuthScreen';
import Dashboard from './components/Dashboard';
import EditorRoom from './components/EditorRoom';
import GlobalListener from './components/GlobalListener';

// 🔴 KOYU TEMA SCROLLBAR STİLLERİ
const globalStyles = `
  ::-webkit-scrollbar { width: 8px; height: 8px; }
  ::-webkit-scrollbar-track { background: #121212; border-radius: 4px; }
  ::-webkit-scrollbar-thumb { background: #444; border-radius: 4px; }
  ::-webkit-scrollbar-thumb:hover { background: #666; }
`;

export default function App() {
  const [user, setUser] = useState(localStorage.getItem('loggedUser'));

  const handleLogin = (username) => { localStorage.setItem('loggedUser', username); setUser(username); };
  const handleLogout = () => { localStorage.removeItem('loggedUser'); setUser(null); };
  const updateUsernameState = (newUsername) => { localStorage.setItem('loggedUser', newUsername); setUser(newUsername); };

  if (!user) return (
    <>
      <style>{globalStyles}</style>
      <AuthScreen onLogin={handleLogin} />
    </>
  );

  return (
    <BrowserRouter>
      <style>{globalStyles}</style>
      {user && <GlobalListener user={user} />}
      <Routes>
        <Route path="/" element={<Dashboard username={user} onLogout={handleLogout} updateUsernameState={updateUsernameState} />} />
        <Route path="/room/:roomId" element={<EditorRoom username={user} />} />
      </Routes>
    </BrowserRouter>
  );
}