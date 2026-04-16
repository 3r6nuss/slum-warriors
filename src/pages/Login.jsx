import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/lib/auth';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Crown, LogIn, Loader2, Clock, RefreshCw, LogOut, Key } from 'lucide-react';

// Discord OAuth callback component
export function AuthCallback() {
    const [searchParams] = useSearchParams();
    const { handleCallback } = useAuth();
    const navigate = useNavigate();

    useEffect(() => {
        const code = searchParams.get('code');
        if (code) {
            handleCallback(code).then((success) => {
                navigate(success ? '/' : '/login?error=auth_failed');
            });
        } else {
            navigate('/login?error=no_code');
        }
    }, [searchParams, handleCallback, navigate]);

    return (
        <div className="min-h-screen flex items-center justify-center">
            <Card className="w-96 backdrop-blur-sm bg-card/80 border-border/50">
                <CardContent className="flex flex-col items-center justify-center py-12">
                    <Loader2 className="h-8 w-8 text-primary animate-spin mb-4" />
                    <p className="text-muted-foreground">Anmeldung wird verarbeitet...</p>
                </CardContent>
            </Card>
        </div>
    );
}

// Login page component
export function LoginPage() {
    const { login, isLoggedIn, loginWithToken } = useAuth();
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const [errorMsg, setErrorMsg] = useState(searchParams.get('error'));
    const [tokenInput, setTokenInput] = useState('');
    const [isLoggingIn, setIsLoggingIn] = useState(false);

    useEffect(() => {
        if (isLoggedIn) navigate('/');
    }, [isLoggedIn, navigate]);

    // Auto-login if token is in URL
    useEffect(() => {
        const token = searchParams.get('token');
        if (token && !isLoggedIn) {
            handleTokenLogin(token);
        }
    }, [searchParams, isLoggedIn]); // eslint-disable-line react-hooks/exhaustive-deps

    const handleTokenLogin = async (token) => {
        setIsLoggingIn(true);
        setErrorMsg(null);
        try {
            await loginWithToken(token);
            navigate('/');
        } catch (err) {
            setErrorMsg(err.message || 'Token-Anmeldung fehlgeschlagen');
            setIsLoggingIn(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-background p-4">
            <Card className="w-full max-w-md backdrop-blur-sm bg-card/80 border-border/50">
                <CardHeader className="text-center">
                    <div className="flex justify-center mb-4">
                        <div className="p-4 rounded-xl bg-primary/10">
                            <Crown className="h-10 w-10 text-primary" />
                        </div>
                    </div>
                    <CardTitle className="text-2xl">Nochnaya Krone</CardTitle>
                    <CardDescription>
                        Melde dich mit Discord an, um auf die Lagerverwaltung zuzugreifen
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    {errorMsg && (
                        <div className="p-3 rounded-lg bg-destructive/10 text-destructive text-sm text-center">
                            {errorMsg === 'auth_failed' ? 'Anmeldung fehlgeschlagen. Bitte versuche es erneut.' : errorMsg}
                        </div>
                    )}
                    
                    {isLoggingIn ? (
                        <div className="flex flex-col items-center justify-center py-4 space-y-4">
                            <Loader2 className="h-8 w-8 text-primary animate-spin" />
                            <p className="text-sm text-muted-foreground">Logge ein...</p>
                        </div>
                    ) : (
                        <>
                            <Button
                                onClick={login}
                                className="w-full gap-2"
                                size="lg"
                            >
                                <LogIn className="h-5 w-5" />
                                Mit Discord anmelden
                            </Button>

                            <div className="relative my-4">
                                <div className="absolute inset-0 flex items-center">
                                    <span className="w-full border-t border-border" />
                                </div>
                                <div className="relative flex justify-center text-xs uppercase">
                                    <span className="bg-card px-2 text-muted-foreground">Oder</span>
                                </div>
                            </div>

                            <div className="flex space-x-2">
                                <Input 
                                    placeholder="Login-Token eingeben..." 
                                    value={tokenInput}
                                    onChange={(e) => setTokenInput(e.target.value)}
                                    type="password"
                                    onKeyDown={(e) => e.key === 'Enter' && tokenInput && handleTokenLogin(tokenInput)}
                                />
                                <Button 
                                    variant="outline" 
                                    onClick={() => handleTokenLogin(tokenInput)}
                                    disabled={!tokenInput}
                                    className="gap-2"
                                >
                                    <Key className="h-4 w-4" />
                                    Einloggen
                                </Button>
                            </div>
                        </>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}

// Pending approval page
export function PendingPage() {
    const { logout, refreshUser, isPending } = useAuth();
    const [checking, setChecking] = useState(false);
    const navigate = useNavigate();

    const checkStatus = async () => {
        setChecking(true);
        await refreshUser();
        setChecking(false);
    };

    // If no longer pending after refresh, redirect to dashboard
    useEffect(() => {
        if (!isPending) {
            navigate('/');
        }
    }, [isPending, navigate]);

    return (
        <div className="min-h-screen flex items-center justify-center bg-background p-4">
            <Card className="w-full max-w-md backdrop-blur-sm bg-card/80 border-border/50">
                <CardHeader className="text-center">
                    <div className="flex justify-center mb-4">
                        <div className="p-4 rounded-xl bg-amber-500/10 animate-pulse">
                            <Clock className="h-10 w-10 text-amber-500" />
                        </div>
                    </div>
                    <CardTitle className="text-2xl">Warte auf Freischaltung</CardTitle>
                    <CardDescription>
                        Dein Account wurde registriert und wartet auf die Freischaltung durch einen Administrator.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                    <Button
                        onClick={checkStatus}
                        className="w-full gap-2"
                        variant="outline"
                        disabled={checking}
                    >
                        {checking ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                            <RefreshCw className="h-4 w-4" />
                        )}
                        Status prüfen
                    </Button>
                    <Button
                        onClick={logout}
                        variant="ghost"
                        className="w-full gap-2 text-muted-foreground"
                    >
                        <LogOut className="h-4 w-4" />
                        Abmelden
                    </Button>
                </CardContent>
            </Card>
        </div>
    );
}
