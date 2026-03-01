import { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/lib/auth';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Swords, LogIn, Loader2 } from 'lucide-react';

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
    }, []);

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
    const { login, isLoggedIn } = useAuth();
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const error = searchParams.get('error');

    useEffect(() => {
        if (isLoggedIn) navigate('/');
    }, [isLoggedIn]);

    return (
        <div className="min-h-screen flex items-center justify-center bg-background p-4">
            <Card className="w-full max-w-md backdrop-blur-sm bg-card/80 border-border/50">
                <CardHeader className="text-center">
                    <div className="flex justify-center mb-4">
                        <div className="p-4 rounded-xl bg-primary/10">
                            <Swords className="h-10 w-10 text-primary" />
                        </div>
                    </div>
                    <CardTitle className="text-2xl">Slum Warriors</CardTitle>
                    <CardDescription>
                        Melde dich mit Discord an, um auf die Lagerverwaltung zuzugreifen
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    {error && (
                        <div className="p-3 rounded-lg bg-destructive/10 text-destructive text-sm text-center">
                            Anmeldung fehlgeschlagen. Bitte versuche es erneut.
                        </div>
                    )}
                    <Button
                        onClick={login}
                        className="w-full gap-2"
                        size="lg"
                    >
                        <LogIn className="h-5 w-5" />
                        Mit Discord anmelden
                    </Button>
                </CardContent>
            </Card>
        </div>
    );
}
