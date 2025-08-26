import { FaSun, FaMoon } from "react-icons/fa";
import { useTheme } from "next-themes";
import React, { useEffect, useState } from "react";
import { tv } from "tailwind-variants";

const inputVariants = tv({
    base: "absolute top-[3px] left-[4px] size-6 rounded-full flex items-center justify-center shadow-md transform transition duration-300 ease-in-out",
    variants: {
        variant: {
            dark: "translate-x-0 bg-primary/20",
            light: "translate-x-6 bg-primary/20",
        },
    },
    defaultVariants: {
        variant: "dark",
    },
});

export default function ThemeSwitcher() {
    const [mounted, setMounted] = useState(false);
    const { theme, setTheme } = useTheme();

    useEffect(() => {
        setMounted(true);
    }, []);

    if (!mounted) {
        return null;
    }

    return (
        <div className="flex items-center justify-center">
            <label className="flex items-center cursor-pointer">
                <div className="w-14 h-8 relative rounded-3xl bg-card border border-border shadow-sm transition-colors">
                    <input
                        type="checkbox"
                        className="hidden"
                        onChange={() => setTheme(theme === "light" ? "dark" : "light")}
                        checked={theme === "light"}
                    />
                    <div
                        className={inputVariants({
                            variant: theme === "light" ? "light" : "dark",
                        })}
                    >
                        {theme === "light" ? (
                            <FaSun className="text-primary size-4" />
                        ) : (
                            <FaMoon className="text-primary size-4" />
                        )}
                    </div>
                </div>
            </label>
        </div>
    );
}