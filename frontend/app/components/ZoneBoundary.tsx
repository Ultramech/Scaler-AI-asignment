"use client";

import { ReactNode } from "react";
import { useConsole } from "../lib/console";
import { Resource, useResource } from "../lib/hooks";
import { paths } from "../lib/router";
import type { Zone } from "../lib/types";
import { Alert, Button, Loading } from "./ui";

export function useZone(id: string): Resource<Zone> {
  const { api } = useConsole();
  return useResource(() => api.get<Zone>(`/zones/${id}`), [id, api]);
}

/** Renders `children` once the hosted zone has loaded, otherwise a spinner or an error. */
export function ZoneBoundary({ resource, children }: { resource: Resource<Zone>; children: (zone: Zone) => ReactNode }) {
  const { go } = useConsole();
  if (resource.data) return <>{children(resource.data)}</>;
  if (resource.error) {
    return (
      <Alert type="error" header="Unable to load the hosted zone" action={<Button onClick={() => go(paths.zones())}>Back to hosted zones</Button>}>
        {resource.error}
      </Alert>
    );
  }
  return <Loading>Loading hosted zone</Loading>;
}
