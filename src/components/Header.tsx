"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import { Button } from "./ui/button";
import ThemeSwitcher from "./ThemeSwitcher";
import { LuCoins, LuMenu } from "react-icons/lu";
import { Dialog, DialogContent, DialogTrigger, DialogTitle, DialogDescription } from "./ui/dialog";
import { useSession } from "next-auth/react";
import LogoutButton from "./LogoutButton";
import { useTheme } from "next-themes";
import { useRealtimeStore } from "@/store/realtime-store";


type HeaderProps = {
    userName?: string;
    userEmail?: string;
    userAvatarUrl?: string;
    userCredits?: number;
    showThemeSwitch?: boolean;
};

export default function Header({
    userName = "Usuário",
    userEmail = "usuario@example.com",
    userAvatarUrl,
    userCredits = 0,
    showThemeSwitch = true,
}: HeaderProps) {
    const { data: session } = useSession();
    const { theme, resolvedTheme } = useTheme();
    const [mounted, setMounted] = useState(false);
    const [logoURL, setLogoURL] = useState("");
    const LOGO_DARK_MODE_URL = `https://nfwfolrcpaxqwgkzzfok.supabase.co/storage/v1/object/public/Images/logo%20dark%20mode.png`;
    const LOGO_LIGHT_MODE_URL = `https://nfwfolrcpaxqwgkzzfok.supabase.co/storage/v1/object/public/Images/logo%20light%20mode.png`;

    useEffect(() => {
        setMounted(true);
    }, []);

    useEffect(() => {
        const current = resolvedTheme || theme;
        setLogoURL(current === "dark" ? LOGO_DARK_MODE_URL : LOGO_LIGHT_MODE_URL);
    }, [resolvedTheme, theme, LOGO_DARK_MODE_URL, LOGO_LIGHT_MODE_URL])


    const nameToShow = (session?.user?.name ?? userName) || "Usuário";
    const emailToShow = session?.user?.email ?? userEmail;
    const avatarToShow = session?.user?.image ?? userAvatarUrl;
    const displayInitial = (nameToShow?.[0] || "U").toUpperCase();
    const realtimeCredits = useRealtimeStore(s => s.userCredits);
    const demoModeActive = useRealtimeStore(s => s.demoModeActive);
    const demoCredits = useRealtimeStore(s => s.demoCredits);
    const demoHolds = useRealtimeStore(s => s.demoHolds);
    const subscribeToUserCreditHolds = useRealtimeStore(s => s.subscribeToUserCreditHolds);
    const subscribeToUserCredits = useRealtimeStore(s => s.subscribeToUserCredits);

    useEffect(() => {
        if (session?.user?.id) {
            subscribeToUserCredits(session.user.id);
            subscribeToUserCreditHolds(session.user.id);
        }
    }, [session?.user?.id, subscribeToUserCredits, subscribeToUserCreditHolds]);

    const demoAvailable = Math.max(0, demoCredits - Object.values(demoHolds || {}).reduce((a, b) => a + (Number(b) || 0), 0));
    const displayCredits = session?.user?.id ? (demoModeActive ? demoAvailable : realtimeCredits) : userCredits;

    const Logo = ({ width, height }: { width: number, height: number }) => {
        if (!mounted) {
            return <div style={{ width: `${width}px`, height: `${height}px` }} />;
        }
        return (
            <Image
                src={logoURL}
                alt="Alpha Assessoria Logo"
                width={width}
                height={height}
                className="h-auto"
                priority
            />
        );
    };


    return (
        <header className="w-full bg-background border-b border-border/40 shadow-sm fixed top-0 z-50">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex justify-between items-center h-16">
                    <div className="flex items-center space-x-3">
                        <a href="#home" className="relative group flex items-center">
                            <Logo width={120} height={40} />
                        </a>
                    </div>

                    <div className="flex items-center space-x-3 sm:space-x-4">
                        <div className="flex items-center gap-2 bg-yellow-50 dark:bg-yellow-900/20 px-3 py-1 rounded-lg border border-yellow-200 dark:border-yellow-700">
                            <LuCoins className="h-4 w-4 text-yellow-600 dark:text-yellow-400" />
                            <span className="font-semibold text-yellow-900 dark:text-yellow-200">
                                {displayCredits.toLocaleString()} <span className="max-[375px]:sr-only">créditos</span>
                            </span>
                        </div>

                        <div className="hidden sm:flex items-center gap-3">
                            <div className="relative inline-flex h-9 w-9 items-center justify-center rounded-full bg-muted overflow-hidden">
                                {avatarToShow ? (
                                    <Image
                                        src={avatarToShow}
                                        alt={nameToShow}
                                        className="h-full w-full object-cover"
                                        referrerPolicy="no-referrer"
                                        width={36}
                                        height={36}
                                    />
                                ) : (
                                    <span className="text-sm font-medium text-foreground">
                                        {displayInitial}
                                    </span>
                                )}
                            </div>
                            <div className="hidden sm:block">
                                <p className="text-sm font-medium text-foreground">{nameToShow}</p>
                                <p className="text-xs text-muted-foreground">{emailToShow}</p>
                            </div>
                        </div>

                        {showThemeSwitch && (
                            <div className="hidden md:flex items-center">
                                <ThemeSwitcher />
                            </div>
                        )}

                        <LogoutButton />

                        <div className="sm:hidden">
                            <Dialog>
                                <DialogTrigger asChild>
                                    <Button variant="outline" size="icon" aria-label="Abrir menu">
                                        <LuMenu className="h-5 w-5" />
                                    </Button>
                                </DialogTrigger>
                                <DialogContent className="w-full max-w-[calc(100%-3rem)] sm:max-w-sm p-4" showCloseButton>
                                    <DialogTitle className="sr-only">Menu</DialogTitle>
                                    <DialogDescription className="sr-only">Ações do usuário</DialogDescription>
                                    <div className="flex items-center justify-between pb-3 border-b pr-10">
                                        <a href="#home" className="relative group flex items-center">
                                            <Logo width={110} height={36} />
                                        </a>
                                        <div className="flex items-center gap-2 bg-yellow-50 dark:bg-yellow-900/20 px-3 py-1 rounded-lg border border-yellow-200 dark:border-yellow-700">
                                            <LuCoins className="h-4 w-4 text-yellow-600 dark:text-yellow-400" />
                                            <span className="font-semibold text-yellow-900 dark:text-yellow-200">
                                                {displayCredits.toLocaleString()} <span className="max-[375px]:sr-only">créditos</span>
                                            </span>
                                        </div>
                                    </div>

                                    <div className="mt-4 flex items-center gap-3">
                                        <div className="relative inline-flex h-10 w-10 items-center justify-center rounded-full bg-muted overflow-hidden">
                                            {avatarToShow ? (
                                                <Image
                                                    src={avatarToShow}
                                                    alt={nameToShow}
                                                    className="h-full w-full object-cover"
                                                    referrerPolicy="no-referrer"
                                                    width={40}
                                                    height={40}
                                                />
                                            ) : (
                                                <span className="text-sm font-medium text-foreground">
                                                    {displayInitial}
                                                </span>
                                            )}
                                        </div>
                                        <div>
                                            <p className="text-sm font-medium text-foreground">{nameToShow}</p>
                                            <p className="text-xs text-muted-foreground">{emailToShow}</p>
                                        </div>
                                    </div>

                                    <div className="mt-4 flex items-center justify-between">
                                        {showThemeSwitch && (
                                            <div>
                                                <ThemeSwitcher />
                                            </div>
                                        )}
                                        <LogoutButton mobile />
                                    </div>
                                </DialogContent>
                            </Dialog>
                        </div>
                    </div>
                </div>
            </div>
        </header>
    );
}