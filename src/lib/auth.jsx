import { createContext, useContext, useState, useEffect } from 'react';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetch('/api/auth/me', { credentials: 'include' })
            .then(r => r.json())
            .then(data => {
                setUser(data.user);
                setLoading(false);
            })
            .catch(() => setLoading(false));
    }, []);

    const login = async () => {
        const res = await fetch('/api/auth/login', { credentials: 'include' });
        const data = await res.json();
        if (data.url) {
            window.location.href = data.url;
        }
    };

    const handleCallback = async (code) => {
        const res = await fetch('/api/auth/callback', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ code }),
        });
        const data = await res.json();
        if (data.user) {
            setUser(data.user);
            return true;
        }
        return false;
    };

    const logout = async () => {
        await fetch('/api/auth/logout', {
            method: 'POST',
            credentials: 'include',
        });
        setUser(null);
    };

    const isAdmin = user?.role === 'admin';
    const isModerator = user?.role === 'moderator' || isAdmin;

    return (
        <AuthContext.Provider value={{
            user, loading, login, logout, handleCallback,
            isAdmin, isModerator, isLoggedIn: !!user,
        }}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    const context = useContext(AuthContext);
    if (!context) throw new Error('useAuth must be used within AuthProvider');
    return context;
}
