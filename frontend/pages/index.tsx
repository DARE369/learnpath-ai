import React from "react";

export default function Home() {
  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        alignItems: "center",
        fontFamily: "system-ui, sans-serif",
        backgroundColor: "#0f0f0f",
        color: "#fff",
      }}
    >
      <h1 style={{ fontSize: "3rem", margin: 0 }}>LearnPath AI</h1>
      <p style={{ fontSize: "1.25rem", color: "#aaa", marginTop: "0.5rem" }}>
        Learn anything. Faster.
      </p>
      <p style={{ marginTop: "2rem", color: "#555" }}>Coming Soon</p>

      <div
        style={{
          marginTop: "3rem",
          padding: "1rem 2rem",
          backgroundColor: "#1a1a1a",
          borderRadius: "8px",
          fontSize: "12px",
          color: "#666",
          textAlign: "center",
        }}
      >
        <p style={{ margin: "0 0 4px 0" }}>
          Status: <span style={{ color: "#22c55e" }}>Deployed</span>
        </p>
        <p style={{ margin: 0 }}>
          API:{" "}
          <code style={{ color: "#60a5fa" }}>
            {process.env.NEXT_PUBLIC_API_URL || "not configured"}
          </code>
        </p>
      </div>
    </div>
  );
}
