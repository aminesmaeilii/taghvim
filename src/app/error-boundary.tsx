import { Component, type ErrorInfo, type ReactNode } from "react";
import { AlertTriangle, RotateCcw } from "lucide-react";

interface Props { children: ReactNode; }
interface State { hasError: boolean; }

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };
  static getDerivedStateFromError(): State { return { hasError: true }; }
  componentDidCatch(error: Error, info: ErrorInfo) { void error; void info; /* Technical error reporting is handled by the desktop runtime. */ }
  render() { if (this.state.hasError) return <main className="fatal-error" dir="rtl"><AlertTriangle size={30} /><h1>نمایش این بخش با مشکل روبه رو شد</h1><p>داده های شما حذف نشده اند. برنامه را تازه سازی کنید و اگر مشکل ادامه داشت، از پشتیبان بازیابی کنید.</p><button className="button button-primary" type="button" onClick={() => window.location.reload()}><RotateCcw size={17} />تازه سازی</button></main>; return this.props.children; }
}
