import { Link } from "react-router-dom";

export default function NotFoundPage() {
  return (
    <main className="grid min-h-dvh place-items-center px-5 text-center">
      <div>
        <h1 className="text-3xl font-extrabold">Page not found</h1>
        <p className="mt-2 text-muted">The page you're looking for doesn't exist or has moved.</p>
        <Link to="/" className="mt-6 inline-flex min-h-11 items-center rounded-md bg-lagoon-600 px-5 font-semibold text-white hover:bg-lagoon-700">
          Go to the start
        </Link>
      </div>
    </main>
  );
}
