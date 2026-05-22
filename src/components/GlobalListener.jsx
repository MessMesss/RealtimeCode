import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

export default function GlobalListener({ user }) {
    const navigate = useNavigate();
    const [incomingInvite, setIncomingInvite] = useState(null);

    useEffect(() => {
        if (!user) return;
        const globalWs = new WebSocket('wss://realtimecode-mr24.onrender.com');
        globalWs.onopen = () => globalWs.send(JSON.stringify({ type: 'init', username: user }));

        globalWs.onmessage = (e) => {
            if (e.data instanceof Blob) return;
            try {
                const data = JSON.parse(e.data);
                if (data.type === 'invite_received') {
                    setIncomingInvite({ sender: data.sender, roomName: data.roomName, roomId: data.roomId });
                }
            } catch (err) { }
        };
        return () => globalWs.close();
    }, [user]);

    if (!incomingInvite) return null;

    return (
        <div style={{ position: 'fixed', top: '20px', left: '50%', transform: 'translateX(-50%)', backgroundColor: '#1e1e1e', padding: '20px', borderRadius: '12px', boxShadow: '0 8px 32px rgba(0,0,0,0.8)', zIndex: 9999, border: '1px solid #85c46c', textAlign: 'center' }}>
            <h3 style={{ color: '#fff', margin: '0 0 10px 0' }}>🎉 Odaya Davet Edildin!</h3>
            <p style={{ color: '#d4d4d4', fontSize: '14px', marginBottom: '20px' }}>
                <b style={{ color: '#85c46c' }}>{incomingInvite.sender}</b> seni <b>{incomingInvite.roomName}</b> odasına çağırıyor.
            </p>
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
                <button onClick={() => { navigate(`/room/${incomingInvite.roomId}`); setIncomingInvite(null); }} style={{ padding: '8px 16px', backgroundColor: '#85c46c', color: '#121212', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' }}>Işınlan</button>
                <button onClick={() => setIncomingInvite(null)} style={{ padding: '8px 16px', backgroundColor: '#d32f2f', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' }}>Reddet</button>
            </div>
        </div>
    );
}