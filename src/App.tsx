import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './AuthContext';
import { ThemeProvider } from './ThemeContext';
import { AuthGuard } from './components/AuthGuard';
import Layout from './components/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Inventory from './pages/Inventory';
import Sales from './pages/Sales';
import Outlets from './pages/Outlets';
import Users from './pages/Users';
import StockTransfers from './pages/StockTransfer';
import Transactions from './pages/Transactions';

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<Login />} />
            
            <Route element={<AuthGuard><Layout /></AuthGuard>}>
              <Route path="/" element={<Dashboard />} />
              <Route path="/inventory" element={<Inventory />} />
              <Route path="/sales" element={<Sales />} />
              <Route path="/transactions" element={<Transactions />} />
              <Route path="/transfers" element={<AuthGuard requiredRole="manager"><StockTransfers /></AuthGuard>} />
              <Route path="/outlets" element={<AuthGuard requiredRole="admin"><Outlets /></AuthGuard>} />
              <Route path="/users" element={<AuthGuard requiredRole="admin"><Users /></AuthGuard>} />
            </Route>

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </ThemeProvider>
  );
}
