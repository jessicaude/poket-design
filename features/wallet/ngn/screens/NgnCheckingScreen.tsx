"use client";
import { NGN_ID, useNgn } from "../useNgn";

/** tVaNgn stage 'ngnChecking'. */
export function NgnCheckingScreen() {
  const route = useNgn((s) => s.route);
  return (
    <div className="center-col" style={{ paddingTop: "50px" }}>
      <div className="spinner" />
      <div className="step-title" style={{ marginTop: "16px" }}>Checking your {route ? NGN_ID[route].name : ""}</div>
    </div>
  );
}
