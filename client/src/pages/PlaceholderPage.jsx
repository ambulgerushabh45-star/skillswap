// client/src/pages/PlaceholderPage.jsx
// Placeholder for pages deferred to task M4

import { Link } from 'react-router-dom';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Clock, ArrowRight } from 'lucide-react';

export default function PlaceholderPage({ title = 'Feature In Progress' }) {
  return (
    <div className="flex-1 max-w-xl w-full mx-auto p-4 sm:p-6 lg:p-8 flex items-center justify-center my-auto">
      <Card className="border-slate-200 shadow-sm w-full text-center">
        <CardHeader className="pb-3">
          <div className="h-12 w-12 rounded-xl bg-indigo-50 border border-indigo-100 text-indigo-600 mx-auto flex items-center justify-center mb-2">
            <Clock className="h-6 w-6" />
          </div>
          <CardTitle className="text-xl text-slate-900">{title}</CardTitle>
          <CardDescription className="text-sm text-slate-500">
            This page is being migrated (task M4)
          </CardDescription>
        </CardHeader>
        <CardContent className="text-xs text-slate-600">
          We are currently rebuilding this section with our new decoupled React (Vite) and Express architecture. Full functionality will be restored in task M4.
        </CardContent>
        <CardFooter className="justify-center pt-2">
          <Link to="/dashboard">
            <Button className="bg-indigo-600 hover:bg-indigo-700 gap-1.5 text-xs">
              Back to Find Matches
              <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          </Link>
        </CardFooter>
      </Card>
    </div>
  );
}

