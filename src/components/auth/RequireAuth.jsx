import { Navigate } from 'react-router-dom';
import { useAuth } from '@/lib/auth';
import { PendingPage } from '@/pages/Login';

export default function RequireAuth({ children }) {
    const { isLoggedIn, loading, isPending } = useAuth();
    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-background">
                <div className="animate-spin h-8 w-8 border-2 border-primary border-t-transparent rounded-full" />
            </div>
        );
    }
    if (!isLoggedIn) return <Navigate to="/login" />;
    if (isPending) return <PendingPage />;
    return children;
}
