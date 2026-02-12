import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Home } from './pages/Home';
import { Login } from './pages/Login';
import { Register } from './pages/Register';
import { MyBookings } from './pages/MyBookings'; // Import

import { AuthProvider } from './context/AuthContext';
import { Navbar } from './components/Navbar'; // Import Navbar here to wrap if we want global navbar

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        {/* We can put Navbar inside pages or here. Current design has Navbar inside pages. */}
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/my-bookings" element={
            <>
              <Navbar />
              <MyBookings />
            </>
          } />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
