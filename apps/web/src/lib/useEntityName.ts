/**
 * Hook to fetch entity name from entity_slug in URL params
 */
"use client";

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";

export function useEntityName(): string | null {
  const params = useParams();
  const entitySlug = params?.entitySlug as string | undefined;
  const [entityName, setEntityName] = useState<string | null>(null);

  useEffect(() => {
    if (!entitySlug) {
      setEntityName(null);
      return;
    }

    let cancelled = false;

    fetch(`/api/core/entity/by-slug/${encodeURIComponent(entitySlug)}`)
      .then((res) => {
        if (cancelled) return;
        if (res.ok) {
          return res.json();
        }
        return null;
      })
      .then((data) => {
        if (cancelled) return;
        if (data?.fullLegalName) {
          setEntityName(data.fullLegalName);
        } else {
          setEntityName(null);
        }
      })
      .catch(() => {
        if (cancelled) return;
        setEntityName(null);
      });

    return () => {
      cancelled = true;
    };
  }, [entitySlug]);

  return entityName;
}
