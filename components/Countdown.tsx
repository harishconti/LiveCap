import React, { useState, useEffect } from 'react';

interface CountdownProps {
    onFinish: () => void;
}

const Countdown: React.FC<CountdownProps> = ({ onFinish }) => {
    const [count, setCount] = useState(3);

    useEffect(() => {
        if (count > 0) {
            const timer = setTimeout(() => setCount(count - 1), 1000);
            return () => clearTimeout(timer);
        } else {
            onFinish();
        }
    }, [count, onFinish]);

    return (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50">
            <div key={count} className="text-9xl font-bold text-white animate-bounce">
                {count > 0 ? count : 'GO!'}
            </div>
        </div>
    );
};

export default Countdown;