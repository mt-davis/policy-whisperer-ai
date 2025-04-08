
import React from 'react';
import { MessageSquare } from 'lucide-react';

const Header = () => {
  return (
    <header className="bg-primary text-white p-4 shadow-md">
      <div className="container mx-auto flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <MessageSquare className="h-6 w-6" />
          <h1 className="text-xl font-bold">Policy Whisperer AI</h1>
        </div>
        <div className="text-sm">
          Translating policy into clarity
        </div>
      </div>
    </header>
  );
};

export default Header;
