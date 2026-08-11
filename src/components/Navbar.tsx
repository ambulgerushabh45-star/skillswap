"use client";

import Link from "next/link";
import { useSession, signOut } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Users, Calendar, Sparkles, LogOut, User } from "lucide-react";

export default function Navbar() {
  const { data: session, status } = useSession();

  return (
    <header className="sticky top-0 z-40 w-full border-b border-slate-200 bg-white/95 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* Brand Logo & Title */}
        <Link href="/" className="flex items-center gap-2 font-bold text-xl text-indigo-600">
          <Sparkles className="h-6 w-6 text-indigo-600" />
          <span>SkillSwap</span>
        </Link>

        {/* Navigation Links */}
        <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-600">
          <Link href="/dashboard" className="hover:text-indigo-600 transition-colors flex items-center gap-1.5">
            <Users className="h-4 w-4" />
            Find Matches
          </Link>
          <Link href="/events" className="hover:text-indigo-600 transition-colors flex items-center gap-1.5">
            <Calendar className="h-4 w-4" />
            Local Events
          </Link>
        </nav>

        {/* User Auth Section */}
        <div className="flex items-center gap-3">
          {status === "authenticated" && session?.user ? (
            <div className="flex items-center gap-3">
              <Link href="/profile/setup" className="flex items-center gap-2 text-sm font-medium hover:text-indigo-600">
                <Avatar className="h-8 w-8">
                  <AvatarImage src={session.user.image || ""} alt={session.user.name || "User"} />
                  <AvatarFallback className="bg-indigo-100 text-indigo-700">
                    {session.user.name ? session.user.name.charAt(0).toUpperCase() : "U"}
                  </AvatarFallback>
                </Avatar>
                <span className="hidden sm:inline">{session.user.name || "Profile"}</span>
              </Link>
              <Button
                variant="outline"
                size="sm"
                onClick={() => signOut({ callbackUrl: "/" })}
                className="gap-1.5 text-slate-600"
              >
                <LogOut className="h-4 w-4" />
                <span className="hidden sm:inline">Logout</span>
              </Button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Link href="/auth">
                <Button variant="outline" size="sm">
                  Log In
                </Button>
              </Link>
              <Link href="/auth?tab=signup">
                <Button size="sm" className="bg-indigo-600 hover:bg-indigo-700">
                  Get Started
                </Button>
              </Link>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
