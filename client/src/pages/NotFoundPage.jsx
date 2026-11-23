// client/src/pages/NotFoundPage.jsx
// 404 Page Not Found

import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { AlertCircle, ArrowLeft } from 'lucide-react';

export default function NotFoundPage() {
  return (
    <div className="flex-1 max-w-md w-full mx-auto p-4 sm:p-6 flex flex-col items-center justify-center text-center my-auto">
      <div className="bg-white rounded-xl border border-slate-200 p-8 shadow-sm w-full">
        <AlertCircle className="h-12 w-12 text-slate-400 mx-auto mb-3" />
        <h2 className="text-xl font-bold text-slate-900 mb-1">Page Not Found</h2>
        <p className="text-slate-500 text-xs mb-6">
          The page you requested does not exist or may have been moved.
        </p>
        <Link to="/dashboard">
          <Button className="w-full bg-indigo-600 hover:bg-indigo-700 gap-1.5 text-xs">
            <ArrowLeft className="h-4 w-4" />
            Back to Find Matches
          </Button>
        </Link>
      </div>
    </div>
  );
}

