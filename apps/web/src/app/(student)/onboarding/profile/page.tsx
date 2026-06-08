import type { Metadata } from "next";
import { ProfileSetupForm } from "./profile-form";

export const metadata: Metadata = {
  title: "Set up your profile",
};

export default function ProfilePage() {
  return <ProfileSetupForm />;
}
