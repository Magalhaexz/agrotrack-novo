import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
<<<<<<< HEAD
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
=======
import { AuthProvider } from './auth/AuthContext';
import './index.css';
import './styles/tokens.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <AuthProvider>
      <App />
    </AuthProvider>
  </React.StrictMode>
);
>>>>>>> f7f6d2991c81e0a38b5e190db55c7ad82834360d
