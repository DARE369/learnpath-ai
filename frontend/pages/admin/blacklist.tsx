import React from "react";
import Head from "next/head";
import BlacklistDashboard from "../../components/Admin/BlacklistDashboard";

export default function BlacklistAdminPage() {
  return (
    <>
      <Head>
        <title>Blacklist · Admin · LearnPath AI</title>
      </Head>
      <BlacklistDashboard />
    </>
  );
}
