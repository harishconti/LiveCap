
import React from 'react';

const VisualIndicator: React.FC = () => {
    return (
        <div className="fixed top-4 left-4 flex items-center space-x-2 bg-gray-800 bg-opacity-80 p-2 rounded-lg z-40">
            <div className="w-4 h-4 bg-red-500 rounded-full animate-pulse"></div>
            <span className="text-sm font-semibold text-red-400">REC</span>
        </div>
    );
};

export default VisualIndicator;
