import { User, LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/lib/auth';

export default function UserProfile() {
    const { user, logout } = useAuth();
    if (!user) return null;

    const avatar = user.avatar
        ? `https://cdn.discordapp.com/avatars/${user.discord_id}/${user.avatar}.png?size=40`
        : null;

    return (
        <div className="p-4 border-t border-sidebar-border space-y-3">
            <div className="flex items-center gap-3">
                {avatar ? (
                    <img src={avatar} alt="" className="h-8 w-8 rounded-full ring-2 ring-sidebar-primary/30" />
                ) : (
                    <div className="h-8 w-8 rounded-full bg-sidebar-accent flex items-center justify-center">
                        <User className="h-4 w-4 text-sidebar-foreground" />
                    </div>
                )}
                <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-sidebar-foreground truncate">{user.display_name || user.username}</p>
                    {user.display_name && (
                        <p className="text-[11px] text-sidebar-foreground/40 truncate">@{user.username}</p>
                    )}
                    <p className="text-xs text-sidebar-foreground/50 capitalize">{user.role}</p>
                </div>
            </div>
            <Button
                variant="ghost"
                size="sm"
                className="w-full text-sidebar-foreground/60 hover:text-sidebar-foreground"
                onClick={logout}
            >
                <LogOut className="h-3.5 w-3.5 mr-2" />
                Abmelden
            </Button>
        </div>
    );
}
