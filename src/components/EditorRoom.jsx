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
    const [inviteMsg, setInviteMsg] = useState('');

    // 🔴 YENİ: Sesli Sohbet ve Mikrofon Durumları
    const [isAudioOn, setIsAudioOn] = useState(false);
    const [isMuted, setIsMuted] = useState(false);
    const [audioStatus, setAudioStatus] = useState({}); // Odadakilerin ses durumu { "Ahmet": "unmute", "Mehmet": "mute" }

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

                // 🔴 YENİ: Ses kanalındaki mikrofon hareketlerini (Aç/Kapat/Ayrıl) algılama
                if (received.type === 'audio_action') {
                    const { sender, action } = received;

                    // Arayüzdeki mikrofon ikonunu güncelle
                    setAudioStatus(prev => ({ ...prev, [sender]: action }));

                    if (action === 'join' && isAudioOn) {
                        createPeerConnection(sender, true);
                        // Odaya yeni biri girdiğinde ona kendi mikrofon durumumuzu da yollayalım ki ikonu doğru görsün
                        ws.send(JSON.stringify({ type: 'audio_action', sender: username, action: isMuted ? 'mute' : 'unmute' }));
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
    }, [roomId, username, isAudioOn, isMuted]);

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

    const inviteFriend = async (targetUsername) => {
        try {
            const res = await fetch('https://realtimecode-mr24.onrender.com/api/send-invite', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sender: username, targetUsername, roomId, roomName }) });
            if (res.ok) setInviteMsg(`✅ ${targetUsername} davet edildi!`);
            else setInviteMsg(`❌ ${targetUsername} ulaşılamıyor.`);
            setTimeout(() => setInviteMsg(''), 3000);
        } catch (err) { setInviteMsg('❌ Sunucu hatası!'); setTimeout(() => setInviteMsg(''), 3000); }
    };

    function copyRoomLink() {
        navigator.clipboard.writeText(window.location.href);
        alert("Oda linki kopyalandı! Arkadaşına atabilirsin.");
    }

    const downloadCode = () => {
        const code = ydocRef.current.getText('monaco').toString();
        const blob = new Blob([code], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = 'main.cs'; a.click(); URL.revokeObjectURL(url);
    };

    // 🔴 YENİ: Ses Bağlantısını Başlatma
    const startAudio = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            localStreamRef.current = stream;
            setIsAudioOn(true);
            setIsMuted(false);
            setAudioStatus(prev => ({ ...prev, [username]: 'unmute' }));
            wsRef.current.send(JSON.stringify({ type: 'audio_action', sender: username, action: 'join' }));

            // Girdikten yarım saniye sonra mikrofonun açık olduğunu da teyit et
            setTimeout(() => {
                wsRef.current.send(JSON.stringify({ type: 'audio_action', sender: username, action: 'unmute' }));
            }, 500);
        } catch (err) {
            alert("Mikrofon izni verilmedi! Ayarlardan tarayıcı mikrofon iznini açman lazım.");
        }
    };

    // 🔴 YENİ: Mikrofonu Kapat/Aç (Sesten çıkmadan)
    const toggleMute = () => {
        if (localStreamRef.current) {
            const audioTrack = localStreamRef.current.getAudioTracks()[0];
            audioTrack.enabled = !audioTrack.enabled;
            const newMutedState = !audioTrack.enabled;

            setIsMuted(newMutedState);
            const actionType = newMutedState ? 'mute' : 'unmute';
            setAudioStatus(prev => ({ ...prev, [username]: actionType }));

            if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
                wsRef.current.send(JSON.stringify({ type: 'audio_action', sender: username, action: actionType }));
            }
        }
    };

    // 🔴 YENİ: Ses Bağlantısını Komple Kapatma
    const stopAudio = () => {
        if (localStreamRef.current) {
            localStreamRef.current.getTracks().forEach(track => track.stop());
            localStreamRef.current = null;
        }
        Object.keys(peerConnections.current).forEach(peerName => closePeerConnection(peerName));
        setIsAudioOn(false);
        setIsMuted(false);
        setAudioStatus(prev => ({ ...prev, [username]: 'leave' }));
        if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify({ type: 'audio_action', sender: username, action: 'leave' }));
        }
    };

    const createPeerConnection = (peerUsername, isInitiator) => {
        if (peerConnections.current[peerUsername]) return;

        // 🔴 YENİ: Güçlendirilmiş STUN Sunucuları (Google + Twilio)
        const pc = new RTCPeerConnection({
            iceServers: [
                { urls: 'stun:stun.l.google.com:19302' },
                { urls: 'stun:stun1.l.google.com:19302' },
                { urls: 'stun:global.stun.twilio.com:3478' }
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

        if (data.sdp) {
            await pc.setRemoteDescription(new RTCSessionDescription(data.sdp));
            if (data.sdp.type === 'offer') {
                const answer = await pc.createAnswer();
                await pc.setLocalDescription(answer);
                wsRef.current.send(JSON.stringify({ type: 'signal', sender: username, target: sender, data: { sdp: pc.localDescription } }));
            }
        } else if (data.candidate) {
            await pc.addIceCandidate(new RTCIceCandidate(data.candidate));
        }
    };

    const closePeerConnection = (peerUsername) => {
        if (peerConnections.current[peerUsername]) {
            peerConnections.current[peerUsername].close();
            delete peerConnections.current[peerUsername];
        }
        const audioEl = document.getElementById(`audio-${peerUsername}`);
        if (audioEl) audioEl.remove();
    };

    const invitableFriends = onlineFriends.filter(f => !activeUsers.includes(f.username));

    // 🔴 YENİ: İkon Belirleme Fonksiyonu
    const getAudioIcon = (uname) => {
        const status = audioStatus[uname];
        if (status === 'join' || status === 'unmute') return '🎤';
        if (status === 'mute') return '🔇';
        return ''; // Seste değilse boş döner
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

                {/* 🔴 YENİ: Gelişmiş Sesli Kanal Paneli */}
                <div style={{ backgroundColor: isAudioOn ? '#1c3a1e' : '#252526', padding: '15px', borderRadius: '10px', marginBottom: '20px', border: isAudioOn ? '1px solid #4caf50' : '1px solid #333', transition: '0.3s' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: isAudioOn ? '10px' : '0' }}>
                        <span style={{ fontSize: '13px', fontWeight: 'bold', color: isAudioOn ? '#85c46c' : '#aaa' }}>
                            {isAudioOn ? '📡 Ses Bağlantısı Aktif' : '🔇 Ses Kanalı Kapalı'}
                        </span>

                        {!isAudioOn && (
                            <button onClick={startAudio} style={{ padding: '6px 12px', backgroundColor: '#4caf50', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', fontSize: '12px' }}>
                                Bağlan
                            </button>
                        )}
                    </div>

                    {/* Sese girildiyse Mikrofon ve Ayrıl butonları çıkar */}
                    {isAudioOn && (
                        <div style={{ display: 'flex', gap: '10px' }}>
                            <button onClick={toggleMute} style={{ flex: 1, padding: '8px', backgroundColor: isMuted ? '#d4d4d4' : '#4ea8de', color: '#121212', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', fontSize: '12px' }}>
                                {isMuted ? '🎤 Sesi Aç' : '🔇 Sustur'}
                            </button>
                            <button onClick={stopAudio} style={{ padding: '8px 12px', backgroundColor: '#d32f2f', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', fontSize: '12px' }}>
                                ❌ Ayrıl
                            </button>
                        </div>
                    )}
                </div>

                {/* Odadakiler */}
                <div style={{ marginBottom: '20px', paddingBottom: '20px', borderBottom: '1px solid #2d2d2d' }}>
                    <h4 style={{ color: '#85c46c', marginTop: 0, marginBottom: '12px', fontSize: '14px', textTransform: 'uppercase', letterSpacing: '1px' }}>👥 Odadakİler</h4>
                    <ul style={{ listStyleType: 'none', padding: 0, margin: 0, maxHeight: '100px', overflowY: 'auto' }}>
                        {activeUsers.map((user, idx) => (
                            <li key={idx} style={{ padding: '6px 0', color: user === username ? '#4caf50' : '#4ea8de', fontWeight: 'bold', fontSize: '14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <span style={{ fontSize: '10px' }}>🟢</span> {user} {user === username ? <span style={{ fontSize: '11px', color: '#888' }}>(Sen)</span> : ''}
                                </div>
                                {/* 🔴 YENİ: İkonu Gösterme Alanı */}
                                <span style={{ fontSize: '16px' }}>{getAudioIcon(user)}</span>
                            </li>
                        ))}
                    </ul>
                </div>

                {/* Davet Et */}
                <div style={{ marginBottom: '20px', paddingBottom: '20px', borderBottom: '1px solid #2d2d2d' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                        <h4 style={{ color: '#4ea8de', margin: '0', fontSize: '14px', textTransform: 'uppercase', letterSpacing: '1px' }}>📡 Davet Et</h4>
                        {inviteMsg && <span style={{ fontSize: '11px', color: inviteMsg.includes('✅') ? '#85c46c' : '#ff6b6b', fontWeight: 'bold' }}>{inviteMsg}</span>}
                    </div>
                    <ul style={{ listStyleType: 'none', padding: 0, margin: 0, maxHeight: '120px', overflowY: 'auto' }}>
                        {invitableFriends.map(f => (
                            <li key={f.username} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 10px', backgroundColor: '#252526', borderRadius: '6px', marginBottom: '6px' }}>
                                <span style={{ fontSize: '13px', color: '#d4d4d4', fontWeight: 'bold' }}>{f.username}</span>
                                <button onClick={() => inviteFriend(f.username)} style={{ background: '#4ea8de', color: '#121212', border: 'none', borderRadius: '4px', padding: '5px 10px', fontSize: '11px', cursor: 'pointer', fontWeight: 'bold', transition: '0.2s' }}>Çağır</button>
                            </li>
                        ))}
                        {invitableFriends.length === 0 && <div style={{ fontSize: '12px', color: '#666', fontStyle: 'italic', textAlign: 'center', padding: '10px 0' }}>Davet edilecek çevrimiçi kimse yok.</div>}
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
                    <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                        <button onClick={() => navigate('/')} style={{ backgroundColor: '#333', color: '#fff', border: 'none', padding: '8px 16px', cursor: 'pointer', borderRadius: '8px', fontWeight: 'bold', fontSize: '13px' }}>🔙 Lobiye Dön</button>
                        <span style={{ fontWeight: 'bold', color: '#85c46c', fontSize: '15px' }}></span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <button onClick={copyRoomLink} style={{ backgroundColor: 'transparent', color: '#888', border: '1px solid #333', padding: '8px 16px', cursor: 'pointer', borderRadius: '8px', fontWeight: 'bold' }}>Bağlantıyı Kopyala</button>
                        <button onClick={downloadCode} style={{ backgroundColor: '#333', color: '#fff', border: 'none', padding: '8px 16px', cursor: 'pointer', borderRadius: '8px', fontWeight: 'bold' }}>⬇️ İndir</button>
                    </div>
                </div>

                <div style={{ flex: 1, backgroundColor: '#1e1e1e', width: '100%', overflow: 'hidden' }}>
                    <Editor height="100%" defaultLanguage="csharp" theme="vs-dark" onMount={handleEditorDidMount} options={{ fontSize: 16, minimap: { enabled: true }, automaticLayout: true }} />
                </div>
            </div>

        </div>
    );
}