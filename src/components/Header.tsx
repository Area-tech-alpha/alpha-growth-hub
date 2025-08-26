"use client";

import React from "react";
import Image from "next/image";
import { Button } from "./ui/button";
import ThemeSwitcher from "./ThemeSwitcher";
import { LuCoins, LuMenu } from "react-icons/lu";
import { Dialog, DialogContent, DialogTrigger, DialogTitle, DialogDescription } from "./ui/dialog";
import { useSession } from "next-auth/react";
import LogoutButton from "./LogoutButton";

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
    const nameToShow = (session?.user?.name ?? userName) || "Usuário";
    const emailToShow = session?.user?.email ?? userEmail;
    const avatarToShow = session?.user?.image ?? userAvatarUrl;
    const displayInitial = (nameToShow?.[0] || "U").toUpperCase();

    return (
        <header className="w-full bg-background border-b border-border/40 shadow-sm fixed top-0 z-50">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex justify-between items-center h-16">
                    <div className="flex items-center space-x-3">
                        <a href="#home" className="relative group flex items-center">
                            <Image
                                src="https://assessorialpha.com/wp-content/uploads/2023/04/01-61.png"
                                alt="Alpha Assessoria Logo"
                                width={120}
                                height={40}
                                className="h-auto"
                                priority
                            />
                        </a>
                    </div>

                    <div className="flex items-center space-x-3 sm:space-x-4">
                        <div className="flex items-center gap-2 bg-yellow-50 dark:bg-yellow-900/20 px-3 py-1 rounded-lg border border-yellow-200 dark:border-yellow-700">
                            <LuCoins className="h-4 w-4 text-yellow-600 dark:text-yellow-400" />
                            <span className="font-semibold text-yellow-900 dark:text-yellow-200">
                                {userCredits.toLocaleString()} <span className="max-[375px]:sr-only">créditos</span>
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

                        {/* Mobile dropdown trigger */}
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
                                            <Image
                                                src="https://assessorialpha.com/wp-content/uploads/2023/04/01-61.png"
                                                alt="Alpha Assessoria Logo"
                                                width={110}
                                                height={36}
                                                className="h-auto"
                                                priority
                                            />
                                        </a>
                                        <div className="flex items-center gap-2 bg-yellow-50 dark:bg-yellow-900/20 px-3 py-1 rounded-lg border border-yellow-200 dark:border-yellow-700">
                                            <LuCoins className="h-4 w-4 text-yellow-600 dark:text-yellow-400" />
                                            <span className="font-semibold text-yellow-900 dark:text-yellow-200">
                                                {userCredits.toLocaleString()} <span className="max-[375px]:sr-only">créditos</span>
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

