import React from "react";
import Head from "next/head";
import ConfidenceDashboard from "../../components/Admin/ConfidenceDashboard";

export default function ConfidenceAdminPage() {
  return (
    <>
      <Head>
        <title>Confidence · Admin · LearnPath AI</title>
      </Head>
      <ConfidenceDashboard />
    </>
  );
}
