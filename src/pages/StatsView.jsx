import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Legend } from 'recharts';
import { Package, Users, Activity, TrendingUp } from 'lucide-react';

export default function StatsView() {
    const [stats, setStats] = useState(null);
    const [activity, setActivity] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchStats = async () => {
            try {
                const [resOverview, resAct] = await Promise.all([
                    fetch('/api/stats/overview'),
                    fetch('/api/stats/activity')
                ]);
                const dataOverview = await resOverview.json();
                const dataAct = await resAct.json();

                setStats(dataOverview);
                setActivity(dataAct);
            } catch (err) {
                console.error(err);
            } finally {
                setLoading(false);
            }
        };
        fetchStats();
    }, []);

    if (loading) {
        return (
            <div className="flex items-center justify-center py-20">
                <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
            </div>
        );
    }

    if (!stats || !activity) return null;

    // Calculate aggregated activity from the last 14 days
    const totalTransactions14D = activity.reduce((acc, day) => acc + day.checkins + day.checkouts, 0);
    const totalVolume14D = activity.reduce((acc, day) => acc + day.checkin_volume + day.checkout_volume, 0);

    return (
        <div className="space-y-6 max-w-7xl mx-auto animate-in fade-in duration-300">
            <div>
                <h1 className="text-3xl font-bold tracking-tight">Statistiken</h1>
                <p className="text-muted-foreground mt-0.5">
                    Übersicht der Lageraktivitäten und Bestände
                </p>
            </div>

            {/* KPIs */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <Card className="bg-card/50 backdrop-blur border-border/50">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Gesamtbestand</CardTitle>
                        <Package className="h-4 w-4 text-primary" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{stats.inventory.total_items?.toLocaleString('de-DE')}</div>
                        <p className="text-xs text-muted-foreground">in {stats.inventory.total_products} verschiedenen Produkten</p>
                    </CardContent>
                </Card>

                <Card className="bg-card/50 backdrop-blur border-border/50">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Transaktionen (14 Tage)</CardTitle>
                        <Activity className="h-4 w-4 text-primary" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{totalTransactions14D.toLocaleString('de-DE')}</div>
                        <p className="text-xs text-muted-foreground">Scan- oder Manuelle Buchungen</p>
                    </CardContent>
                </Card>

                <Card className="bg-card/50 backdrop-blur border-border/50">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Volumen (14 Tage)</CardTitle>
                        <TrendingUp className="h-4 w-4 text-primary" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{totalVolume14D.toLocaleString('de-DE')}</div>
                        <p className="text-xs text-muted-foreground">Bewegte Items gesamt</p>
                    </CardContent>
                </Card>

                <Card className="bg-card/50 backdrop-blur border-border/50">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Aktive Mitglieder</CardTitle>
                        <Users className="h-4 w-4 text-primary" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{stats.topUsers.length}</div>
                        <p className="text-xs text-muted-foreground">Mitglieder mit Transaktionen  (7 Tage)</p>
                    </CardContent>
                </Card>
            </div>

            <div className="grid gap-6 md:grid-cols-2">
                {/* 14 Days Activity Area Chart */}
                <Card className="col-span-2 bg-card/50 backdrop-blur border-border/50">
                    <CardHeader>
                        <CardTitle>Aktivitätsverlauf (14 Tage)</CardTitle>
                        <CardDescription>Anzahl der Ein- und Auslagerungs-Transaktionen pro Tag</CardDescription>
                    </CardHeader>
                    <CardContent className="h-[350px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={activity} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                                <defs>
                                    <linearGradient id="colorCheckin" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                                        <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                                    </linearGradient>
                                    <linearGradient id="colorCheckout" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3} />
                                        <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <XAxis dataKey="date" stroke="#888888" fontSize={12} tickLine={false} axisLine={false} />
                                <YAxis stroke="#888888" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(value) => `${value}`} />
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#333" />
                                <Tooltip
                                    contentStyle={{ backgroundColor: '#1f2937', borderColor: '#374151', borderRadius: '8px' }}
                                    itemStyle={{ color: '#e5e7eb' }}
                                    labelStyle={{ color: '#9ca3af', marginBottom: '4px' }}
                                />
                                <Legend wrapperStyle={{ paddingTop: '20px' }} />
                                <Area type="monotone" dataKey="checkins" name="Einlagerungen" stroke="#10b981" fillOpacity={1} fill="url(#colorCheckin)" strokeWidth={2} />
                                <Area type="monotone" dataKey="checkouts" name="Auslagerungen" stroke="#ef4444" fillOpacity={1} fill="url(#colorCheckout)" strokeWidth={2} />
                            </AreaChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>

                {/* Top Users Bar Chart */}
                <Card className="bg-card/50 backdrop-blur border-border/50">
                    <CardHeader>
                        <CardTitle>Aktivste Mitglieder (7 Tage)</CardTitle>
                        <CardDescription>Nach Anzahl der erfassten Transaktionen</CardDescription>
                    </CardHeader>
                    <CardContent className="h-[300px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={stats.topUsers} layout="vertical" margin={{ top: 0, right: 30, left: 40, bottom: 0 }}>
                                <XAxis type="number" stroke="#888888" fontSize={12} tickLine={false} axisLine={false} />
                                <YAxis dataKey="person_name" type="category" stroke="#888888" fontSize={12} tickLine={false} axisLine={false} />
                                <Tooltip
                                    cursor={{ fill: 'rgba(255,255,255,0.05)' }}
                                    contentStyle={{ backgroundColor: '#1f2937', borderColor: '#374151', borderRadius: '8px' }}
                                />
                                <Bar dataKey="tx_count" name="Transaktionen" fill="#8b5cf6" radius={[0, 4, 4, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>

                {/* Top Products Volume Bar Chart */}
                <Card className="bg-card/50 backdrop-blur border-border/50">
                    <CardHeader>
                        <CardTitle>Bewegt-Volumen (7 Tage)</CardTitle>
                        <CardDescription>Produkte mit der höchsten Fluktuation (Stückzahl)</CardDescription>
                    </CardHeader>
                    <CardContent className="h-[300px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={stats.topProducts} layout="vertical" margin={{ top: 0, right: 30, left: 40, bottom: 0 }}>
                                <XAxis type="number" stroke="#888888" fontSize={12} tickLine={false} axisLine={false} />
                                <YAxis dataKey="name" type="category" stroke="#888888" fontSize={12} tickLine={false} axisLine={false} />
                                <Tooltip
                                    cursor={{ fill: 'rgba(255,255,255,0.05)' }}
                                    contentStyle={{ backgroundColor: '#1f2937', borderColor: '#374151', borderRadius: '8px' }}
                                />
                                <Bar dataKey="volume" name="Stückzahl" fill="#f59e0b" radius={[0, 4, 4, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
