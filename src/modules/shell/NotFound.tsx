import { Link } from "react-router-dom";
import { usePageMeta } from "../../ui/pageMeta";

export function NotFound() {
  usePageMeta("Page not found", "That address is not part of this station");
  return (
    <section className="card not-found">
      <p className="muted">There is nothing here.</p>
      <Link to="/" className="btn primary">
        Back to dashboard
      </Link>
    </section>
  );
}
