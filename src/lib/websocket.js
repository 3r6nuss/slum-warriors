import { useState, useEffect, useRef } from 'react';

export function useInventorySocket() {
    const [inventory, setInventory] = useState([]);
    const [connected, setConnected] = useState(false);
    const wsRef = useRef(null);
    const reconnectTimeoutRef = useRef(null);

    useEffect(() => {
        let isConnecting = false;

        const connect = () => {
            if (isConnecting) return;
            isConnecting = true;

            const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
            const host = import.meta.env.DEV ? 'localhost:3001' : window.location.host;
            const wsUrl = `${protocol}//${host}`;

            const ws = new WebSocket(wsUrl);
            wsRef.current = ws;

            ws.onopen = () => {
                console.log('[WS] Connected');
                setConnected(true);
                isConnecting = false;
            };

            ws.onmessage = (event) => {
                try {
                    const message = JSON.parse(event.data);
                    if (message.type === 'inventory_update') {
                        setInventory(message.data);
                    }
                } catch (err) {
                    console.error('[WS] Parse error:', err);
                }
            };

            ws.onclose = () => {
                console.log('[WS] Disconnected, reconnecting in 3s...');
                setConnected(false);
                isConnecting = false;
                reconnectTimeoutRef.current = setTimeout(connect, 3000);
            };

            ws.onerror = (err) => {
                console.error('[WS] Error:', err);
                ws.close();
            };
        };

        connect();

        return () => {
            if (wsRef.current) wsRef.current.close();
            if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
        };
    }, []);

    return { inventory, connected };
}
