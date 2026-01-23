import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import AppShell from "./AppShell";
import "./index.css";
import "./ui-kit/ui.css";

const rawBase = import.meta.env.BASE_URL;
const basename = rawBase === "./" ? "/" : rawBase;

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserRouter basename={basename}>
      <AppShell />
    </BrowserRouter>
  </React.StrictMode>
);
