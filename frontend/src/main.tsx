import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "@fontsource/vazirmatn/400.css";
import "@fontsource/vazirmatn/500.css";
import "@fontsource/vazirmatn/600.css";
import "@fontsource/vazirmatn/700.css";
import "./styles/app.css";
import { App } from "./app/app";

createRoot(document.getElementById("root")!).render(<StrictMode><App /></StrictMode>);
