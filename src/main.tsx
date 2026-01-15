import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import AppShell from "./AppShell";
import "./index.css";

const isGithubPages = window.location.hostname.endsWith("github.io");
const basename = import.meta.env.PROD && isGithubPages ? "/loop-ledger-v2" : "";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserRouter basename={basename}>
      <AppShell />
    </BrowserRouter>
  </React.StrictMode>
);
