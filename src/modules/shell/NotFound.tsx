import { Link } from "react-router-dom";

export function NotFound() {
  return (
    <section className="panel not-found">
      <h1>Page not found</h1>
      <p className="muted">That address is not part of this station.</p>
      <p>
        <Link to="/">Back to dashboard</Link>
      </p>
    </section>
  );
}
