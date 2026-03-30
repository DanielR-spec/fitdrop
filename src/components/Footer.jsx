import React from 'react';
import { Link } from 'react-router-dom';
import './Footer.css';

const Footer = () => {
  return (
    <footer className="footer animate-fade-in">
      <div className="page-container footer-container">
        <h2 className="footer-logo text-gradient">FitDrop</h2>
        
        <div className="footer-contact">
          <p>¿Necesitas ayuda con tu pedido?</p>
          <a href="mailto:fitdrop66+help@gmail.com" className="footer-email">
            fitdrop66+help@gmail.com
          </a>
        </div>

        <div className="footer-copyright">
          &copy; {new Date().getFullYear()} FitDrop. Todos los derechos reservados.
        </div>
      </div>
    </footer>
  );
};

export default Footer;
