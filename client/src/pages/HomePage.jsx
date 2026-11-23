// client/src/pages/HomePage.jsx
// SkillSwap Landing Page

import { Link, useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { BookOpen, GraduationCap, Calendar, ArrowRight, CheckCircle2, Users2, MapPin, Info } from 'lucide-react';

export default function HomePage() {
  const location = useLocation();
  const notice = location.state?.notice || location.state?.message;

  return (
    <div className="flex-1 flex flex-col">
      {notice && (
        <div className="max-w-3xl w-full mx-auto px-4 mt-6">
          <div className="p-4 rounded-xl bg-indigo-50 border border-indigo-200 text-indigo-900 flex items-center gap-3 text-sm shadow-xs">
            <Info className="h-5 w-5 text-indigo-600 shrink-0" />
            <span className="font-medium">{notice}</span>
          </div>
        </div>
      )}

      {/* Hero Section */}
      <section className="py-20 px-4 text-center sm:px-6 lg:px-8 max-w-5xl mx-auto">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-50 border border-indigo-200 text-indigo-700 text-xs font-semibold mb-6">
          <Users2 className="h-3.5 w-3.5" />
          Local Skill Sharing Community
        </div>

        <h1 className="text-4xl sm:text-6xl font-extrabold text-slate-900 tracking-tight leading-tight">
          Learn what you want. <br className="hidden sm:inline" />
          <span className="text-indigo-600">Teach what you know.</span>
        </h1>

        <p className="mt-6 text-lg sm:text-xl text-slate-600 max-w-2xl mx-auto leading-relaxed">
          SkillSwap connects you with nearby peers to trade skills locally. No money needed — just mutual learning, practice, and community meetups.
        </p>

        <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-4">
          <Link to="/auth?tab=signup">
            <Button size="lg" className="w-full sm:w-auto bg-indigo-600 hover:bg-indigo-700 text-white font-medium text-base gap-2 px-8 py-6">
              Get Started Free
              <ArrowRight className="h-5 w-5" />
            </Button>
          </Link>
          <Link to="/dashboard">
            <Button variant="outline" size="lg" className="w-full sm:w-auto text-base px-8 py-6 border-slate-300">
              Explore Skill Matches
            </Button>
          </Link>
        </div>

        {/* Quick Stats / Highlights */}
        <div className="mt-12 grid grid-cols-1 sm:grid-cols-3 gap-6 text-left max-w-3xl mx-auto pt-8 border-t border-slate-200">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="h-5 w-5 text-indigo-600 shrink-0 mt-0.5" />
            <div>
              <h4 className="font-semibold text-slate-900 text-sm">100% Free Swaps</h4>
              <p className="text-slate-500 text-xs mt-0.5">Trade coding for music, Spanish for cooking.</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <MapPin className="h-5 w-5 text-indigo-600 shrink-0 mt-0.5" />
            <div>
              <h4 className="font-semibold text-slate-900 text-sm">Local Nearby Peers</h4>
              <p className="text-slate-500 text-xs mt-0.5">Find people in your city or neighborhood.</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <Calendar className="h-5 w-5 text-indigo-600 shrink-0 mt-0.5" />
            <div>
              <h4 className="font-semibold text-slate-900 text-sm">Group Meetups</h4>
              <p className="text-slate-500 text-xs mt-0.5">Create or join local study sessions & events.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Feature Cards Grid */}
      <section className="py-16 bg-white border-t border-slate-200 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="text-center max-w-2xl mx-auto mb-12">
            <h2 className="text-3xl font-bold text-slate-900">How SkillSwap Works</h2>
            <p className="text-slate-600 mt-2 text-sm">Three easy steps to start learning and teaching in your community.</p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {/* Feature Card 1: Learn */}
            <Card className="hover:shadow-md transition-shadow border-slate-200">
              <CardHeader>
                <div className="h-12 w-12 rounded-lg bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 mb-2">
                  <BookOpen className="h-6 w-6" />
                </div>
                <CardTitle className="text-xl">1. List Skills to Learn</CardTitle>
                <CardDescription className="text-slate-500">
                  Want to learn Python, Guitar, French, or UI Design? Add them to your profile wishlist.
                </CardDescription>
              </CardHeader>
              <CardContent className="text-sm text-slate-600">
                SkillSwap matches you with local peers who have high proficiency in those exact topics.
              </CardContent>
            </Card>

            {/* Feature Card 2: Teach */}
            <Card className="hover:shadow-md transition-shadow border-slate-200">
              <CardHeader>
                <div className="h-12 w-12 rounded-lg bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 mb-2">
                  <GraduationCap className="h-6 w-6" />
                </div>
                <CardTitle className="text-xl">2. Share What You Teach</CardTitle>
                <CardDescription className="text-slate-500">
                  Share your expertise in Web Development, Photography, Math, or Chess with eager learners.
                </CardDescription>
              </CardHeader>
              <CardContent className="text-sm text-slate-600">
                Set your proficiency level (Beginner to Expert) and help others while building your portfolio.
              </CardContent>
            </Card>

            {/* Feature Card 3: Events */}
            <Card className="hover:shadow-md transition-shadow border-slate-200">
              <CardHeader>
                <div className="h-12 w-12 rounded-lg bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 mb-2">
                  <Calendar className="h-6 w-6" />
                </div>
                <CardTitle className="text-xl">3. Join Local Meetups</CardTitle>
                <CardDescription className="text-slate-500">
                  Organize group study sessions, practice workshops, or outdoor skill exchanges nearby.
                </CardDescription>
              </CardHeader>
              <CardContent className="text-sm text-slate-600">
                Browse upcoming local events on an interactive map and RSVP in just one click.
              </CardContent>
            </Card>
          </div>
        </div>
      </section>
    </div>
  );
}

