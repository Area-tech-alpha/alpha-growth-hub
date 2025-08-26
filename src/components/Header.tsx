"use client";

import ThemeSwitcher from "./ThemeSwitcher";
import {
    NavigationMenu,
    NavigationMenuItem,
    NavigationMenuList,
    navigationMenuTriggerStyle,
} from "./ui/navigation-menu";
import React, { useState } from "react";
import { cn } from "@/lib/utils";
import { Button } from "./ui/button";
import { Dialog, DialogContent, DialogTrigger, DialogTitle, DialogDescription } from "./ui/dialog";
import { Menu } from "lucide-react";
import Image from "next/image";

export default function Header() {

    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

    const handleMobileLinkClick = () => {
        setIsMobileMenuOpen(false);
    };

    const navItems = ["home", "projects", "about", "experience", "education", "contact"];

    return (
        <header className="w-full py-5 px-6 border-b border-border/40 bg-background/95 backdrop-blur-sm fixed top-0 z-50 transition-all duration-200">
            <div className="container mx-auto flex items-center justify-between">
                <div className="flex-1">
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

                <NavigationMenu className="hidden md:flex">
                    <NavigationMenuList>
                        {navItems.map((item) => (
                            <NavigationMenuItem key={item}>
                                <a href={`#${item}`} className={cn(navigationMenuTriggerStyle(), "text-foreground hover:text-primary transition-colors")}>
                                    {item}
                                </a>
                            </NavigationMenuItem>
                        ))}
                    </NavigationMenuList>
                </NavigationMenu>

                <div className="flex-1 flex items-center justify-end gap-4">
                    <div className="hidden md:flex items-center gap-4">
                        <ThemeSwitcher />
                    </div>

                    <Dialog open={isMobileMenuOpen} onOpenChange={setIsMobileMenuOpen}>
                        <DialogTrigger asChild className="md:hidden">
                            <Button variant="outline" size="icon">
                                <Menu className="h-6 w-6" />
                            </Button>
                        </DialogTrigger>
                        <DialogContent className="w-full h-full flex flex-col items-center justify-center">
                            <DialogTitle className="sr-only">Navegação Principal</DialogTitle>
                            <DialogDescription className="sr-only">Uma lista de links para navegar no site.</DialogDescription>
                            <nav className="flex flex-col items-center gap-8">
                                {navItems.map((item) => (
                                    <a
                                        key={item}
                                        href={`#${item}`}
                                        onClick={() => handleMobileLinkClick()}
                                        className="text-2xl font-semibold text-foreground hover:text-primary transition-colors"
                                    >
                                        {item}
                                    </a>
                                ))}
                            </nav>
                            <div className="absolute top-8 right-8 flex items-center gap-4">
                                <ThemeSwitcher />
                            </div>
                        </DialogContent>
                    </Dialog>
                </div>
            </div>
        </header>
    );
}