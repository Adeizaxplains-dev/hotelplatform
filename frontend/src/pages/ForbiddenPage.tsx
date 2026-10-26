import { Link } from "react-router-dom";

export default function ForbiddenPage() {
  return (
    <main className="grid min-h-dvh place-items-center px-5 text-center">
      <div>
        <h1 className="text-3xl font-extrabold">You don't have access to this page</h1>
        <p className="mt-2 text-muted">Your role doesn't include it. If you think that's a mistake, ask the hotel's owner.</p>
        <Link to="/" className="mt-6 inline-flex min-h-11 items-center rounded-md bg-lagoon-600 px-5 font-semibold text-white hover:bg-lagoon-700">Go back</Link>
      </div>
    </main>
  );
}
