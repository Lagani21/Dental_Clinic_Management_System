import { Link } from 'react-router-dom'

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center text-center px-4">
      <p className="text-5xl font-bold text-primary-600">404</p>
      <h1 className="mt-4 text-xl font-semibold text-slate-800">Page not found</h1>
      <p className="mt-2 text-sm text-slate-500">The page you're looking for doesn't exist.</p>
      <Link to="/dashboard" className="btn-primary mt-6">Go to Dashboard</Link>
    </div>
  )
}
