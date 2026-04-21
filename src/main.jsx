import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import { AuthProvider } from './auth/AuthContext'; // Importa o provedor de autenticação
import './index.css'; // Estilos globais
import './styles/tokens.css'; // Variáveis CSS (tokens de design)

// Renderiza a aplicação React no elemento com id 'root' no HTML
ReactDOM.createRoot(document.getElementById('root')).render(
  // React.StrictMode ajuda a identificar problemas potenciais na aplicação durante o desenvolvimento
  <React.StrictMode>
    {/* AuthProvider envolve toda a aplicação para fornecer o contexto de autenticação */}
    <AuthProvider>
      <App /> {/* Componente principal da aplicação */}
    </AuthProvider>
  </React.StrictMode>
);