import './App.css';

import React, { useState, useEffect } from 'react';
import ReconnectingWebSocket from 'reconnecting-websocket';
const App = () => {
    const protocol = window.location.protocol === 'https:' ? 'wss://' : 'ws://';
    const path = '/ws';
    const room = window.location.hash.substr(1) || "";
    const serverUrl = `${protocol}${window.location.host}${path}?room=${room}`;
    const shareUrl = `${window.location.origin}${window.location.pathname}#${room}`;

    const [socket, setSocket] = useState(null);
    const [selectedCard, setSelectedCard] = useState(null);
    const [name, setName] = useState('');



    useEffect(() => {
        const socket = new ReconnectingWebSocket(serverUrl);
        setSocket(socket);
        socket.addEventListener('open', (event) => {
            console.log('WebSocket connection opened:', event);
        });
        socket.addEventListener('message', (event) => {
            const data = JSON.parse(event.data);
            console.log('WebSocket message received:', data);
        });
        return () => {
            socket.close();
        };
    }, []);

    const handleJoin = () => {
        if (name) {
            socket.send(JSON.stringify({type: 'join', user_name: name}));
        }
    };

    const handleReveal = () => {
        socket.send(JSON.stringify({type: 'reveal'}));
    };

    const handleReset = () => {
        socket.send(JSON.stringify({type: 'reset'}));
    };

    return (
        <div>
            <div id="join-container">
                <button id="join" onClick={handleJoin}>Join</button>
                <input id="name" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <button id="reveal" onClick={handleReveal}>Reveal</button>
            <button id="reset" onClick={handleReset}>Reset</button>
        </div>
    );
};

export default App;