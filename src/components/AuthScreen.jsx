import React, { useState } from 'react';

export default function AuthScreen({ onLogin }) {
    const [isLogin, setIsLogin] = useState(true);
    const [identifier, setIdentifier] = useState('');
    const [email, setEmail] = useState('');
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [statusMsg, setStatusMsg] = useState({ text: '', type: '' });
    const [captchaNum1, setCaptchaNum1] = useState(Math.floor(Math.random() * 10) + 1);
    const [captchaNum2, setCaptchaNum2] = useState(Math.floor(Math.random() * 10) + 1);
    const [captchaInput, setCaptchaInput] = useState('');

    const refreshCaptcha = () => {
        setCaptchaNum1(Math.floor(Math.random() * 10) + 1);
        setCaptchaNum2(Math.floor(Math.random() * 10) + 1);
        setCaptchaInput('');
    };

    const toggleMode = () => {
        setIsLogin(!isLogin);
        setStatusMsg({ text: '', type: '' });
        setShowPassword(false);
        refreshCaptcha();
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (parseInt(captchaInput) !== captchaNum1 + captchaNum2) { setStatusMsg({ text: 'Güvenlik kodunu yanlış girdin!', type: 'error' }); refreshCaptcha(); return; }

        if (!isLogin) {
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(email)) { setStatusMsg({ text: 'Geçerli bir e-posta girmedin abi! (Örn: isim@gmail.com)', type: 'error' }); refreshCaptcha(); return; }
        }

        setStatusMsg({ text: 'İşlem yapılıyor...', type: 'info' });
        const url = isLogin ? 'https://realtimecode-mr24.onrender.com/api/login' : 'https://realtimecode-mr24.onrender.com/api/register';
        const payload = isLogin ? { identifier, password } : { username, email, password };

        try {
            const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
            const data = await res.json();
            if (res.ok) {
                setStatusMsg({ text: data.message, type: 'success' });
                if (isLogin) setTimeout(() => onLogin(data.username), 1000);
                else setTimeout(() => { setIsLogin(true); setPassword(''); setShowPassword(false); refreshCaptcha(); setStatusMsg({ text: 'Kayıt başarılı! Şimdi giriş yapabilirsin.', type: 'success' }); }, 1500);
            } else { setStatusMsg({ text: data.message, type: 'error' }); refreshCaptcha(); }
        } catch (err) { setStatusMsg({ text: 'Sunucu bağlantısında sorun var!', type: 'error' }); }
    };

    return (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', backgroundColor: '#121212', color: '#fff', fontFamily: 'sans-serif' }}>
            <div style={{ backgroundColor: '#1e1e1e', padding: '40px', borderRadius: '16px', boxShadow: '0 8px 32px rgba(0,0,0,0.5)', width: '360px', boxSizing: 'border-box' }}>
                <h2 style={{ textAlign: 'center', color: '#85c46c', marginTop: 0, marginBottom: '25px' }}>{isLogin ? 'Giriş Yap' : 'Kayıt Ol'}</h2>
                {statusMsg.text && <div style={{ padding: '10px', marginBottom: '15px', borderRadius: '8px', textAlign: 'center', fontSize: '13px', backgroundColor: statusMsg.type === 'error' ? '#3a1c1c' : '#1c3a1e', color: statusMsg.type === 'error' ? '#ff6b6b' : '#85c46c' }}>{statusMsg.text}</div>}
                <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                    {isLogin ? (
                        <input type="text" placeholder="Kullanıcı Adı veya E-posta" value={identifier} onChange={e => setIdentifier(e.target.value)} required style={{ width: '100%', padding: '14px', backgroundColor: '#2a2a2b', border: 'none', color: '#fff', borderRadius: '8px', outline: 'none', boxSizing: 'border-box' }} />
                    ) : (
                        <>
                            <input type="email" placeholder="E-posta Adresi" value={email} onChange={e => setEmail(e.target.value)} required style={{ width: '100%', padding: '14px', backgroundColor: '#2a2a2b', border: 'none', color: '#fff', borderRadius: '8px', outline: 'none', boxSizing: 'border-box' }} />
                            <input type="text" placeholder="Kullanıcı Adı" value={username} onChange={e => setUsername(e.target.value)} required style={{ width: '100%', padding: '14px', backgroundColor: '#2a2a2b', border: 'none', color: '#fff', borderRadius: '8px', outline: 'none', boxSizing: 'border-box' }} />
                        </>
                    )}
                    <div style={{ position: 'relative', width: '100%' }}>
                        <input type={showPassword ? "text" : "password"} placeholder="Şifre" value={password} onChange={e => setPassword(e.target.value)} required style={{ width: '100%', padding: '14px', paddingRight: '40px', backgroundColor: '#2a2a2b', border: 'none', color: '#fff', borderRadius: '8px', outline: 'none', boxSizing: 'border-box' }} />
                        <button type="button" onClick={() => setShowPassword(!showPassword)} style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', fontSize: '18px', color: '#888' }}>{showPassword ? '🙈' : '👁️'}</button>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#2a2a2b', padding: '12px', borderRadius: '8px' }}>
                        <span style={{ fontSize: '14px', fontWeight: 'bold', color: '#d4d4d4' }}>Güvenlik: {captchaNum1} + {captchaNum2} = ?</span>
                        <input type="number" value={captchaInput} onChange={e => setCaptchaInput(e.target.value)} required style={{ width: '60px', padding: '8px', backgroundColor: '#1e1e1e', border: 'none', color: '#fff', borderRadius: '6px', outline: 'none', textAlign: 'center' }} />
                    </div>
                    <button type="submit" style={{ padding: '14px', backgroundColor: '#85c46c', color: '#121212', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', fontSize: '15px', marginTop: '5px' }}>{isLogin ? 'Giriş Yap' : 'Kayıt Ol'}</button>
                </form>
                <p style={{ textAlign: 'center', fontSize: '13px', marginTop: '20px', cursor: 'pointer', color: '#888' }} onClick={toggleMode}>{isLogin ? 'Hesabın yok mu? Hemen kayıt ol.' : 'Zaten hesabım var, giriş yapayım.'}</p>
            </div>
        </div>
    );
}