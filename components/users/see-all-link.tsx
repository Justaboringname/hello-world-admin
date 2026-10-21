import Link from "next/link";
import { linkClass } from "@/components/ui";

// `label` says what "See all" opens, for screen readers: a page with three of
// these would otherwise read as three identical links.
export function SeeAllLink({ href, label }: { href: string; label: string }) {
  return (
    <Link href={href} className={`whitespace-nowrap text-sm ${linkClass}`}>
      See all<span className="sr-only"> {label}</span> <span aria-hidden>→</span>
    </Link>
  );
}
