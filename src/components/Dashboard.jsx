import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

export default function Dashboard({ username, onLogout, updateUsernameState }) {
    const navigate = useNavigate();
    const [isMenuOpen, setIsMenuOpen] = useState(true);
    const [activeTab, setActiveTab] = useState(localStorage.getItem('activeTab') || 'odalar');

    useEffect(() => { localStorage.setItem('activeTab', activeTab); }, [activeTab]);

    const [myDisplayId, setMyDisplayId] = useState('');
    const [newRoomName, setNewRoomName] = useState('');
    const [roomCode, setRoomCode] = useState('');
    const [myRooms, setMyRooms] = useState([]);

    const [friendIdInput, setFriendIdInput] = useState('');
    const [myFriends, setMyFriends] = useState([]);
    const [friendRequests, setFriendRequests] = useState([]);
    const [friendMsg, setFriendMsg] = useState({ text: '', type: '' });

    const [newUsername, setNewUsername] = useState('');
    const [oldPassword, setOldPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [newPasswordConfirm, setNewPasswordConfirm] = useState('');
    const [accMsg, setAccMsg] = useState({ text: '', type: '' });

    const fetchMyRooms = async () => { try { const res = await fetch(`http://localhost:5000/api/my-rooms/${username}`); setMyRooms(await res.json()); } catch (err) { } };
    const fetchMyInfo = async () => { try { const res = await fetch(`http://localhost:5000/api/my-info/${username}`); const data = await res.json(); if (data.displayId) setMyDisplayId(data.displayId); } catch (err) { } };
    const fetchFriendsData = async () => { try { setMyFriends(await (await fetch(`http://localhost:5000/api/friends/${username}`)).json()); setFriendRequests(await (await fetch(`http://localhost:5000/api/friend-requests/${username}`)).json()); } catch (err) { } };

    useEffect(() => {
        fetchMyInfo();
        if (activeTab === 'odalar') fetchMyRooms();
        if (activeTab === 'arkadaslar') fetchFriendsData();

        const interval = setInterval(() => { if (activeTab === 'arkadaslar') fetchFriendsData(); }, 5000);
        return () => clearInterval(interval);
    }, [activeTab]);

    const handleCreateRoom = async (e) => { e.preventDefault(); if (!newRoomName.trim()) return; const randomRoomId = Math.random().toString(36).substring(2, 9); await fetch('http://localhost:5000/api/create-room', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username, roomName: newRoomName.trim(), roomId: randomRoomId }) }); navigate(`/room/${randomRoomId}`); };
    const handleJoinRoom = async (e) => { if (e) e.preventDefault(); if (!roomCode.trim()) return; await fetch('http://localhost:5000/api/join-room', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username, roomId: roomCode.trim() }) }); navigate(`/room/${roomCode.trim()}`); };
    const removeRoom = async (roomId) => { if (window.confirm("Bu odayı listenden silmek istediğine emin misin?")) { await fetch('http://localhost:5000/api/remove-room', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username, roomId }) }); fetchMyRooms(); } };

    const handleSendFriendRequest = async (e) => { e.preventDefault(); setFriendMsg({ text: 'İstek gönderiliyor...', type: 'info' }); try { const res = await fetch('http://localhost:5000/api/send-friend-request', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username, friendId: friendIdInput }) }); const data = await res.json(); if (res.ok) { setFriendMsg({ text: data.message, type: 'success' }); setFriendIdInput(''); } else setFriendMsg({ text: data.message, type: 'error' }); } catch (err) { setFriendMsg({ text: 'Sunucu hatası!', type: 'error' }); } };
    const acceptRequest = async (senderId) => { await fetch('http://localhost:5000/api/accept-friend-request', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username, senderId }) }); fetchFriendsData(); };
    const rejectRequest = async (senderId) => { await fetch('http://localhost:5000/api/reject-friend-request', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username, senderId }) }); fetchFriendsData(); };
    const removeFriend = async (friendId) => { if (window.confirm("Arkadaşlıktan çıkarmak istediğine emin misin?")) { await fetch('http://localhost:5000/api/remove-friend', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username, friendId }) }); fetchFriendsData(); } };

    const handleUsernameChange = async (e) => { e.preventDefault(); setAccMsg({ text: 'İsim güncelleniyor...', type: 'info' }); try { const res = await fetch('http://localhost:5000/api/update-username', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ oldUsername: username, newUsername }) }); const data = await res.json(); if (res.ok) { setAccMsg({ text: data.message, type: 'success' }); updateUsernameState(data.username); setNewUsername(''); } else setAccMsg({ text: data.message, type: 'error' }); } catch (err) { setAccMsg({ text: 'Sunucu hatası!', type: 'error' }); } };
    const handlePasswordChange = async (e) => { e.preventDefault(); if (newPassword !== newPasswordConfirm) return setAccMsg({ text: 'Yeni şifreler eşleşmiyor!', type: 'error' }); setAccMsg({ text: 'Şifre güncelleniyor...', type: 'info' }); try { const res = await fetch('http://localhost:5000/api/update-password', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username, oldPassword, newPassword }) }); const data = await res.json(); if (res.ok) { setAccMsg({ text: data.message, type: 'success' }); setOldPassword(''); setNewPassword(''); setNewPasswordConfirm(''); } else setAccMsg({ text: data.message, type: 'error' }); } catch (err) { setAccMsg({ text: 'Sunucu hatası!', type: 'error' }); } };

    return (
        <div style={{ display: 'flex', height: '100vh', width: '100vw', backgroundColor: '#121212', color: '#fff', fontFamily: 'sans-serif' }}>
            <div style={{ width: isMenuOpen ? '260px' : '70px', transition: 'width 0.3s ease-in-out', backgroundColor: '#121212', borderTopRightRadius: '16px', borderBottomRightRadius: '16px', borderRight: '1px solid #2d2d2d', display: 'flex', flexDirection: 'column', boxSizing: 'border-box', boxShadow: '4px 0 15px rgba(0,0,0,0.4)', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                <div style={{ display: 'flex', alignItems: 'center', height: '70px', padding: '0 23px', borderBottom: '1px solid #2d2d2d' }}><button onClick={() => setIsMenuOpen(!isMenuOpen)} style={{ background: 'none', border: 'none', color: '#d4d4d4', fontSize: '24px', cursor: 'pointer', padding: 0 }}>☰</button></div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', padding: '20px 10px', flex: 1 }}>
                    <button onClick={() => setActiveTab('odalar')} style={{ display: 'flex', alignItems: 'center', gap: '15px', padding: '12px', background: activeTab === 'odalar' ? '#2a2a2b' : 'transparent', color: activeTab === 'odalar' ? '#fff' : '#888', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', fontSize: '15px', transition: '0.2s' }}><span style={{ fontSize: '20px' }}>💻</span><span style={{ opacity: isMenuOpen ? 1 : 0, transition: 'opacity 0.2s ease', pointerEvents: isMenuOpen ? 'auto' : 'none' }}>Odalar</span></button>
                    <button onClick={() => setActiveTab('arkadaslar')} style={{ display: 'flex', alignItems: 'center', gap: '15px', padding: '12px', background: activeTab === 'arkadaslar' ? '#2a2a2b' : 'transparent', color: activeTab === 'arkadaslar' ? '#fff' : '#888', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', fontSize: '15px', transition: '0.2s' }}><span style={{ fontSize: '20px' }}>👥</span><span style={{ opacity: isMenuOpen ? 1 : 0, transition: 'opacity 0.2s ease', pointerEvents: isMenuOpen ? 'auto' : 'none' }}>Arkadaşlar</span></button>
                    <button onClick={() => setActiveTab('hesap')} style={{ display: 'flex', alignItems: 'center', gap: '15px', padding: '12px', background: activeTab === 'hesap' ? '#2a2a2b' : 'transparent', color: activeTab === 'hesap' ? '#fff' : '#888', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', fontSize: '15px', transition: '0.2s' }}><span style={{ fontSize: '20px' }}>⚙️</span><span style={{ opacity: isMenuOpen ? 1 : 0, transition: 'opacity 0.2s ease', pointerEvents: isMenuOpen ? 'auto' : 'none' }}>Hesap Yönetimi</span></button>
                </div>
                <div style={{ padding: '20px 10px', borderTop: '1px solid #2d2d2d' }}><button onClick={onLogout} style={{ display: 'flex', alignItems: 'center', gap: '15px', width: '100%', padding: '12px', backgroundColor: '#d32f2f', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', transition: '0.2s' }}><span style={{ fontSize: '20px', fontWeight: 'bold', marginLeft: '2px' }}>⏻</span><span style={{ opacity: isMenuOpen ? 1 : 0, transition: 'opacity 0.2s ease', pointerEvents: isMenuOpen ? 'auto' : 'none' }}>Çıkış Yap</span></button></div>
            </div>

            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '40px', overflowY: 'auto' }}>
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '20px' }}><span style={{ fontSize: '16px' }}>Hoş geldin, <b style={{ color: '#85c46c' }}>{username}</b></span></div>
                <div style={{ display: 'flex', justifyContent: 'center' }}>

                    {activeTab === 'odalar' && (
                        <div style={{ backgroundColor: '#1a1a1a', padding: '40px', borderRadius: '16px', width: '550px', boxShadow: '0 8px 32px rgba(0,0,0,0.3)' }}>
                            <h2 style={{ color: '#85c46c', marginTop: 0, marginBottom: '25px', textAlign: 'center' }}>Çalışma Alanları</h2>
                            <div style={{ display: 'flex', gap: '10px', marginBottom: '25px' }}><input type="text" placeholder="Yeni Oda Adı (Örn: C# Projesi)" value={newRoomName} onChange={e => setNewRoomName(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleCreateRoom(e)} style={{ flex: 1, padding: '14px', backgroundColor: '#2a2a2b', border: 'none', color: '#fff', borderRadius: '8px', outline: 'none' }} /><button onClick={handleCreateRoom} style={{ padding: '0 20px', backgroundColor: '#85c46c', color: '#121212', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' }}>➕ Oluştur</button></div>
                            <div style={{ display: 'flex', gap: '10px', marginBottom: '30px' }}><input type="text" placeholder="Oda ID'si Girin (Davet)..." value={roomCode} onChange={e => setRoomCode(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleJoinRoom(e)} style={{ flex: 1, padding: '14px', backgroundColor: '#2a2a2b', border: 'none', color: '#fff', borderRadius: '8px', outline: 'none' }} /><button onClick={handleJoinRoom} style={{ padding: '0 24px', backgroundColor: '#2d2d2d', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}>Katıl</button></div>
                            <div style={{ borderTop: '1px solid #333', paddingTop: '20px' }}>
                                <h4 style={{ color: '#d4d4d4', marginTop: 0, marginBottom: '15px' }}>Geçmiş Odalarım</h4>
                                <div style={{ maxHeight: '250px', overflowY: 'auto', paddingRight: '5px' }}>
                                    {myRooms.length === 0 ? <p style={{ color: '#666', fontSize: '13px', textAlign: 'center' }}>Henüz bir odaya katılmadınız.</p> : myRooms.map(room => (
                                        <div key={room.roomId} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#2a2a2b', padding: '12px 16px', borderRadius: '8px', marginBottom: '10px', transition: '0.2s' }}>
                                            <div style={{ flex: 1, cursor: 'pointer' }} onClick={() => navigate(`/room/${room.roomId}`)}>
                                                <div style={{ fontWeight: 'bold', color: '#fff', fontSize: '15px' }}>{room.roomName}</div>
                                                <div style={{ fontSize: '12px', color: '#888', marginTop: '4px' }}>Oda ID: {room.roomId}</div>
                                            </div>
                                            <button onClick={() => removeRoom(room.roomId)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '8px', color: '#ef4444' }} title="Listemden Sil"><svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg></button>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === 'arkadaslar' && (
                        <div style={{ backgroundColor: '#1a1a1a', padding: '40px', borderRadius: '16px', width: '550px', boxShadow: '0 8px 32px rgba(0,0,0,0.3)' }}>
                            <h2 style={{ color: '#85c46c', marginTop: 0, marginBottom: '20px', textAlign: 'center' }}>Arkadaş Yönetimi</h2>
                            <div style={{ backgroundColor: '#252526', padding: '15px', borderRadius: '8px', textAlign: 'center', marginBottom: '25px', border: '1px dashed #444' }}>
                                <div style={{ fontSize: '13px', color: '#888', marginBottom: '5px' }}>Senin Kullanıcı ID'n:</div>
                                <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#4ea8de', letterSpacing: '2px' }}>{myDisplayId || 'YÜKLENİYOR...'}</div>
                                <div style={{ fontSize: '12px', color: '#666', marginTop: '5px' }}>(Arkadaşlık isteği almak için bu kodu onlara at)</div>
                            </div>
                            {friendMsg.text && <div style={{ padding: '12px', marginBottom: '20px', borderRadius: '8px', textAlign: 'center', fontSize: '14px', backgroundColor: friendMsg.type === 'error' ? '#3a1c1c' : '#1c3a1e', color: friendMsg.type === 'error' ? '#ff6b6b' : '#85c46c' }}>{friendMsg.text}</div>}
                            <div style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
                                <input type="text" placeholder="Arkadaşının Kullanıcı ID'si (Örn: 8F2A9C)" value={friendIdInput} onChange={e => setFriendIdInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleSendFriendRequest(e)} style={{ flex: 1, padding: '14px', backgroundColor: '#2a2a2b', border: 'none', color: '#fff', borderRadius: '8px', outline: 'none' }} />
                                <button onClick={handleSendFriendRequest} style={{ padding: '0 20px', backgroundColor: '#4ea8de', color: '#121212', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' }}>İstek Yolla</button>
                            </div>
                            {friendRequests.length > 0 && (
                                <div style={{ backgroundColor: '#2e1e1e', padding: '15px', borderRadius: '8px', marginBottom: '25px', border: '1px solid #4a2e2e' }}>
                                    <h4 style={{ color: '#ff8a8a', marginTop: 0, marginBottom: '10px' }}>📬 Gelen Arkadaşlık İstekleri</h4>
                                    {friendRequests.map(req => (
                                        <div key={req.displayId} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#1a1a1a', padding: '10px 15px', borderRadius: '6px', marginBottom: '8px' }}>
                                            <div><div style={{ fontWeight: 'bold', color: '#fff', fontSize: '14px' }}>{req.username}</div><div style={{ fontSize: '11px', color: '#888' }}>ID: {req.displayId}</div></div>
                                            <div style={{ display: 'flex', gap: '8px' }}><button onClick={() => acceptRequest(req.displayId)} style={{ backgroundColor: '#4caf50', border: 'none', borderRadius: '4px', cursor: 'pointer', padding: '6px 10px', color: '#fff', fontWeight: 'bold', fontSize: '12px' }}>Kabul Et</button><button onClick={() => rejectRequest(req.displayId)} style={{ backgroundColor: '#d32f2f', border: 'none', borderRadius: '4px', cursor: 'pointer', padding: '6px 10px', color: '#fff', fontWeight: 'bold', fontSize: '12px' }}>Reddet</button></div>
                                        </div>
                                    ))}
                                </div>
                            )}
                            <div style={{ borderTop: '1px solid #333', paddingTop: '20px' }}>
                                <h4 style={{ color: '#d4d4d4', marginTop: 0, marginBottom: '15px' }}>Arkadaş Listem</h4>
                                <div style={{ maxHeight: '200px', overflowY: 'auto', paddingRight: '5px' }}>
                                    {myFriends.length === 0 ? <p style={{ color: '#666', fontSize: '13px', textAlign: 'center' }}>Henüz arkadaşın yok.</p> : myFriends.map(friend => (
                                        <div key={friend.displayId} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#2a2a2b', padding: '12px 16px', borderRadius: '8px', marginBottom: '10px' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                                <span style={{ color: friend.isOnline ? '#4caf50' : '#555', fontSize: '14px' }} title={friend.isOnline ? "Çevrimiçi" : "Çevrimdışı"}>●</span>
                                                <div>
                                                    <div style={{ fontWeight: 'bold', color: '#fff', fontSize: '15px' }}>{friend.username}</div>
                                                    <div style={{ fontSize: '12px', color: '#888', marginTop: '4px' }}>ID: {friend.displayId}</div>
                                                </div>
                                            </div>
                                            <button onClick={() => removeFriend(friend.displayId)} style={{ background: '#3a1c1c', color: '#ff6b6b', border: '1px solid #ff6b6b', borderRadius: '6px', cursor: 'pointer', padding: '6px 12px', fontSize: '12px', fontWeight: 'bold' }}>Çıkar</button>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === 'hesap' && (
                        <div style={{ backgroundColor: '#1a1a1a', padding: '40px', borderRadius: '16px', width: '500px', boxShadow: '0 8px 32px rgba(0,0,0,0.3)' }}>
                            <h2 style={{ color: '#85c46c', marginTop: 0, marginBottom: '25px', textAlign: 'center' }}>Hesap Yönetimi</h2>
                            {accMsg.text && <div style={{ padding: '12px', marginBottom: '25px', borderRadius: '8px', textAlign: 'center', fontSize: '14px', backgroundColor: accMsg.type === 'error' ? '#3a1c1c' : '#1c3a1e', color: accMsg.type === 'error' ? '#ff6b6b' : '#85c46c' }}>{accMsg.text}</div>}
                            <div style={{ marginBottom: '35px', paddingBottom: '25px', borderBottom: '1px solid #333' }}>
                                <h4 style={{ color: '#d4d4d4', marginTop: 0, marginBottom: '15px' }}>Kullanıcı Adını Değiştir</h4>
                                <form onSubmit={handleUsernameChange} style={{ display: 'flex', gap: '10px' }}><input type="text" placeholder="Yeni Kullanıcı Adı" value={newUsername} onChange={e => setNewUsername(e.target.value)} required style={{ flex: 1, padding: '12px', backgroundColor: '#2a2a2b', border: 'none', color: '#fff', borderRadius: '8px', outline: 'none' }} /><button type="submit" style={{ padding: '12px 20px', backgroundColor: '#85c46c', color: '#121212', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' }}>Güncelle</button></form>
                            </div>
                            <div>
                                <h4 style={{ color: '#d4d4d4', marginTop: 0, marginBottom: '15px' }}>Şifreni Değiştir</h4>
                                <form onSubmit={handlePasswordChange} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}><input type="password" placeholder="Mevcut Şifren" value={oldPassword} onChange={e => setOldPassword(e.target.value)} required style={{ padding: '12px', backgroundColor: '#2a2a2b', border: 'none', color: '#fff', borderRadius: '8px', outline: 'none' }} /><input type="password" placeholder="Yeni Şifre" value={newPassword} onChange={e => setNewPassword(e.target.value)} required style={{ padding: '12px', backgroundColor: '#2a2a2b', border: 'none', color: '#fff', borderRadius: '8px', outline: 'none' }} /><input type="password" placeholder="Yeni Şifre (Tekrar)" value={newPasswordConfirm} onChange={e => setNewPasswordConfirm(e.target.value)} required style={{ padding: '12px', backgroundColor: '#2a2a2b', border: 'none', color: '#fff', borderRadius: '8px', outline: 'none' }} /><button type="submit" style={{ padding: '14px', backgroundColor: '#85c46c', color: '#121212', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', marginTop: '10px' }}>Şifreyi Değiştir</button></form>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}