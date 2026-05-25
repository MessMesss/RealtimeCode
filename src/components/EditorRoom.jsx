import React, { useState, useEffect, useRef } from 'react';
import Editor from '@monaco-editor/react';
import * as Y from 'yjs';
import { MonacoBinding } from 'y-monaco';
import { useParams, useNavigate } from 'react-router-dom';

export default function EditorRoom({ username }) {
    const { roomId } = useParams();
    const navigate = useNavigate();
    const [messages, setMessages] = useState([]);
    const [inputMessage, setInputMessage] = useState('');
    const [activeUsers, setActiveUsers] = useState([]);
    const [roomName, setRoomName] = useState('Yükleniyor...');
    const [onlineFriends, setOnlineFriends] = useState([]);

    // Ses Durumları
    const [isAudioOn, setIsAudioOn] = useState(false);

    // 🔴 YENİ: React'ı çıldırtmamak ve bağlantıyı koparmamak için Ref kullandık!
    const isAudioOnRef = useRef(false);

    const localStreamRef = useRef(null);
    const peerConnections = useRef({});
    const wsRef = useRef(null);
    const ydocRef = useRef(new Y.Doc());

    const fetchOnlineFriends = async () => {
        try {
            const res = await fetch(`https://realtimecode-mr24.onrender.com/api/friends/${username}`);
            const data = await res.json();
            setOnlineFriends(data.filter(f => f.isOnline));
        } catch (err) { }
    };

    useEffect(() => {
        fetch('https://realtimecode-mr24.onrender.com/api/join-room', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username, roomId }) });
        fetch(`https://realtimecode-mr24.onrender.com/api/room/${roomId}`).then(res => res.json()).then(data => { if (data.roomName) setRoomName(data.roomName); });

        fetchOnlineFriends();
        const interval = setInterval(fetchOnlineFriends, 5000);

        const ws = new WebSocket('wss://realtimecode-mr24.onrender.com');
        wsRef.current = ws;
        ws.onopen = () => ws.send(JSON.stringify({ type: 'join', room: roomId, username: username }));

        ws.onmessage = async (event) => {
            if (event.data instanceof Blob) {
                const arrayBuffer = await event.data.arrayBuffer();
                Y.applyUpdate(ydocRef.current, new Uint8Array(arrayBuffer));
                return;
            }
            try {
                const received = JSON.parse(event.data);
                if (received.type === 'users') setActiveUsers(received.data);
                if (received.type === 'chat') setMessages((prev) => [...prev, received.data]);

                if (received.type === 'signal') {
                    handleSignalingMessage(received.sender, received.data);
                }

                if (received.type === 'audio_action') {
                    const { sender, action } = received;
                    // 🔴 DÜZELTME: isAudioOn yerine isAudioOnRef.current kullanıyoruz. (Bağlantı artık kopmayacak)
                    if (action === 'join' && isAudioOnRef.current) {
                        createPeerConnection(sender, true);
                    } else if (action === 'leave') {
                        closePeerConnection(sender);
                    }
                }

            } catch (err) { }
        };

        return () => {
            ws.close();
            clearInterval(interval);
            stopAudio();
        }
        // 🔴 DÜZELTME: isAudioOn ve isMuted bağımlılıklarını sildik! 
    }, [roomId, username]);

    function handleEditorDidMount(editor, monaco) {
        const ytext = ydocRef.current.getText('monaco');
        ydocRef.current.on('update', (update) => { if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) wsRef.current.send(update); });
        new MonacoBinding(ytext, editor.getModel(), new Set([editor]), null);
    }

    function executeSendMessage() {
        if (inputMessage.trim() !== '' && wsRef.current) {
            wsRef.current.send(JSON.stringify({ type: 'chat', data: { sender: username, text: inputMessage.trim() } }));
            setInputMessage('');
        }
    }

    // Ses Bağlantısını Başlatma
    const startAudio = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            localStreamRef.current = stream;

            setIsAudioOn(true);
            isAudioOnRef.current = true; // Ref'i güncelliyoruz

            wsRef.current.send(JSON.stringify({ type: 'audio_action', sender: username, action: 'join' }));
        } catch (err) {
            alert("Mikrofon izni verilmedi abi! Ayarlardan tarayıcı mikrofon iznini açman lazım.");
        }
    };

    // Ses Bağlantısını Komple Kapatma
    const stopAudio = () => {
        if (localStreamRef.current) {
            localStreamRef.current.getTracks().forEach(track => track.stop());
            localStreamRef.current = null;
        }
        Object.keys(peerConnections.current).forEach(peerName => closePeerConnection(peerName));

        setIsAudioOn(false);
        isAudioOnRef.current = false; // Ref'i güncelliyoruz

        if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify({ type: 'audio_action', sender: username, action: 'leave' }));
        }
    };

    const createPeerConnection = (peerUsername, isInitiator) => {
        if (peerConnections.current[peerUsername]) return;

        const pc = new RTCPeerConnection({
            iceServers: [
                { urls: 'stun:stun.l.google.com:19302' },
                { urls: 'stun:stun1.l.google.com:19302' },
                {
                    urls: "turn:openrelay.metered.ca:80",
                    username: "openrelayproject",
                    credential: "openrelayproject"
                }
            ]
        });

        peerConnections.current[peerUsername] = pc;

        if (localStreamRef.current) {
            localStreamRef.current.getTracks().forEach(track => {
                pc.addTrack(track, localStreamRef.current);
            });
        }

        pc.onicecandidate = (event) => {
            if (event.candidate && wsRef.current) {
                wsRef.current.send(JSON.stringify({ type: 'signal', sender: username, target: peerUsername, data: { candidate: event.candidate } }));
            }
        };

        pc.ontrack = (event) => {
            let audioEl = document.getElementById(`audio-${peerUsername}`);
            if (!audioEl) {
                audioEl = document.createElement('audio');
                audioEl.id = `audio-${peerUsername}`;
                audioEl.autoplay = true;
                document.body.appendChild(audioEl);
            }
            audioEl.srcObject = event.streams[0];

            audioEl.onloadedmetadata = () => {
                audioEl.play().catch(e => console.log("Oynatma engeli:", e));
            };
        };

        if (isInitiator) {
            pc.onnegotiationneeded = async () => {
                try {
                    const offer = await pc.createOffer();
                    await pc.setLocalDescription(offer);
                    wsRef.current.send(JSON.stringify({ type: 'signal', sender: username, target: peerUsername, data: { sdp: pc.localDescription } }));
                } catch (err) { }
            };
        }
    };

    const handleSignalingMessage = async (sender, data) => {
        if (!peerConnections.current[sender]) {
            createPeerConnection(sender, false);
        }
        const pc = peerConnections.current[sender];

        try {
            if (data.sdp) {
                await pc.setRemoteDescription(new RTCSessionDescription(data.sdp));
                if (data.sdp.type === 'offer') {
                    const answer = await pc.createAnswer();
                    await pc.setLocalDescription(answer);
                    wsRef.current.send(JSON.stringify({ type: 'signal', sender: username, target: sender, data: { sdp: pc.localDescription } }));
                }
            } else if (data.candidate) {
                if (pc.remoteDescription) {
                    await pc.addIceCandidate(new RTCIceCandidate(data.candidate));
                } else {
                    setTimeout(async () => {
                        try {
                            if (pc.remoteDescription) await pc.addIceCandidate(new RTCIceCandidate(data.candidate));
                        } catch (e) { }
                    }, 1500);
                }
            }
        } catch (err) {
            console.error("Sinyal hatası:", err);
        }
    };

    return (
        <div style={{ display: 'flex', height: '100vh', width: '100vw', backgroundColor: '#121212', color: '#fff', fontFamily: 'sans-serif', margin: 0, padding: '20px', boxSizing: 'border-box', gap: '20px', overflow: 'hidden' }}>

            {/* SOL PANEL */}
            <div style={{ width: '320px', height: '100%', display: 'flex', flexDirection: 'column', backgroundColor: '#1a1a1a', borderRadius: '16px', boxSizing: 'border-box', boxShadow: '0 4px 12px rgba(0,0,0,0.3)', padding: '20px' }}>

                {/* Oda Bilgisi */}
                <div style={{ backgroundColor: '#252526', padding: '15px', borderRadius: '10px', marginBottom: '15px', border: '1px solid #333' }}>
                    <h3 style={{ color: '#d4d4d4', margin: '0 0 5px 0', fontSize: '16px' }}>{roomName}</h3>
                    <p style={{ fontSize: '12px', color: '#888', margin: 0 }}>Oda ID: <span style={{ color: '#85c46c', fontWeight: 'bold' }}>{roomId}</span></p>
                </div>

                {/* SES PANELI */}
                <div style={{ backgroundColor: isAudioOn ? '#1c3a1e' : '#252526', padding: '15px', borderRadius: '10px', marginBottom: '20px', border: isAudioOn ? '1px solid #4caf50' : '1px solid #333', transition: '0.3s' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: '13px', fontWeight: 'bold', color: isAudioOn ? '#85c46c' : '#aaa' }}>
                            {isAudioOn ? '📡 Ses Bağlantısı Aktif' : '🔇 Ses Kanalı Kapalı'}
                        </span>
                        <button onClick={isAudioOn ? stopAudio : startAudio} style={{ padding: '6px 12px', backgroundColor: isAudioOn ? '#d32f2f' : '#4caf50', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', fontSize: '12px' }}>
                            {isAudioOn ? 'Ayrıl' : 'Sese Bağlan'}
                        </button>
                    </div>
                </div>

                {/* Odadakiler */}
                <div style={{ marginBottom: '20px', paddingBottom: '20px', borderBottom: '1px solid #2d2d2d' }}>
                    <h4 style={{ color: '#85c46c', marginTop: 0, marginBottom: '12px', fontSize: '14px', textTransform: 'uppercase', letterSpacing: '1px' }}>👥 Odadakİler</h4>
                    <ul style={{ listStyleType: 'none', padding: 0, margin: 0, maxHeight: '100px', overflowY: 'auto' }}>
                        {activeUsers.map((user, idx) => (
                            <li key={idx} style={{ padding: '6px 0', color: user === username ? '#4caf50' : '#4ea8de', fontWeight: 'bold', fontSize: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <span style={{ fontSize: '10px' }}>🟢</span> {user} {user === username ? <span style={{ fontSize: '11px', color: '#888' }}>(Sen)</span> : ''}
                            </li>
                        ))}
                    </ul>
                </div>

                {/* Chat */}
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                    <h4 style={{ color: '#d4d4d4', margin: '0 0 12px 0', fontSize: '14px', textTransform: 'uppercase', letterSpacing: '1px' }}>💬 Sohbet</h4>
                    <div style={{ flex: 1, marginBottom: '12px', padding: '12px', borderRadius: '8px', backgroundColor: '#252526', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        {messages.map((msg, index) => (
                            <div key={index} style={{ fontSize: '13px', backgroundColor: '#1a1a1a', padding: '10px 12px', borderRadius: '8px', borderLeft: `3px solid ${msg.sender === username ? '#85c46c' : '#4ea8de'}` }}>
                                <b style={{ color: msg.sender === username ? '#85c46c' : '#4ea8de', display: 'block', marginBottom: '4px', fontSize: '11px' }}>{msg.sender}</b>
                                <span style={{ color: '#d4d4d4', lineHeight: '1.4' }}>{msg.text}</span>
                            </div>
                        ))}
                    </div>
                    <div style={{ display: 'flex', gap: '8px', width: '100%' }}>
                        <input type="text" placeholder="Mesaj yaz..." value={inputMessage} onChange={(e) => setInputMessage(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && executeSendMessage()} style={{ flex: 1, padding: '12px', backgroundColor: '#252526', border: '1px solid #333', color: '#fff', borderRadius: '8px', outline: 'none', boxSizing: 'border-box' }} />
                        <button onClick={executeSendMessage} style={{ backgroundColor: '#85c46c', color: '#121212', border: 'none', padding: '0 16px', cursor: 'pointer', borderRadius: '8px', fontWeight: 'bold' }}>➤</button>
                    </div>
                </div>
            </div>

            {/* SAĞ PANEL */}
            <div style={{ flex: 1, height: '100%', display: 'flex', flexDirection: 'column', backgroundColor: '#1a1a1a', borderRadius: '16px', overflow: 'hidden', boxSizing: 'border-box', boxShadow: '0 4px 12px rgba(0,0,0,0.3)' }}>
                <div style={{ padding: '15px 25px', backgroundColor: '#1a1a1a', borderBottom: '1px solid #333', display: 'flex', justifyContent: 'space-between', alignItems: 'center', height: '60px', boxSizing: 'border-box' }}>
                    <button onClick={() => navigate('/')} style={{ backgroundColor: '#333', color: '#fff', border: 'none', padding: '8px 16px', cursor: 'pointer', borderRadius: '8px', fontWeight: 'bold', fontSize: '13px' }}>🔙 Lobiye Dön</button>
                </div>

                <div style={{ flex: 1, backgroundColor: '#1e1e1e', width: '100%', overflow: 'hidden' }}>
                    <Editor height="100%" defaultLanguage="csharp" theme="vs-dark" onMount={handleEditorDidMount} options={{ fontSize: 16, minimap: { enabled: true }, automaticLayout: true }} />
                </div>
            </div>

        </div>
    );
}