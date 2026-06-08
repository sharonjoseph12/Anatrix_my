import type { Metadata } from "next";
import { CalendarConnectPanel } from "./calendar-connect";

export const metadata: Metadata = {
  title: "Connect Calendar",
};

export default function CalendarPage() {
  return <CalendarConnectPanel />;
}
