
import React from 'react';

const Footer = () => {
  return (
    <footer className="bg-primary text-white p-4 mt-10">
      <div className="container mx-auto text-center">
        <p className="text-sm">
          &copy; {new Date().getFullYear()} Policy Whisperer AI | 
          Making policy accessible through technology
        </p>
        <div className="mt-2 text-xs text-gray-300">
          <span>Powered by trusted, non-partisan government data sources</span>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
