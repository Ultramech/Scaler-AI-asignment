"use client";

import { Frame, navLabelForSlug } from "../components/Frame";
import { Button, Container } from "../components/ui";
import { useConsole } from "../lib/console";
import { paths } from "../lib/router";

/** Placeholder for Route 53 sections that are intentionally mocked in this assignment. */
export function MockView({ slug }: { slug: string }) {
  const { go } = useConsole();
  const label = navLabelForSlug(slug);
  return (
    <Frame crumbs={[{ label: "Route 53", to: paths.zones() }, { label: label ?? "Page not found" }]} activeNav={label}>
      <div className="coming-soon">
        <h1>{label ?? "Page not found"}</h1>
        <Container>
          <div className="empty-state">
            <strong>{label ? "Coming soon" : "We couldn’t find that page"}</strong>
            <p>{label ? `${label} is a placeholder section in this Route 53 console clone.` : "Check the address, or head back to your hosted zones."}</p>
            <Button variant="primary" onClick={() => go(paths.zones())}>
              Go to hosted zones
            </Button>
          </div>
        </Container>
      </div>
    </Frame>
  );
}
