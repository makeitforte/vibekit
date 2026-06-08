"use client";

import { useEffect, useState, type ReactNode, type CSSProperties } from "react";
import { useParams, useRouter } from "next/navigation";
import { useProfiles } from "@/lib/profiles-context";
import { redeemBoardShare } from "@/project_timeline_and_capacity_planner/queries";
import { PlannerShell } from "@/project_timeline_and_capacity_planner/planner-shell";
import { Button } from "@/project_timeline_and_capacity_planner/ui/button";
import "@/project_timeline_and_capacity_planner/planner.css";

type RedeemState =
  | { status: "idle" | "loading" }
  | { status: "ready"; ownerId: string }
  | { status: "own_board" }
  | { status: "error"; message: string };

const messageStyle: CSSProperties = {
  display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
  height: "100%", minHeight: "60vh", gap: 4,
  fontFamily: "var(--font-mono)", fontSize: 12.5, color: "var(--fg-2)", textAlign: "center",
};

function CenteredMessage({ children, style }: { children: ReactNode; style?: CSSProperties }) {
  return <div style={{ ...messageStyle, ...style }}>{children}</div>;
}

export default function SharedBoardPage() {
  const params = useParams<{ token: string }>();
  const token = params.token;
  const router = useRouter();
  const { user, authLoading, openLogin } = useProfiles();
  const [state, setState] = useState<RedeemState>({ status: "idle" });

  useEffect(() => {
    if (authLoading || !user || !token) return;
    let cancelled = false;
    setState({ status: "loading" });
    redeemBoardShare(token)
      .then(({ ownerId }) => {
        if (!cancelled) setState({ status: "ready", ownerId });
      })
      .catch((e: Error) => {
        if (cancelled) return;
        console.error("redeemBoardShare failed:", e);
        if (e.message.includes("cannot_join_own_board")) setState({ status: "own_board" });
        else if (e.message.includes("invalid_or_revoked_share")) setState({ status: "error", message: "This share link is invalid or has been revoked." });
        else setState({ status: "error", message: `Couldn't join this board — ${e.message}` });
      });
    return () => { cancelled = true; };
  }, [authLoading, user, token]);

  if (authLoading) {
    return <CenteredMessage>Loading…</CenteredMessage>;
  }

  if (!user) {
    return (
      <CenteredMessage>
        <div style={{ marginBottom: 8 }}>Sign in to access this shared board.</div>
        <Button variant="primary" size="sm" onClick={openLogin}>Sign in</Button>
      </CenteredMessage>
    );
  }

  if (state.status === "idle" || state.status === "loading") {
    return <CenteredMessage>Joining board…</CenteredMessage>;
  }

  if (state.status === "own_board") {
    return (
      <CenteredMessage>
        <div style={{ marginBottom: 8 }}>This link points to your own board.</div>
        <Button variant="primary" size="sm" onClick={() => router.push("/tools/project-planner")}>Open my board</Button>
      </CenteredMessage>
    );
  }

  if (state.status === "error") {
    return <CenteredMessage style={{ color: "var(--danger-text)" }}>{state.message}</CenteredMessage>;
  }

  if (state.status !== "ready") return null;

  return <PlannerShell boardOwnerId={state.ownerId} />;
}
